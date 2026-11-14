import { describe, expect, it } from 'vitest';
import { entriesFor, FILE_ITEMS, lastmodOf, sitemapFile, sitemapRoot, urlsetXml } from '../src/lib/sitemap';
import { alternates, hreflangLinks, watchHasHreflang } from '../src/lib/seo';
import { isCacheableRequest } from '../src/lib/edge';
import type { DataDeps } from '../src/lib/data';
import { fixtureSite } from './fixtures';

const API = 'https://api.test';
const SUB = 'https://mustafa-elbadry.alummahnow.org';
const OWN = 'https://example.com';

/** A fake api-videos with `posts` posts and `videos`/`shorts` items; counts every read. */
function fakeApi(counts: { posts: number; videos?: number; shorts?: number; total?: boolean }, opts: { down?: boolean } = {}) {
  const reads: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    reads.push(url.pathname + url.search);
    if (opts.down) return new Response('', { status: 503 });
    const posts = /\/api\/community\/channels\/ch_scholar\/posts$/.exec(url.pathname);
    if (posts) {
      const page = Number(url.searchParams.get('page'));
      const limit = Number(url.searchParams.get('limit'));
      const start = (page - 1) * limit;
      const ids = Array.from({ length: Math.max(0, Math.min(limit, counts.posts - start)) }, (_, i) => start + i);
      return Response.json({
        posts: ids.map((i) => ({ id: `p${i}`, type: 'text', content: 'x', createdAt: '2026-11-01T10:00:00Z', ...(i === 0 ? { updatedAt: '2026-11-12T08:30:00Z' } : {}) })),
        pagination: { page, limit, ...(counts.total === false ? {} : { total: counts.posts }), hasNext: start + limit < counts.posts },
      });
    }
    const list = /\/api\/channels\/ch_scholar\/(videos|shorts)$/.exec(url.pathname);
    if (list) {
      const n = (list[1] === 'videos' ? counts.videos : counts.shorts) ?? 0;
      const offset = Number((url.searchParams.get('cursor') ?? 'o:0').slice(2));
      const limit = Number(url.searchParams.get('limit'));
      const ids = Array.from({ length: Math.max(0, Math.min(limit, n - offset)) }, (_, i) => offset + i);
      const prefix = list[1] === 'videos' ? 'v' : 's';
      return Response.json({ data: ids.map((i) => ({ id: `${prefix}${i}`, title: `T${i}`, channelId: 'ch_scholar', publishedAt: '2026-10-01T00:00:00Z' })), cursor: offset + limit < n ? `o:${offset + limit}` : '' });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const logs: string[] = [];
  const deps: DataDeps = { apiUrl: API, cache: null, waitUntil: () => undefined, fetchImpl, log: (m) => logs.push(m) };
  return { deps, reads, logs };
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => (m[1] as string).replace(/&amp;/g, '&'));
const own = (over = {}) => fixtureSite({ primaryHost: 'example.com', primaryKind: 'custom', ...over });

describe('sitemap entries', () => {
  it('lastmod is a W3C date from the first usable value', () => {
    expect(lastmodOf(null, 'junk', '2026-11-01T10:00:00Z')).toBe('2026-11-01T10:00:00.000Z');
    expect(lastmodOf(undefined, '')).toBeUndefined();
  });

  it('two languages: one entry each, alternates for both plus x-default (the default language)', () => {
    const site = fixtureSite({ locales: ['ar', 'en'] });
    const e = entriesFor(site, SUB, 'posts/p1/');
    expect(e.map((x) => x.loc)).toEqual([`${SUB}/ar/posts/p1/`, `${SUB}/en/posts/p1/`]);
    expect(e[0]?.alternates).toEqual([
      { hreflang: 'ar', href: `${SUB}/ar/posts/p1/` },
      { hreflang: 'en', href: `${SUB}/en/posts/p1/` },
      { hreflang: 'x-default', href: `${SUB}/ar/posts/p1/` },
    ]);
    const xml = urlsetXml(e);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${SUB}/ar/posts/p1/"/>`);
  });

  it('a single-language site: no alternates and no xhtml namespace', () => {
    const site = fixtureSite({ locales: ['ar'] });
    const xml = urlsetXml(entriesFor(site, SUB, 'about/'));
    expect(locs(xml)).toEqual([`${SUB}/ar/about/`]);
    expect(xml).not.toContain('xhtml');
  });
});

describe('sitemap.xml', () => {
  it('a small subdomain site: one urlset with built-ins, published pages and every post, no watch pages', async () => {
    const { deps, reads } = fakeApi({ posts: 120, videos: 30 });
    const site = fixtureSite({
      pages: [
        { id: 'pg1', slug: 'books', title: { en: 'Books' }, status: 'published', updatedAt: '2026-11-05T00:00:00Z' },
        { id: 'pg2', slug: 'draft', title: { en: 'Draft' }, status: 'draft', updatedAt: '2026-11-05T00:00:00Z' },
      ],
    });
    const r = await sitemapRoot(site, SUB, deps);
    expect(r.status).toBe(200);
    const all = locs(r.body);
    expect(r.body).toContain('<urlset');
    expect(all).toContain(`${SUB}/en/`);
    expect(all).toContain(`${SUB}/ar/about/`);
    expect(all).toContain(`${SUB}/en/books/`);
    expect(all).not.toContain(`${SUB}/ar/books/`);
    expect(all.some((u) => u.includes('/draft/'))).toBe(false);
    expect(all.filter((u) => u.includes('/en/posts/p'))).toHaveLength(120);
    expect(all.some((u) => u.includes('/watch/'))).toBe(false);
    // 3 posts pages of 50, no video reads
    expect(reads).toHaveLength(3);
    expect(reads.every((p) => p.includes('/posts?'))).toBe(true);
    // lastmod: the edit date when there is one, else the creation date; pages their updatedAt
    expect(r.body).toContain(`<loc>${SUB}/en/posts/p0/</loc><lastmod>2026-11-12T08:30:00.000Z</lastmod>`);
    expect(r.body).toContain(`<loc>${SUB}/en/posts/p1/</loc><lastmod>2026-11-01T10:00:00.000Z</lastmod>`);
    expect(r.body).toContain(`<loc>${SUB}/en/books/</loc><lastmod>2026-11-05T00:00:00.000Z</lastmod>`);
  });

  it('a small own-domain site also lists every video and Short', async () => {
    const { deps } = fakeApi({ posts: 2, videos: 130, shorts: 3 });
    const r = await sitemapRoot(own(), OWN, deps);
    const all = locs(r.body);
    expect(all.filter((u) => u.startsWith(`${OWN}/en/watch/v`))).toHaveLength(130);
    expect(all).toContain(`${OWN}/ar/watch/s2/`);
    expect(r.body).toContain(`<loc>${OWN}/en/watch/v0/</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod>`);
  });

  it('a big site: an index of files, each file at most FILE_ITEMS items, together complete', async () => {
    const { deps, reads } = fakeApi({ posts: 2_345, videos: 2_050, shorts: 40 });
    const site = own();
    const r = await sitemapRoot(site, OWN, deps);
    expect(r.body).toContain('<sitemapindex');
    const files = locs(r.body);
    expect(files).toEqual([
      `${OWN}/sitemaps/pages.xml`,
      `${OWN}/sitemaps/posts-1.xml`,
      `${OWN}/sitemaps/posts-2.xml`,
      `${OWN}/sitemaps/posts-3.xml`,
      `${OWN}/sitemaps/videos-1.xml`,
      `${OWN}/sitemaps/videos-2.xml?cursor=o%3A1000`,
      `${OWN}/sitemaps/videos-3.xml?cursor=o%3A2000`,
      `${OWN}/sitemaps/shorts-1.xml`,
    ]);
    // index reads: 1 posts page + 21 videos pages + 1 Shorts page
    expect(reads).toHaveLength(23);

    const seen = new Set<string>();
    for (const f of files) {
      const u = new URL(f);
      const file = u.pathname.replace(/^\/sitemaps\/|\.xml$/g, '');
      const res = await sitemapFile(site, OWN, deps, file, u.searchParams.get('cursor'));
      expect(res.status, f).toBe(200);
      const urls = locs(res.body);
      expect(urls.length, f).toBeLessThanOrEqual(FILE_ITEMS * 2);
      for (const url of urls) seen.add(url);
    }
    const count = (re: RegExp) => [...seen].filter((u) => re.test(u)).length;
    expect(count(/\/en\/posts\/p\d+\/$/)).toBe(2_345);
    expect(count(/\/ar\/watch\/v\d+\/$/)).toBe(2_050);
    expect(count(/\/en\/watch\/s\d+\/$/)).toBe(40);
  });

  it('a list ending exactly on a file boundary gets no empty file', async () => {
    const { deps } = fakeApi({ posts: 0, videos: 2_000 });
    const files = locs((await sitemapRoot(own(), OWN, deps)).body);
    expect(files.filter((f) => f.includes('/videos-'))).toEqual([`${OWN}/sitemaps/videos-1.xml`, `${OWN}/sitemaps/videos-2.xml?cursor=o%3A1000`]);
  });

  it('bounds the upstream reads of one request and logs a truncated list', async () => {
    const { deps, reads, logs } = fakeApi({ posts: 10, videos: 100_000 });
    const r = await sitemapRoot(own(), OWN, deps);
    expect(reads.length).toBeLessThanOrEqual(1 + 50 + 1);
    expect(logs).toContain('sites: sitemap video list truncated');
    expect(locs(r.body).filter((f) => f.includes('/videos-'))).toHaveLength(5);
  });

  it('a posts API without a total still splits into files', async () => {
    const { deps } = fakeApi({ posts: 1_200, total: false });
    const files = locs((await sitemapRoot(fixtureSite(), SUB, deps)).body);
    expect(files).toContain(`${SUB}/sitemaps/posts-1.xml`);
    expect(files).toContain(`${SUB}/sitemaps/posts-2.xml`);
  });

  it('api-videos down: the built-in pages only, still a 200', async () => {
    const { deps } = fakeApi({ posts: 10 }, { down: true });
    const r = await sitemapRoot(own(), OWN, deps);
    expect(r.status).toBe(200);
    expect(locs(r.body)).toEqual(['', 'videos/', 'posts/', 'about/'].flatMap((p) => [`${OWN}/en/${p}`, `${OWN}/ar/${p}`]));
  });
});

describe('sitemap files', () => {
  it('refuses unknown files, video files on a subdomain site and later files without their cursor', async () => {
    const { deps } = fakeApi({ posts: 10, videos: 10 });
    expect((await sitemapFile(fixtureSite(), SUB, deps, 'videos-1', null)).status).toBe(404);
    expect((await sitemapFile(own(), OWN, deps, 'videos-2', null)).status).toBe(404);
    expect((await sitemapFile(own(), OWN, deps, 'videos-2', '../x')).status).toBe(404);
    expect((await sitemapFile(own(), OWN, deps, 'posts', null)).status).toBe(404);
    expect((await sitemapFile(own(), OWN, deps, 'pages-1', null)).status).toBe(404);
    expect((await sitemapFile(own(), OWN, deps, 'evil', null)).status).toBe(404);
    expect((await sitemapFile(own(), OWN, deps, 'posts-9', null)).status).toBe(404);
    expect((await sitemapFile(own(), OWN, deps, 'pages', null)).status).toBe(200);
  });

  it('are edge-cacheable like the root sitemap', () => {
    expect(isCacheableRequest(new Request('https://example.com/sitemaps/posts-2.xml'))).toBe(true);
    expect(isCacheableRequest(new Request('https://example.com/sitemaps/videos-2.xml?cursor=o:1000'))).toBe(true);
    expect(isCacheableRequest(new Request('https://example.com/sitemaps/../x.xml'))).toBe(false);
  });
});

describe('page hreflang (every page type)', () => {
  it('x-default falls back to the first language a page has when the default is missing', () => {
    const site = fixtureSite({ locales: ['en', 'ar'] });
    expect(hreflangLinks(site, { ar: '/ar/books/' })).toEqual([{ hreflang: 'ar', href: `${SUB}/ar/books/` }]);
    const three = hreflangLinks(fixtureSite({ locales: ['ar', 'en'] }), alternates(site, 'posts/'));
    expect(three.at(-1)).toEqual({ hreflang: 'x-default', href: `${SUB}/ar/posts/` });
  });

  it('watch pages print hreflang only where they are canonical (own domain)', () => {
    expect(watchHasHreflang(fixtureSite())).toBe(false);
    expect(watchHasHreflang(own())).toBe(true);
  });
});
