/** Scholar sites on www (AUN-SCHOLAR-SITES SS6/SS7, AlUmmahNow#1215): lookup, head links, sitemap exclusions. */
import { describe, expect, it } from 'vitest';
import { channelSite, mapLimit, siteHome, siteHreflang, sitePostSeo, siteUrl, toSiteLink, type SiteLookup } from '../src/lib/scholar-site';
import { buildSitemap, MAX_SITE_LOOKUPS, withoutSiteCanonicals } from '../src/lib/sitemap';
import type { VideosDeps } from '../src/lib/videos';
import { MemoryCache, waiter } from './helpers';

const SUB = { channelId: 'ch1', primaryHost: 'mustafa.alummahnow.org', primaryKind: 'subdomain', locales: ['en', 'ar'] };
const OWN = { channelId: 'ch2', primaryHost: 'example.com', primaryKind: 'custom', locales: ['ar'] };

function deps(answer: (url: string, signal?: AbortSignal) => Response | Promise<Response>, cache: MemoryCache | null = null) {
  const calls: string[] = [];
  const logs: string[] = [];
  const w = waiter();
  const d: VideosDeps = {
    apiUrl: 'https://videos.api.test',
    cache: cache as unknown as Cache,
    cacheKeyBase: 'https://www.test/__videos/v1',
    waitUntil: w.waitUntil,
    timeoutMs: 50,
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input));
      return answer(String(input), init?.signal ?? undefined);
    }) as typeof fetch,
    log: (m) => logs.push(m),
  };
  return { d, calls, logs, flush: w.flush };
}

describe('the by-channel answer', () => {
  it('accepts a live site on a subdomain or an own domain', () => {
    expect(toSiteLink(SUB, 'ch1')).toEqual(SUB);
    expect(toSiteLink(OWN, 'ch2')).toEqual(OWN);
  });

  it('refuses anything off: bad host, kind, languages, another channel', () => {
    for (const host of ['evil.com/x', 'EVIL.com', 'a b.com', 'evil.com:443', 'localhost', '.evil.com', 'evil..com', 'https://evil.com', '']) {
      expect(toSiteLink({ ...SUB, primaryHost: host }, 'ch1'), host).toBeNull();
    }
    expect(toSiteLink({ ...SUB, primaryKind: 'other' }, 'ch1')).toBeNull();
    expect(toSiteLink({ ...SUB, locales: [] }, 'ch1')).toBeNull();
    expect(toSiteLink({ ...SUB, locales: ['en', 'fr'] }, 'ch1')).toBeNull();
    expect(toSiteLink({ ...SUB, locales: ['en', 'en'] }, 'ch1')).toBeNull();
    expect(toSiteLink(SUB, 'other-channel')).toBeNull();
    expect(toSiteLink('nope', 'ch1')).toBeNull();
  });
});

describe('channelSite', () => {
  it('live: the link, cached five minutes, one read per request with a memo', async () => {
    const cache = new MemoryCache();
    const { d, calls, flush } = deps(() => Response.json(SUB, { headers: { 'Cache-Control': 'public, max-age=300' } }), cache);
    const memo = new Map<string, Promise<SiteLookup>>();
    expect(await channelSite(d, 'ch1', memo)).toEqual({ kind: 'live', link: SUB });
    expect(await channelSite(d, 'ch1', memo)).toEqual({ kind: 'live', link: SUB });
    expect(calls).toEqual(['https://videos.api.test/api/sites/by-channel/ch1']);
    await flush();
    const stored = cache.store.get('https://www.test/__videos/v1/site-by-channel/ch1');
    expect(stored?.headers.get('Cache-Control')).toBe('public, max-age=300');
    // a later request reads the cache
    expect(await channelSite(d, 'ch1')).toEqual({ kind: 'live', link: SUB });
    expect(calls).toHaveLength(1);
  });

  it('no site (404): none, and the answer is cached too', async () => {
    const cache = new MemoryCache();
    const { d, calls, flush } = deps(() => Response.json({ error: 'site_not_found' }, { status: 404 }), cache);
    expect(await channelSite(d, 'ch1')).toEqual({ kind: 'none' });
    await flush();
    expect(await channelSite(d, 'ch1')).toEqual({ kind: 'none' });
    expect(calls).toHaveLength(1);
  });

  it('API down, timeout or a malformed body: unknown (www stays canonical), never cached', async () => {
    const cache = new MemoryCache();
    for (const answer of [
      () => new Response('', { status: 503 }),
      () => Response.json({ ...SUB, primaryHost: 'evil.com/path' }),
      () => new Response('<html>', { status: 200 }),
      () => Promise.reject(new Error('network')),
      // never answers: the timeout aborts it, as fetch does
      (_: string, signal?: AbortSignal) => new Promise<Response>((_ok, fail) => signal?.addEventListener('abort', () => fail(new Error('aborted')))),
    ]) {
      const { d, logs, flush } = deps(answer, cache);
      expect(await channelSite(d, 'ch1')).toEqual({ kind: 'unknown' });
      await flush();
      expect(logs.length).toBe(1);
    }
    expect(cache.store.size).toBe(0);
  });

  it('no channel or a junk id: none, without a read', async () => {
    const { d, calls } = deps(() => Response.json(SUB));
    expect(await channelSite(d, null)).toEqual({ kind: 'none' });
    expect(await channelSite(d, '../x')).toEqual({ kind: 'none' });
    expect(calls).toHaveLength(0);
  });
});

