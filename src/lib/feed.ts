/**
 * The home timeline, read from Workers KV (binding FEED). The CMS feed job is the only writer
 * (AlUmmahNowCMS src/lib/feed/jobs.ts); this file is the reader. The key layout, ordering, cursor
 * format and the page walks below MUST stay in step with AlUmmahNowCMS src/lib/feed/model.ts
 * (docs/CMS_PUBLIC_API.md "Home timeline feed"); tests/feed.test.ts runs the same cases.
 *
 *   feed:{l}:head                  the pointer AND the first page: pinned items, the newest 40, the
 *                                  weeks those live in, the year index keys. Rewritten in place.
 *   feed:{l}:y:{isoYear}:{build}   a year's weeks, newest first (the fallback index)
 *   feed:{l}:w:{isoWeek}:{build}   one ISO week's items, newest first, and `older`: the next older
 *                                  non-empty week. A superseded version becomes a tombstone
 *                                  ({ moved: <build> } or { gone: true }) once, then is deleted.
 *
 * The first page is one read (the head). "Load more" carries a cursor naming the last item AND the
 * week to read next ("<ms>-<key>.<week>.<build>"), so it is normally one read too. Week and year
 * keys can be overwritten once (tombstone), so they are read with a short edge cacheTtl (60 s);
 * the head with the minimum (30 s), the same order as the HTML edge cache.
 */
import type { KVNamespace } from './cf';
import type { CuratedSnapshot, MediaRef } from './cms-types';
import type { Locale } from './locale';

export const PAGE_SIZE = 20;
export const HEAD_TTL_SEC = 30;
export const BUCKET_TTL_SEC = 60;
export const FEED_VERSION = 1;

export interface FeedSlide {
  id?: string;
  image: MediaRef;
  heading: string | null;
  body: string | null;
  position: 'top' | 'middle' | 'bottom';
}

/** The public PostSummary (docs/CMS_PUBLIC_API.md) with the feed's additions. */
export interface FeedPost {
  slug: string;
  locale: Locale;
  title: string;
  excerpt: string | null;
  cover: MediaRef | null;
  author_name: string | null;
  tags: string[];
  published_at: string;
  updated_at: string;
  kind?: 'article' | 'cards';
  slide_count?: number;
  first_slide?: FeedSlide | null;
  /** `::video[ID]` lines of the body, in order (at most 4). */
  videos: FeedVideo[];
}

export interface FeedVideo {
  kind: 'video' | 'playlist';
  ref_id: string;
  snapshot: CuratedSnapshot | null;
}

export interface FeedItem {
  key: string;
  type: 'post' | 'video';
  date: string;
  pinned: boolean;
  post?: FeedPost;
  video?: FeedVideo & { title_override: string | null };
}

export interface WeekPtr { week: string; build: string }
export interface YearRef { year: number; key: string; count: number; oldest: string }
export interface HeadWeek extends WeekPtr { oldest: string; older: WeekPtr | null }

export interface HeadDoc {
  v: number;
  locale: Locale;
  build: string;
  built_at: string;
  page_size: number;
  pinned: FeedItem[];
  items: FeedItem[];
  more: boolean;
  total: number;
  weeks: HeadWeek[];
  years: YearRef[];
}
export interface WeekRef { week: string; key: string; count: number; newest: string; oldest: string }
export interface YearDoc { v: number; year: number; weeks: WeekRef[] }
export interface WeekDoc { v: number; week: string; build: string; items: FeedItem[]; older: WeekPtr | null }
export interface WeekTombstone { v: number; week: string; moved?: string; gone?: true }

export const headKey = (l: Locale) => `feed:${l}:head`;
export const yearKey = (l: Locale, year: number, build: string) => `feed:${l}:y:${year}:${build}`;
export const weekKey = (l: Locale, week: string, build: string) => `feed:${l}:w:${week}:${build}`;

/* ISO weeks (UTC): the storage buckets (headings on the page are per day, in the reader's zone) */

const DAY = 86_400_000;

export function isoWeek(date: string | number | Date): string {
  const d = new Date(typeof date === 'object' ? date.getTime() : date);
  if (Number.isNaN(d.getTime())) throw new Error('bad date');
  const day = (d.getUTCDay() + 6) % 7;
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3);
  const year = new Date(thursday).getUTCFullYear();
  const jan4 = Date.UTC(year, 0, 4);
  const monday1 = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY;
  return `${year}-W${String(1 + Math.floor((thursday - monday1) / (7 * DAY))).padStart(2, '0')}`;
}

