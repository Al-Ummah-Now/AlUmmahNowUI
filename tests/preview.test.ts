import { describe, expect, it } from 'vitest';
import { applySecurityHeaders, contentSecurityPolicy, isCacheableRequest, withHtmlCache } from '../src/lib/edge';
import { config } from '../src/lib/env';
import { enterPreview, loadPreview, minutesLeft, parsePreview, previewCookieName, readClaims, type FetchPreview } from '../src/lib/preview';
import { MemoryCache } from './helpers';

const NOW = 1_800_000_000;
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (claims: Record<string, unknown>) => `v1.${b64(claims)}.c2lnbmF0dXJl`;
const qa = config({ APP_ENV: 'qa', SITE_URL: 'https://www.qa.alummahnow.net' });
const prod = config({ APP_ENV: 'production', SITE_URL: 'https://www.alummahnow.net' });

const page = { slug: 'about', locale: 'en', title: 'About', summary: null, body: 'Hi', seo_title: null, seo_description: null, cover: null, published_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-01T00:00:00.000Z', alternates: [] };
const okBody = { kind: 'page', id: 7, status: 'draft', expires_at: new Date((NOW + 1800) * 1000).toISOString(), edit_url: 'https://cms.qa.alummahnow.net/pages/7', content: page };

describe('preview links', () => {
  it('reads kind, id and exp from a well-formed token, nothing else', () => {
    expect(readClaims(token({ k: 'pages', id: 7, iat: NOW, exp: NOW + 1800 }))).toEqual({ k: 'pages', id: 7, exp: NOW + 1800 });
    for (const bad of [null, '', 'v1.e2e.probe', 'v2.x.y', token({ k: 'media', id: 1, exp: NOW }), token({ k: 'pages', id: -1, exp: NOW }), token({ k: 'pages', id: 1.5, exp: NOW }), token({ k: 'pages', id: 1 }), 'x'.repeat(600)]) {
      expect(readClaims(bad)).toBeNull();
    }
  });

  it('/preview?token= puts the token in a per-row cookie and 303s to a token-free URL', () => {
    const t = token({ k: 'posts', id: 12, iat: NOW, exp: NOW + 1800 });
    const res = enterPreview(new URL(`https://www.qa.alummahnow.net/preview?token=${t}`), NOW);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/preview/posts/12');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store, no-transform');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('Set-Cookie')).toBe(`${previewCookieName('posts', 12)}=${t}; Path=/; Max-Age=1800; HttpOnly; Secure; SameSite=Lax`);
    expect(previewCookieName('posts', 12)).toBe('__Host-aun_preview_posts_12');
  });

  it('a broken or expired link goes to its friendly page, with no cookie', () => {
    const bad = enterPreview(new URL('https://www.qa.alummahnow.net/preview?token=v1.e2e.broken'), NOW);
    expect(bad.headers.get('Location')).toBe('/preview/invalid');
    expect(bad.headers.get('Set-Cookie')).toBeNull();
    const none = enterPreview(new URL('https://www.qa.alummahnow.net/preview'), NOW);
    expect(none.headers.get('Location')).toBe('/preview/invalid');
    const old = enterPreview(new URL(`https://www.qa.alummahnow.net/preview?token=${token({ k: 'pages', id: 1, exp: NOW - 1 })}`), NOW);
    expect(old.headers.get('Location')).toBe('/preview/expired');
    expect(old.headers.get('Set-Cookie')).toBeNull();
  });

  it('caps the cookie at an hour even if a payload claims more (the CMS decides validity anyway)', () => {
    const res = enterPreview(new URL(`https://www.qa.alummahnow.net/preview?token=${token({ k: 'pages', id: 1, exp: NOW + 999_999 })}`), NOW);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=3600');
  });
});

