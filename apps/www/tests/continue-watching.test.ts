import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE, SESSION_VERSION, type Session } from '../src/lib/auth';
import { callback, logout } from '../src/lib/auth-routes';
import { continueWatching, toContinueItems } from '../src/lib/continue-watching';
import { config } from '../src/lib/env';
import { readCookie } from '../src/lib/locale';
import { seal, unseal } from '../src/lib/session';

const SECRET = 'b'.repeat(64);
const cfg = config({ APP_ENV: 'qa', SITE_URL: 'https://www.qa.alummahnow.net', AUTH_URL: 'https://auth.qa.alummahnow.net', VIDEOS_API_URL: 'https://api.test', VIDEOS_WEB_URL: 'https://videos.test' });
const NOW = 1_800_000_000_000;
const nowSec = NOW / 1000;
const verify = async (t: string) => ({ sub: t.startsWith('other') ? 'u2' : 'u1', name: null, email: null, roles: [] });

const apiItem = (id: string, extra: Record<string, unknown> = {}) => ({
  videoId: id,
  position: 30,
  duration: 600,
  percentageWatched: 41.6,
  lastWatchedAt: '2026-11-10T00:00:00Z',
  video: { id, title: `Video ${id}`, thumbnailUrl: `https://img.test/${id}.jpg`, channelId: 'c1', channelName: 'Channel', channelNameLocalized: { ar: 'قناة' }, duration: 600, ...extra },
});

async function sessionCookie(tok: Session['tok'], v = SESSION_VERSION) {
  const s: Session = { sub: 'u1', name: null, email: null, roles: [], exp: nowSec + 3600, v, profile: null, tok };
  return `${SESSION_COOKIE}=${await seal(SECRET, { ...s })}`;
}

function api(opts: { paused?: boolean; status?: number; items?: unknown[]; refresh?: (body: URLSearchParams) => Response } = {}) {
  const calls: { url: string; auth: string | null; body?: string }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, auth: new Headers(init.headers).get('Authorization'), body: init.body ? String(init.body) : undefined });
    if (url === 'https://auth.qa.alummahnow.net/token') return opts.refresh ? opts.refresh(new URLSearchParams(String(init.body))) : new Response('{}', { status: 400 });
    if (url.startsWith('https://api.test/api/continue-watching')) return opts.status ? new Response('{}', { status: opts.status }) : Response.json({ items: opts.items ?? [apiItem('v1'), apiItem('v2')] });
    if (url === 'https://api.test/api/watch-history/settings') return Response.json({ paused: opts.paused === true });
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}
const req = (cookie: string, locale = 'en') => new Request(`https://www.qa.alummahnow.net/auth/continue-watching?locale=${locale}`, { headers: { Cookie: cookie } });

