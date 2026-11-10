import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import { isCacheableRequest } from '../src/lib/edge';
import {
  compareItems,
  cursorOf,
  dayKey,
  dayLabel,
  FeedMissing,
  groupByDay,
  parseCursor,
  readPage,
  relativeTime,
  validHead,
  type FeedItem,
  type KvGet,
} from '../src/lib/feed';
import { cardCountLabel, feedVideoItem, loadTimeline } from '../src/lib/timeline';
import { isoWeek, layoutFeed, post, video } from './feed-fixture';

function getter(kv: Map<string, string>, log: string[] = []): KvGet {
  return async (key) => {
    log.push(key);
    const v = kv.get(key);
    return v === undefined ? null : JSON.parse(v);
  };
}

async function walk(kv: Map<string, string>, size = 20) {
  const seen: FeedItem[] = [];
  let before: string | null = null;
  let pages = 0;
  for (;;) {
    const p = await readPage(getter(kv), 'en', before, size);
    seen.push(...p.items);
    pages++;
    if (!p.next) break;
    before = p.next;
    if (pages > 1000) throw new Error('loop');
  }
  return seen;
}

describe('ISO weeks (UTC), as the CMS stores buckets', () => {
  it('handles year boundaries and week 53', () => {
    expect(isoWeek('2025-12-29T00:00:00Z')).toBe('2026-W01');
    expect(isoWeek('2026-11-10T12:00:00Z')).toBe('2026-W46');
    expect(isoWeek('2026-12-28T00:00:00Z')).toBe('2026-W53');
    expect(isoWeek('2027-01-03T23:59:59Z')).toBe('2026-W53');
    expect(isoWeek('2027-01-04T00:00:00Z')).toBe('2027-W01');
  });
});

describe('cursor paging over the head and the week buckets', () => {
  // 300 items from Dec 2025 to Feb 2027 (crossing 2026-W53 and two year boundaries), with ties.
  const items: FeedItem[] = [];
  const start = Date.UTC(2025, 11, 20);
  for (let i = 0; i < 300; i++) {
    const ms = start + Math.floor(i / 3) * 4.5 * 86_400_000 + (i % 3 === 2 ? 0 : (i % 3) * 3_600_000);
    const date = new Date(ms).toISOString();
    items.push(i % 7 === 0 ? video(i + 1, date) : post(i + 1, date));
  }
  // Two items at the very same instant (a post and a video): the tie order is v before p, id desc.
  items.push(post(1001, '2026-12-31T23:59:59.000Z'), video(1002, '2026-12-31T23:59:59.000Z'));
  items.push(post(2000, '2026-06-01T00:00:00.000Z', {}, true));
  const kv = layoutFeed('en', items);
  const expected = items.filter((i) => !i.pinned).sort(compareItems);

  it('visits every item once, in order, with no gaps (page sizes 20, 7, 41)', async () => {
    for (const size of [20, 7, 41]) {
      const seen = await walk(kv, size);
      expect(seen.map((i) => i.key)).toEqual(expected.map((i) => i.key));
    }
  });

  it('keeps pinned items out of the dated stream and on the first page only', async () => {
    const first = await readPage(getter(kv), 'en', null);
    expect(first.pinned.map((i) => i.key)).toEqual(['p2000']);
    const second = await readPage(getter(kv), 'en', first.next);
    expect(second.pinned).toEqual([]);
  });

  it('crosses ISO week 53 and the year boundary without duplicates', async () => {
    const at = expected.findIndex((i) => isoWeek(i.date) === '2027-W01');
    const cursor = cursorOf(expected[at]!);
    const page = await readPage(getter(kv), 'en', cursor, 10);
    expect(page.items.map((i) => i.key)).toEqual(expected.slice(at + 1, at + 11).map((i) => i.key));
    expect(page.items.some((i) => isoWeek(i.date) === '2026-W53')).toBe(true);
  });

  it('reads one key for the first page, on the 1st of a month and mid-month', async () => {
    for (const newest of ['2026-12-01T06:00:00.000Z', '2026-12-15T06:00:00.000Z']) {
      const list = [...items.filter((i) => Date.parse(i.date) < Date.parse(newest)), post(5000, newest)];
      const log: string[] = [];
      const p = await readPage(getter(layoutFeed('en', list), log), 'en', null);
      expect(p.reads).toBe(1);
      expect(log).toEqual(['feed:en:head']);
      expect(p.items[0]!.key).toBe('p5000');
    }
  });

  it('pages after the first follow the week pointers (via "pointer")', async () => {
    const first = await readPage(getter(kv), 'en', null);
    expect(first.next).toMatch(/^\d+-[pv]\d+\.\d{4}-W\d{2}\.b1$/);
    const second = await readPage(getter(kv), 'en', first.next);
    expect(second.via).toBe('pointer');
  });

  it('load more is one KV read when a week holds a page (a few posts a day)', async () => {
    const dense: FeedItem[] = [];
    // 25 posts a week for 6 weeks (Monday 2026-09-28 onwards), newest week last.
    for (let w = 0; w < 6; w++) for (let i = 0; i < 25; i++) dense.push(post(w * 100 + i + 1, new Date(Date.UTC(2026, 8, 28 + w * 7, 1 + i * 6)).toISOString()));
    const map = layoutFeed('en', dense);
    const first = await readPage(getter(map), 'en', null);
    const reads: number[] = [];
    let next = first.next;
    while (next) {
      const p = await readPage(getter(map), 'en', next);
      reads.push(p.reads);
      next = p.next;
    }
    expect(Math.max(...reads)).toBeLessThanOrEqual(2);
    expect(reads.filter((r) => r === 1).length).toBeGreaterThanOrEqual(Math.floor(reads.length / 2));
  });

  it('a cursor from a superseded build follows the tombstone (moved) or falls back (gone)', async () => {
    const first = await readPage(getter(kv), 'en', null);
    const second = await readPage(getter(kv), 'en', first.next);
    // Rebuild: one old item deleted, one inserted into an old week; the cached page-1 cursor still works.
    const removed = second.items[3]!.key;
    const next = [...items.filter((i) => i.key !== removed), post(7777, second.items[5]!.date.replace(/\.\d{3}Z$/, '.500Z'))];
    const rebuilt = layoutFeed('en', next, 'b2', undefined, { kv, build: 'b1' });
    const again = await readPage(getter(rebuilt), 'en', first.next);
    const want = next.filter((i) => !i.pinned).sort(compareItems);
    const cursor = parseCursor(first.next)!;
    const expectKeys = want.filter((i) => compareItems(i, { ...i, date: new Date(cursor.ms).toISOString(), key: cursor.key }) > 0).slice(0, 20).map((i) => i.key);
    expect(again.items.map((i) => i.key)).toEqual(expectKeys);
    expect(again.items.map((i) => i.key)).not.toContain(removed);
    // A week that no longer exists at all: the walk falls back to the year index.
    const empty = layoutFeed('en', items.slice(0, 5), 'b3', undefined, { kv, build: 'b1' });
    const gone = await readPage(getter(empty), 'en', second.next);
    expect(gone.via).toBe('index');
  });

  it('skips years wholly newer than the cursor (no year index read)', async () => {
    const old = expected.findIndex((i) => i.date.startsWith('2026-01-1'));
    const log: string[] = [];
    await readPage(getter(kv, log), 'en', cursorOf(expected[old]!));
    expect(log.some((k) => k.startsWith('feed:en:y:2027'))).toBe(false);
    expect(log.some((k) => k.startsWith('feed:en:y:2026'))).toBe(true);
  });

  it('an item added at the top does not shift the next page (cursor, not offset)', async () => {
    const first = await readPage(getter(kv), 'en', null);
    const grown = layoutFeed('en', [...items, post(9999, '2027-03-01T00:00:00.000Z')], 'b2', undefined, { kv, build: 'b1' });
    const a = await readPage(getter(kv), 'en', first.next);
    const b = await readPage(getter(grown), 'en', first.next);
    expect(b.items.map((i) => i.key)).toEqual(a.items.map((i) => i.key));
  });
});

