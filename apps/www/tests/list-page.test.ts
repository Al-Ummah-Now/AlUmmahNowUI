/**
 * List pages (docs/specs/WWW-PAGES.md §6): the cms.list client and its fallback chain, the
 * built-in /videos and /articles fallbacks, ?page= validation and the numbered pages, and the
 * channel card's mapping (D7). No network, no AI: a fake CMS answers.
 */
import { describe, expect, it } from 'vitest';
import { cmsClient, cmsPaths, snapshotKey, toList, type CmsDeps } from '../src/lib/cms';
import type { ListWire } from '../src/lib/cms-types';
import { validItem, type FeedItem } from '../src/lib/feed';
import { listTitle, loadList, otherLocaleList, pageNumbers, pageQuery, parsePage } from '../src/lib/list-page';
import { CHANNEL_LATEST_MAX, channelCard } from '../src/lib/timeline';
import { post, video } from './feed-fixture';
import { MemoryCache, MemoryKV, waiter } from './helpers';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const VIDEOS = 'https://videos.test';

const head = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug, locale: 'en', title: `Title ${slug}`, summary: 'Intro', seo_title: null, seo_description: null,
  list_kind: 'filter', list_filter: { kinds: ['video', 'playlist', 'channel'], tag: null }, alternates: [{ locale: 'ar', slug: `${slug}-ar` }], ...extra,
});
const wire = (slug: string, o: { pinned?: FeedItem[]; items?: unknown[]; page?: number; pages?: number; total?: number } = {}): ListWire =>
  ({ page: head(slug), pinned: o.pinned ?? [], items: o.items ?? [], page_number: o.page ?? 1, pages: o.pages ?? 1, total: o.total ?? (o.items?.length ?? 0), limit: 20 }) as ListWire;

function setup(fetchCms: CmsDeps['fetchCms'], kv = new MemoryKV()) {
  const w = waiter();
  const deps: CmsDeps = { fetchCms, cacheKeyBase: 'https://www.test/__cms/v1', cache: new MemoryCache() as unknown as Cache, kv: kv as never, waitUntil: w.waitUntil, timeoutMs: 50 };
  return { cms: cmsClient(deps), w, kv };
}

const D = (h: number) => new Date(Date.UTC(2026, 10, 10, 12) - h * 3_600_000).toISOString();

describe('cms.list', () => {
  it('reads /lists/:slug, the head from `page` and the number from `page_number`', async () => {
    const seen: string[] = [];
    const { cms } = setup(async (p) => (seen.push(p), json(wire('videos', { items: [video(1, D(1))], page: 2, pages: 3, total: 41 }))));
    const r = await cms.list('en', 'videos', 2);
    expect(seen).toEqual(['/lists/videos?locale=en&page=2']);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data).toMatchObject({ page: 2, pages: 3, total: 41, head: { slug: 'videos', list_kind: 'filter', alternates: [{ locale: 'ar', slug: 'videos-ar' }] } });
    expect(r.data.items.map((i) => i.key)).toEqual(['v1']);
  });

  it('drops malformed items and repeated keys, never the page', () => {
    const l = toList(wire('x', { pinned: [post(1, D(1), {}, true)], items: [post(1, D(1)), { key: 'nope' }, video(2, D(2))] }), 1);
    expect(l.pinned.map((i) => i.key)).toEqual(['p1']);
    expect(l.items.map((i) => i.key)).toEqual(['v2']);
  });

  it('a page number missing from the answer is the one asked for; bad alternates are dropped', () => {
    const w = { ...wire('x'), page_number: undefined, page: head('x', { alternates: [{ locale: 'fr', slug: 'x' }, { locale: 'ar', slug: '' }, null] }) } as unknown as ListWire;
    const l = toList(w, 4);
    expect(l.page).toBe(4);
    expect(l.head.alternates).toEqual([]);
  });

  it('404 is not_found; an unreachable CMS falls back to the snapshot, then to unavailable', async () => {
    expect((await setup(async () => json({ error: 'not_found' }, 404)).cms.list('en', 'x', 1)).status).toBe('not_found');
    const kv = new MemoryKV();
    await kv.put(snapshotKey(cmsPaths.list('en', 'videos', 1)), JSON.stringify(wire('videos', { items: [video(3, D(1))] })));
    const snap = await setup(async () => json({}, 503), kv).cms.list('en', 'videos', 1);
    expect(snap).toMatchObject({ status: 'ok', source: 'snapshot' });
    expect(await setup(async () => json({}, 503)).cms.list('en', 'other', 1)).toEqual({ status: 'unavailable', source: 'builtin' });
    // An answer without the head is bad JSON (a failure), not an empty list
    expect((await setup(async () => json({ items: [], pages: 1, total: 0, page_number: 1 })).cms.list('en', 'x', 1)).status).toBe('unavailable');
  });
});

