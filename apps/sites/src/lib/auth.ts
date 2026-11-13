/**
 * Sign-in on a scholar site (wiki AUN-SCHOLAR-SITES §5.4, SS11). Sites are on alummahnow.org or the
 * scholar's own domain, a different site from auth.alummahnow.net, so there is no silent background
 * check (a third-party request browsers drop the cookie of). Instead:
 *   1. "Sign in" is a top-level redirect to auth /authorize (PKCE S256, the sites client, this
 *      host's exact /auth/callback). A browser already signed in to Al Ummah Now comes straight
 *      back with a code: one click, no password.
 *   2. The callback exchanges the code and keeps a sealed, host-only `__Host-aun_site` session
 *      (8 h) holding the refresh token.
 *   3. Every RECHECK_SEC the session is refreshed at auth /token; a sign-out anywhere revokes the
 *      refresh token, so the site session ends within 5 minutes of it.
 * Cookies are always host-only (`__Host-`, no Domain): never set for all of alummahnow.org.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { b64url } from '../../../../packages/render/src/session';
import type { Config } from './env';

export const SESSION_COOKIE = '__Host-aun_site';
export const LOGIN_COOKIE = '__Host-aun_site_login';
export const SESSION_TTL_SEC = 8 * 60 * 60;
export const LOGIN_TTL_SEC = 10 * 60;
/** How often a site session is checked against auth (sign-out elsewhere ends it within this). */
export const RECHECK_SEC = 5 * 60;
/** Readable by scripts, not a secret: "this browser has a session here" (header state before /auth/me). */
export const SIGNED_IN_HINT = 'aun_site_si';

export interface SiteSession {
  sub: string;
  name: string | null;
  email: string | null;
  /** The refresh token: lets the site re-check the account every RECHECK_SEC. */
  rt: string;
  /** Unix seconds of the last successful check. */
  checked: number;
  exp: number;
}

export interface LoginState {
  state: string;
  verifier: string;
  returnTo: string;
  exp: number;
}

/** Only a same-site relative path survives ("/ar/posts/?page=2"); anything else → fallback. */
export function safeReturnPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || raw.length > 512) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const base = 'https://return.invalid';
    const url = new URL(raw, base);
    if (url.origin !== base || url.pathname.startsWith('/auth/')) return fallback;
    const out = `${url.pathname}${url.search}${url.hash}`;
    if (!out.startsWith('/') || out.startsWith('//') || out.includes('\\')) return fallback;
    return out;
  } catch {
    return fallback;
  }
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

/** This host's callback: registered nowhere, auth checks the host against the site registry (exact host). */
export const redirectUri = (origin: string) => `${origin}/auth/callback`;

export function authorizeUrl(cfg: Config, origin: string, state: string, challenge: string, locale: string): string {
  const url = new URL(`${cfg.authUrl}/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', redirectUri(origin));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('lang', locale);
  url.searchParams.set('ui_locales', locale);
  return url.toString();
}

export function logoutUrl(cfg: Config, returnTo: string): string {
  const url = new URL(`${cfg.authUrl}/logout`);
  url.searchParams.set('return', returnTo);
  return url.toString();
}

const jwks = new Map<string, JWTVerifyGetKey>();
function remoteJwks(authUrl: string): JWTVerifyGetKey {
  let set = jwks.get(authUrl);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`), { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 });
    jwks.set(authUrl, set);
  }
  return set;
}

interface AccessClaims {
  mode?: string;
  sub?: string;
  properties?: { id?: string; email?: string; name?: string };
}

/** Verifies an access token (JWKS signature, issuer, exp) and returns the account fields. */
export async function accountFromAccessToken(token: string, cfg: Config, getKey: JWTVerifyGetKey = remoteJwks(cfg.authUrl)): Promise<{ sub: string; name: string | null; email: string | null }> {
  const { payload } = await jwtVerify<AccessClaims>(token, getKey, { issuer: cfg.authUrl, requiredClaims: ['exp', 'sub'] });
  if (payload.mode && payload.mode !== 'access') throw new Error('not an access token');
  const p = payload.properties ?? {};
  return {
    sub: String(p.id ?? payload.sub),
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 120) : null,
    email: typeof p.email === 'string' ? p.email.slice(0, 200) : null,
  };
}

export interface TokenAnswer {
  access_token: string;
  refresh_token: string;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function tokenCall(cfg: Config, body: URLSearchParams, fetcher: Fetcher): Promise<TokenAnswer | null> {
  const res = await fetcher(`${cfg.authUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(5_000),
  });
  // Auth itself failing is not a sign-out: the caller keeps the session and tries again later
  if (res.status >= 500) throw new Error(`auth answered ${res.status}`);
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as Partial<TokenAnswer> | null;
  return json && typeof json.access_token === 'string' && typeof json.refresh_token === 'string' ? { access_token: json.access_token, refresh_token: json.refresh_token } : null;
}

export function exchangeCode(cfg: Config, origin: string, code: string, verifier: string, fetcher: Fetcher = fetch): Promise<TokenAnswer | null> {
  return tokenCall(cfg, new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(origin), client_id: cfg.clientId, code_verifier: verifier }), fetcher);
}

/** null: the refresh token was revoked (signed out elsewhere) or expired. */
export function refreshTokens(cfg: Config, refreshToken: string, fetcher: Fetcher = fetch): Promise<TokenAnswer | null> {
  return tokenCall(cfg, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: cfg.clientId }), fetcher);
}

export const needsRecheck = (session: SiteSession, nowSec = Math.floor(Date.now() / 1000)) => nowSec - session.checked >= RECHECK_SEC;

/** Host-only: `__Host-` names require Secure, Path=/ and no Domain (localhost allows Secure over http). */
export function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearCookie = (name: string) => cookie(name, '', 0);
export const hintCookie = (on: boolean) => `${SIGNED_IN_HINT}=${on ? '1' : ''}; Path=/; Max-Age=${on ? SESSION_TTL_SEC : 0}; Secure; SameSite=Lax`;
