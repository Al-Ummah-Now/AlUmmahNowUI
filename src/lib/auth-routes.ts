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
  type SessionProfile,
} from './auth';
import type { Config } from './env';
import { normalizeImageUrl } from './images';
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

/** The public profile fields the header shows (the videos site's profile, same record). */
export interface MeProfile {
  displayName: string | null;
  displayNameLocalized: Partial<Record<'en' | 'ar', string>>;
  handle: string | null;
  avatarUrl: string | null;
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

type Loc = 'en' | 'ar';
const LOCS: readonly Loc[] = ['en', 'ar'];
const joinName = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ').trim().slice(0, 120) || null;
const locOf = (v: unknown, l: Loc) => (v && typeof v === 'object' ? str((v as Record<string, unknown>)[l], 120) : null);

/**
 * The names the videos site's profile holds, resolved the way it shows them: a display name
 * when one is set, else first + last name (per language, then the plain fields). In production
 * most profiles have only first/last names (displayName is ""), so both are needed.
 */
export function profileNames(p: Record<string, unknown>): SessionProfile {
  const names: SessionProfile['names'] = {};
  for (const l of LOCS) {
    const n = locOf(p.displayNameLocalized, l) ?? joinName(locOf(p.firstNameLocalized, l), locOf(p.lastNameLocalized, l));
    if (n) names[l] = n;
  }
  return {
    names,
    name: str(p.displayName, 120) ?? joinName(str(p.firstName, 60), str(p.lastName, 60)),
    handle: str(p.userName, 60)?.replace(/^@+/, '') || null,
    avatarUrl: normalizeImageUrl(str(p.avatarUrl, 500)),
  };
}

/** GET {VIDEOS_API}/api/profile with the user's access token (the full view, incl. first/last name). */
export async function fetchOwnProfile(accessToken: string, cfg: Config, fetchImpl: typeof fetch = fetch): Promise<SessionProfile | null> {
  try {
    const res = await fetchImpl(`${cfg.videosApiUrl}/api/profile`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ msg: 'sign-in: own profile unavailable', status: res.status }));
      return null;
    }
    const body = (await res.json()) as { result?: { profile?: unknown } } | null;
    const p = body?.result?.profile;
    return p && typeof p === 'object' ? profileNames(p as Record<string, unknown>) : null;
  } catch (error) {
    console.warn(JSON.stringify({ msg: 'sign-in: own profile failed', error: String(error) }));
    return null;
  }
}

/**
 * The signed-in user's public profile from the videos API (GET /api/profiles/:id, public; the
 * profile id is the auth user id). Short edge cache and timeout: the header falls back to the
 * session's name/email when the profile is missing or slow.
 */
export async function fetchProfile(sub: string, cfg: Config, fetchImpl: typeof fetch = fetch): Promise<MeProfile | null> {
  try {
    const init: RequestInit & { cf?: Record<string, unknown> } = {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(1500),
      cf: { cacheTtl: 60, cacheEverything: true },
    };
    const res = await fetchImpl(`${cfg.videosApiUrl}/api/profiles/${encodeURIComponent(sub)}`, init);
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: { profile?: Record<string, unknown> } } | null;
    const p = body?.result?.profile;
    if (!p || typeof p !== 'object') return null;
    const loc = (p.displayNameLocalized ?? {}) as Record<string, unknown>;
    const displayNameLocalized: MeProfile['displayNameLocalized'] = {};
    for (const l of ['en', 'ar'] as const) {
      const v = str(loc[l], 120);
      if (v) displayNameLocalized[l] = v;
    }
    return {
      displayName: str(p.displayName, 120),
      displayNameLocalized,
      handle: str(p.userName, 60)?.replace(/^@+/, '') || null,
      avatarUrl: normalizeImageUrl(str(p.avatarUrl, 500)),
    };
  } catch {
    return null;
  }
}

/**
 * The header's profile: the public view is fresh (60 s) but has no first/last name; the session
 * has the names from sign-in. Public values win when set (a display name or avatar changed since).
 */
export function mergeProfile(own: SessionProfile | null, pub: MeProfile | null): MeProfile | null {
  if (!own && !pub) return null;
  const displayNameLocalized: MeProfile['displayNameLocalized'] = {};
  for (const l of LOCS) {
    const n = pub?.displayNameLocalized[l] ?? own?.names[l];
    if (n) displayNameLocalized[l] = n;
  }
  return {
    displayName: pub?.displayName ?? own?.name ?? null,
    displayNameLocalized,
    handle: pub?.handle ?? own?.handle ?? null,
    avatarUrl: pub?.avatarUrl ?? own?.avatarUrl ?? null,
  };
}

export async function me(request: Request, deps: AuthDeps): Promise<Response> {
  const s = await readSession(request, deps.secret);
  const profile = s ? mergeProfile(s.profile ?? null, await fetchProfile(s.sub, deps.cfg, deps.fetchImpl)) : null;
  const body = s
    ? {
        signedIn: true,
        sub: s.sub,
        name: s.name ?? s.email,
        authName: s.name,
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