describe('missing or broken feed', () => {
  it('throws FeedMissing without a head, or with a malformed one', async () => {
    await expect(readPage(getter(new Map()), 'en', null)).rejects.toBeInstanceOf(FeedMissing);
    const bad = new Map([['feed:en:head', JSON.stringify({ v: 1, build: 'x', items: [{ key: 'nope' }] })]]);
    await expect(readPage(getter(bad), 'en', null)).rejects.toBeInstanceOf(FeedMissing);
    expect(validHead({ v: 2 })).toBe(false);
  });

  it('falls back to the CMS posts list (never an error page)', async () => {
    const kv = { get: async () => null } as never;
    const cms = {
      posts: async () => ({
        status: 'ok' as const,
        source: 'snapshot' as const,
        data: { items: [{ slug: 'a', locale: 'en' as const, title: 'A', excerpt: null, cover: null, author_name: null, tags: [], published_at: '2026-11-09T10:00:00.000Z', updated_at: '2026-11-09T10:00:00.000Z' }], page: 1, limit: 20, total: 45 },
      }),
    };
    const page = await loadTimeline({ kv, cms, locale: 'en', before: null, page: 1 });
    expect(page.source).toBe('fallback');
    expect(page.items.map((i) => i.post?.slug)).toEqual(['a']);
    expect(page.nextHref).toBe('/en/?page=2');
  });

  it('uses the feed when the head is there', async () => {
    const map = layoutFeed('en', [post(1, '2026-11-10T08:00:00.000Z')]);
    const kv = { get: async (k: string) => (map.has(k) ? JSON.parse(map.get(k)!) : null) } as never;
    const page = await loadTimeline({ kv, cms: { posts: async () => { throw new Error('not called'); } }, locale: 'en', before: null, page: 1 });
    expect(page.source).toBe('feed');
    expect(page.builtAt).toBe('2026-11-10T12:00:00.000Z');
  });
});

