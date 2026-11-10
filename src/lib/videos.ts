/**
 * Server-side metadata from the videos API (SPEC §5): only items the API returns as
 * public render. Private, unlisted-by-owner, deleted, hidden, unknown or erroring
 * items are skipped silently (and logged).
 *
 * Public reads: GET /api/videos/:id, /api/playlists/:id, /api/channels/:id. The API
 * answers 404 for deleted, hidden and other users' private items; an anonymous
 * request never sees them. We still check the flags in case that ever changes.
 */
import type { CuratedSnapshot, CuratedVideo } from './cms-types';
import { VIDEO_ID } from './embeds';
import { normalizeImageUrl } from './images';
import type { Locale } from './locale';

export type VideoKind = 'video' | 'playlist' | 'channel';

export interface VideoItem {
  kind: VideoKind;
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  channelName: string | null;
  /** Channels only: @handle, if set. */
  handle: string | null;
  durationSeconds: number | null;
  uploadDate: string | null;
  videoCount: number | null;
  /** Per-locale title/name and description from the API (titleLocalized / nameLocalized). */
  titles?: Partial<Record<Locale, string>>;
  descriptions?: Partial<Record<Locale, string>>;
}

export interface VideosDeps {
  apiUrl: string;
  now?: () => number;
  fetchImpl?: typeof fetch;
  cache?: Cache | null;
  cacheKeyBase: string;
  waitUntil: (p: Promise<unknown>) => void;
  timeoutMs?: number;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

const PATHS: Record<VideoKind, string> = { video: 'videos', playlist: 'playlists', channel: 'channels' };
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const localized = (v: unknown): Partial<Record<Locale, string>> => {
  const out: Partial<Record<Locale, string>> = {};
  if (typeof v === 'object' && v !== null) {
    for (const l of ['en', 'ar'] as const) {
      const t = str((v as Record<string, unknown>)[l]);
      if (t) out[l] = t;
    }
  }
  return out;
};
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** Maps an API body to a VideoItem, or null when it is not public. Pure (unit-tested). */
export function toVideoItem(kind: VideoKind, id: string, body: unknown): VideoItem | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.isDeleted === true || b.isHidden === true) return null;
  if (kind === 'channel' ? b.isPrivate === true : b.isPublic === false) return null;
  const title = kind === 'channel' ? str(b.name) : str(b.title) ?? str(b.name);
  if (!title) return null;
  const thumb = kind === 'channel' ? (b.avatarUrl ?? b.coverUrl) : (b.thumbnailUrl ?? b.coverUrl);
  return {
    kind,
    id,
    // Upload names like "lesson 4.mp4" read badly as titles
    title: kind === 'video' ? title.replace(/\.(mp4|mov|mkv|webm)$/i, '') : title,
    description: str(b.description),
    thumbnailUrl: normalizeImageUrl(typeof thumb === 'string' ? thumb : null),
    channelName: kind === 'channel' ? null : str(b.channelName) ?? str(b.channel),
    handle: kind === 'channel' ? str(b.handle) : null,
    durationSeconds: kind === 'video' ? num(b.duration) : null,
    uploadDate: str(b.dateCreated),
    videoCount: kind === 'playlist' ? num(b.videosCount) ?? (Array.isArray(b.videos) ? b.videos.length : null) : null,
    titles: localized(kind === 'channel' ? b.nameLocalized : b.titleLocalized),
    descriptions: localized(b.descriptionLocalized),
  };
}

/** The item in the page's language: the API's localized title/description when it has one. */
export function localizeItem(item: VideoItem, locale: Locale): VideoItem {
  return { ...item, title: item.titles?.[locale] ?? item.title, description: item.descriptions?.[locale] ?? item.description };
}