describe('loadList', () => {
  const posts = (total: number) => async (p: string) => {
    if (p.startsWith('/lists/')) return json({ error: 'not_found' }, 404);
    const u = new URL(`https://cms${p}`);
    const page = Number(u.searchParams.get('page'));
    const limit = Number(u.searchParams.get('limit'));
    const n = Math.max(0, Math.min(limit, total - (page - 1) * limit));
    const items = Array.from({ length: n }, (_, i) => ({ slug: `s${i}`, locale: 'en', title: `Post ${i}`, excerpt: null, cover: null, author_name: null, tags: [], published_at: D(i), updated_at: D(i) }));
    return json({ items, page, limit, total });
  };

  it('a CMS list: pinned on page 1, the alternates as slugs per locale', async () => {
    const { cms } = setup(async () => json(wire('picks', { pinned: [post(9, D(9), {}, true)], items: [video(1, D(1))], total: 1 })));
    const r = await loadList({ cms, locale: 'en', slug: 'picks', page: 1 });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.view).toMatchObject({ origin: 'cms', title: 'Title picks', summary: 'Intro', page: 1, pages: 1, slugs: { en: 'picks', ar: 'picks-ar' } });
    expect(r.view.pinned).toHaveLength(1);
  });

  it('404 past the last page when the CMS says so', async () => {
    const { cms } = setup(async () => json(wire('videos', { page: 3, pages: 2, total: 30 })));
    expect((await loadList({ cms, locale: 'en', slug: 'videos', page: 3, builtin: 'videos' })).status).toBe('not_found');
  });

  it('no CMS page: /articles is the built-in filter page from /posts, 20 per page', async () => {
    const { cms } = setup(posts(45));
    const r = await loadList({ cms, locale: 'en', slug: 'articles', page: 3, builtin: 'articles' });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.view).toMatchObject({ origin: 'builtin', title: 'Articles', page: 3, pages: 3, total: 45 });
    expect(r.view.items.map((i) => i.key)).toEqual(['p41', 'p42', 'p43', 'p44', 'p45']);
    expect((await loadList({ cms, locale: 'en', slug: 'articles', page: 4, builtin: 'articles' })).status).toBe('not_found');
  });

  it('no CMS page: /videos page 1 is the built-in empty page; past it 404', async () => {
    const { cms } = setup(async () => json({ error: 'not_found' }, 404));
    const r = await loadList({ cms, locale: 'ar', slug: 'videos', page: 1, builtin: 'videos' });
    expect(r).toMatchObject({ status: 'ok', view: { origin: 'builtin', title: 'المرئيات', items: [], pages: 1 } });
    expect((await loadList({ cms, locale: 'ar', slug: 'videos', page: 2, builtin: 'videos' })).status).toBe('not_found');
  });

  it('CMS down: the built-in pages still answer page 1 (and never 404 page 2 on a guess)', async () => {
    const { cms } = setup(async () => json({}, 503));
    expect((await loadList({ cms, locale: 'en', slug: 'videos', page: 1, builtin: 'videos' })).status).toBe('ok');
    expect((await loadList({ cms, locale: 'en', slug: 'videos', page: 2, builtin: 'videos' })).status).toBe('ok');
    expect((await loadList({ cms, locale: 'en', slug: 'articles', page: 1, builtin: 'articles' })).status).toBe('ok');
    expect((await loadList({ cms, locale: 'en', slug: 'articles', page: 2, builtin: 'articles' })).status).toBe('ok');
  });

  it('without a built-in, a missing page is not_found and an unreachable one unavailable', async () => {
    expect((await loadList({ cms: setup(async () => json({}, 404)).cms, locale: 'en', slug: 'x', page: 1 })).status).toBe('not_found');
    expect((await loadList({ cms: setup(async () => json({}, 500)).cms, locale: 'en', slug: 'x', page: 1 })).status).toBe('unavailable');
  });

  it('an empty list points at the other language when that one has items', async () => {
    const slugOf = (p: string) => decodeURIComponent(p.split('?')[0]!.split('/').pop()!).replace(/-ar$/, '');
    const { cms } = setup(async (p) => json(wire(slugOf(p), p.includes('locale=ar') ? { items: [post(1, D(1))], total: 1 } : {})));
    const r = await loadList({ cms, locale: 'en', slug: 'articles', page: 1, builtin: 'articles' });
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(await otherLocaleList(cms, 'en', r.view, 'articles')).toBe('/ar/articles/');
    const s = await loadList({ cms, locale: 'en', slug: 'picks', page: 1 });
    if (s.status !== 'ok') throw new Error('expected ok');
    expect(await otherLocaleList(cms, 'en', s.view)).toBe('/ar/picks-ar/');
    // A list with items never looks
    const full = await loadList({ cms: setup(async () => json(wire('x', { items: [post(1, D(1))], total: 1 }))).cms, locale: 'en', slug: 'x', page: 1 });
    if (full.status !== 'ok') throw new Error('expected ok');
    expect(await otherLocaleList(cms, 'en', full.view)).toBeNull();
  });
});

