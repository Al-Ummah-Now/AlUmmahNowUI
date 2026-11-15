/**
 * Videos in www search (AUN WWW-1, CMS-QUEUE "Search"): the videos API's index-backed search
 * (AlUmmahNow api-videos `GET /api/search?type=video`, Story 29.8) for the full search page, and its
 * typeahead (`GET /api/search/suggestions?types=video`) for the search boxes. Both answer only public
 * videos of visible channels. A video links to its watch page on the videos site; "See all video
 * results" opens the videos site's own search. Any failure is "no videos": the posts still show.
 *
 * Pure (shared by the server page and the browser combobox; unit-tested).
 */
import type { Locale } from '../locale';
import { libraryUrl, VIDEO_ID, watchUrl } from '../embeds';
import { QUERY_MAX } from './suggest';

export interface VideoHit {
  id: string;
  title: string;
  /** Absolute watch URL on the videos site. */
  href: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  /** Seconds, or null when unknown. */
  durationSeconds: number | null;
  isShort: boolean;
  /** ISO date, or '' when unknown. */
  publishedAt: string;
}

/** Videos on page 1 of the full search; the rest are on the videos site. */
export const VIDEO_RESULTS = 6;
/** Video suggestions in a search box. */
export const VIDEO_SUGGEST_LIMIT = 3;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const httpsOrNull = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? v : null);
const localized = (base: unknown, map: unknown, locale: Locale) => (isObj(map) ? str(map[locale]) : null) ?? str(base);

const trim = (u: string) => u.replace(/\/+$/, '');

export function videoSearchUrl(videosApiUrl: string, q: string, limit = VIDEO_RESULTS): string {
  const params = new URLSearchParams({ q: q.slice(0, QUERY_MAX), type: 'video', limit: String(limit) });
  return `${trim(videosApiUrl)}/api/search?${params}`;
}

export function videoSuggestUrl(videosApiUrl: string, q: string, limit = VIDEO_SUGGEST_LIMIT): string {
  const params = new URLSearchParams({ q: q.slice(0, QUERY_MAX), types: 'video', limit: String(limit) });
  return `${trim(videosApiUrl)}/api/search/suggestions?${params}`;
}

/** The videos site's own search for the same words ("See all video results"). */
export function videosSiteSearchUrl(videosWebUrl: string, locale: Locale, q: string): string {
  return `${libraryUrl(videosWebUrl, locale)}/search?${new URLSearchParams({ q: q.slice(0, QUERY_MAX) })}`;
}

/** A watch URL on the videos site for a hit: only that origin, only a valid id. */
export function isVideoHref(href: unknown, videosWebUrl: string): href is string {
  if (typeof href !== 'string') return false;
  try {
    const u = new URL(href);
    return u.origin === new URL(videosWebUrl).origin && /^\/(?:en|ar)\/video\/[A-Za-z0-9_-]{1,64}$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** `GET /api/search?type=video` → hits (anything malformed is dropped), or null when it is no answer. */
export function videoHitsFromSearch(v: unknown, locale: Locale, videosWebUrl: string): VideoHit[] | null {
  if (!isObj(v) || v.success === false || !Array.isArray(v.results)) return null;
  const out: VideoHit[] = [];
  for (const r of v.results) {
    if (!isObj(r) || r.type !== 'video' || !isObj(r.video)) continue;
    const video = r.video;
    const id = str(video.id, 64);
    const title = localized(video.title, video.titleLocalized, locale);
    if (!id || !VIDEO_ID.test(id) || !title) continue;
    const channel = isObj(r.channel) ? r.channel : null;
    out.push({
      id,
      title,
      href: watchUrl(videosWebUrl, { kind: 'video', id, lang: locale }),
      thumbnailUrl: httpsOrNull(video.thumbnailUrl),
      channelName: localized(video.channelName, video.channelNameLocalized, locale) ?? (channel ? localized(channel.name, channel.nameLocalized, locale) : null),
      durationSeconds: typeof video.duration === 'number' && Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : null,
      isShort: video.isShort === true,
      publishedAt: str(video.dateCreated, 40) ?? '',
    });
  }
  return out;
}

/** `GET /api/search/suggestions?types=video` → hits, or null when it is no answer. */
export function videoHitsFromSuggest(v: unknown, locale: Locale, videosWebUrl: string): VideoHit[] | null {
  if (!Array.isArray(v)) return null;
  const out: VideoHit[] = [];
  for (const s of v) {
    if (!isObj(s) || s.type !== 'video') continue;
    const id = str(s.id, 64);
    const title = str(s.text);
    if (!id || !VIDEO_ID.test(id) || !title) continue;
    const meta = isObj(s.metadata) ? s.metadata : {};
    out.push({
      id,
      title,
      href: watchUrl(videosWebUrl, { kind: 'video', id, lang: locale }),
      thumbnailUrl: httpsOrNull(s.thumbnailUrl),
      channelName: str(s.subtitle, 120),
      durationSeconds: typeof meta.duration === 'number' && meta.duration > 0 ? Math.round(meta.duration) : null,
      isShort: meta.isShort === true,
      publishedAt: '',
    });
  }
  return out;
}

/** Suggestions for a search box, or null when there is no answer. Abortable; never throws. */
export async function fetchVideoSuggestions(url: string, locale: Locale, videosWebUrl: string, signal: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<VideoHit[] | null> {
  try {
    const res = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, credentials: 'omit' });
    if (!res.ok) return null;
    return videoHitsFromSuggest(await res.json(), locale, videosWebUrl);
  } catch {
    return null;
  }
}
