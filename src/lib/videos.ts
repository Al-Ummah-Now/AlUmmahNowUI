/**
 * Server-side metadata from the videos API (SPEC §5): only items the API returns as
 * public render. Private, unlisted-by-owner, deleted, hidden, unknown or erroring
 * items are skipped silently (and logged).
 *
 * Public reads: GET /api/videos/:id, /api/playlists/:id, /api/channels/:id. The API
 * answers 404 for deleted, hidden and other users' private items; an anonymous
 * request never sees them. We still check the flags in case that ever changes.
 */
import type { CuratedVideo } from './cms-types';
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

/** Curated CMS entries → public items, in CMS order, with the editor's title override. */
export async function resolveCurated(deps: VideosDeps, curated: CuratedVideo[], locale?: Locale): Promise<ResolvedCurated[]> {
  const sorted = [...curated].sort((a, b) => a.sort - b.sort);
  const items = await Promise.all(sorted.map((c) => fetchVideoItem(deps, c.kind, c.ref_id)));
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