/* Ordering and cursors */

const KEY = /^([pv])(\d{1,12})$/;
function keyParts(key: string): [number, number] {
  const m = KEY.exec(key);
  if (!m) throw new Error(`bad item key ${key}`);
  return [m[1] === 'v' ? 1 : 0, Number(m[2])];
}

/** < 0 when a sorts before b (a is newer): date desc, then "v" before "p", then id desc. */
export function compareSort(aMs: number, aKey: string, bMs: number, bKey: string): number {
  if (aMs !== bMs) return bMs - aMs;
  const [at, ai] = keyParts(aKey);
  const [bt, bi] = keyParts(bKey);
  return at !== bt ? bt - at : bi - ai;
}
export const compareItems = (a: FeedItem, b: FeedItem) => compareSort(Date.parse(a.date), a.key, Date.parse(b.date), b.key);
/** An item's position ("<ms>-<key>"). */
export const cursorOf = (item: Pick<FeedItem, 'date' | 'key'>) => `${Date.parse(item.date)}-${item.key}`;

export interface Cursor { ms: number; key: string; next?: WeekPtr }

/** A load-more cursor; also src/lib/edge.ts FEED_CURSOR (cacheable ?before= values). */
export const CURSOR = /^(\d{1,15})-([pv]\d{1,12})(?:\.(\d{4}-W\d{2})\.([a-z0-9]{1,32}))?$/;
export const formatCursor = (item: Pick<FeedItem, 'date' | 'key'>, next: WeekPtr | null) => (next ? `${cursorOf(item)}.${next.week}.${next.build}` : cursorOf(item));

export function parseCursor(raw: string | null | undefined): Cursor | null {
  const m = raw ? CURSOR.exec(raw) : null;
  if (!m) return null;
  return { ms: Number(m[1]), key: m[2]!, ...(m[3] && m[4] ? { next: { week: m[3], build: m[4] } } : {}) };
}
export function isOlder(item: Pick<FeedItem, 'date' | 'key'>, cursor: { ms: number; key: string }): boolean {
  return compareSort(Date.parse(item.date), item.key, cursor.ms, cursor.key) > 0;
}
const positionOlder = (pos: string, cursor: { ms: number; key: string }) => {
  const p = parseCursor(pos);
  return !p || isOlder({ date: new Date(p.ms).toISOString(), key: p.key }, cursor);
};

/* Shape checks: a malformed value reads as missing (never a broken page). */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

export function validItem(v: unknown): v is FeedItem {
  if (!isObj(v) || !isStr(v.key) || !KEY.test(v.key) || !isStr(v.date) || Number.isNaN(Date.parse(v.date))) return false;
  if (v.type === 'post') {
    const p = v.post;
    return isObj(p) && isStr(p.slug) && isStr(p.title) && Array.isArray(p.videos);
  }
  if (v.type === 'video') {
    const x = v.video;
    return isObj(x) && (x.kind === 'video' || x.kind === 'playlist') && isStr(x.ref_id);
  }
  return false;
}
const validItems = (v: unknown): boolean => Array.isArray(v) && v.every(validItem);

export function validHead(v: unknown): v is HeadDoc {
  return (
    isObj(v) && v.v === FEED_VERSION && isStr(v.build) && isStr(v.built_at) && validItems(v.pinned) && validItems(v.items) &&
    Array.isArray(v.weeks) && Array.isArray(v.years) && v.years.every((y) => isObj(y) && isStr(y.key) && typeof y.year === 'number')
  );
}
const validYear = (v: unknown): v is YearDoc => isObj(v) && Array.isArray(v.weeks) && v.weeks.every((w) => isObj(w) && isStr(w.key) && isStr(w.oldest));
const validWeek = (v: unknown): v is WeekDoc => isObj(v) && isStr(v.week) && validItems(v.items);

/* Reading */

export type KvGet = (key: string, kind: 'head' | 'year' | 'week') => Promise<unknown>;

