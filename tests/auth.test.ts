import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from 'jose';
import { describe, expect, it } from 'vitest';
import { canEditContent, codeChallenge, normalizeRole, parsePrompt, safeReturnPath, sessionFromAccessToken, LOGIN_COOKIE, SESSION_COOKIE } from '../src/lib/auth';
import { callback, login, logout, me } from '../src/lib/auth-routes';
import { config } from '../src/lib/env';
import { readCookie } from '../src/lib/locale';
import { seal, unseal } from '../src/lib/session';

const SECRET = 'a'.repeat(64);
const cfg = config({ APP_ENV: 'qa', SITE_URL: 'https://www.qa.alummahnow.net', AUTH_URL: 'https://auth.qa.alummahnow.net', WWW_CLIENT_ID: 'ecda6f18-89cb-415c-b746-7e77184d75a2' });

describe('return-path guard', () => {
  it.each([
    ['/ar/articles/?page=2', '/ar/articles/?page=2'],
    ['/en/about/#team', '/en/about/#team'],
    ['https://evil.example/', '/'],
    ['//evil.example/', '/'],
    ['/\\evil.example', '/'],
    ['\\\\evil', '/'],
    ['javascript:alert(1)', '/'],
    ['/en/\nSet-Cookie:x', '/'],
    ['/auth/logout', '/'],
    ['', '/'],
    [null, '/'],
    ['/' + 'a'.repeat(600), '/'],
    ['/%2F%2Fevil.example', '/%2F%2Fevil.example'],
    ['/..//evil.example', '/'],
    ['/.//evil.example', '/'],
    ['/a/../..//evil.example/x', '/'],
    ['/en/../ar/articles/', '/ar/articles/'],
  ])('%s → %s', (input, expected) => {
    expect(safeReturnPath(input as string | null)).toBe(expected);
  });
});

describe('roles', () => {
  it('normalizes display names', () => {
    expect(normalizeRole(' Super Admin ')).toBe('super_admin');
    expect(normalizeRole('content-editor')).toBe('content_editor');
  });
  it('CMS link only for super_admin, admin, moderator, scholar', () => {
    expect(canEditContent(['Scholar', 'Member'])).toBe(true);
    expect(canEditContent(['Super Admin'])).toBe(true);
    expect(canEditContent(['Admin'])).toBe(true);
    expect(canEditContent(['moderator'])).toBe(true);
    expect(canEditContent(['Viewer', 'Creator'])).toBe(false);
    expect(canEditContent([])).toBe(false);
  });
});

describe('session crypto', () => {
  it('round-trips and rejects tampering, expiry and other keys', async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = await seal(SECRET, { sub: 'u1', exp });
    expect(await unseal(SECRET, token)).toEqual({ sub: 'u1', exp });
    const flipped = token.slice(0, -2) + (token.at(-2) === 'A' ? 'B' : 'A') + token.at(-1);
    expect(await unseal(SECRET, flipped)).toBeNull();
    expect(await unseal('b'.repeat(64), token)).toBeNull();
    expect(await unseal(SECRET, token, exp + 1)).toBeNull();
    expect(await unseal(SECRET, 'garbage')).toBeNull();
  });
  it('refuses a malformed secret', async () => {
    await expect(seal('short', { exp: 1 })).rejects.toThrow();
  });
  it('produces different ciphertexts for the same payload (random IV)', async () => {
    expect(await seal(SECRET, { exp: 1 })).not.toBe(await seal(SECRET, { exp: 1 }));
  });
});

