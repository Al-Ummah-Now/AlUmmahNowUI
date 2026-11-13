import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { isPreviewToken, lookupSite, normalizeHost, resetSiteMemo, siteFromRequest, SITE_HEADER, withSiteHeader } from '../src/lib/site';
import { applySecurityHeaders, contentSecurityPolicy, isCacheableRequest, localeRedirect, siteCacheKey, zoneRedirect } from '../src/lib/edge';
import { config } from '../src/lib/env';
import { alternates, canonicalUrl, hreflangLinks, siteName, watchCanonical, watchPagesInSitemap } from '../src/lib/seo';
import { renderTheme, themeIdOf } from '../src/lib/theme';
import { MODE_SCRIPT, MODE_SCRIPT_HASH } from '../src/lib/theme-mode';
import { cookie, clearCookie, hintCookie, needsRecheck, safeReturnPath, SESSION_COOKIE } from '../src/lib/auth';
import { callback, login, me } from '../src/lib/auth-routes';
import { toSitePost, toSiteVideo } from '../src/lib/data';
import { seal } from '../../../packages/render/src/session';
import { fixtureSite } from './fixtures';

const kv = () => {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string, type?: 'json') {
      const v = store.get(key);
      return v === undefined ? null : type === 'json' ? JSON.parse(v) : v;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
};

describe('host → site', () => {
  beforeEach(() => resetSiteMemo());

  it('normalises hosts and refuses junk', () => {
    expect(normalizeHost('Mustafa-Elbadry.AlUmmahNow.org:443')).toBe('mustafa-elbadry.alummahnow.org');
    expect(normalizeHost('localhost')).toBeNull();
    expect(normalizeHost('a b.org')).toBeNull();
    expect(isPreviewToken('f'.repeat(32))).toBe(true);
    expect(isPreviewToken('../x')).toBe(false);
  });

  it('reads the registry once per isolate minute and keeps the last good config', async () => {
    const site = fixtureSite();
    let calls = 0;
    const store = kv();
    const pending: Promise<unknown>[] = [];
    const deps = { apiUrl: 'https://api', kv: store, waitUntil: (p: Promise<unknown>) => pending.push(p), fetchImpl: async () => (calls++, Response.json(site)) };
    expect((await lookupSite('mustafa-elbadry.alummahnow.org', null, deps)).kind).toBe('site');
    expect((await lookupSite('mustafa-elbadry.alummahnow.org', null, deps)).kind).toBe('site');
    expect(calls).toBe(1);
    await Promise.all(pending);
    expect(JSON.parse(store.store.get('site-config:mustafa-elbadry.alummahnow.org') as string).site.configVersion).toBe(3);
  });

  it('renders the snapshot (own theme) when api-videos is down, else 503; never another site', async () => {
    const store = kv();
    store.store.set('site-config:mustafa-elbadry.alummahnow.org', JSON.stringify(fixtureSite()));
    const down = { apiUrl: 'https://api', kv: store, waitUntil: () => undefined, fetchImpl: async () => new Response('', { status: 503 }) };
    const r = await lookupSite('mustafa-elbadry.alummahnow.org', null, down);
    expect(r.kind === 'site' && r.source).toBe('snapshot');
    expect(r.kind === 'site' && r.site.site.themeRef).toBe('nahas@1.0.0');
    expect((await lookupSite('other.alummahnow.org', null, down)).kind).toBe('unavailable');
  });

  it('passes 404 and redirects through; previews are never memoised or snapshotted', async () => {
    const deps = (body: unknown, status = 200) => ({ apiUrl: 'https://api', waitUntil: () => undefined, fetchImpl: async () => (status === 404 ? new Response('', { status }) : Response.json(body)) });
    expect((await lookupSite('nobody.alummahnow.org', null, deps(null, 404))).kind).toBe('not_found');
    expect(await lookupSite('old.alummahnow.org', null, deps({ redirectTo: 'https://new.alummahnow.org' }))).toEqual({ kind: 'redirect', location: 'https://new.alummahnow.org' });
    const urls: string[] = [];
    const preview = { apiUrl: 'https://api', waitUntil: () => undefined, fetchImpl: async (u: string) => (urls.push(u), Response.json(fixtureSite({}, true))) };
    await lookupSite('mustafa-elbadry.alummahnow.org', 'a'.repeat(32), preview);
    await lookupSite('mustafa-elbadry.alummahnow.org', 'a'.repeat(32), preview);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('?preview=');
  });

  it('a client can never choose the site Astro renders', () => {
    const spoofed = new Request('https://x.alummahnow.org/en/', { headers: { [SITE_HEADER]: 'junk' } });
    expect(siteFromRequest(withSiteHeader(spoofed, null))).toBeNull();
    const real = withSiteHeader(spoofed, fixtureSite());
    expect(siteFromRequest(real)?.site.slug).toBe('mustafa-elbadry');
  });
});