export async function fetchVideoItem(deps: VideosDeps, kind: VideoKind, id: string): Promise<VideoItem | null> {
  if (!VIDEO_ID.test(id)) {
    deps.log?.('videos: invalid id skipped', { kind, id: id.slice(0, 80) });
    return null;
  }
  const url = `${deps.apiUrl}/api/${PATHS[kind]}/${id}`;
  const key = `${deps.cacheKeyBase}/${kind}/${id}`;
  try {
    const hit = await deps.cache?.match(key);
    if (hit) return ((await hit.json()) as { item: VideoItem | null }).item;
  } catch {
    // cache miss
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 2_500);
  let item: VideoItem | null = null;
  try {
    const res = await (deps.fetchImpl ?? fetch)(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (res.ok) {
      item = toVideoItem(kind, id, await res.json());
      if (!item) deps.log?.('videos: not public, skipped', { kind, id });
    } else {
      deps.log?.('videos: skipped', { kind, id, status: res.status });
      if (res.status >= 500) return null; // do not cache upstream errors
    }
  } catch (error) {
    deps.log?.('videos: fetch failed, skipped', { kind, id, error: controller.signal.aborted ? 'timeout' : String(error) });
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (deps.cache) {
    const res = new Response(JSON.stringify({ item }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
    deps.waitUntil(deps.cache.put(key, res).catch(() => undefined));
  }
  return item;
}

export interface ResolvedCurated { curated: CuratedVideo; item: VideoItem }

/** At most this many curated items render per list (the CMS caps it too). */
export const CURATED_MAX = 48;
/** At most this many items per render are looked up live (no fresh snapshot). */
export const LIVE_LOOKUPS_MAX = 8;
/**
 * A snapshot refreshed within this window renders without a videos API call. The CMS refreshes
 * every 30 minutes; its thumbnail tokens live ≥ 6 h, so 3 h leaves a wide margin.
 */
export const SNAPSHOT_MAX_AGE_MS = 3 * 60 * 60_000;

const EXPIRES = /[?&]expires=(\d+)/;

/**
 * The item from the CMS snapshot, when it is fresh (refreshed recently) or `stale` is allowed.
 * A stale snapshot's signed thumbnail is dropped once its `expires` has passed.
 */
export function snapshotItem(c: CuratedVideo, nowMs: number, allowStale = false): VideoItem | null {
  const s: CuratedSnapshot | null = c.snapshot;
  if (!s || !str(s.title) || !VIDEO_ID.test(c.ref_id)) return null;
  const refreshed = s.refreshed_at ? Date.parse(s.refreshed_at) : NaN;
  const fresh = Number.isFinite(refreshed) && nowMs - refreshed < SNAPSHOT_MAX_AGE_MS && refreshed - nowMs < 5 * 60_000;
  if (!fresh && !allowStale) return null;
  let thumb = normalizeImageUrl(s.thumbnail_url ?? null);
  const expires = thumb ? EXPIRES.exec(thumb) : null;
  if (expires && Number(expires[1]) * 1000 <= nowMs) thumb = null;
  const title = str(s.title)!;
  return {
    kind: c.kind,
    id: c.ref_id,
    title: c.kind === 'video' ? title.replace(/\.(mp4|mov|mkv|webm)$/i, '') : title,
    description: str(s.description),
    thumbnailUrl: thumb,
    channelName: c.kind === 'channel' ? null : str(s.channel_name),
    handle: c.kind === 'channel' ? str(s.handle) : null,
    durationSeconds: c.kind === 'video' ? num(s.duration_seconds) : null,
    uploadDate: str(s.upload_date),
    videoCount: c.kind === 'playlist' ? num(s.video_count) : null,
    titles: localized(s.titles),
    descriptions: localized(s.descriptions),
  };
}

/**
 * Curated CMS entries → public items, in CMS order, with the editor's title override.
 *
 * Bounded fan-out (audit UI-1): at most CURATED_MAX items; items with a fresh CMS snapshot need no
 * videos API call; at most LIVE_LOOKUPS_MAX of the rest are looked up live, and any beyond that
 * render from their (stale) snapshot or are skipped until the CMS refreshes them.
 */
export async function resolveCurated(deps: VideosDeps, curated: CuratedVideo[], locale?: Locale): Promise<ResolvedCurated[]> {
  const now = (deps.now ?? Date.now)();
  const sorted = [...curated].sort((a, b) => a.sort - b.sort).slice(0, CURATED_MAX);
  let budget = LIVE_LOOKUPS_MAX;
  const items = await Promise.all(
    sorted.map((c) => {
      const snap = snapshotItem(c, now);
      if (snap) return snap;
      if (budget > 0) {
        budget--;
        return fetchVideoItem(deps, c.kind, c.ref_id);
      }
      const stale = snapshotItem(c, now, true);
      if (!stale) deps.log?.('videos: no fresh snapshot and over the live lookup budget, skipped', { kind: c.kind, id: c.ref_id });
      return stale;
    }),
  );
  return sorted.flatMap((curated, i) => {
    const item = items[i];
    if (!item) return [];
    const shown = locale ? localizeItem(item, locale) : item;
    return [{ curated, item: curated.title_override ? { ...shown, title: curated.title_override } : shown }];
  });
}

/** ISO 8601 duration for JSON-LD: 3725 → PT1H2M5S */
export function isoDuration(seconds: number | null): string | undefined {
  if (!seconds) return undefined;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${r || (!h && !m) ? `${r}S` : ''}`;
}

/** 3725 → "1:02:05", 65 → "1:05" */
export function clockDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export interface ChannelVideosPage {
  items: VideoItem[];
  /** The videos API's cursor for the next page; '' = no more. */
  cursor: string;
}

/** A videos-API cursor as we pass it back: opaque, but bounded and URL-safe. */
export const CURSOR = /^[A-Za-z0-9._~:+/=-]{1,512}$/;

/**
 * A channel's latest public videos (`GET /api/channels/:id/videos?sort=latest&cursor=`), for a
 * scholar's page (AlUmmahNowCMS docs/SCHOLARS.md). Same rules as fetchVideoItem: only public items,
 * failures are an empty page (and logged), never an error page. Cached 60 s per (channel, cursor).
 */
export async function fetchChannelVideos(deps: VideosDeps, channelId: string, opts: { cursor?: string | null; limit?: number } = {}): Promise<ChannelVideosPage> {
  if (!VIDEO_ID.test(channelId)) return { items: [], cursor: '' };
  const cursor = opts.cursor && CURSOR.test(opts.cursor) ? opts.cursor : '';
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 24);
  const params = new URLSearchParams({ sort: 'latest', limit: String(limit), ...(cursor ? { cursor } : {}) });
  const url = `${deps.apiUrl}/api/channels/${channelId}/videos?${params}`;
  const key = `${deps.cacheKeyBase}/channel-videos/${channelId}?${params}`;
  try {
    const hit = await deps.cache?.match(key);
    if (hit) return (await hit.json()) as ChannelVideosPage;
  } catch {
    // cache miss
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 2_500);
  let page: ChannelVideosPage = { items: [], cursor: '' };
  try {
    const res = await (deps.fetchImpl ?? fetch)(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      deps.log?.('videos: channel videos skipped', { channelId, status: res.status });
      return page;
    }
    const body = (await res.json()) as { data?: unknown; cursor?: unknown };
    const rows = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
    page = {
      items: rows.map((r) => (typeof r.id === 'string' ? toVideoItem('video', r.id, r) : null)).filter((x): x is VideoItem => x !== null),
      cursor: typeof body.cursor === 'string' && CURSOR.test(body.cursor) ? body.cursor : '',
    };
  } catch (error) {
    deps.log?.('videos: channel videos failed', { channelId, error: controller.signal.aborted ? 'timeout' : String(error) });
    return page;
  } finally {
    clearTimeout(timer);
  }
  if (deps.cache) {
    const res = new Response(JSON.stringify(page), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
    deps.waitUntil(deps.cache.put(key, res).catch(() => undefined));
  }
  return page;
}
