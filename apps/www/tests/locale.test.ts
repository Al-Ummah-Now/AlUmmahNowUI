import { describe, expect, it } from 'vitest';
import { articlesPath, localeFromPath, negotiateLocale, statusPageUrl, swapLocale } from '../src/lib/locale';
import { navHref } from '../src/lib/context';
import { rootResponse, rootRewrite } from '../src/lib/edge';

describe('negotiateLocale (for /)', () => {
  it('prefers the aun_locale cookie', () => {
    expect(negotiateLocale('a=1; aun_locale=ar', 'en-US,en;q=0.9')).toBe('ar');
  });
  it('ignores an invalid cookie value', () => {
    expect(negotiateLocale('aun_locale=fr', 'ar-EG')).toBe('ar');
  });
  it('uses Accept-Language by quality', () => {
    expect(negotiateLocale(null, 'fr;q=0.9, ar;q=0.8, en;q=0.5')).toBe('ar');
    expect(negotiateLocale(null, 'en;q=0.2, ar-SA;q=0.7')).toBe('ar');
    expect(negotiateLocale(null, 'de-DE, en-GB;q=0.8')).toBe('en');
  });
  it('keeps header order on equal quality', () => {
    expect(negotiateLocale(null, 'ar, en')).toBe('ar');
  });
  it('skips q=0', () => {
    expect(negotiateLocale(null, 'ar;q=0, en;q=0.1')).toBe('en');
  });
  it('defaults to en', () => {
    expect(negotiateLocale(null, null)).toBe('en');
    expect(negotiateLocale(null, 'fr, de')).toBe('en');
    expect(negotiateLocale(null, 'garbage;;;')).toBe('en');
  });
});

describe('rootRewrite / rootResponse (no locale redirect)', () => {
  it('serves / as the negotiated language page, keeping the query and headers', () => {
    const req = rootRewrite(new Request('https://www.alummahnow.net/?utm=x', { headers: { 'Accept-Language': 'ar', Cookie: 'a=b' } }))!;
    expect(req.url).toBe('https://www.alummahnow.net/ar/?utm=x');
    expect(req.headers.get('Cookie')).toBe('a=b');
    expect(rootRewrite(new Request('https://www.alummahnow.net/'))!.url).toBe('https://www.alummahnow.net/en/');
  });
  it('leaves other paths and non-GET requests alone', () => {
    expect(rootRewrite(new Request('https://www.alummahnow.net/en/'))).toBeNull();
    expect(rootRewrite(new Request('https://www.alummahnow.net/', { method: 'POST' }))).toBeNull();
  });
  it('the answer at / is private, varies on cookie and language, and names its language', async () => {
    const page = new Response('<html></html>', { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60', 'Content-Type': 'text/html' } });
    const res = rootResponse(page, 'ar');
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(res.headers.get('Vary')).toBe('Cookie, Accept-Language');
    expect(res.headers.get('Content-Language')).toBe('ar');
    expect(res.headers.get('Content-Type')).toBe('text/html');
    expect(await res.text()).toBe('<html></html>');
  });
});

describe('path helpers', () => {
  it('localeFromPath', () => {
    expect(localeFromPath('/ar/articles/')).toBe('ar');
    expect(localeFromPath('/fr/articles/')).toBeNull();
    expect(localeFromPath('/')).toBeNull();
  });
  it('swapLocale', () => {
    expect(swapLocale('/en/articles/', 'ar')).toBe('/ar/articles/');
    expect(swapLocale('/ar/', 'en')).toBe('/en/');
  });
});

describe('News → Articles paths', () => {
  it('maps old News paths, with or without a locale', () => {
    expect(articlesPath('/en/news/')).toBe('/en/articles/');
    expect(articlesPath('/ar/news')).toBe('/ar/articles/');
    expect(articlesPath('/ar/news/x/')).toBe('/ar/articles/x/');
    expect(articlesPath('/news/')).toBe('/articles/');
    expect(articlesPath('/news?page=2')).toBe('/articles/?page=2');
    expect(articlesPath('/news#top')).toBe('/articles/#top');
  });
  it('ignores anything else', () => {
    for (const p of ['/en/articles/', '/newsletter/', '/en/newsroom', '/about/news/', '/']) expect(articlesPath(p), p).toBeNull();
  });
  it('CMS menus that still say /news/ link straight to /articles/', () => {
    expect(navHref('/news/', 'ar')).toBe('/ar/articles/');
    expect(navHref('/en/news/', 'ar')).toBe('/en/articles/');
    expect(navHref('/articles/', 'en')).toBe('/en/articles/');
    expect(navHref('/about/', 'en')).toBe('/en/about/');
    expect(navHref('https://example.org/news/', 'en')).toBe('https://example.org/news/');
  });
});

describe('statusPageUrl', () => {
  it('links the status page of the env serving the request', () => {
    expect(statusPageUrl('www.alummahnow.net', 'en')).toBe('https://status.alummahnow.net/');
    expect(statusPageUrl('www.qa.alummahnow.net', 'ar')).toBe('https://status.qa.alummahnow.net/ar');
    expect(statusPageUrl('www.stage.alummahnow.net', 'en')).toBe('https://status.stage.alummahnow.net/');
    expect(statusPageUrl('localhost', 'en')).toBe('https://status.alummahnow.net/');
  });
});