describe('paging', () => {
  it('?page= is a positive number without leading zeros, at most 4 digits', () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage('2')).toBe(2);
    for (const bad of ['0', '-1', '01', '1.5', 'abc', '', '10000', '2 ']) expect(parsePage(bad), bad).toBeNull();
  });

  it('page 1 has one URL; later pages carry ?page=', () => {
    expect(pageQuery(1)).toBe('');
    expect(pageQuery(3)).toBe('?page=3');
  });

  it('numbers: first, last, the neighbours, gaps of more than one page', () => {
    expect(pageNumbers(1, 1)).toEqual([]);
    expect(pageNumbers(1, 2)).toEqual([1, 2]);
    expect(pageNumbers(1, 5)).toEqual([1, 2, 'gap', 5]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageNumbers(12, 12)).toEqual([1, 'gap', 11, 12]);
  });

  it('the title says the page past the first', () => {
    const view = { seoTitle: null, title: 'Articles', page: 2, pages: 5 } as Parameters<typeof listTitle>[0];
    expect(listTitle(view, (p, n) => `Page ${p} of ${n}`)).toBe('Articles: Page 2 of 5');
    expect(listTitle({ ...view, page: 1, seoTitle: 'All articles' }, () => '')).toBe('All articles');
  });
});

describe('channel items (D7)', () => {
  const NOW = Date.UTC(2026, 10, 10, 12);
  const channel = (extra: Record<string, unknown> = {}) => ({
    kind: 'channel' as const,
    ref_id: 'ch-1',
    title_override: null,
    snapshot: {
      title: 'Knowledge channel',
      thumbnail_url: 'https://images.alummahnow.net/avatar.jpg',
      channel_name: null,
      handle: 'knowledge',
      titles: { ar: 'قناة العلم' },
      latest: [
        { id: 'a1', title: 'Lesson one.mp4', thumbnail_url: 'https://images.alummahnow.net/a1.jpg', duration_seconds: 3725 },
        { id: 'a2', title: 'Lesson two', thumbnail_url: `https://images.alummahnow.net/a2.jpg?token=x&expires=${NOW / 1000 - 10}`, duration_seconds: null },
        { id: 'bad id!', title: 'Skipped', thumbnail_url: null, duration_seconds: 5 },
        { id: 'a3', title: 'Lesson three', thumbnail_url: null, duration_seconds: 65 },
        { id: 'a4', title: 'Lesson four', thumbnail_url: null, duration_seconds: 65 },
      ],
      ...extra,
    },
  });

  it('is a valid feed item', () => {
    expect(validItem({ key: 'v5', type: 'video', date: D(1), pinned: false, video: channel() })).toBe(true);
  });

  it('maps name, handle, avatar, the latest ≤ 3 linked videos and the channel link', () => {
    const c = channelCard(channel(), 'en', VIDEOS, 'Channel', NOW)!;
    expect(c).toMatchObject({ id: 'ch-1', name: 'Knowledge channel', handle: 'knowledge', avatarUrl: 'https://images.alummahnow.net/avatar.jpg', href: `${VIDEOS}/en/@knowledge` });
    expect(c.latest).toHaveLength(CHANNEL_LATEST_MAX);
    expect(c.latest.map((v) => v.id)).toEqual(['a1', 'a2', 'a3']);
    expect(c.latest[0]).toEqual({ id: 'a1', title: 'Lesson one', thumbnailUrl: 'https://images.alummahnow.net/a1.jpg', duration: '1:02:05', href: `${VIDEOS}/en/video/a1` });
    // An expired signed thumbnail is dropped (the card shows the placeholder)
    expect(c.latest[1]!.thumbnailUrl).toBeNull();
    expect(c.latest[1]!.duration).toBeNull();
  });

  it('Arabic: the localized name and Arabic watch links; the editor title wins', () => {
    const c = channelCard(channel(), 'ar', VIDEOS, 'قناة', NOW)!;
    expect(c.name).toBe('قناة العلم');
    expect(c.latest[0]!.href).toBe(`${VIDEOS}/ar/video/a1`);
    expect(channelCard({ ...channel(), title_override: 'Our pick' }, 'ar', VIDEOS, 'قناة', NOW)!.name).toBe('Our pick');
  });

  it('no handle → the channel id link; no snapshot → the fallback title, no videos; a bad id → no card', () => {
    const c = channelCard({ ...channel(), snapshot: null }, 'en', VIDEOS, 'Channel', NOW)!;
    expect(c).toMatchObject({ name: 'Channel', handle: null, avatarUrl: null, href: `${VIDEOS}/en/channels/ch-1`, latest: [] });
    expect(channelCard({ ...channel(), ref_id: '../x' }, 'en', VIDEOS, 'Channel', NOW)).toBeNull();
    expect(channelCard({ ...channel(), kind: 'video' }, 'en', VIDEOS, 'Channel', NOW)).toBeNull();
  });

  it('a snapshot without `latest` (refreshed before D7) shows no videos', () => {
    expect(channelCard(channel({ latest: undefined }), 'en', VIDEOS, 'Channel', NOW)!.latest).toEqual([]);
  });
});
