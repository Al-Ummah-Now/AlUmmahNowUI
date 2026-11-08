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

export function facadeHtml(item: VideoItem, opts: { videosWebUrl: string; lang: Locale; headingLevel?: 2 | 3 }): string {
  if (item.kind === 'channel') throw new Error('channels have no embed');
  const t = strings(opts.lang);
  const src = embedUrl(opts.videosWebUrl, { kind: item.kind, id: item.id, lang: opts.lang, autoplay: true });
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
    `<figure class="facade" data-embed-src="${e(src)}" data-embed-title="${e(item.title)}">`,
    `<div class="facade-frame">${thumb}${badge}`,
    `<button type="button" class="facade-play" aria-label="${e(fmt(t.videos.play, { title: item.title }))}">`,
    `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="31"/><path d="M26 20v24l19-12z"/></svg>`,
    `</button></div>`,
    `<figcaption class="facade-caption"><${h} class="facade-title">${e(item.title)}</${h}>`,
    item.channelName ? `<p class="facade-channel">${e(item.channelName)}</p>` : '',
    `<a class="facade-link" href="${e(watch)}">${e(t.videos.watchOnVideos)}</a>`,
    `</figcaption></figure>`,
  ].join('');
}
