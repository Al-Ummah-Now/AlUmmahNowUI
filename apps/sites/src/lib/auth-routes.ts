/**
 * /auth/* on a scholar site: login (top-level redirect to auth), callback (code → sealed site
 * session), me (the header's state, with the 5-minute re-check), logout (local + auth sign-out).
 * The origin used for redirect_uri is the request's, and the Worker only lets a request through
 * on the site's primary host, so it is always the registered host.
 */
import type { APIContext } from 'astro';
import { isValidSecret, seal, unseal } from '../../../../packages/render/src/session';
import { isLocale, readCookie } from '../../../../packages/render/src/locale';
import {
  LOGIN_COOKIE,
  LOGIN_TTL_SEC,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  accountFromAccessToken,
  authorizeUrl,
  clearCookie,
  codeChallenge,
  cookie,
  exchangeCode,
  hintCookie,
  logoutUrl,
  needsRecheck,
  randomToken,
  refreshTokens,
  safeReturnPath,
  type LoginState,
  type SiteSession,
} from './auth';
import { config, type SitesEnv } from './env';
import { siteFromRequest } from './site';

type Ctx = Pick<APIContext, 'request' | 'locals' | 'url'>;

const noStore = { 'Cache-Control': 'private, no-store' };

function envOf(ctx: Ctx): SitesEnv {
  return (ctx.locals as { runtime?: { env?: SitesEnv } }).runtime?.env ?? {};
}

function redirect(location: string, cookies: string[] = [], status = 302): Response {
  const headers = new Headers({ Location: location, ...noStore });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status, headers });
}

function json(body: unknown, cookies: string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', ...noStore });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { headers });
}

export async function readSession(ctx: Ctx): Promise<SiteSession | null> {
  const secret = envOf(ctx).SESSION_SECRET;
  if (!isValidSecret(secret)) return null;
  return unseal<SiteSession>(secret, readCookie(ctx.request.headers.get('Cookie'), SESSION_COOKIE));
}

export async function login(ctx: Ctx): Promise<Response> {
  const env = envOf(ctx);
  const site = siteFromRequest(ctx.request);
  if (!site || !isValidSecret(env.SESSION_SECRET)) return new Response('Sign-in is not available', { status: 503, headers: noStore });
  const cfg = config(env);
  const lang = ctx.url.searchParams.get('lang');
  const locale = isLocale(lang) && site.site.locales.includes(lang) ? lang : site.site.locales[0] ?? 'en';
  const returnTo = safeReturnPath(ctx.url.searchParams.get('return'), `/${locale}/`);
  const state = randomToken();
  const verifier = randomToken(48);
  const login: LoginState = { state, verifier, returnTo, exp: Math.floor(Date.now() / 1000) + LOGIN_TTL_SEC };
  const sealed = await seal(env.SESSION_SECRET, login as never);
  return redirect(authorizeUrl(cfg, ctx.url.origin, state, await codeChallenge(verifier), locale), [cookie(LOGIN_COOKIE, sealed, LOGIN_TTL_SEC)]);
}

export async function callback(ctx: Ctx, fetcher: typeof fetch = fetch, getKey?: Parameters<typeof accountFromAccessToken>[2]): Promise<Response> {
  const env = envOf(ctx);
  const site = siteFromRequest(ctx.request);
  const home = `/${site?.site.locales[0] ?? 'en'}/`;
  if (!site || !isValidSecret(env.SESSION_SECRET)) return new Response('Sign-in is not available', { status: 503, headers: noStore });
  const cfg = config(env);
  const state = await unseal<LoginState>(env.SESSION_SECRET, readCookie(ctx.request.headers.get('Cookie'), LOGIN_COOKIE));
  const clearLogin = clearCookie(LOGIN_COOKIE);
  const code = ctx.url.searchParams.get('code');
  if (!state || !code || ctx.url.searchParams.get('state') !== state.state) return redirect(state?.returnTo ?? home, [clearLogin]);
  const tokens = await exchangeCode(cfg, ctx.url.origin, code, state.verifier, fetcher).catch(() => null);
  if (!tokens) return redirect(state.returnTo, [clearLogin]);
  let account: Awaited<ReturnType<typeof accountFromAccessToken>>;
  try {
    account = await accountFromAccessToken(tokens.access_token, cfg, getKey);
  } catch {
    return redirect(state.returnTo, [clearLogin]);
  }
  const now = Math.floor(Date.now() / 1000);
  const session: SiteSession = { ...account, rt: tokens.refresh_token, checked: now, exp: now + SESSION_TTL_SEC };
  return redirect(state.returnTo, [clearLogin, cookie(SESSION_COOKIE, await seal(env.SESSION_SECRET, session as never), SESSION_TTL_SEC), hintCookie(true)], 303);
}

/** The header asks on every page; a session older than RECHECK_SEC is checked with auth first. */
export async function me(ctx: Ctx, fetcher: typeof fetch = fetch): Promise<Response> {
  const env = envOf(ctx);
  const session = await readSession(ctx);
  if (!session) return json({ signedIn: false }, readCookie(ctx.request.headers.get('Cookie'), SESSION_COOKIE) ? [clearCookie(SESSION_COOKIE), hintCookie(false)] : []);
  if (!needsRecheck(session)) return json({ signedIn: true, name: session.name });
  const cfg = config(env);
  const tokens = await refreshTokens(cfg, session.rt, fetcher).catch(() => undefined);
  if (tokens === undefined) return json({ signedIn: true, name: session.name }); // auth unreachable: keep it, try next time
  if (!tokens) return json({ signedIn: false }, [clearCookie(SESSION_COOKIE), hintCookie(false)]); // signed out elsewhere
  const now = Math.floor(Date.now() / 1000);
  const renewed: SiteSession = { ...session, rt: tokens.refresh_token, checked: now };
  const left = Math.max(1, session.exp - now);
  return json({ signedIn: true, name: session.name }, [cookie(SESSION_COOKIE, await seal(env.SESSION_SECRET as string, renewed as never), left)]);
}

/** POST from the header's form (same origin only): ends the site session, then auth's. */
export async function logout(ctx: Ctx): Promise<Response> {
  const site = siteFromRequest(ctx.request);
  const origin = ctx.request.headers.get('Origin');
  if (ctx.request.method !== 'POST' || (origin && origin !== ctx.url.origin)) return new Response('Forbidden', { status: 403, headers: noStore });
  const form = await ctx.request.formData().catch(() => null);
  const back = safeReturnPath(form?.get('return')?.toString(), `/${site?.site.locales[0] ?? 'en'}/`);
  const cfg = config(envOf(ctx));
  return redirect(logoutUrl(cfg, `${ctx.url.origin}${back}`), [clearCookie(SESSION_COOKIE), clearCookie(LOGIN_COOKIE), hintCookie(false)], 303);
}