describe('site URLs', () => {
  it('the page language when the site serves it, else its default', () => {
    expect(siteUrl(SUB as never, 'ar', 'about/')).toBe('https://mustafa.alummahnow.org/ar/about/');
    expect(siteUrl(OWN as never, 'en', 'about/')).toBe('https://example.com/ar/about/');
  });

  it('scholar page: canonical on the site home in its default language, hreflang on its languages', () => {
    expect(siteHome({ ...SUB, locales: ['ar', 'en'] } as never)).toEqual({
      canonical: 'https://mustafa.alummahnow.org/ar/',
      hreflang: [
        { hreflang: 'ar', href: 'https://mustafa.alummahnow.org/ar/' },
        { hreflang: 'en', href: 'https://mustafa.alummahnow.org/en/' },
        { hreflang: 'x-default', href: 'https://mustafa.alummahnow.org/ar/' },
      ],
    });
    expect(siteHome(OWN as never)).toEqual({ canonical: 'https://example.com/ar/', hreflang: [{ hreflang: 'ar', href: 'https://example.com/ar/' }] });
  });

  it('post reference: canonical on the site post page in the post language (or the site default)', () => {
    expect(sitePostSeo(SUB as never, 'en', 'cp_1').canonical).toBe('https://mustafa.alummahnow.org/en/posts/cp_1/');
    expect(sitePostSeo(OWN as never, 'en', 'cp_1')).toEqual({ canonical: 'https://example.com/ar/posts/cp_1/', hreflang: [{ hreflang: 'ar', href: 'https://example.com/ar/posts/cp_1/' }] });
  });

  it('hreflang: the site languages plus x-default (its default); one entry for a single-language site', () => {
    expect(siteHreflang({ primaryHost: 'example.com', locales: ['ar', 'en'] }, 'about/')).toEqual([
      { hreflang: 'ar', href: 'https://example.com/ar/about/' },
      { hreflang: 'en', href: 'https://example.com/en/about/' },
      { hreflang: 'x-default', href: 'https://example.com/ar/about/' },
    ]);
    expect(siteHreflang(OWN as never, 'about/')).toEqual([{ hreflang: 'ar', href: 'https://example.com/ar/about/' }]);
  });

  it('mapLimit keeps order and the bound', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, 1));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBe(2);
  });
});

