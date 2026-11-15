/**
 * /auth/* handlers (SPEC §7), written against plain Request/Response so they are
 * unit-testable without Astro. The pages under src/pages/auth/ only delegate here.
 */
import {
  LOGIN_COOKIE,
  LOGIN_TTL_SEC,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  SESSION_VERSION,
  authorizeUrl,
  canEditContent,
  clearCookie,
  codeChallenge,
  cookie,
  hintCookie,
  logoutUrl,
  parsePrompt,
  randomToken,
  safeReturnPath,
  sessionFromAccessToken,
  tokenRequestBody,
  type LoginState,
  type Session,
} from './auth';
// The header's name (one source with the scholar sites): packages/render/src/profile-name.ts
export { fetchOwnProfile, fetchProfile, mergeProfile, profileNames, resolveDisplayName, type MeProfile } from '../../../../packages/render/src/profile-name';
import type { Config } from './env';
import { fetchOwnProfile, fetchProfile, mergeProfile } from '../../../../packages/render/src/profile-name';
import { isLocale, localeFromPath, readCookie } from './locale';
import { isValidSecret, seal, unseal } from './session';

const noStore = { 'Cache-Control': 'private, no-store' };
/**
 * A silent sign-in that failed on auth's side (an auth hiccup, not "signed out"): the page's probe
 * (account-sync.ts PROBE_RETRY_COOKIE) clears its "checked" mark and asks again, at most
 * SILENT_ATTEMPTS_MAX round trips per tab. Readable by scripts, short-lived, not a secret.
 */
const probeRetryCookie = 'aun_www_probe_retry=1; Path=/; Max-Age=120; Secure; SameSite=Lax';
const redirect = (location: string, status = 302, extra: Record<string, string> = {}, cookies: string[] = []) => {
  const h = new Headers({ Location: location, ...noStore, ...extra });
  for (const c of cookies) h.append('Set-Cookie', c);
  return new Response(null, { status, headers: h });
};
const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...noStore } });

export interface AuthDeps {
  cfg: Config;
  secret: string | undefined;
  fetchImpl?: typeof fetch;
  /** Token → session fields (verifies signature, iss, exp). Injected in tests. */
  verify?: (token: string) => Promise<Omit<Session, 'exp'>>;
  now?: () => number;
}

export async function login(request: Request, deps: AuthDeps): Promise<Response> {
  if (!isValidSecret(deps.secret)) return text('Sign-in is not configured (SESSION_SECRET).', 503);
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get('return'), '/');
  const prompt = parsePrompt(url.searchParams.get('prompt'));
  const state = randomToken();
  const verifier = randomToken(48);
  const exp = Math.floor((deps.now?.() ?? Date.now()) / 1000) + LOGIN_TTL_SEC;
  const loginState: LoginState = { state, verifier, returnTo, exp };
  if (prompt === 'none') loginState.silent = true;
  const sealed = await seal(deps.secret, { ...loginState });
  const locale = localeFromPath(returnTo) ?? undefined;
  return redirect(authorizeUrl(deps.cfg, state, await codeChallenge(verifier), locale, prompt), 302, {}, [cookie(LOGIN_COOKIE, sealed, LOGIN_TTL_SEC)]);
}

