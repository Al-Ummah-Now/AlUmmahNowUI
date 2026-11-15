/**
 * Large link previews (2026-11-15, owner: "its only a small image with text to the side, cant make
 * it a big one with text under?"). WhatsApp, Telegram, iMessage, Facebook/Messenger, LinkedIn, Slack
 * and Discord show the big preview (image on top, title and description under) only for a wide
 * og:image; a square avatar, a portrait thumbnail or a logo gets the small side thumbnail.
 *
 * Every og:image on www and the scholar sites is therefore a 1200x630 JPEG: the videos web app makes
 * it (`/og/v/<videoId>.jpg`, `/og/c/<channelId>.jpg`, `/og/i/<base64url image>.jpg`, AlUmmahNow
 * apps/web lib/share-card), or the brand card `/brand/og-default.jpg` (the owner's art, as supplied).
 */
import { stableImageUrl } from './images';

export const SHARE_CARD = { width: 1200, height: 630, type: 'image/jpeg' } as const;
export const BRAND_CARD_PATH = '/brand/og-default.jpg';

const trim = (url: string) => url.replace(/\/+$/, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const videoCardUrl = (videosWebUrl: string, videoId: string) => `${trim(videosWebUrl)}/og/v/${encodeURIComponent(videoId)}.jpg`;
export const channelCardUrl = (videosWebUrl: string, channelId: string) => `${trim(videosWebUrl)}/og/c/${encodeURIComponent(channelId)}.jpg`;

function base64Url(text: string): string {
  let binary = '';
  for (const b of new TextEncoder().encode(text)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Hosts the videos app makes cards from (its isAllowedImageSource): https on our domains or Bunny */
function isCardSource(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    const host = u.hostname.toLowerCase();
    return host.endsWith('.b-cdn.net') || host === 'alummahnow.net' || host.endsWith('.alummahnow.net');
  } catch {
    return false;
  }
}

/**
 * The 1200x630 card for a page image, or null (the caller uses its default). A video thumbnail
 * (signed or not, `ownerVideoId` = the video it belongs to) is that video's card; any other picture
 * on our hosts (an article cover, a scholar's avatar, a site logo) is framed by `/og/i/`.
 */
export function shareCardUrl(videosWebUrl: string, image: string | null | undefined, ownerVideoId?: string | null): string | null {
  if (ownerVideoId && UUID.test(ownerVideoId)) return videoCardUrl(videosWebUrl, ownerVideoId.toLowerCase());
  const stable = stableImageUrl(videosWebUrl, image ?? null);
  if (!stable) return null;
  const thumb = new RegExp(`^${trim(videosWebUrl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/thumb/([^/?#]+)\\.jpg$`).exec(stable);
  if (thumb?.[1] && SAFE_ID.test(thumb[1])) return videoCardUrl(videosWebUrl, thumb[1]);
  // Already a card (the videos app's own URLs)
  if (stable.startsWith(`${trim(videosWebUrl)}/og/`)) return stable;
  return isCardSource(stable) ? `${trim(videosWebUrl)}/og/i/${base64Url(stable)}.jpg` : null;
}
