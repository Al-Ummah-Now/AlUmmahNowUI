/**
 * The home timeline's page model: which page to show (KV feed, or the CMS posts list when the feed
 * is missing), and the small pure helpers its components share with the client script.
 */
import type { ChannelLatest, PostSummary, CuratedVideo } from './cms-types';
import type { CmsClient } from './cms';
import { FeedMissing, kvGetter, postItem, readPage, PAGE_SIZE, type FeedItem, type FeedVideo } from './feed';
import type { KVNamespace } from './cf';
import type { Locale } from './locale';
import { channelUrl, VIDEO_ID, watchUrl } from './embeds';
import { clockDuration, liveThumb, snapshotItem, localizeItem, type VideoItem } from './videos';

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

/** At most this many of a channel's latest videos show on its card (the CMS stores ≤ 3). */
export const CHANNEL_LATEST_MAX = 3;

export interface ChannelCardLatest { id: string; title: string; thumbnailUrl: string | null; duration: string | null; href: string }
export interface ChannelCard {
  id: string;
  name: string;
  /** Without the @. */
  handle: string | null;
  avatarUrl: string | null;
  href: string;
  latest: ChannelCardLatest[];
}

/**
 * A channel timeline entry (docs/specs/WWW-PAGES.md D7) as its card: name (localized, or the
 * editor's override), @handle, avatar, the newest ≤ 3 videos from the snapshot's `latest` (each
 * linking to its watch page; an expired signed thumbnail is dropped) and the channel's link.
 * Null when the id is not a videos-site id (nothing safe to link to: the card is skipped).
 */
export function channelCard(
  v: FeedVideo & { title_override?: string | null },
  locale: Locale,
  videosWebUrl: string,
  fallbackTitle: string,
  now = Date.now(),
): ChannelCard | null {
  if (v.kind !== 'channel' || !VIDEO_ID.test(v.ref_id)) return null;
  const item = feedVideoItem(v, locale, fallbackTitle, now);
  const handle = item.handle?.replace(/^@/, '') || null;
  const stored: unknown = v.snapshot?.latest;
  const latest = (Array.isArray(stored) ? (stored as Partial<ChannelLatest>[]) : [])
    .filter((x): x is ChannelLatest => !!x && typeof x.id === 'string' && VIDEO_ID.test(x.id) && typeof x.title === 'string' && !!x.title.trim())
    .slice(0, CHANNEL_LATEST_MAX)
    .map((x) => ({
      id: x.id,
      title: x.title.trim().replace(/\.(mp4|mov|mkv|webm)$/i, ''),
      thumbnailUrl: liveThumb(x.thumbnail_url, now),
      duration: clockDuration(typeof x.duration_seconds === 'number' && x.duration_seconds > 0 ? x.duration_seconds : null),
      href: watchUrl(videosWebUrl, { kind: 'video', id: x.id, lang: locale }),
    }));
  return {
    id: v.ref_id,
    name: item.title,
    handle,
    avatarUrl: item.thumbnailUrl,
    href: channelUrl(videosWebUrl, { id: v.ref_id, handle, lang: locale }),
    latest,
  };
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