describe('edge', () => {
  const cfg = config({ APP_ENV: 'production', VIDEOS_WEB_URL: 'https://videos.alummahnow.net', AUTH_URL: 'https://auth.alummahnow.net', WWW_URL: 'https://www.alummahnow.net' });

  it('sends the zone names to www.alummahnow.net', () => {
    for (const h of ['alummahnow.org', 'www.alummahnow.org', 'sites.alummahnow.org']) expect(zoneRedirect(h, cfg)?.headers.get('Location')).toBe('https://www.alummahnow.net/');
    expect(zoneRedirect('mustafa-elbadry.alummahnow.org', cfg)).toBeNull();
    const qa = config({ APP_ENV: 'qa', WWW_URL: 'https://www.qa.alummahnow.net' });
    expect(zoneRedirect('qa.alummahnow.org', qa)?.status).toBe(301);
  });

  it('sends / to the default language and an unserved language to it (single-language sites)', () => {
    const arOnly = fixtureSite({ locales: ['ar'] });
    expect(localeRedirect(new URL('https://h.alummahnow.org/?preview=x'), arOnly)?.headers.get('Location')).toBe('/ar/?preview=x');
    expect(localeRedirect(new URL('https://h.alummahnow.org/en/posts/1/'), arOnly)?.headers.get('Location')).toBe('/ar/posts/1/');
    expect(localeRedirect(new URL('https://h.alummahnow.org/ar/posts/'), arOnly)).toBeNull();
  });

  it('frames only previews, and only in the videos site (Studio)', () => {
    expect(contentSecurityPolicy(cfg, { preview: false, https: true })).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy(cfg, { preview: true, https: true })).toContain('frame-ancestors https://videos.alummahnow.net');
    expect(contentSecurityPolicy(cfg, { preview: false, https: true })).toContain(`script-src 'self' ${MODE_SCRIPT_HASH}`);
  });

  it('HSTS covers subdomains only on our own zone; previews are no-store and noindex', () => {
    const own = applySecurityHeaders(new Response('x', { headers: { 'Content-Type': 'text/html' } }), cfg, { host: 'a.alummahnow.org', preview: false, noindex: false });
    expect(own.headers.get('Strict-Transport-Security')).toContain('includeSubDomains');
    expect(own.headers.get('X-Robots-Tag')).toBeNull();
    const custom = applySecurityHeaders(new Response('x'), cfg, { host: 'example.com', preview: false, noindex: false });
    expect(custom.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
    const preview = applySecurityHeaders(new Response('x'), cfg, { host: 'a.alummahnow.org', preview: true, noindex: true });
    expect(preview.headers.get('Cache-Control')).toContain('no-store');
    expect(preview.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(preview.headers.get('X-Frame-Options')).toBeNull();
  });

  it('caches locale pages with bounded queries; the key holds host, build, config version and theme', () => {
    expect(isCacheableRequest(new Request('https://a.alummahnow.org/en/posts/?page=2'))).toBe(true);
    expect(isCacheableRequest(new Request('https://a.alummahnow.org/en/?preview=' + 'a'.repeat(32)))).toBe(false);
    expect(isCacheableRequest(new Request('https://a.alummahnow.org/auth/me'))).toBe(false);
    const key = siteCacheKey('https://a.alummahnow.org/en/', 'v1', fixtureSite());
    expect(key).toContain('a.alummahnow.org');
    expect(key).toContain('__c=3');
    expect(key).toContain('__t=nahas%401.0.0');
  });
});

describe('canonical rules (SS7)', () => {
  it('posts and pages are canonical on the site; videos on videos for a subdomain, on the site for an own domain', () => {
    const sub = fixtureSite();
    expect(canonicalUrl(sub, 'en', 'posts/p1/')).toBe('https://mustafa-elbadry.alummahnow.org/en/posts/p1/');
    expect(watchCanonical(sub, 'ar', 'vid1', 'https://videos.alummahnow.net')).toBe('https://videos.alummahnow.net/ar/video/vid1');
    expect(watchPagesInSitemap(sub)).toBe(false);
    const own = fixtureSite({ primaryHost: 'example.com', primaryKind: 'custom' });
    expect(watchCanonical(own, 'en', 'vid1', 'https://videos.alummahnow.net')).toBe('https://example.com/en/watch/vid1/');
    expect(watchPagesInSitemap(own)).toBe(true);
  });

  it('hreflang pairs only the languages the site serves', () => {
    const both = fixtureSite();
    expect(hreflangLinks(both, alternates(both, 'about/')).map((l) => l.hreflang)).toEqual(['en', 'ar', 'x-default']);
    const ar = fixtureSite({ locales: ['ar'] });
    expect(hreflangLinks(ar, alternates(ar, 'about/'))).toEqual([{ hreflang: 'ar', href: 'https://mustafa-elbadry.alummahnow.org/ar/about/' }]);
    expect(siteName(fixtureSite({ name: {} }), 'ar')).toBe('Mustafa Elbadry');
  });
});

describe('theme', () => {
  it('renders the pinned built-in theme; an unknown ref is marked so it is never cached', () => {
    expect(themeIdOf('zujaj@1.0.0')).toBe('zujaj');
    expect(themeIdOf('zujaj')).toBeNull();
    expect(renderTheme('nahas@1.0.0')).toEqual({ id: 'nahas', exact: true });
    expect(renderTheme('custom-pkg@1.0.0').exact).toBe(false);
  });

  it('the head script matches the CSP hash', () => {
    expect(`'sha256-${createHash('sha256').update(MODE_SCRIPT).digest('base64')}'`).toBe(MODE_SCRIPT_HASH);
  });
});

describe('content', () => {
  it('keeps only public videos and posts', () => {
    expect(toSiteVideo({ id: 'v1', title: 'A.mp4', channelId: 'ch' })?.title).toBe('A');
    expect(toSiteVideo({ id: 'v1', title: 'A', isPublic: false })).toBeNull();
    expect(toSitePost({ id: 'p1', type: 'text', content: 'x', visibility: 'subscribers' })).toBeNull();
    expect(toSitePost({ id: 'p1', type: 'poll', content: 'Q', poll: { options: [{ text: 'a' }, { text: 'b' }] } })?.options).toEqual(['a', 'b']);
    expect(toSitePost({ id: 'p1', type: 'image', images: [{ url: 'https://evil.example/x.png' }] })?.images).toEqual([]);
  });

  it('maps link, GIF and cards posts (SS14): safe link, our images only, site name kept', () => {
    const img = 'https://images.alummahnow.net/community-posts/c1/link-1.png';
    const link = toSitePost({ id: 'p1', type: 'link', content: 'Worth a read', link: { url: 'https://example.org/a', title: 'A page', siteName: 'Example', description: null, image: { url: img } } });
    expect(link?.link).toEqual({ url: 'https://example.org/a', title: 'A page', description: null, siteName: 'Example', image: { url: img, alt: null, width: null, height: null } });
    expect(toSitePost({ id: 'p1', type: 'link', link: { url: 'javascript:alert(1)' } })?.link).toBeNull();
    expect(toSitePost({ id: 'p1', type: 'link', link: { url: 'https://example.org/', image: { url: 'https://evil.example/x.png' } } })?.link?.image).toBeNull();
    expect(toSitePost({ id: 'p1', type: 'gif', gif: { url: 'https://images.alummahnow.net/g.gif', width: 200 } })?.gif).toEqual({ url: 'https://images.alummahnow.net/g.gif', width: 200, height: null });
    const cards = toSitePost({ id: 'p1', type: 'cards', slides: [{ image: { url: img, alt: 'Card one' }, heading: 'One', body: null }, { image: { url: 'https://evil.example/x.png' } }] });
    expect(cards?.slides).toEqual([{ url: img, alt: 'Card one', heading: 'One', body: null }]);
  });
});

describe('sign-in (SS11): top-level redirect, host-only session, 5-minute re-check', () => {
  const SECRET = 'a'.repeat(64);
  const site = fixtureSite();
  const env = { APP_ENV: 'qa', AUTH_URL: 'https://auth.qa.alummahnow.net', SITES_CLIENT_ID: 'sites-qa', SESSION_SECRET: SECRET };
  const ctx = (url: string, init: RequestInit = {}) => {
    const request = withSiteHeader(new Request(url, init), site);
    return { request, url: new URL(url), locals: { runtime: { env } } } as never;
  };

  it('cookies are host-only: never a Domain attribute', () => {
    for (const c of [cookie(SESSION_COOKIE, 'v', 10), clearCookie(SESSION_COOKIE), hintCookie(true)]) expect(c.toLowerCase()).not.toContain('domain=');
    expect(cookie(SESSION_COOKIE, 'v', 10)).toMatch(/^__Host-aun_site=v; Path=\/; Max-Age=10; HttpOnly; Secure; SameSite=Lax$/);
  });

  it('keeps return paths on this site', () => {
    expect(safeReturnPath('/ar/posts/?page=2')).toBe('/ar/posts/?page=2');
    for (const bad of ['https://evil.example/', '//evil.example', '/\\evil', '/auth/login', '/..//evil.example']) expect(safeReturnPath(bad, '/')).toBe('/');
  });

  it('round trip: login → auth /authorize with this host\'s callback → callback → sealed session', async () => {
    const start = await login(ctx('https://mustafa-elbadry.qa.alummahnow.org/auth/login?return=%2Far%2Fposts%2F&lang=ar'));
    expect(start.status).toBe(302);
    const authorize = new URL(start.headers.get('Location') as string);
    expect(authorize.origin + authorize.pathname).toBe('https://auth.qa.alummahnow.net/authorize');
    expect(authorize.searchParams.get('redirect_uri')).toBe('https://mustafa-elbadry.qa.alummahnow.org/auth/callback');
    expect(authorize.searchParams.get('client_id')).toBe('sites-qa');
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorize.searchParams.get('lang')).toBe('ar');
    const loginCookie = (start.headers.get('Set-Cookie') as string).split(';')[0];

    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' };
    const token = await new SignJWT({ mode: 'access', properties: { id: 'usr_1', name: 'Viewer', email: 'v@example.com' } })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setIssuer('https://auth.qa.alummahnow.net')
      .setSubject('user:usr_1')
      .setExpirationTime('10m')
      .sign(privateKey);
    let tokenBody = '';
    const fetcher = (async (_u: string, init: RequestInit) => ((tokenBody = String(init.body)), Response.json({ access_token: token, refresh_token: 'rt-1' }))) as typeof fetch;
    const done = await callback(
      ctx(`https://mustafa-elbadry.qa.alummahnow.org/auth/callback?code=c1&state=${authorize.searchParams.get('state')}`, { headers: { Cookie: loginCookie ?? '' } }),
      fetcher,
      createLocalJWKSet({ keys: [jwk] }),
    );
    expect(done.status).toBe(303);
    expect(done.headers.get('Location')).toBe('/ar/posts/');
    expect(tokenBody).toContain('redirect_uri=https%3A%2F%2Fmustafa-elbadry.qa.alummahnow.org%2Fauth%2Fcallback');
    expect(tokenBody).toContain('code_verifier=');
    const set = done.headers.getSetCookie();
    expect(set.some((c) => c.startsWith('__Host-aun_site=') && !/domain=/i.test(c))).toBe(true);
    expect(set.some((c) => c.startsWith('aun_site_si=1'))).toBe(true);
  });

  it('a wrong state signs nobody in', async () => {
    const res = await callback(ctx('https://mustafa-elbadry.qa.alummahnow.org/auth/callback?code=c1&state=forged'), (async () => Response.json({})) as typeof fetch);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('__Host-aun_site='))).toBe(false);
  });

  it('re-checks after 5 minutes: a revoked refresh token ends the site session', async () => {
    const now = Math.floor(Date.now() / 1000);
    const stale = await seal(SECRET, { sub: 'usr_1', name: 'Viewer', email: null, rt: 'rt-1', checked: now - 301, exp: now + 3600 });
    expect(needsRecheck({ sub: '', name: null, email: null, rt: '', checked: now - 301, exp: 0 }, now)).toBe(true);
    const withCookie = () => ctx('https://mustafa-elbadry.qa.alummahnow.org/auth/me', { headers: { Cookie: `__Host-aun_site=${stale}` } });

    const revoked = await me(withCookie(), (async () => new Response('', { status: 400 })) as typeof fetch);
    expect(await revoked.json()).toEqual({ signedIn: false });
    expect(revoked.headers.getSetCookie().some((c) => c.startsWith('__Host-aun_site=;'))).toBe(true);

    const outage = await me(withCookie(), (async () => new Response('', { status: 503 })) as typeof fetch);
    expect(await outage.json()).toEqual({ signedIn: true, name: 'Viewer' });

    const ok = await me(withCookie(), (async () => Response.json({ access_token: 'a', refresh_token: 'rt-2' })) as typeof fetch);
    expect(await ok.json()).toEqual({ signedIn: true, name: 'Viewer' });
    expect(ok.headers.getSetCookie()[0]).toMatch(/^__Host-aun_site=/);

    const fresh = await seal(SECRET, { sub: 'usr_1', name: 'Viewer', email: null, rt: 'rt-1', checked: now, exp: now + 3600 });
    let called = false;
    await me(ctx('https://mustafa-elbadry.qa.alummahnow.org/auth/me', { headers: { Cookie: `__Host-aun_site=${fresh}` } }), (async () => ((called = true), Response.json({}))) as typeof fetch);
    expect(called).toBe(false);
  });
});
