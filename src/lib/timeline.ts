/**
 * The home timeline's page model: which page to show (KV feed, or the CMS posts list when the feed
 * is missing), and the small pure helpers its components share with the client script.
 */
import type { PostSummary, CuratedVideo } from './cms-types';
import type { CmsClient } from './cms';
import { FeedMissing, kvGetter, postItem, readPage, PAGE_SIZE, type FeedItem, type FeedVideo } from './feed';
import type { KVNamespace } from './cf';
import type { Locale } from './locale';
import { snapshotItem, localizeItem, type VideoItem } from './videos';

export interface TimelinePage {
  pinned: FeedItem[];
  items: FeedItem[];
  /** Link to the next page (no-JS "Load more"), or null at the end. */
  nextHref: string | null;
  /** feed: Workers KV; fallback: the CMS posts list (itself cache → CMS → snapshot → built-in). */
  source: 'feed' | 'fallback';
  builtAt: string | null;
}

/**
 * The page for `?before=` (feed) or `?page=` (fallback). Never throws: a missing or unreadable feed
 * falls back to the posts list, whose own chain ends in built-in content.
 */
export async function loadTimeline(opts: {
  kv: KVNamespace | undefined;
  cms: Pick<CmsClient, 'posts'>;
  locale: Locale;
  before: string | null;
  page: number;
  log?: (msg: string, data?: Record<string, unknown>) => void;
}): Promise<TimelinePage> {
  const base = `/${opts.locale}/`;
  if (opts.kv) {
    try {
      const p = await readPage(kvGetter(opts.kv), opts.locale, opts.before);
      return { pinned: p.pinned, items: p.items, nextHref: p.next ? `${base}?before=${encodeURIComponent(p.next)}` : null, source: 'feed', builtAt: p.builtAt };
    } catch (error) {
      opts.log?.('timeline: feed unavailable, using the posts list', { error: error instanceof FeedMissing ? error.message : String(error) });
    }
  }
  const page = opts.before ? 1 : opts.page;
  const res = await opts.cms.posts(opts.locale, page, PAGE_SIZE);
  const list = res.status === 'ok' ? res.data : { items: [] as PostSummary[], total: 0, page, limit: PAGE_SIZE };
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  // Fallback keys only need to be unique on the page (no cursor is built from them).
  const items = list.items.map((p, i) => postItem({ ...p, videos: [] }, (page - 1) * PAGE_SIZE + i + 1));
  return { pinned: [], items, nextHref: page < pages && items.length ? `${base}?page=${page + 1}` : null, source: 'fallback', builtAt: null };
}

/**
 * A feed video as the facade's VideoItem. The snapshot may be stale (the feed is rebuilt when the
 * CMS refreshes it); an expired signed thumbnail is dropped by snapshotItem. No snapshot (a body
 * video not looked up yet) → a plain player card titled "Video".
 */
export function feedVideoItem(v: FeedVideo & { title_override?: string | null }, locale: Locale, fallbackTitle: string, now = Date.now()): VideoItem {
  const curated = { id: 0, kind: v.kind, ref_id: v.ref_id, title_override: v.title_override ?? null, snapshot: v.snapshot, sort: 0 } as CuratedVideo;
  const item = v.snapshot ? snapshotItem(curated, now, true) : null;
  const shown = item ? localizeItem(item, locale) : null;
  const base: VideoItem = shown ?? {
    kind: v.kind,
    id: v.ref_id,
    title: fallbackTitle,
    description: null,
    thumbnailUrl: null,
    channelName: null,
    handle: null,
    durationSeconds: null,
    uploadDate: null,
    videoCount: null,
  };
  return v.title_override ? { ...base, title: v.title_override } : base;
}

/** "10 November 2026, 14:05" in UTC (the client script rewrites it in the reader's zone). */
export function absoluteTime(iso: string, locale: Locale, timeZone = 'UTC'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(d);
}
