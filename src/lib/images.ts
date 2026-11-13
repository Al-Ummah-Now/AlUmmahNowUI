/**
 * Image hosts www may load from (CSP img-src and URL normalisation share this list,
 * so an image either renders or is dropped; it never trips the CSP).
 * Video thumbnails come from the videos platform's CDNs.
 */
export const VIDEO_IMAGE_HOSTS = ['images.alummahnow.net', '*.b-cdn.net'] as const;

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

export function imgSrcSources(cmsPublicUrl: string): string[] {
  return ["'self'", 'data:', new URL(cmsPublicUrl).origin, ...VIDEO_IMAGE_HOSTS.map((h) => `https://${h}`)];
}
