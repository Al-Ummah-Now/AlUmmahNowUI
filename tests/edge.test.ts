import { describe, expect, it } from 'vitest';
import { apexRedirect, applySecurityHeaders, contentSecurityPolicy, formActionSources, isCacheableRequest, withHtmlCache } from '../src/lib/edge';
import { config } from '../src/lib/env';
import { normalizeImageUrl } from '../src/lib/images';
import { robotsTxt } from '../src/lib/seo';
import { MemoryCache, waiter } from './helpers';

const prod = config({ APP_ENV: 'production', SITE_URL: 'https://www.alummahnow.net', AUTH_URL: 'https://auth.alummahnow.net', VIDEOS_WEB_URL: 'https://videos.alummahnow.net', CMS_PUBLIC_URL: 'https://cms.alummahnow.net' });
const qa = config({ APP_ENV: 'qa', SITE_URL: 'https://www.qa.alummahnow.net' });

describe('apex → www', () => {
  it('301s the apex keeping path and query', () => {
    const res = apexRedirect('https://alummahnow.net/ar/news/?page=2&x=%20y', prod.siteUrl)!;
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://www.alummahnow.net/ar/news/?page=2&x=%20y');
  });
  it('301s the bare apex root', () => {
    expect(apexRedirect('https://alummahnow.net/', prod.siteUrl)!.headers.get('Location')).toBe('https://www.alummahnow.net/');
  });
  it('leaves www and other hosts alone', () => {
    expect(apexRedirect('https://www.alummahnow.net/en/', prod.siteUrl)).toBeNull();
    expect(apexRedirect('https://www.qa.alummahnow.net/en/', qa.siteUrl)).toBeNull();
  });
});

describe('security headers', () => {
  it('CSP: frames only from the videos site, images from self, CMS and video CDNs, no inline script', () => {
    const csp = contentSecurityPolicy(prod);
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain('frame-src https://videos.alummahnow.net');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("img-src 'self' data: https://cms.alummahnow.net https://images.alummahnow.net https://*.b-cdn.net");
    expect(csp).toContain("form-action 'self' https://auth.alummahnow.net https://*.alummahnow.net;");
    expect(csp).toContain("connect-src 'self' https://auth.alummahnow.net https://cloudflareinsights.com");
  });
  it("form-action covers auth's front-channel logout chain (every app's logout, then back to www)", () => {
    expect(formActionSources('https://auth.alummahnow.net')).toEqual(["'self'", 'https://auth.alummahnow.net', 'https://*.alummahnow.net']);
    expect(formActionSources('https://auth.qa.alummahnow.net')).toEqual(["'self'", 'https://auth.qa.alummahnow.net', 'https://*.qa.alummahnow.net']);
    // no wildcard for local dev hosts
    expect(formActionSources('http://localhost:8787')).toEqual(["'self'", 'http://localhost:8787']);
    expect(formActionSources('http://127.0.0.1:8787')).toEqual(["'self'", 'http://127.0.0.1:8787']);
  });
  it('adds HSTS and friends; noindex off production only', () => {
    const html = () => new Response('<p>', { headers: { 'Content-Type': 'text/html' } });
    const p = applySecurityHeaders(html(), prod).headers;
    expect(p.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(p.get('X-Content-Type-Options')).toBe('nosniff');
    expect(p.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(p.get('Permissions-Policy')).toContain('camera=()');
    expect(p.get('X-Robots-Tag')).toBeNull();
    expect(applySecurityHeaders(html(), qa).headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });
  it('robots.txt disallows everything off production', () => {
    expect(robotsTxt(false, qa.siteUrl)).toBe('User-agent: *\nDisallow: /\n');
    expect(robotsTxt(true, prod.siteUrl)).toContain('Sitemap: https://www.alummahnow.net/sitemap.xml');
  });
});

describe('image URLs', () => {
  it('normalizes scheme-less CDN values and drops unknown hosts', () => {
    expect(normalizeImageUrl('images.alummahnow.net/a b.jpg')).toBe('https://images.alummahnow.net/a%20b.jpg');
    expect(normalizeImageUrl('https://vz-1.b-cdn.net/x/thumbnail.jpg?token=1')).toBe('https://vz-1.b-cdn.net/x/thumbnail.jpg?token=1');
    expect(normalizeImageUrl('https://evil.example/x.jpg')).toBeNull();
    expect(normalizeImageUrl('http://images.alummahnow.net/x.jpg')).toBeNull();
    expect(normalizeImageUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeImageUrl('https://b-cdn.net.evil.example/x.jpg')).toBeNull();
    expect(normalizeImageUrl(null)).toBeNull();
  });
});

describe('HTML edge cache', () => {
  const html = (source = 'cms') => new Response('<h1>hi</h1>', { headers: { 'Content-Type': 'text/html', 'X-Content-Source': source } });

  it('only caches anonymous-identical locale pages', () => {
    expect(isCacheableRequest(new Request('https://w/en/news/?page=2'))).toBe(true);
    expect(isCacheableRequest(new Request('https://w/en/?utm_source=x'))).toBe(false);
    expect(isCacheableRequest(new Request('https://w/auth/me'))).toBe(false);
    expect(isCacheableRequest(new Request('https://w/en/', { method: 'POST' }))).toBe(false);
  });

  it('MISS → HIT → STALE (revalidates in the background) → MISS', async () => {
    const cache = new MemoryCache();
    const w = waiter();
    let now = 0;
    let renders = 0;
    const render = async () => (renders++, html());
    const go = () => withHtmlCache(new Request('https://w/en/'), cache as unknown as Cache, w.waitUntil, render, () => now);
    expect((await go()).headers.get('X-Edge-Cache')).toBe('MISS');
    await w.flush();
    now = 30_000;
    const hit = await go();
    expect(hit.headers.get('X-Edge-Cache')).toBe('HIT');
    expect(hit.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=600');
    expect(await hit.text()).toBe('<h1>hi</h1>');
    now = 120_000;
    expect((await go()).headers.get('X-Edge-Cache')).toBe('STALE');
    await w.flush();
    expect(renders).toBe(2);
    now = 120_000 + 700_000;
    expect((await go()).headers.get('X-Edge-Cache')).toBe('MISS');
  });

  it('never stores built-in fallback pages or responses with cookies', async () => {
    const cache = new MemoryCache();
    const w = waiter();
    await withHtmlCache(new Request('https://w/en/'), cache as unknown as Cache, w.waitUntil, async () => html('builtin'));
    await withHtmlCache(new Request('https://w/ar/'), cache as unknown as Cache, w.waitUntil, async () => {
      const r = html();
      r.headers.set('Set-Cookie', 'x=1');
      return r;
    });
    await w.flush();
    expect(cache.store.size).toBe(0);
  });
});