describe('www sitemap without site canonicals', () => {
  const items = [
    { type: 'post' as const, locale: 'en' as const, slug: 'staff-post', updated_at: '2026-11-10T00:00:00Z' },
    { type: 'post' as const, locale: 'en' as const, slug: 'site-ref', updated_at: '2026-11-10T00:00:00Z', ref_post_id: 'cp1', ref_channel_id: 'ch_site' },
    { type: 'post' as const, locale: 'ar' as const, slug: 'nosite-ref', updated_at: '2026-11-10T00:00:00Z', ref_post_id: 'cp2', ref_channel_id: 'ch_none' },
    { type: 'post' as const, locale: 'en' as const, slug: 'down-ref', updated_at: '2026-11-10T00:00:00Z', ref_post_id: 'cp3', ref_channel_id: 'ch_down' },
    { type: 'page' as const, locale: 'en' as const, slug: 'about', updated_at: '2026-11-10T00:00:00Z' },
  ];
  const scholars = [
    { slug: 'with-site', updated_at: '2026-11-10T00:00:00Z', primary_channel_id: 'ch_site' },
    { slug: 'no-site', updated_at: '2026-11-10T00:00:00Z', primary_channel_id: 'ch_none' },
    { slug: 'api-down', updated_at: '2026-11-10T00:00:00Z', primary_channel_id: 'ch_down' },
    { slug: 'older-cms', updated_at: '2026-11-10T00:00:00Z' },
  ];
  const lookup = async (c: string): Promise<SiteLookup> => (c === 'ch_site' ? { kind: 'live', link: { ...SUB, channelId: c } as never } : c === 'ch_none' ? { kind: 'none' } : { kind: 'unknown' });

  it('leaves out the scholar page and the posts of a channel with a live site; keeps the rest', async () => {
    const asked: string[] = [];
    const out = await withoutSiteCanonicals({ items, scholars }, (c) => (asked.push(c), lookup(c)));
    expect(asked.sort()).toEqual(['ch_down', 'ch_none', 'ch_site']);
    expect(out.items.map((i) => i.slug)).toEqual(['staff-post', 'nosite-ref', 'down-ref', 'about']);
    expect(out.scholars.map((s) => s.slug)).toEqual(['no-site', 'api-down', 'older-cms']);
    const xml = buildSitemap('https://www.alummahnow.net', out.items, out.scholars);
    expect(xml).not.toContain('/scholars/with-site/');
    expect(xml).not.toContain('/articles/site-ref/');
    expect(xml).toContain('/ar/articles/nosite-ref/');
    expect(xml).toContain('/en/scholars/api-down/');
  });

  it('every white-label site counts, on a platform subdomain or an own domain (§4.4)', async () => {
    const both = async (c: string): Promise<SiteLookup> =>
      c === 'ch_sub' ? { kind: 'live', link: { ...SUB, channelId: c } as never } : c === 'ch_own' ? { kind: 'live', link: { ...OWN, channelId: c } as never } : { kind: 'none' };
    const out = await withoutSiteCanonicals(
      {
        items: [
          { type: 'post', locale: 'en', slug: 'sub-ref', updated_at: '2026-11-10T00:00:00Z', ref_post_id: 'cp1', ref_channel_id: 'ch_sub' },
          { type: 'post', locale: 'ar', slug: 'own-ref', updated_at: '2026-11-10T00:00:00Z', ref_post_id: 'cp2', ref_channel_id: 'ch_own' },
        ],
        scholars: [
          { slug: 'on-subdomain', updated_at: '2026-11-10T00:00:00Z', primary_channel_id: 'ch_sub' },
          { slug: 'on-own-domain', updated_at: '2026-11-10T00:00:00Z', primary_channel_id: 'ch_own' },
        ],
      },
      both,
    );
    expect(out.items).toEqual([]);
    expect(out.scholars).toEqual([]);
  });

  it('a thrown lookup keeps the URLs; nothing to look up is no lookup', async () => {
    const out = await withoutSiteCanonicals({ items, scholars }, async () => {
      throw new Error('boom');
    });
    expect(out.items).toHaveLength(items.length);
    let n = 0;
    await withoutSiteCanonicals({ items: [items[0]!], scholars: [scholars[3]!] }, async () => (n++, { kind: 'none' }));
    expect(n).toBe(0);
  });

  it('bounds the lookups of one build', async () => {
    const many = Array.from({ length: MAX_SITE_LOOKUPS + 20 }, (_, i) => ({ slug: `s${i}`, updated_at: '2026-11-10T00:00:00Z', primary_channel_id: `ch${i}` }));
    let n = 0;
    const logs: string[] = [];
    await withoutSiteCanonicals({ items: [], scholars: many }, async () => (n++, { kind: 'none' }), (m) => logs.push(m));
    expect(n).toBe(MAX_SITE_LOOKUPS);
    expect(logs).toEqual(['sitemap: scholar site lookups capped']);
  });
});