describe('Continue watching (UI#4)', () => {
  it('maps the API list: page-language channel name, stable thumbnails, watch links, percent; bad items dropped', () => {
    const items = toContinueItems({ items: [apiItem('v1'), apiItem('bad/id'), { video: { id: 'v3', title: '' } }, apiItem('v4', { thumbnailUrl: 'javascript:x' })] }, 'ar', 'https://videos.test');
    expect(items.map((i) => i.id)).toEqual(['v1', 'v4']);
    expect(items[0]).toMatchObject({ title: 'Video v1', href: 'https://videos.test/ar/video/v1', channelName: 'قناة', durationSeconds: 600, percent: 42 });
    expect(items[1]!.thumbnailUrl).toBeNull();
    expect(toContinueItems('nope', 'en', 'https://videos.test')).toEqual([]);
  });

  it('with a live access token: one list call with it, no refresh, no new cookie', async () => {
    const { calls, fetchImpl } = api();
    const res = await continueWatching(req(await sessionCookie({ access: 'acc1', accessExp: nowSec + 600, refresh: 'u1:r1' })), { cfg, secret: SECRET, fetchImpl, verify, now: () => NOW });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.getSetCookie()).toEqual([]);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items.map((i) => i.id)).toEqual(['v1', 'v2']);
    expect(calls.find((c) => c.url.includes('/api/continue-watching'))).toMatchObject({ url: 'https://api.test/api/continue-watching?limit=10', auth: 'Bearer acc1' });
    expect(calls.some((c) => c.url.endsWith('/token'))).toBe(false);
  });

  it('an expiring access token is refreshed (rotated refresh token) and the cookie re-sealed with the same expiry', async () => {
    let sent: URLSearchParams | undefined;
    const { calls, fetchImpl } = api({ refresh: (b) => ((sent = b), Response.json({ access_token: 'acc2', refresh_token: 'u1:r2', expires_in: 900 })) });
    const res = await continueWatching(req(await sessionCookie({ access: 'acc1', accessExp: nowSec + 30, refresh: 'u1:r1' })), { cfg, secret: SECRET, fetchImpl, verify, now: () => NOW });
    expect(res.status).toBe(200);
    expect(sent?.get('grant_type')).toBe('refresh_token');
    expect(sent?.get('refresh_token')).toBe('u1:r1');
    expect(sent?.get('client_id')).toBe(cfg.clientId);
    expect(calls.find((c) => c.url.includes('/api/continue-watching'))!.auth).toBe('Bearer acc2');
    const set = res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(set).toContain('Max-Age=3600');
    expect(set).toContain('HttpOnly');
    const s = await unseal<Session>(SECRET, readCookie(set.split(';')[0]!, SESSION_COOKIE));
    expect(s?.tok).toEqual({ access: 'acc2', accessExp: nowSec + 900, refresh: 'u1:r2' });
    expect(s?.exp).toBe(nowSec + 3600);
  });

  it('no row: signed out, an older session without tokens, a refused or foreign refresh, a 401 from the API', async () => {
    const deps = (fetchImpl: typeof fetch) => ({ cfg, secret: SECRET, fetchImpl, verify, now: () => NOW });
    expect((await continueWatching(req(''), deps(api().fetchImpl))).status).toBe(401);
    expect((await continueWatching(req(await sessionCookie(null)), deps(api().fetchImpl))).status).toBe(401);
    expect((await continueWatching(req(await sessionCookie({ access: 'a', accessExp: nowSec + 600, refresh: null }, 2)), deps(api().fetchImpl))).status).toBe(401);
    const expired = await sessionCookie({ access: 'a', accessExp: nowSec - 1, refresh: 'u1:r1' });
    expect((await continueWatching(req(expired), deps(api().fetchImpl))).status).toBe(401);
    const foreign = api({ refresh: () => Response.json({ access_token: 'other', refresh_token: 'u2:x' }) });
    const r = await continueWatching(req(expired), deps(foreign.fetchImpl));
    expect(r.status).toBe(401);
    expect(r.headers.getSetCookie()).toEqual([]);
    const live = await sessionCookie({ access: 'a', accessExp: nowSec + 600, refresh: 'u1:r1' });
    expect((await continueWatching(req(live), deps(api({ status: 401 }).fetchImpl))).status).toBe(401);
    expect((await continueWatching(req(live), deps(api({ status: 500 }).fetchImpl))).status).toBe(502);
  });

  it('paused watch history: an empty row', async () => {
    const res = await continueWatching(req(await sessionCookie({ access: 'a', accessExp: nowSec + 600, refresh: null })), { cfg, secret: SECRET, fetchImpl: api({ paused: true }).fetchImpl, verify, now: () => NOW });
    expect(await res.json()).toEqual({ signedIn: true, items: [] });
  });

  it('sign-in keeps the tokens in the sealed session; sign-out revokes the refresh token at auth', async () => {
    // sign-in
    const login = { state: 's1', verifier: 'v'.repeat(48), returnTo: '/en/', exp: nowSec + 600 };
    const loginCookie = `__Host-aun_www_login=${await seal(SECRET, { ...login })}`;
    const cb = await callback(new Request('https://www.qa.alummahnow.net/auth/callback?code=c&state=s1', { headers: { Cookie: loginCookie } }), {
      cfg,
      secret: SECRET,
      now: () => NOW,
      verify,
      fetchImpl: (async (url: string) => (url.endsWith('/token') ? Response.json({ access_token: 'acc', refresh_token: 'u1:r1', expires_in: 900 }) : new Response('', { status: 404 }))) as typeof fetch,
    });
    const set = cb.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    const s = await unseal<Session>(SECRET, readCookie(set.split(';')[0]!, SESSION_COOKIE));
    expect(s).toMatchObject({ v: SESSION_VERSION, tok: { access: 'acc', accessExp: nowSec + 900, refresh: 'u1:r1' } });

    // sign-out
    const revoked: string[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => (revoked.push(`${url} ${String(init.body)}`), new Response('{}'))) as typeof fetch;
    const out = await logout(new Request('https://www.qa.alummahnow.net/auth/logout', { method: 'POST', headers: { Origin: 'https://www.qa.alummahnow.net', Cookie: set.split(';')[0]! } }), { cfg, secret: SECRET, fetchImpl });
    expect(out.status).toBe(303);
    expect(revoked).toHaveLength(1);
    expect(revoked[0]).toContain('https://auth.qa.alummahnow.net/token/revoke ');
    expect(new URLSearchParams(revoked[0]!.split(' ')[1]).get('token')).toBe('u1:r1');
    // a cross-site POST revokes nothing
    revoked.length = 0;
    await logout(new Request('https://www.qa.alummahnow.net/auth/logout', { method: 'POST', headers: { Origin: 'https://evil.example', Cookie: set.split(';')[0]! } }), { cfg, secret: SECRET, fetchImpl });
    expect(revoked).toHaveLength(0);
  });
});