export async function callback(request: Request, deps: AuthDeps): Promise<Response> {
  if (!isValidSecret(deps.secret)) return text('Sign-in is not configured (SESSION_SECRET).', 503);
  const url = new URL(request.url);
  const login = await unseal<LoginState>(deps.secret, readCookie(request.headers.get('Cookie'), LOGIN_COOKIE));
  const fallback = login?.returnTo ?? '/';
  const clearLogin = clearCookie(LOGIN_COOKIE);
  // The user cancelled or auth refused (prompt=none → error=login_required): back where
  // they came from, unchanged. No error page and no retry, so a silent probe cannot loop.
  // Auth's own trouble (server_error, temporarily_unavailable) is no answer: the page asks again.
  const authError = url.searchParams.get('error');
  if (authError) {
    const transient = login?.silent && (authError === 'server_error' || authError === 'temporarily_unavailable');
    return redirect(fallback, 302, {}, transient ? [clearLogin, probeRetryCookie] : [clearLogin]);
  }
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!login || !code || !state || state !== login.state) {
    if (login?.silent) return redirect(fallback, 302, {}, [clearLogin]);
    return redirect(`/auth/login?return=${encodeURIComponent(fallback)}`, 302, {}, [clearLogin]);
  }
  // A silent sign-in never ends on an error page: it just returns without a session, marked as
  // "not answered" (auth or its keys did not respond) so the page's probe tries again, a few times
  const failed = (transient: boolean) =>
    login.silent ? redirect(fallback, 302, {}, transient ? [clearLogin, probeRetryCookie] : [clearLogin]) : text('Sign-in failed. Please try again.', 502);

  let tokenJson: { access_token?: string };
  let tokenStatus = 0;
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${deps.cfg.authUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: tokenRequestBody(deps.cfg, code, login.verifier).toString(),
    });
    tokenStatus = res.status;
    if (!res.ok) throw new Error(`token endpoint ${res.status}`);
    tokenJson = (await res.json()) as { access_token?: string };
  } catch (error) {
    console.warn(JSON.stringify({ msg: 'sign-in: token exchange failed', error: String(error) }));
    // No answer (network) or auth's trouble (5xx, 429): ask again; a 4xx (bad or used code) is an answer
    return failed(tokenStatus === 0 || tokenStatus === 429 || tokenStatus >= 500);
  }
  if (!tokenJson.access_token) return failed(false);

  let fields: Omit<Session, 'exp'>;
  try {
    fields = await (deps.verify ?? ((t: string) => sessionFromAccessToken(t, deps.cfg)))(tokenJson.access_token);
  } catch (error) {
    console.warn(JSON.stringify({ msg: 'sign-in: token rejected', error: String(error) }));
    // The keys could not be fetched (auth unreachable) or the token is bad: let the page ask again (capped)
    return failed(true);
  }
  // The user's own profile (names are not in the public profile view): best effort, never blocks sign-in
  const profile = await fetchOwnProfile(tokenJson.access_token, deps.cfg, deps.fetchImpl);
  const exp = Math.floor((deps.now?.() ?? Date.now()) / 1000) + SESSION_TTL_SEC;
  const session = await seal(deps.secret, { ...fields, exp, v: SESSION_VERSION, profile } satisfies Session);
  return redirect(login.returnTo, 302, {}, [clearLogin, cookie(SESSION_COOKIE, session, SESSION_TTL_SEC), hintCookie(true)]);
}

export async function readSession(request: Request, secret: string | undefined): Promise<Session | null> {
  if (!isValidSecret(secret)) return null;
  const s = await unseal<Session>(secret, readCookie(request.headers.get('Cookie'), SESSION_COOKIE));
  return s && s.v === SESSION_VERSION ? s : null;
}

export async function me(request: Request, deps: AuthDeps): Promise<Response> {
  const s = await readSession(request, deps.secret);
  const profile = s ? mergeProfile(s.profile ?? null, await fetchProfile(s.sub, deps.cfg, deps.fetchImpl)) : null;
  const body = s
    ? {
        signedIn: true,
        sub: s.sub,
        name: s.name ?? s.email,
        email: s.email,
        roles: s.roles,
        canEditContent: canEditContent(s.roles),
        profile,
      }
    : { signedIn: false };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', ...noStore, Vary: 'Cookie' } });
}

/**
 * POST (the header's sign-out form): same-origin only, clears the session, then auth's
 * /logout ends the SSO session and returns to www.
 * GET ?next=<auth>/logout?...: auth's front-channel sign-out walking each app
 * (FRONTCHANNEL_LOGOUT_URLS); `next` must be auth's /logout.
 * GET without a valid `next` (a link to /auth/logout): single sign-out, like every other app.
 * Signing out of www alone would leave the other apps signed in.
 */
export async function logout(request: Request, deps: AuthDeps): Promise<Response> {
  const clear = [clearCookie(SESSION_COOKIE), hintCookie(false)];
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const next = url.searchParams.get('next');
    if (next) {
      try {
        const u = new URL(next);
        if (u.origin === new URL(deps.cfg.authUrl).origin && u.pathname === '/logout') return redirect(u.toString(), 302, {}, clear);
      } catch {
        // not a URL
      }
    }
    const l = url.searchParams.get('locale');
    const locale = isLocale(l) ? l : 'en';
    return redirect(logoutUrl(deps.cfg, `${deps.cfg.siteUrl}/${locale}/`), 302, {}, clear);
  }
  if (request.method !== 'POST') return text('Method not allowed', 405);
  const origin = request.headers.get('Origin');
  const site = new URL(deps.cfg.siteUrl).origin;
  if (origin !== site && origin !== new URL(request.url).origin) return text('Forbidden', 403);
  let locale = 'en';
  try {
    const form = await request.formData();
    const l = form.get('locale');
    if (isLocale(l)) locale = l;
  } catch {
    // no body
  }
  return redirect(logoutUrl(deps.cfg, `${deps.cfg.siteUrl}/${locale}/`), 303, {}, clear);
}
