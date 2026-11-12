/**
 * Video facade (SPEC §6): thumbnail, title and a real <button> render server-side;
 * src/scripts/facade.ts swaps in the iframe on click. Used by the videos page and by
 * the ::video directive in CMS markdown, so both render identically.
 */
import { fmt, strings } from '../i18n';
import { embedUrl, watchUrl } from './embeds';
import { escapeHtml as e } from './html';
import type { Locale } from './locale';
import { clockDuration, type VideoItem } from './videos';

/**
 * The player frame's shape from the video's size (CMS snapshot width/height): the nearest of the
 * shapes the stylesheet has (.facade-frame.ar-*), 16:9 when the size is unknown. The embed fills
 * the frame and contains the video, so the frame at the video's shape means no bars at all.
 * Classes, not an inline aspect-ratio: the CSP allows no style attributes.
 */
export const FRAME_SHAPES = [
  { cls: 'ar-21x9', ratio: 21 / 9 },
  { cls: 'ar-16x9', ratio: 16 / 9 },
  { cls: 'ar-4x3', ratio: 4 / 3 },
  { cls: 'ar-1x1', ratio: 1 },
  { cls: 'ar-4x5', ratio: 4 / 5 },
  { cls: 'ar-9x16', ratio: 9 / 16 },
] as const;
export function frameShape(width: number | null | undefined, height: number | null | undefined): (typeof FRAME_SHAPES)[number]['cls'] {
  if (!width || !height || width <= 0 || height <= 0) return 'ar-16x9';
  const r = Math.log(width / height);
  let best: (typeof FRAME_SHAPES)[number] = FRAME_SHAPES[1];
  for (const s of FRAME_SHAPES) if (Math.abs(Math.log(s.ratio) - r) < Math.abs(Math.log(best.ratio) - r)) best = s;
  return best.cls;
}

/** `caption: false` leaves out the title block (the home timeline writes its own around the player). */
export function facadeHtml(item: VideoItem, opts: { videosWebUrl: string; lang: Locale; headingLevel?: 2 | 3; caption?: boolean; className?: string }): string {
  if (item.kind === 'channel') throw new Error('channels have no embed');
  const t = strings(opts.lang);
  // The iframe is inserted only on the viewer's click (scripts/facade.ts): a gesture start, with sound
  const src = embedUrl(opts.videosWebUrl, { kind: item.kind, id: item.id, lang: opts.lang, autoplay: true, gesture: true });
  const watch = watchUrl(opts.videosWebUrl, { kind: item.kind, id: item.id, lang: opts.lang });
  const duration = clockDuration(item.durationSeconds);
  const h = `h${opts.headingLevel ?? 3}`;
  const thumb = item.thumbnailUrl
    ? `<img class="facade-thumb" src="${e(item.thumbnailUrl)}" alt="" loading="lazy" decoding="async" width="640" height="360">`
    : `<span class="facade-thumb facade-thumb-empty" aria-hidden="true"></span>`;
  const badge =
    item.kind === 'playlist'
      ? `<span class="facade-badge">${e(t.videos.playlist)}</span>`
      : duration
        ? `<span class="facade-badge" dir="ltr">${e(duration)}</span>`
        : '';
  return [
    `<figure class="facade${opts.className ? ` ${e(opts.className)}` : ''}" data-embed-src="${e(src)}" data-embed-title="${e(item.title)}">`,
    `<div class="facade-frame ${frameShape(item.width, item.height)}">${thumb}${badge}`,
    `<button type="button" class="facade-play" aria-label="${e(fmt(t.videos.play, { title: item.title }))}">`,
    `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="31"/><path d="M26 20v24l19-12z"/></svg>`,
    `</button></div>`,
    opts.caption === false ? '' : `<figcaption class="facade-caption"><${h} class="facade-title">${e(item.title)}</${h}>`,
    opts.caption !== false && item.channelName ? `<p class="facade-channel">${e(item.channelName)}</p>` : '',
    opts.caption === false ? '' : `<a class="facade-link" href="${e(watch)}">${e(t.videos.watchOnVideos)}</a>`,
    opts.caption === false ? '</figure>' : `</figcaption></figure>`,
  ].join('');
}
