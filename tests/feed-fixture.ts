/**
 * A feed laid out in KV keys exactly as the CMS feed job writes it (AlUmmahNowCMS
 * src/lib/feed/jobs.ts + model.ts): the head (pinned, newest HEAD_SIZE, their weeks, year refs),
 * one year index per ISO year, one bucket per ISO week with its `older` pointer, and tombstones on
 * superseded week versions. Used by the unit tests and to seed the E2E KV.
 */
import { compareItems, cursorOf, isoWeek, type FeedItem, type HeadDoc, type WeekPtr } from '../src/lib/feed.ts';

export const HEAD_SIZE = 40;
export { isoWeek };

export function layoutFeed(
  locale: 'en' | 'ar',
  all: FeedItem[],
  build = 'b1',
  builtAt = '2026-11-10T12:00:00.000Z',
  /** The previous layout: its week versions become tombstones (moved / gone), as the CMS does. */
  previous?: { kv: Map<string, string>; build: string },
): Map<string, string> {
  const kv = new Map<string, string>(previous?.kv ?? []);
  const pinned = all.filter((i) => i.pinned);
  const items = all.filter((i) => !i.pinned).sort(compareItems);
  const weeks = new Map<string, FeedItem[]>();
  for (const it of items) {
    const w = isoWeek(it.date);
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w)!.push(it);
  }
  const order = [...weeks.keys()].sort().reverse(); // newest week first
  const ptr = (i: number): WeekPtr | null => (i + 1 < order.length ? { week: order[i + 1]!, build } : null);
  const years = new Map<number, { week: string; key: string; count: number; newest: string; oldest: string }[]>();
  order.forEach((week, i) => {
    const list = weeks.get(week)!;
    const key = `feed:${locale}:w:${week}:${build}`;
    kv.set(key, JSON.stringify({ v: 1, week, build, items: list, older: ptr(i) }));
    const y = Number(week.slice(0, 4));
    if (!years.has(y)) years.set(y, []);
    years.get(y)!.push({ week, key, count: list.length, newest: cursorOf(list[0]!), oldest: cursorOf(list[list.length - 1]!) });
  });
  if (previous) {
    for (const k of previous.kv.keys()) {
      const m = new RegExp(`^feed:${locale}:w:(\\d{4}-W\\d{2}):${previous.build}$`).exec(k);
      if (!m) continue;
      kv.set(k, JSON.stringify(weeks.has(m[1]!) ? { v: 1, week: m[1], moved: build } : { v: 1, week: m[1], gone: true }));
    }
    for (const k of [...kv.keys()]) if (k.startsWith(`feed:${locale}:y:`) && k.endsWith(`:${previous.build}`)) kv.delete(k);
  }
  const yearRefs = [...years].sort((a, b) => b[0] - a[0]).map(([year, ws]) => {
    const key = `feed:${locale}:y:${year}:${build}`;
    kv.set(key, JSON.stringify({ v: 1, year, weeks: ws }));
    return { year, key, count: ws.reduce((n, w) => n + w.count, 0), oldest: ws[ws.length - 1]!.oldest };
  });
  const headItems = items.slice(0, HEAD_SIZE);
  const headWeeks = order
    .map((week, i) => ({ week, i }))
    .filter(({ week }) => headItems.some((it) => isoWeek(it.date) === week))
    .map(({ week, i }) => {
      const list = weeks.get(week)!;
      return { week, build, oldest: cursorOf(list[list.length - 1]!), older: ptr(i) };
    });
  const head: HeadDoc = {
    v: 1,
    locale,
    build,
    built_at: builtAt,
    page_size: 20,
    pinned,
    items: headItems,
    more: items.length > HEAD_SIZE,
    total: items.length,
    weeks: headWeeks,
    years: yearRefs,
  };
  kv.set(`feed:${locale}:head`, JSON.stringify(head));
  return kv;
}

export function post(id: number, date: string, extra: Partial<NonNullable<FeedItem['post']>> = {}, pinned = false): FeedItem {
  return {
    key: `p${id}`,
    type: 'post',
    date,
    pinned,
    post: {
      slug: `post-${id}`,
      locale: 'en',
      title: `Post ${id}`,
      excerpt: `Excerpt of post ${id}.`,
      cover: null,
      author_name: 'Editor',
      tags: [],
      published_at: date,
      updated_at: date,
      videos: [],
      ...extra,
    },
  };
}

export function video(id: number, date: string, refId = 'vid-1', pinned = false): FeedItem {
  return {
    key: `v${id}`,
    type: 'video',
    date,
    pinned,
    video: { kind: 'video', ref_id: refId, title_override: null, snapshot: { title: `Video ${id}`, thumbnail_url: null, channel_name: 'Channel' } },
  };
}
