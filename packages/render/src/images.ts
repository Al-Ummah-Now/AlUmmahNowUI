/**
 * Image hosts www may load from (CSP img-src and URL normalisation share this list,
 * so an image either renders or is dropped; it never trips the CSP).
 * Video thumbnails come from the videos platform's CDNs.
 */
// media.* are the platform's own R2 media domains: the play API answers posters (thumb.jpg) there
// once a video has R2 renditions (AlUmmahNow r2-delivery); without them the browser blocks the poster.
export const VIDEO_IMAGE_HOSTS = ['images.alummahnow.net', '*.b-cdn.net', 'media.alummahnow.net', 'media.stage.alummahnow.net', 'media.qa.alummahnow.net'] as const;

/**
 * Hosts the timeline's video files come from (CSP media-src): the videos platform's public play API
 * (AlUmmahNow apps/api-videos) answers signed MP4 URLs on its R2 media domains or Bunny's CDN.
 */
export const VIDEO_MEDIA_HOSTS = ['media.alummahnow.net', 'media.stage.alummahnow.net', 'media.qa.alummahnow.net', '*.b-cdn.net'] as const;

function hostAllowed(host: string, allowed: readonly string[]): boolean {
  return allowed.some((h) => (h.startsWith('*.') ? host.endsWith(h.slice(1)) && host.length > h.length - 1 : host === h));
}

/**
 * Absolute https URL for an image, or null if missing / not allowed.
 * The videos API sometimes returns scheme-less values ("images.alummahnow.net/x y.jpg").
 */
export function normalizeImageUrl(raw: string | null | undefined, extraOrigins: string[] = []): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let value = raw.trim();
  if (!value) return null;
  if (value.startsWith('//')) value = `https:${value}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (extraOrigins.includes(url.origin)) return url.toString();
  if (url.protocol !== 'https:') return null;
  return hostAllowed(url.hostname, VIDEO_IMAGE_HOSTS) ? url.toString() : null;
}

/** The videos web app's origin (VIDEOS_WEB_URL): it serves the stable `/thumb/<videoId>.jpg` images. */
export function videosWebOrigin(videosWebUrl: string): string {
  return new URL(videosWebUrl).origin;
}

/**
 * img-src: the CMS, the videos web app (stable thumbnails, stableImageUrl), and the video CDNs.
 * The play API's hover posters (scripts/timeline-media.ts) are signed media.* or Bunny URLs: kept.
 */
export function imgSrcSources(cmsPublicUrl: string, videosWebUrl: string): string[] {
  const origins = [new URL(cmsPublicUrl).origin, videosWebOrigin(videosWebUrl)];
  return ["'self'", 'data:', ...new Set(origins), ...VIDEO_IMAGE_HOSTS.map((h) => `https://${h}`)];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEDIA_HOST = /^media\.(?:[a-z0-9-]+\.)*alummahnow\.net$/i;

function parseLoose(raw: string): URL | null {
  let value = raw.trim();
  if (value.startsWith('//')) value = `https:${value}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * True when the URL carries a signature that expires: Bunny's path token (`bcdn_token=`), a
 * `token=` query with `expires=`, or an R2 private path (`/priv/<expires>.<sig>/…` on media.*).
 */
export function isSignedImageUrl(raw: string): boolean {
  if (/bcdn_token=/i.test(raw)) return true;
  const url = parseLoose(raw);
  if (!url) return false;
  if (url.searchParams.has('token') && url.searchParams.has('expires')) return true;
  return MEDIA_HOST.test(url.hostname) && url.pathname.startsWith('/priv/');
}

/** The video id a signed thumbnail belongs to: Bunny's `token_path=/<id>/`, else the first UUID path segment. */
function videoIdInUrl(raw: string): string | null {
  const tokenPath = /token_path=([^&/]+)/i.exec(raw);
  if (tokenPath?.[1]) {
    let decoded = tokenPath[1];
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // keep it encoded: no id in it then
    }
    const id = decoded.split('/').find((s) => UUID.test(s));
    if (id) return id.toLowerCase();
  }
  const url = parseLoose(raw);
  const id = url?.pathname.split('/').find((s) => UUID.test(s));
  return id ? id.toLowerCase() : null;
}

/**
 * A thumbnail URL that never expires. A signed (expiring) one becomes the videos web app's public
 * `${videosWebUrl}/thumb/<videoId>.jpg` (404 for a non-public video): the id is `ownerVideoId`
 * (the video the thumbnail belongs to) when it is a UUID, else the one in the URL. A signed URL
 * with no id is null (a dead link in a few hours, and never for crawlers). Unsigned: unchanged.
 */
export function stableImageUrl(videosWebUrl: string, url: string | null | undefined, ownerVideoId?: string | null): string | null {
  if (!url) return null;
  if (!isSignedImageUrl(url)) return url;
  const id = ownerVideoId && UUID.test(ownerVideoId) ? ownerVideoId.toLowerCase() : videoIdInUrl(url);
  return id ? `${videosWebUrl.replace(/\/+$/, '')}/thumb/${id}.jpg` : null;
}

/** A video item's thumbnail, stable (stableImageUrl): videos own theirs; playlists and channels show another video's. */
export function itemThumb(videosWebUrl: string, item: { kind: string; id: string; thumbnailUrl: string | null }): string | null {
  return stableImageUrl(videosWebUrl, item.thumbnailUrl, item.kind === 'video' ? item.id : null);
}
