/**
 * /auth/* handlers (SPEC §7), written against plain Request/Response so they are
 * unit-testable without Astro. The pages under src/pages/auth/ only delegate here.
 */
import {
  LOGIN_COOKIE,
  LOGIN_TTL_SEC,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  authorizeUrl,
  canEditContent,
  clearCookie,
  codeChallenge,
  cookie,
  logoutUrl,
  parsePrompt,
  randomToken,
  safeReturnPath,
  sessionFromAccessToken,
  tokenRequestBody,
  type LoginState,
  type Session,
} from './auth';
import type { Config } from './env';
import { isLocale, localeFromPath, readCookie } from './locale';
import { isValidSecret, seal, unseal } from './session';

const noStore = { 'Cache-Control': 'private, no-store' };
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
  if (url.searchParams.get('error')) return redirect(fallback, 302, {}, [clearLogin]);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!login || !code || !state || state !== login.state) {
    if (login?.silent) return redirect(fallback, 302, {}, [clearLogin]);
    return redirect(`/auth/login?return=${encodeURIComponent(fallback)}`, 302, {}, [clearLogin]);
  }
  // A silent sign-in never ends on an error page: it just returns without a session
  const failed = () => (login.silent ? redirect(fallback, 302, {}, [clearLogin]) : text('Sign-in failed. Please try again.', 502));

  let tokenJson: { access_token?: string };
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${deps.cfg.authUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: tokenRequestBody(deps.cfg, code, login.verifier).toString(),
    });
    if (!res.ok) throw new Error(`token endpoint ${res.status}`);
    tokenJson = (await res.json()) as { access_token?: string };
  } catch (error) {
    console.warn(JSON.stringify({ msg: 'sign-in: token exchange failed', error: String(error) }));
    return failed();
  }
  if (!tokenJson.access_token) return failed();

  let fields: Omit<Session, 'exp'>;
  try {
    fields = await (deps.verify ?? ((t: string) => sessionFromAccessToken(t, deps.cfg)))(tokenJson.access_token);
  } catch (error) {
    console.warn(JSON.stringify({ msg: 'sign-in: token rejected', error: String(error) }));
    return failed();
  }
  const exp = Math.floor((deps.now?.() ?? Date.now()) / 1000) + SESSION_TTL_SEC;
  const session = await seal(deps.secret, { ...fields, exp } satisfies Session);
  return redirect(login.returnTo, 302, {}, [clearLogin, cookie(SESSION_COOKIE, session, SESSION_TTL_SEC)]);
}

export async function readSession(request: Request, secret: string | undefined): Promise<Session | null> {
  if (!isValidSecret(secret)) return null;
  return unseal<Session>(secret, readCookie(request.headers.get('Cookie'), SESSION_COOKIE));
}

export async function me(request: Request, deps: AuthDeps): Promise<Response> {
  const s = await readSession(request, deps.secret);
  const body = s
    ? { signedIn: true, sub: s.sub, name: s.name ?? s.email, email: s.email, roles: s.roles, canEditContent: canEditContent(s.roles) }
    : { signedIn: false };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', ...noStore, Vary: 'Cookie' } });
}

/**
 * POST (the header's sign-out form): same-origin only, clears the session, then auth's
 * /logout ends the SSO session and returns to www.
 * GET ?next=<auth>/logout?...: auth's front-channel sign-out walking each app
 * (FRONTCHANNEL_LOGOUT_URLS); `next` must be on AUTH_URL.
 */
export async function logout(request: Request, deps: AuthDeps): Promise<Response> {
  const clear = clearCookie(SESSION_COOKIE);
  if (request.method === 'GET') {
    const next = new URL(request.url).searchParams.get('next');
    let target = '/';
    if (next) {
      try {
        const u = new URL(next);
        if (u.origin === new URL(deps.cfg.authUrl).origin) target = u.toString();
      } catch {
        // not a URL
      }
    }
    return redirect(target, 302, {}, [clear]);
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
  return redirect(logoutUrl(deps.cfg, `${deps.cfg.siteUrl}/${locale}/`), 303, {}, [clear]);
}
