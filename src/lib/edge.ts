/**
 * Edge behaviour around Astro (src/worker.ts): apex → www, `/` → locale, security
 * headers, HTML edge cache. Pure functions where possible (tests/edge.test.ts).
 */
import { embedOrigin } from './embeds';
import type { Config } from './env';
import { imgSrcSources, VIDEO_MEDIA_HOSTS } from './images';
import { articlesPath, isLocale, negotiateLocale } from './locale';
import { isPreviewPath } from './preview';
import { THEME_SOURCE_HEADER } from './site-theme';
import { MODE_SCRIPT_HASH } from './theme-mode';

/** alummahnow.net/x?y → 301 https://www.alummahnow.net/x?y (only when SITE_URL is a www host). */
export function apexRedirect(requestUrl: string, siteUrl: string): Response | null {
  const site = new URL(siteUrl);
  if (!site.hostname.startsWith('www.')) return null;
  const url = new URL(requestUrl);
  if (url.hostname !== site.hostname.slice(4)) return null;
  const target = `${site.origin}${url.pathname}${url.search}`;
  return new Response(null, {
    status: 301,
    headers: { Location: target, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * The News section is now Articles: `/{l}/news/…` → 301 `/{l}/articles/…`, query kept. Runs
 * before Astro and the HTML cache, so old links, bookmarks and search results keep working.
 */
export function legacyArticlesRedirect(requestUrl: string): Response | null {
  const url = new URL(requestUrl);
  if (!isLocale(url.pathname.split('/')[1])) return null;
  const path = articlesPath(url.pathname);
  if (!path) return null;
  return new Response(null, {
    status: 301,
    headers: { Location: `${path}${url.search}`, 'Cache-Control': 'public, max-age=86400' },
  });
}

/** `/` → `/en/` or `/ar/` (cookie, Accept-Language, default en). Never cached by shared caches. */
export function rootRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== '/') return null;
  const locale = negotiateLocale(request.headers.get('Cookie'), request.headers.get('Accept-Language'));
  return new Response(null, {
    status: 302,
    headers: { Location: `/${locale}/${url.search}`, Vary: 'Cookie, Accept-Language', 'Cache-Control': 'private, no-cache' },
  });
}

/**
 * form-action for the sign-out form. It posts to /auth/logout, which 303s to auth's
 * /logout, and auth then walks a front-channel redirect chain through every app's logout
 * (profile.auth, admin.auth, admin, cms, videos, back to www). Browsers apply form-action
 * to every redirect in that chain, so allow auth's origin and its parent site's
 * subdomains: https://auth.alummahnow.net → https://*.alummahnow.net;
 * https://auth.qa.alummahnow.net → https://*.qa.alummahnow.net. No wildcard for
 * single-label hosts (localhost) or IPs.
 */
export function formActionSources(authUrl: string): string[] {
  const auth = new URL(authUrl);
  const sources = ["'self'", auth.origin];
  const labels = auth.hostname.split('.');
  const isIp = /^[\d.]+$/.test(auth.hostname) || auth.hostname.includes(':');
  if (!isIp && labels.length >= 3) sources.push(`${auth.protocol}//*.${labels.slice(1).join('.')}`);
  return sources;
}

export function contentSecurityPolicy(cfg: Config, opts: { analytics?: boolean } = {}): string {
  const https = cfg.siteUrl.startsWith('https://');
  const analytics = opts.analytics ?? true;
  const directives = [
    "default-src 'self'",
    // Cloudflare Web Analytics: the zone injects its beacon into HTML responses (not on previews).
    // The one inline script is the light/dark head script, allowed by its hash (theme-mode.ts).
    analytics
      ? `script-src 'self' ${MODE_SCRIPT_HASH} https://static.cloudflareinsights.com`
      : `script-src 'self' ${MODE_SCRIPT_HASH}`,
    "style-src 'self'",
    `img-src ${imgSrcSources(cfg.cmsPublicUrl).join(' ')}`,
    "font-src 'self'",
    // the header asks auth which accounts this browser is signed in to (/session/accounts), and
    // search boxes ask the CMS for suggestions (/api/public/v1/search/suggest)
    // and the timeline asks the videos platform for a video's preview file and the next Shorts
    `connect-src 'self' ${new URL(cfg.authUrl).origin} ${new URL(cfg.cmsPublicUrl).origin} ${new URL(cfg.videosApiUrl).origin}${analytics ? ' https://cloudflareinsights.com' : ''}`,
    // the timeline's hover previews and the Shorts viewer play the platform's MP4s
    `media-src ${VIDEO_MEDIA_HOSTS.map((h) => `https://${h}`).join(' ')}`,
    `frame-src ${embedOrigin(cfg.videosWebUrl)}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    // the sign-out form posts here and is redirected through auth's logout chain
    `form-action ${formActionSources(cfg.authUrl).join(' ')}`,
    "manifest-src 'self'",
  ];
  if (https) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/**
 * Draft previews (src/lib/preview.ts): never stored by any cache (no-store), never rewritten by
 * the zone (no-transform: Cloudflare injects no analytics beacon), never indexed, no Referer, and
 * a CSP that would block the beacon anyway. Applied to every /preview response, errors included.
 */
export function applyPreviewHeaders(h: Headers): void {
  h.set('Cache-Control', 'private, no-store, no-transform');
  h.set('X-Robots-Tag', 'noindex, nofollow');
  h.delete('X-Edge-Cache');
}

export function applySecurityHeaders(response: Response, cfg: Config, pathname = ''): Response {
  const res = new Response(response.body, response);
  const h = res.headers;
  const type = h.get('Content-Type') ?? '';
  const preview = isPreviewPath(pathname);
  if (type.includes('text/html')) h.set('Content-Security-Policy', contentSecurityPolicy(cfg, { analytics: !preview }));
  if (cfg.siteUrl.startsWith('https://')) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', preview ? 'no-referrer' : 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'DENY');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  if (!cfg.isProduction) h.set('X-Robots-Tag', 'noindex, nofollow');
  if (preview) applyPreviewHeaders(h);
  return res;
}

/** A home timeline cursor (src/lib/feed.ts CURSOR: position, then the week version to read next). */
const FEED_CURSOR = /^\d{1,15}-[pv]\d{1,12}(?:\.\d{4}-W\d{2}\.[a-z0-9]{1,32})?$/;

// ---- HTML edge cache (SPEC §5): anonymous-identical HTML, keyed by URL --------------

export const HTML_FRESH_SEC = 60;
export const HTML_SWR_SEC = 600;
/**
 * Revalidation lease (audit UI-2): on a STALE hit, the stale entry is first re-stored as fresh for
 * this long, so requests in other isolates of the colo see a HIT instead of each starting their
 * own render. Within one isolate an in-flight map collapses concurrent revalidations completely.
 */
export const HTML_LEASE_SEC = 15;
const STORED_AT = 'x-www-stored-at';
/** When the entry's content was rendered: a lease moves STORED_AT, never this (bounds staleness). */
const RENDERED_AT = 'x-www-rendered-at';
export const HTML_CACHE_CONTROL = `public, max-age=0, s-maxage=${HTML_FRESH_SEC}, stale-while-revalidate=${HTML_SWR_SEC}`;

/** Locale pages only (not /auth, /healthz, feeds are fine to cache too). */
export function isCacheableRequest(request: Request): boolean {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (isPreviewPath(url.pathname) || !/^\/(en|ar)(\/|$)/.test(url.pathname)) return false;
  // Only ?page=, the home timeline's ?before=<cursor>, a card post's ?slide=N and a card grid's ?tag=
  // vary a page, each bounded so junk values can't fill the cache; other query strings bypass it.
  for (const [k, v] of url.searchParams) {
    if (k === 'page') continue;
    if (k === 'before' && FEED_CURSOR.test(v)) continue;
    if (k === 'slide' && /^[1-9]\d{0,2}$/.test(v)) continue;
    if (k === 'tag' && v.length > 0 && v.length <= 60) continue;
    return false;
  }
  return true;
}

/** Store only complete, CMS-backed (not built-in fallback) 200 HTML/XML. */
export function isCacheableResponse(response: Response): boolean {
  if (response.status !== 200) return false;
  if (response.headers.has('Set-Cookie')) return false;
  if (response.headers.get('X-Content-Source') === 'builtin') return false;
  // Rendered without the admin's theme (admin API down or slow): don't keep it for everyone
  const theme = response.headers.get(THEME_SOURCE_HEADER);
  if (theme && theme !== 'admin') return false;
  const type = response.headers.get('Content-Type') ?? '';
  return type.includes('text/html') || type.includes('xml');
}

/**
 * The edge-cache key for a page: its URL plus the Worker version that rendered it. Pages link
 * hashed assets (/_astro/*.css) that only exist in the version that built them, so a page cached
 * by the previous deploy would load without its stylesheet (404) for up to FRESH+SWR after every
 * deploy. Keying by version starts each deploy on its own cache; during a gradual rollout each
 * version serves only pages that match its own assets.
 *
 * The site theme is in the key too: the page's <html data-theme> is rendered by the server, so when
 * the admin switches the theme every page starts afresh (a MISS) instead of serving the old theme
 * until its entry expires.
 */
export function htmlCacheKey(url: string, version: string, theme = ''): string {
  if (!version && !theme) return url;
  const u = new URL(url);
  if (version) u.searchParams.set('__v', version);
  if (theme) u.searchParams.set('__t', theme);
  return u.toString();
}

/** Revalidations in flight in this isolate, by URL. */
const revalidating = new Map<string, Promise<unknown>>();

export async function withHtmlCache(
  request: Request,
  cache: Cache | null,
  waitUntil: (p: Promise<unknown>) => void,
  render: () => Promise<Response>,
  now: () => number = Date.now,
  inflight: Map<string, Promise<unknown>> = revalidating,
  version = '',
  theme = '',
): Promise<Response> {
  if (!cache || !isCacheableRequest(request)) return render();
  const key = new Request(htmlCacheKey(request.url, version, theme), { method: 'GET' });
  const put = (res: Response, storedAt: number, renderedAt: number) => {
    const copy = new Response(res.body, res);
    copy.headers.set(STORED_AT, String(storedAt));
    copy.headers.set(RENDERED_AT, String(renderedAt));
    const left = Math.max(1, Math.ceil(HTML_FRESH_SEC + HTML_SWR_SEC - (now() - renderedAt) / 1000));
    copy.headers.set('Cache-Control', `public, max-age=${left}`);
    return cache.put(key, copy).catch(() => undefined);
  };
  const store = async (res: Response) => {
    if (!isCacheableResponse(res)) return;
    const t = now();
    await put(res.clone(), t, t);
  };
  const finish = (res: Response, state: string) => {
    const out = new Response(res.body, res);
    out.headers.delete(STORED_AT);
    out.headers.delete(RENDERED_AT);
    out.headers.set('Cache-Control', HTML_CACHE_CONTROL);
    out.headers.set('X-Edge-Cache', state);
    return out;
  };

  const hit = await cache.match(key).catch(() => undefined);
  if (hit) {
    const storedAt = Number(hit.headers.get(STORED_AT) ?? 0);
    const renderedAt = Number(hit.headers.get(RENDERED_AT) ?? storedAt);
    const age = (now() - storedAt) / 1000;
    const life = (now() - renderedAt) / 1000;
    if (life < HTML_FRESH_SEC + HTML_SWR_SEC) {
      if (age < HTML_FRESH_SEC) return finish(hit, 'HIT');
      if (!inflight.has(key.url)) {
        // Lease first (the stale copy, fresh for HTML_LEASE_SEC), then render and store.
        const lease = put(hit.clone(), now() - (HTML_FRESH_SEC - HTML_LEASE_SEC) * 1000, renderedAt);
        const job = lease
          .then(render)
          .then(store)
          .catch(() => undefined)
          .finally(() => inflight.delete(key.url));
        inflight.set(key.url, job);
        waitUntil(job);
      }
      return finish(hit, 'STALE');
    }
  }
  const fresh = await render();
  waitUntil(store(fresh));
  return isCacheableResponse(fresh) ? finish(fresh, 'MISS') : fresh;
}