describe('PKCE login', () => {
  it('redirects to /authorize with client_id, exact redirect_uri and an S256 challenge of the stored verifier', async () => {
    const res = await login(new Request('https://www.qa.alummahnow.net/auth/login?return=/ar/articles/'), { cfg, secret: SECRET });
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get('Location')!);
    expect(url.origin + url.pathname).toBe('https://auth.qa.alummahnow.net/authorize');
    expect(url.searchParams.get('client_id')).toBe('ecda6f18-89cb-415c-b746-7e77184d75a2');
    expect(url.searchParams.get('redirect_uri')).toBe('https://www.qa.alummahnow.net/auth/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const setCookie = res.headers.get('Set-Cookie')!;
    expect(setCookie).toMatch(/^__Host-aun_www_login=.+; Path=\/; Max-Age=600; HttpOnly; Secure; SameSite=Lax$/);
    const state = await unseal<{ state: string; verifier: string; returnTo: string; exp: number }>(SECRET, readCookie(setCookie, LOGIN_COOKIE));
    expect(state?.returnTo).toBe('/ar/articles/');
    expect(url.searchParams.get('state')).toBe(state?.state);
    expect(url.searchParams.get('code_challenge')).toBe(await codeChallenge(state!.verifier));
    // The sign-in page takes its language from ?lang= only: an Arabic page signs in in Arabic
    expect(url.searchParams.get('lang')).toBe('ar');
  });
  it('guards the return path', async () => {
    const res = await login(new Request('https://www.qa.alummahnow.net/auth/login?return=https://evil.example'), { cfg, secret: SECRET });
    const state = await unseal<{ returnTo: string; exp: number }>(SECRET, readCookie(res.headers.get('Set-Cookie'), LOGIN_COOKIE));
    expect(state?.returnTo).toBe('/');
  });
  it('never adds a prompt by default (auth decides: silent for the active account, else the form)', async () => {
    const res = await login(new Request('https://www.qa.alummahnow.net/auth/login?return=/en/'), { cfg, secret: SECRET });
    expect(new URL(res.headers.get('Location')!).searchParams.has('prompt')).toBe(false);
  });
  it.each([
    ['none', 'none', true],
    ['login', 'login', undefined],
    ['select_account', null, undefined],
    ['consent', null, undefined],
  ])('prompt=%s → authorize prompt %s', async (input, expected, silent) => {
    const res = await login(new Request(`https://www.qa.alummahnow.net/auth/login?prompt=${input}&return=/en/articles/`), { cfg, secret: SECRET });
    expect(new URL(res.headers.get('Location')!).searchParams.get('prompt')).toBe(expected);
    const state = await unseal<{ returnTo: string; silent?: boolean; exp: number }>(SECRET, readCookie(res.headers.get('Set-Cookie'), LOGIN_COOKIE));
    expect(state?.returnTo).toBe('/en/articles/');
    expect(state?.silent).toBe(silent);
  });
  it('parsePrompt accepts only none and login', () => {
    expect(parsePrompt('none')).toBe('none');
    expect(parsePrompt('login')).toBe('login');
    expect(parsePrompt('select_account')).toBeUndefined();
    expect(parsePrompt(null)).toBeUndefined();
  });
  it('is 503 without a valid SESSION_SECRET', async () => {
    expect((await login(new Request('https://www.qa.alummahnow.net/auth/login'), { cfg, secret: undefined })).status).toBe(503);
  });
});

