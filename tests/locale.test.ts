import { describe, expect, it } from 'vitest';
import { articlesPath, localeFromPath, negotiateLocale, swapLocale } from '../src/lib/locale';
import { navHref } from '../src/lib/context';
import { rootRedirect } from '../src/lib/edge';

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

describe('rootRedirect', () => {
  it('302s / with Vary and private caching, keeping the query', () => {
    const res = rootRedirect(new Request('https://www.alummahnow.net/?utm=x', { headers: { 'Accept-Language': 'ar' } }))!;
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/ar/?utm=x');
    expect(res.headers.get('Vary')).toBe('Cookie, Accept-Language');
    expect(res.headers.get('Cache-Control')).toContain('private');
  });
  it('leaves other paths alone', () => {
    expect(rootRedirect(new Request('https://www.alummahnow.net/en/'))).toBeNull();
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
