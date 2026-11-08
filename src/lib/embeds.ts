/**
 * The ONLY place that builds URLs into the videos site (SPEC §6).
 *
 * Embed paths and parameters follow the embed contract, AlUmmahNow
 * `docs/embeds/README.md` §2 (`/embed/v/{id}`, `/embed/p/{id}`; `lang`, `start`,
 * `autoplay` which always starts muted). Change them here only.
 * Watch and channel URLs follow apps/web today:
 *   /{locale}/video/{id}, /{locale}/playlist/{id}, /{locale}/@{handle} or /{locale}/channels/{id}.
 */
import type { Locale } from './locale';

export type EmbedKind = 'video' | 'playlist';

export interface EmbedTarget {
  kind: EmbedKind;
  id: string;
  lang: Locale;
  /** Start offset in seconds (videos only). */
  start?: number;
  /** Facades load the iframe on a click, so the player may start at once. */
  autoplay?: boolean;
}

/** Ids from the videos platform: uuids and similar. Anything else is rejected. */
export const VIDEO_ID = /^[A-Za-z0-9_-]{1,64}$/;
const HANDLE = /^[A-Za-z0-9._-]{1,40}$/;

const base = (videosWebUrl: string) => videosWebUrl.replace(/\/+$/, '');

function assertId(id: string): string {
  if (!VIDEO_ID.test(id)) throw new Error(`invalid videos id: ${JSON.stringify(id).slice(0, 80)}`);
  return id;
}

export function embedUrl(videosWebUrl: string, t: EmbedTarget): string {
  const path = t.kind === 'playlist' ? `/embed/p/${assertId(t.id)}` : `/embed/v/${assertId(t.id)}`;
  const url = new URL(base(videosWebUrl) + path);
  url.searchParams.set('lang', t.lang);
  if (t.kind === 'video' && t.start && Number.isInteger(t.start) && t.start > 0) url.searchParams.set('start', String(t.start));
  if (t.autoplay) url.searchParams.set('autoplay', '1');
  return url.toString();
}

export function watchUrl(videosWebUrl: string, t: Omit<EmbedTarget, 'start' | 'autoplay'>): string {
  const segment = t.kind === 'playlist' ? 'playlist' : 'video';
  return `${base(videosWebUrl)}/${t.lang}/${segment}/${assertId(t.id)}`;
}

export function channelUrl(videosWebUrl: string, c: { id: string; handle?: string | null; lang: Locale }): string {
  if (c.handle && HANDLE.test(c.handle)) return `${base(videosWebUrl)}/${c.lang}/@${c.handle}`;
  return `${base(videosWebUrl)}/${c.lang}/channels/${assertId(c.id)}`;
}

export function libraryUrl(videosWebUrl: string, lang: Locale): string {
  return `${base(videosWebUrl)}/${lang}`;
}

/** Origin allowed in CSP frame-src. */
export function embedOrigin(videosWebUrl: string): string {
  return new URL(base(videosWebUrl)).origin;
}
