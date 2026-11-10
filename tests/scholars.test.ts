/** Scholar pages (AlUmmahNowCMS docs/SCHOLARS.md): search hits, channel videos, JSON-LD. */
import { describe, expect, it } from 'vitest';
import { validate } from '../src/lib/cms-types';
import { config } from '../src/lib/env';
import { scholarHitsOf, scholarSuggestUrl } from '../src/lib/search/suggest';
import { articleLd, scholarLd } from '../src/lib/seo';
import { fetchChannelVideos } from '../src/lib/videos';

const cfg = config({ APP_ENV: 'qa', SITE_URL: 'https://www.qa.alummahnow.net', AUTH_URL: 'https://auth.qa.alummahnow.net', WWW_CLIENT_ID: 'x' });

describe('scholar search hits', () => {
  it('keeps valid scholars with www-relative links only', () => {
    expect(scholarSuggestUrl('https://cms.test', 'ar', 'عائشة')).toBe('https://cms.test/api/public/v1/search/scholars?locale=ar&q=%D8%B9%D8%A7%D8%A6%D8%B4%D8%A9&limit=3');
    const hits = scholarHitsOf(
      [
        { type: 'scholar', slug: 'aisha', title: 'Aisha', href: '/ar/scholars/aisha/', thumbnailUrl: 'https://cms.test/a.webp' },
        { type: 'scholar', slug: 'evil', title: 'Evil', href: 'https://evil.test/' },
        { type: 'scholar', slug: 'js', title: 'JS', href: '/ar/x', thumbnailUrl: 'javascript:alert(1)' },
        { type: 'post', slug: 'p', title: 'P', href: '/ar/articles/p/' },
      ],
      'ar',
    )!;
    expect(hits.map((h) => h.slug)).toEqual(['aisha', 'js']);
    expect(hits[0]).toMatchObject({ type: 'scholar', locale: 'ar', thumbnailUrl: 'https://cms.test/a.webp' });
    expect(hits[1]!.thumbnailUrl).toBeNull();
    expect(scholarHitsOf({ nope: 1 }, 'en')).toBeNull();
  });
});

describe('channel videos', () => {
  const deps = (body: unknown, status = 200) => ({
    apiUrl: 'https://videos.api.test',
    cacheKeyBase: 'https://cache.test',
    waitUntil: () => undefined,
    fetchImpl: (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch,
  });
  const calls: string[] = [];

  it('reads the latest public videos with the cursor, and drops private ones', async () => {
    const page = await fetchChannelVideos(
      deps({ data: [{ id: 'v1', title: 'Lesson 1.mp4', thumbnailUrl: 'https://img.test/1.jpg', duration: 90 }, { id: 'v2', title: 'Private', isPublic: false }], cursor: 'abc=' }),
      'ch1',
      { cursor: 'prev', limit: 8 },
    );
    expect(calls.at(-1)).toBe('https://videos.api.test/api/channels/ch1/videos?sort=latest&limit=8&cursor=prev');
    expect(page.items.map((v) => [v.id, v.title])).toEqual([['v1', 'Lesson 1']]);
    expect(page.cursor).toBe('abc=');
  });

  it('is an empty page on any failure or a bad id', async () => {
    expect(await fetchChannelVideos(deps({}, 500), 'ch1')).toEqual({ items: [], cursor: '' });
    expect(await fetchChannelVideos(deps({}), '../x')).toEqual({ items: [], cursor: '' });
  });
});

describe('scholar JSON-LD', () => {
  it('a ProfilePage about a Person, named by @id as the author of their articles', () => {
    const ld = scholarLd(cfg, { name: 'Aisha', url: '/en/scholars/aisha/', description: 'Teaches fiqh', image: null, locale: 'en', sameAs: ['https://videos.qa.alummahnow.net/en/channels/c1'] });
    expect(ld.mainEntity).toMatchObject({ '@type': 'Person', '@id': 'https://www.qa.alummahnow.net/en/scholars/aisha/#person', name: 'Aisha' });
    const art = articleLd(cfg, { title: 'T', description: 'D', url: '/en/articles/t/', image: null, published: '2026-11-10', modified: '2026-11-10', author: 'Aisha', authorUrl: '/en/scholars/aisha/', locale: 'en' });
    expect(art.author).toMatchObject({ '@type': 'Person', '@id': 'https://www.qa.alummahnow.net/en/scholars/aisha/#person' });
  });

  it('validates the CMS scholar answers', () => {
    expect(validate.scholar({ scholar: { slug: 'a', name: 'A' }, posts: { items: [] }, post_counts: { en: 0, ar: 0 } })).toBe(true);
    expect(validate.scholar({ scholar: { slug: 'a' } })).toBe(false);
    expect(validate.scholars({ items: [], total: 0 })).toBe(true);
  });
});