/** KV reads with the edge TTLs above; any error or bad JSON → null. */
export function kvGetter(kv: KVNamespace): KvGet {
  return async (key, kind) => {
    try {
      return await kv.get(key, { type: 'json', cacheTtl: kind === 'head' ? HEAD_TTL_SEC : BUCKET_TTL_SEC });
    } catch {
      return null;
    }
  };
}

export interface FeedPage {
  pinned: FeedItem[];
  items: FeedItem[];
  /** Cursor for "Load more"; null at the end. Pass it through unchanged. */
  next: string | null;
  reads: number;
  via: 'head' | 'pointer' | 'index';
  /** The head's build time, when this page read the head. */
  builtAt: string | null;
}

export class FeedMissing extends Error {}

function nextPtr(item: FeedItem, week: { week: string; build: string; oldest: string; older: WeekPtr | null }): WeekPtr | null {
  return cursorOf(item) === week.oldest ? week.older : { week: week.week, build: week.build };
}

/**
 * One page. No cursor: pinned + the newest `size`, from the head alone (one read). With a cursor:
 * the `size` items strictly older than it, from the week the cursor names and on through `older`
 * pointers (normally one read), following a tombstone; anything missing → the year index walk.
 * Throws FeedMissing when the head is missing or unreadable.
 */
export async function readPage(get: KvGet, locale: Locale, before: string | null, size = PAGE_SIZE): Promise<FeedPage> {
  const cursor = parseCursor(before);
  if (!cursor) {
    const head = await get(headKey(locale), 'head');
    if (!validHead(head)) throw new FeedMissing('feed head missing or unreadable');
    const list = head.items.slice(0, size);
    const last = list[list.length - 1];
    let next: string | null = null;
    if (last && (head.items.length > size || head.more)) {
      const w = head.weeks.find((x) => x.week === isoWeek(last.date));
      next = formatCursor(last, w ? nextPtr(last, w) : null);
    }
    return { pinned: head.pinned, items: list, next, reads: 1, via: 'head', builtAt: head.built_at };
  }
  let reads = 0;
  const read: KvGet = async (key, kind) => {
    reads++;
    return get(key, kind);
  };
  if (cursor.next) {
    const viaPointer = await walkPointers(read, locale, cursor, size);
    if (viaPointer) return { pinned: [], ...viaPointer, reads, via: 'pointer', builtAt: null };
  }
  const viaIndex = await walkIndex(read, locale, cursor, size);
  return { pinned: [], items: viaIndex.items, next: viaIndex.next, reads, via: 'index', builtAt: viaIndex.builtAt };
}

/** A week version, following one tombstone; null when it (or its successor) is gone. */
async function readWeek(read: KvGet, locale: Locale, ptr: WeekPtr): Promise<WeekDoc | null> {
  let doc = await read(weekKey(locale, ptr.week, ptr.build), 'week');
  const moved = isObj(doc) && isStr(doc.moved) ? doc.moved : undefined;
  if (moved) doc = await read(weekKey(locale, ptr.week, moved), 'week');
  return validWeek(doc) ? doc : null;
}

async function walkPointers(read: KvGet, locale: Locale, cursor: Cursor, size: number): Promise<{ items: FeedItem[]; next: string | null } | null> {
  const out: FeedItem[] = [];
  let ptr: WeekPtr | null = cursor.next!;
  let lastWeek: WeekDoc | null = null;
  for (let hops = 0; ptr && out.length < size && hops < 60; hops++) {
    const doc = await readWeek(read, locale, ptr);
    if (!doc) return null;
    lastWeek = doc;
    for (const it of doc.items) if (isOlder(it, cursor) && out.length < size) out.push(it);
    ptr = doc.older;
  }
  if (!out.length) return { items: [], next: null };
  const last = out[out.length - 1]!;
  const w = lastWeek!;
  const lastIsInLastWeek = w.items.some((x) => x.key === last.key);
  const oldest = w.items.length ? cursorOf(w.items[w.items.length - 1]!) : '';
  const after = lastIsInLastWeek ? nextPtr(last, { week: w.week, build: w.build, oldest, older: w.older }) : null;
  return { items: out, next: after ? formatCursor(last, after) : null };
}