describe('callback, me, logout', () => {
  async function loginCookie(prompt = '') {
    const res = await login(new Request(`https://www.qa.alummahnow.net/auth/login?return=/en/articles/${prompt ? `&prompt=${prompt}` : ''}`), { cfg, secret: SECRET });
    const cookie = res.headers.get('Set-Cookie')!.split(';')[0]!;
    const state = new URL(res.headers.get('Location')!).searchParams.get('state')!;
    return { cookie, state };
  }

  it('exchanges the code with the verifier, sets an 8h session and returns', async () => {
    const { cookie, state } = await loginCookie();
    let body = '';
    const res = await callback(new Request(`https://www.qa.alummahnow.net/auth/callback?code=c1&state=${state}`, { headers: { Cookie: cookie } }), {
      cfg,
      secret: SECRET,
      fetchImpl: (async (_url: string, init: RequestInit) => {
        body = String(init.body);
        return new Response(JSON.stringify({ access_token: 'tok' }));
      }) as never,
      verify: async () => ({ sub: 'u1', name: 'Amina', email: 'a@x', roles: ['Admin'] }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/en/articles/');
    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('redirect_uri')).toBe('https://www.qa.alummahnow.net/auth/callback');
    expect(params.get('client_id')).toBe(cfg.clientId);
    expect(params.get('code_verifier')).toBeTruthy();
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith(`${LOGIN_COOKIE}=;`))).toBe(true);
    const session = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(session).toContain('Max-Age=28800');
    expect(session).not.toContain('tok');

    const meRes = await me(new Request('https://www.qa.alummahnow.net/auth/me', { headers: { Cookie: session.split(';')[0]! } }), { cfg, secret: SECRET });
    expect(meRes.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await meRes.json()).toEqual({ signedIn: true, sub: 'u1', name: 'Amina', email: 'a@x', roles: ['Admin'], canEditContent: true });
  });

  it('rejects a state mismatch by restarting sign-in', async () => {
    const { cookie } = await loginCookie();
    const res = await callback(new Request('https://www.qa.alummahnow.net/auth/callback?code=c1&state=wrong', { headers: { Cookie: cookie } }), { cfg, secret: SECRET });
    expect(res.headers.get('Location')).toMatch(/^\/auth\/login\?return=/);
  });

  it('silent sign-in: error=login_required returns to the page anonymously (no error page, no retry)', async () => {
    const { cookie, state } = await loginCookie('none');
    const res = await callback(new Request(`https://www.qa.alummahnow.net/auth/callback?error=login_required&state=${state}`, { headers: { Cookie: cookie } }), { cfg, secret: SECRET });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/en/articles/');
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith(`${LOGIN_COOKIE}=;`))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(false);
  });

  it('silent sign-in: a state mismatch or failed token exchange also just returns', async () => {
    const { cookie, state } = await loginCookie('none');
    const mismatch = await callback(new Request('https://www.qa.alummahnow.net/auth/callback?code=c1&state=wrong', { headers: { Cookie: cookie } }), { cfg, secret: SECRET });
    expect(mismatch.headers.get('Location')).toBe('/en/articles/');
    const failed = await callback(new Request(`https://www.qa.alummahnow.net/auth/callback?code=c1&state=${state}`, { headers: { Cookie: cookie } }), {
      cfg,
      secret: SECRET,
      fetchImpl: (async () => new Response('nope', { status: 400 })) as never,
    });
    expect(failed.status).toBe(302);
    expect(failed.headers.get('Location')).toBe('/en/articles/');
  });

  it('silent sign-in with a code creates the session like a normal sign-in', async () => {
    const { cookie, state } = await loginCookie('none');
    const res = await callback(new Request(`https://www.qa.alummahnow.net/auth/callback?code=c1&state=${state}`, { headers: { Cookie: cookie } }), {
      cfg,
      secret: SECRET,
      fetchImpl: (async () => new Response(JSON.stringify({ access_token: 'tok' }))) as never,
      verify: async () => ({ sub: 'u1', name: null, email: 'a@x', roles: [] }),
    });
    expect(res.headers.get('Location')).toBe('/en/articles/');
    expect(res.headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(true);
  });

  it('interactive sign-in: a failed token exchange still shows the error', async () => {
    const { cookie, state } = await loginCookie();
    const res = await callback(new Request(`https://www.qa.alummahnow.net/auth/callback?code=c1&state=${state}`, { headers: { Cookie: cookie } }), {
      cfg,
      secret: SECRET,
      fetchImpl: (async () => new Response('nope', { status: 400 })) as never,
    });
    expect(res.status).toBe(502);
  });

  it('/auth/me is signed out without a cookie', async () => {
    const res = await me(new Request('https://www.qa.alummahnow.net/auth/me'), { cfg, secret: SECRET });
    expect(await res.json()).toEqual({ signedIn: false });
  });

  it('logout POST requires same origin and redirects to auth /logout with a return to www', async () => {
    const forged = await logout(new Request('https://www.qa.alummahnow.net/auth/logout', { method: 'POST', headers: { Origin: 'https://evil.example' } }), { cfg, secret: SECRET });
    expect(forged.status).toBe(403);
    const body = new URLSearchParams({ locale: 'ar' });
    const ok = await logout(new Request('https://www.qa.alummahnow.net/auth/logout', { method: 'POST', body, headers: { Origin: 'https://www.qa.alummahnow.net', 'Content-Type': 'application/x-www-form-urlencoded' } }), { cfg, secret: SECRET });
    expect(ok.status).toBe(303);
    expect(ok.headers.get('Location')).toBe('https://auth.qa.alummahnow.net/logout?return=https%3A%2F%2Fwww.qa.alummahnow.net%2Far%2F');
    expect(ok.headers.get('Set-Cookie')).toContain(`${SESSION_COOKIE}=; Path=/; Max-Age=0`);
  });

  it('front-channel GET follows next only on the auth origin', async () => {
    const good = await logout(new Request('https://www.qa.alummahnow.net/auth/logout?next=https%3A%2F%2Fauth.qa.alummahnow.net%2Flogout%3Fstep%3D2'), { cfg, secret: SECRET });
    expect(good.headers.get('Location')).toBe('https://auth.qa.alummahnow.net/logout?step=2');
    const bad = await logout(new Request('https://www.qa.alummahnow.net/auth/logout?next=https%3A%2F%2Fevil.example'), { cfg, secret: SECRET });
    expect(bad.headers.get('Location')).toBe('https://auth.qa.alummahnow.net/logout?return=https%3A%2F%2Fwww.qa.alummahnow.net%2Fen%2F');
    const notLogout = await logout(new Request('https://www.qa.alummahnow.net/auth/logout?next=https%3A%2F%2Fauth.qa.alummahnow.net%2Fauthorize'), { cfg, secret: SECRET });
    expect(notLogout.headers.get('Location')).toBe('https://auth.qa.alummahnow.net/logout?return=https%3A%2F%2Fwww.qa.alummahnow.net%2Fen%2F');
  });

  it('a GET without next is single sign-out (not www alone), back to the page language', async () => {
    const res = await logout(new Request('https://www.qa.alummahnow.net/auth/logout?locale=ar'), { cfg, secret: SECRET });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://auth.qa.alummahnow.net/logout?return=https%3A%2F%2Fwww.qa.alummahnow.net%2Far%2F');
    expect(res.headers.get('Set-Cookie')).toContain(`${SESSION_COOKIE}=; Path=/; Max-Age=0`);
  });
});

describe('access token verification', () => {
  it('accepts a valid token from the issuer and maps properties', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k', alg: 'ES256' }] });
    const sign = (iss: string, exp = '1h') =>
      new SignJWT({ mode: 'access', type: 'user', properties: { id: 'u1', email: 'a@x', name: 'Amina', roles: ['Moderator'] } })
        .setProtectedHeader({ alg: 'ES256', kid: 'k' })
        .setSubject('user:u1').setIssuer(iss).setAudience('x').setIssuedAt().setExpirationTime(exp)
        .sign(privateKey);
    expect(await sessionFromAccessToken(await sign(cfg.authUrl), cfg, jwks)).toEqual({ sub: 'u1', name: 'Amina', email: 'a@x', roles: ['Moderator'] });
    await expect(sessionFromAccessToken(await sign('https://evil.example'), cfg, jwks)).rejects.toThrow();
    await expect(sessionFromAccessToken(await sign(cfg.authUrl, '-1m'), cfg, jwks)).rejects.toThrow();
  });
});
