/**
 * Sign-in as a public OAuth client with PKCE S256 (SPEC §7). No client secret and no
 * tokens are kept: the session cookie holds only { sub, name, email, roles, exp }.
 *
 * Session lifetime: www never calls an API with the access token, so the 15-minute
 * access-token lifetime does not bound the www session; it lives SESSION_TTL_SEC. When it
 * ends while auth still has the browser signed in, the header's client probe signs in
 * again silently (prompt=none), so a live auth session never shows "Sign in" on www.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Config } from './env';
import { b64url } from './session';

export const SESSION_COOKIE = '__Host-aun_www';
export const LOGIN_COOKIE = '__Host-aun_www_login';
export const SESSION_TTL_SEC = 8 * 60 * 60;
export const LOGIN_TTL_SEC = 10 * 60;

export interface Session {
  sub: string;
  name: string | null;
  email: string | null;
  roles: string[];
  exp: number;
}

export interface LoginState {
  state: string;
  verifier: string;
  returnTo: string;
  exp: number;
  /** prompt=none: any failure returns to `returnTo` anonymously (no error page, no retry). */
  silent?: boolean;
}

/**
 * OIDC prompt values www forwards to /authorize. `none` = silent sign-in (client probe,
 * account switch), `login` = "Add another account". Anything else (including
 * select_account) is dropped: the normal sign-in path never forces a chooser.
 */
export type Prompt = 'none' | 'login';
export function parsePrompt(raw: string | null | undefined): Prompt | undefined {
  return raw === 'none' || raw === 'login' ? raw : undefined;
}

/**
 * Open-redirect guard: only a same-site relative path survives ("/ar/articles/?page=2").
 * Anything absolute, protocol-relative, backslashed or with control characters → fallback.
 */
export function safeReturnPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || raw.length > 512) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const base = 'https://return.invalid';
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    if (url.pathname.startsWith('/auth/')) return fallback;
    // Check the normalised result too: '/..//evil.example' normalises to '//evil.example'
    const out = `${url.pathname}${url.search}${url.hash}`;
    if (!out.startsWith('/') || out.startsWith('//') || out.includes('\\')) return fallback;
    return out;
  } catch {
    return fallback;
  }
}

/** "Super Admin" → "super_admin", "content-editor" → "content_editor" */
export function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

const EDITOR_ROLES = new Set(['super_admin', 'admin', 'moderator']);
export function canEditContent(roles: readonly string[]): boolean {
  return roles.some((r) => EDITOR_ROLES.has(normalizeRole(r)));
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

export const redirectUri = (cfg: Config) => `${cfg.siteUrl}/auth/callback`;

export function authorizeUrl(cfg: Config, state: string, challenge: string, locale?: string, prompt?: Prompt): string {
  const url = new URL(`${cfg.authUrl}/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', redirectUri(cfg));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (locale) url.searchParams.set('ui_locales', locale);
  if (prompt) url.searchParams.set('prompt', prompt);
  return url.toString();
}

export function tokenRequestBody(cfg: Config, code: string, verifier: string): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(cfg),
    client_id: cfg.clientId,
    code_verifier: verifier,
  });
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
  type?: string;
  sub?: string;
  properties?: { id?: string; email?: string; name?: string; roles?: unknown };
}

/** Verifies an access token (signature via JWKS, iss, exp) and extracts the session fields. */
export async function sessionFromAccessToken(
  token: string,
  cfg: Config,
  getKey: JWTVerifyGetKey = remoteJwks(cfg.authUrl),
): Promise<Omit<Session, 'exp'>> {
  const { payload } = await jwtVerify<AccessClaims>(token, getKey, { issuer: cfg.authUrl, requiredClaims: ['exp', 'sub'] });
  if (payload.mode && payload.mode !== 'access') throw new Error('not an access token');
  const p = payload.properties ?? {};
  const roles = Array.isArray(p.roles) ? p.roles.filter((r): r is string => typeof r === 'string').slice(0, 20) : [];
  return {
    sub: String(p.id ?? payload.sub),
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 120) : null,
    email: typeof p.email === 'string' ? p.email.slice(0, 200) : null,
    roles,
  };
}

export function cookie(name: string, value: string, maxAge: number, path = '/'): string {
  // __Host-: Secure, Path=/, no Domain (browsers allow Secure cookies on http://localhost)
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearCookie = (name: string) => cookie(name, '', 0);