describe('loading a preview', () => {
  const answer = (status: number, body: unknown): FetchPreview => async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('sends the token as a bearer to /{kind}/{id} and returns the content', async () => {
    let seen: { path: string; token: string } | null = null;
    const f: FetchPreview = async (path, t) => {
      seen = { path, token: t };
      return Response.json(okBody);
    };
    const r = await loadPreview(f, 'pages', 7, 'tok');
    expect(seen).toEqual({ path: '/pages/7', token: 'tok' });
    expect(r).toEqual({ state: 'ok', data: { kind: 'page', status: 'draft', expiresAt: okBody.expires_at, editUrl: okBody.edit_url, content: page } });
  });

  it('maps every failure to a friendly state', async () => {
    expect(await loadPreview(answer(200, okBody), 'pages', 7, null)).toEqual({ state: 'expired' });
    expect(await loadPreview(answer(401, { error: 'expired_token' }), 'pages', 7, 't')).toEqual({ state: 'expired' });
    expect(await loadPreview(answer(401, { error: 'invalid_token' }), 'pages', 7, 't')).toEqual({ state: 'invalid' });
    expect(await loadPreview(answer(404, { error: 'not_found' }), 'pages', 7, 't')).toEqual({ state: 'gone' });
    expect(await loadPreview(answer(500, {}), 'pages', 7, 't')).toEqual({ state: 'unavailable' });
    expect(await loadPreview(answer(200, { ...okBody, kind: 'post' }), 'pages', 7, 't')).toEqual({ state: 'unavailable' });
    expect(await loadPreview(async () => new Response('<html>', { status: 200 }), 'pages', 7, 't')).toEqual({ state: 'unavailable' });
    expect(await loadPreview(async () => { throw new Error('down'); }, 'pages', 7, 't')).toEqual({ state: 'unavailable' });
    const slow: FetchPreview = (_p, _t, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    expect(await loadPreview(slow, 'pages', 7, 't', 10)).toEqual({ state: 'unavailable' });
  });

  it('validates the post shape too', () => {
    expect(parsePreview('posts', { ...okBody, kind: 'post', content: { ...page, tags: [], excerpt: null, author_name: null } })?.kind).toBe('post');
    expect(parsePreview('posts', { ...okBody, kind: 'post', content: { title: 'x' } })).toBeNull();
  });

  it('counts whole minutes left, at least one', () => {
    expect(minutesLeft(new Date(NOW * 1000 + 29.5 * 60_000).toISOString(), NOW * 1000)).toBe(30);
    expect(minutesLeft(new Date(NOW * 1000 + 1000).toISOString(), NOW * 1000)).toBe(1);
    expect(minutesLeft('nonsense', NOW * 1000)).toBe(1);
  });
});

describe('preview responses at the edge', () => {
  it('no-store, no-transform, noindex and no Referer even in production; CSP without the analytics beacon', () => {
    const html = new Response('<p>x</p>', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=60' } });
    const res = applySecurityHeaders(html, prod, '/preview/pages/7');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store, no-transform');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('Content-Security-Policy')).not.toContain('cloudflareinsights');
    // Everything else keeps the beacon and its normal headers.
    const normal = applySecurityHeaders(new Response('<p>x</p>', { headers: { 'Content-Type': 'text/html' } }), prod, '/en/');
    expect(normal.headers.get('Content-Security-Policy')).toContain('static.cloudflareinsights.com');
    expect(normal.headers.get('X-Robots-Tag')).toBeNull();
    expect(contentSecurityPolicy(qa, { analytics: false })).toContain("script-src 'self';");
  });

  it('the HTML edge cache never stores or serves a preview', async () => {
    expect(isCacheableRequest(new Request('https://www.qa.alummahnow.net/preview/pages/7'))).toBe(false);
    expect(isCacheableRequest(new Request('https://www.qa.alummahnow.net/preview?token=x'))).toBe(false);
    const cache = new MemoryCache();
    let renders = 0;
    const render = async () => {
      renders++;
      return new Response('<p>draft</p>', { headers: { 'Content-Type': 'text/html', 'X-Content-Source': 'cms' } });
    };
    const req = new Request('https://www.qa.alummahnow.net/preview/pages/7');
    await withHtmlCache(req, cache as unknown as Cache, () => undefined, render);
    await withHtmlCache(req, cache as unknown as Cache, () => undefined, render);
    expect(renders).toBe(2);
    expect(cache.store.size).toBe(0);
  });
});
