import { describe, expect, it } from 'vitest';
import { buildSitemap } from '../src/lib/sitemap';

const SITE = 'https://www.alummahnow.net';
const locs = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? '');

describe('www sitemap (wiki AUN-SEO)', () => {
  const xml = buildSitemap(
    SITE,
    [
      { type: 'page', locale: 'en', slug: 'articles', updated_at: '2026-11-11T10:00:00Z', translation_key: 'www-articles' },
      { type: 'page', locale: 'ar', slug: 'articles', updated_at: '2026-11-11T10:00:00Z', translation_key: 'www-articles' },
      { type: 'page', locale: 'en', slug: 'videos', updated_at: '2026-11-11T10:00:00Z' },
      { type: 'page', locale: 'en', slug: 'about', updated_at: '2026-11-09T10:00:00Z', translation_key: 'k-about' },
      { type: 'page', locale: 'ar', slug: 'about', updated_at: '2026-11-10T10:00:00Z', translation_key: 'k-about' },
      { type: 'post', locale: 'ar', slug: 'judgment-is-only-for-allah', updated_at: '2026-11-12T10:00:00Z', translation_key: null },
      { type: 'post', locale: 'en', slug: 'hello', updated_at: '2026-11-13T10:00:00Z', translation_key: 't1' },
      { type: 'post', locale: 'ar', slug: 'marhaba', updated_at: '2026-11-13T09:00:00Z', translation_key: 't1' },
    ],
    [{ slug: 'mostafa-elbadry', updated_at: '2026-11-12T00:00:00Z' }],
  );

  it('lists every URL once (static sections are not repeated as CMS pages)', () => {
    const all = locs(xml);
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter((l) => l.endsWith('/en/articles/'))).toHaveLength(1);
    expect(all.filter((l) => l.endsWith('/en/videos/'))).toHaveLength(1);
  });

  it('gives static sections an en/ar pair, x-default and the newest lastmod', () => {
    const home = xml.split('\n').find((l) => l.includes('<loc>https://www.alummahnow.net/en/</loc>'))!;
    expect(home).toContain('hreflang="ar" href="https://www.alummahnow.net/ar/"');
    expect(home).toContain('hreflang="x-default" href="https://www.alummahnow.net/en/"');
    expect(home).toContain('<lastmod>2026-11-13</lastmod>');
  });

  it('pairs translated posts and pages through translation_key', () => {
    const hello = xml.split('\n').find((l) => l.includes('<loc>https://www.alummahnow.net/en/articles/hello/</loc>'))!;
    expect(hello).toContain('hreflang="ar" href="https://www.alummahnow.net/ar/articles/marhaba/"');
    expect(hello).toContain('hreflang="x-default" href="https://www.alummahnow.net/en/articles/hello/"');
    const about = xml.split('\n').find((l) => l.includes('<loc>https://www.alummahnow.net/ar/about/</loc>'))!;
    expect(about).toContain('hreflang="en" href="https://www.alummahnow.net/en/about/"');
  });

  it('a post in one language only has no alternates', () => {
    const solo = xml.split('\n').find((l) => l.includes('judgment-is-only-for-allah'))!;
    expect(solo).not.toContain('hreflang');
    expect(solo).toContain('<lastmod>2026-11-12</lastmod>');
  });

  it('lists scholar pages in both languages', () => {
    expect(locs(xml)).toEqual(expect.arrayContaining([`${SITE}/en/scholars/mostafa-elbadry/`, `${SITE}/ar/scholars/mostafa-elbadry/`]));
  });
});