describe('day headings', () => {
  const now = new Date('2026-11-10T09:00:00.000Z');
  it('labels Today, Yesterday, the weekday within a week, then the date (en and ar)', () => {
    expect(dayLabel('2026-11-10', now, 'en', en.timeline)).toBe('Today');
    expect(dayLabel('2026-11-09', now, 'en', en.timeline)).toBe('Yesterday');
    expect(dayLabel('2026-11-06', now, 'en', en.timeline)).toBe('Friday');
    expect(dayLabel('2026-10-20', now, 'en', en.timeline)).toBe('Tuesday 20 October');
    expect(dayLabel('2025-10-20', now, 'en', en.timeline)).toBe('Monday, 20 October 2025');
    expect(dayLabel('2026-11-10', now, 'ar', ar.timeline)).toBe('اليوم');
    expect(dayLabel('2026-11-09', now, 'ar', ar.timeline)).toBe('أمس');
    expect(dayLabel('2026-11-06', now, 'ar', ar.timeline)).toBe('الجمعة');
  });

  it('groups by the reader’s day: 23:30 UTC is tomorrow in Riyadh', () => {
    expect(dayKey('2026-11-10T23:30:00.000Z', 'UTC')).toBe('2026-11-10');
    expect(dayKey('2026-11-10T23:30:00.000Z', 'Asia/Riyadh')).toBe('2026-11-11');
    const late = new Date('2026-11-10T22:00:00.000Z');
    expect(dayLabel('2026-11-11', late, 'en', en.timeline, 'Asia/Riyadh')).toBe('Today');
    expect(dayLabel('2026-11-10', late, 'en', en.timeline, 'Asia/Riyadh')).toBe('Yesterday');
    const groups = groupByDay([post(1, '2026-11-10T23:30:00.000Z'), post(2, '2026-11-10T20:00:00.000Z'), post(3, '2026-11-09T10:00:00.000Z')], 'Asia/Riyadh');
    expect(groups.map((g) => [g.day, g.items.length])).toEqual([['2026-11-11', 1], ['2026-11-10', 1], ['2026-11-09', 1]]);
  });

  it('relative times', () => {
    expect(relativeTime('2026-11-10T08:00:00.000Z', now, 'en')).toBe('1 hour ago');
    expect(relativeTime('2026-11-08T09:00:00.000Z', now, 'en')).toBe('2 days ago');
  });
});

describe('cards and videos in the feed', () => {
  it('counts cards with the Arabic plural forms', () => {
    expect([1, 2, 3, 10, 11].map((n) => cardCountLabel(ar.timeline, n))).toEqual(['بطاقة واحدة', 'بطاقتان', '3 بطاقات', '10 بطاقات', '11 بطاقة']);
    expect(cardCountLabel(en.timeline, 8)).toBe('8 cards');
  });

  it('turns a feed video into a facade item: snapshot, title override, or a plain card', () => {
    const snap = { title: 'Lesson 4.mp4', thumbnail_url: 'https://images.alummahnow.net/t.jpg', channel_name: 'Ch', titles: { ar: 'الدرس' } };
    expect(feedVideoItem({ kind: 'video', ref_id: 'abc', snapshot: snap }, 'en', 'Video')).toMatchObject({ id: 'abc', title: 'Lesson 4', thumbnailUrl: 'https://images.alummahnow.net/t.jpg' });
    expect(feedVideoItem({ kind: 'video', ref_id: 'abc', snapshot: snap }, 'ar', 'مقطع').title).toBe('الدرس');
    expect(feedVideoItem({ kind: 'video', ref_id: 'abc', snapshot: snap, title_override: 'Picked' }, 'en', 'Video').title).toBe('Picked');
    expect(feedVideoItem({ kind: 'video', ref_id: 'abc', snapshot: null }, 'en', 'Video')).toMatchObject({ title: 'Video', thumbnailUrl: null });
  });
});

describe('cursors and the edge cache', () => {
  it('parses only well-formed cursors', () => {
    expect(parseCursor('1762780000000-p123')).toEqual({ ms: 1762780000000, key: 'p123' });
    expect(parseCursor('1762780000000-v9.2026-W53.k3x9')).toEqual({ ms: 1762780000000, key: 'v9', next: { week: '2026-W53', build: 'k3x9' } });
    expect(parseCursor('1762780000000-v9.2026-W53.B!')).toBeNull();
    expect(parseCursor('1762780000000-x1')).toBeNull();
    expect(parseCursor('abc')).toBeNull();
  });
  it('caches ?before=<cursor> home pages, not junk values', () => {
    const req = (q: string) => new Request(`https://www.example/en/${q}`);
    expect(isCacheableRequest(req('?before=1762780000000-p123'))).toBe(true);
    expect(isCacheableRequest(req('?before=1762780000000-p123.2026-W46.abc123'))).toBe(true);
    expect(isCacheableRequest(req('?before=junk'))).toBe(false);
    expect(isCacheableRequest(req('?before=1762780000000-p123&utm=x'))).toBe(false);
  });
});