/** The fallback: head → year indexes → weeks, skipping years and weeks wholly newer than the cursor. */
async function walkIndex(read: KvGet, locale: Locale, cursor: Cursor, size: number): Promise<{ items: FeedItem[]; next: string | null; builtAt: string }> {
  const head = await read(headKey(locale), 'head');
  if (!validHead(head)) throw new FeedMissing('feed head missing or unreadable');
  const out: FeedItem[] = [];
  let lastWeek: (WeekRef & { build: string; older: WeekPtr | null }) | null = null;
  for (const y of head.years) {
    if (out.length > size) break;
    if (!positionOlder(y.oldest, cursor)) continue;
    const year = await read(y.key, 'year');
    if (!validYear(year)) throw new FeedMissing(`feed year ${y.year} missing`);
    for (const w of year.weeks) {
      if (out.length > size) break;
      if (!positionOlder(w.oldest, cursor)) continue;
      const doc = await read(w.key, 'week');
      if (!validWeek(doc)) throw new FeedMissing(`feed week ${w.week} missing`);
      for (const it of doc.items) if (isOlder(it, cursor)) out.push(it);
      lastWeek = { ...w, build: doc.build, older: doc.older };
    }
  }
  out.sort(compareItems);
  const list = out.slice(0, size);
  if (out.length <= size || !list.length) return { items: list, next: null, builtAt: head.built_at };
  const last = list[list.length - 1]!;
  const inLast = lastWeek && isoWeek(last.date) === lastWeek.week;
  const next = inLast ? nextPtr(last, { week: lastWeek!.week, build: lastWeek!.build, oldest: lastWeek!.oldest, older: lastWeek!.older }) : null;
  return { items: list, next: formatCursor(last, next), builtAt: head.built_at };
}

/** The head's state for /healthz and the smoke check: ok (with its build time) or missing. */
export async function feedHealth(kv: KVNamespace | undefined, locale: Locale = 'en'): Promise<{ feed: 'ok' | 'missing'; builtAt: string | null }> {
  if (!kv) return { feed: 'missing', builtAt: null };
  const head = await kvGetter(kv)(headKey(locale), 'head');
  return validHead(head) ? { feed: 'ok', builtAt: head.built_at } : { feed: 'missing', builtAt: null };
}

/* Day grouping */

/** The calendar day (YYYY-MM-DD) of an instant in a time zone. */
export function dayKey(iso: string, timeZone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/**
 * The heading for a day: Today, Yesterday, the weekday within the last week, else the full date
 * (with the year only when it isn't the current one).
 */
export function dayLabel(day: string, now: Date, locale: Locale, words: { today: string; yesterday: string }, timeZone = 'UTC'): string {
  const today = dayKey(now.toISOString(), timeZone);
  const diff = dayDiff(today, day);
  if (diff === 0) return words.today;
  if (diff === 1) return words.yesterday;
  const date = new Date(`${day}T12:00:00Z`);
  const tag = locale === 'ar' ? 'ar' : 'en-GB';
  if (diff > 1 && diff < 7) return new Intl.DateTimeFormat(tag, { weekday: 'long', timeZone: 'UTC' }).format(date);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(date);
}

export interface DayGroup { day: string; items: FeedItem[] }

/** Consecutive items of the same day (items are newest first). */
export function groupByDay(list: FeedItem[], timeZone = 'UTC'): DayGroup[] {
  const out: DayGroup[] = [];
  for (const it of list) {
    const day = dayKey(it.date, timeZone);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(it);
    else out.push({ day, items: [it] });
  }
  return out;
}

/** "5 minutes ago" / "منذ ٥ دقائق" style relative time (Intl.RelativeTimeFormat). */
export function relativeTime(iso: string, now: Date, locale: Locale): string {
  const sec = Math.round((Date.parse(iso) - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 30 * 86_400) return rtf.format(Math.round(sec / 86_400), 'day');
  if (abs < 365 * 86_400) return rtf.format(Math.round(sec / (30 * 86_400)), 'month');
  return rtf.format(Math.round(sec / (365 * 86_400)), 'year');
}

/* Fallback: the CMS posts list (cache → CMS → KV snapshot → built-in) as feed items */

/** PostSummary → a feed item with no videos (the list carries no bodies). */
export function postItem(p: Omit<FeedPost, 'videos'> & { videos?: FeedVideo[] }, id: number): FeedItem {
  return { key: `p${id}`, type: 'post', date: p.published_at, pinned: false, post: { ...p, videos: p.videos ?? [] } };
}
