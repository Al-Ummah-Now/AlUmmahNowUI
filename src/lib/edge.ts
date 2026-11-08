/**
 * Edge behaviour around Astro (src/worker.ts): apex → www, `/` → locale, security
 * headers, HTML edge cache. Pure functions where possible (tests/edge.test.ts).
 */
import { embedOrigin } from './embeds';
import type { Config } from './env';
import { imgSrcSources } from './images';
import { negotiateLocale } from './locale';

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

export function contentSecurityPolicy(cfg: Config): string {
  const https = cfg.siteUrl.startsWith('https://');
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src ${imgSrcSources(cfg.cmsPublicUrl).join(' ')}`,
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'none'",
    `frame-src ${embedOrigin(cfg.videosWebUrl)}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    // the sign-out form posts here and is redirected to auth's /logout
    `form-action 'self' ${new URL(cfg.authUrl).origin}`,
    "manifest-src 'self'",
  ];
  if (https) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function applySecurityHeaders(response: Response, cfg: Config): Response {
  const res = new Response(response.body, response);
  const h = res.headers;
  const type = h.get('Content-Type') ?? '';
  if (type.includes('text/html')) h.set('Content-Security-Policy', contentSecurityPolicy(cfg));
  if (cfg.siteUrl.startsWith('https://')) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'DENY');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  if (!cfg.isProduction) h.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

// ---- HTML edge cache (SPEC §5): anonymous-identical HTML, keyed by URL --------------

export const HTML_FRESH_SEC = 60;
export const HTML_SWR_SEC = 600;
const STORED_AT = 'x-www-stored-at';
export const HTML_CACHE_CONTROL = `public, max-age=0, s-maxage=${HTML_FRESH_SEC}, stale-while-revalidate=${HTML_SWR_SEC}`;

/** Locale pages only (not /auth, /healthz, feeds are fine to cache too). */
export function isCacheableRequest(request: Request): boolean {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (!/^\/(en|ar)(\/|$)/.test(url.pathname)) return false;
  // Only ?page= varies a page; other query strings (tracking etc.) bypass the cache
  for (const k of url.searchParams.keys()) if (k !== 'page') return false;
  return true;
}

/** Store only complete, CMS-backed (not built-in fallback) 200 HTML/XML. */
export function isCacheableResponse(response: Response): boolean {
  if (response.status !== 200) return false;
  if (response.headers.has('Set-Cookie')) return false;
  if (response.headers.get('X-Content-Source') === 'builtin') return false;
  const type = response.headers.get('Content-Type') ?? '';
  return type.includes('text/html') || type.includes('xml');
}

export async function withHtmlCache(
  request: Request,
  cache: Cache | null,
  waitUntil: (p: Promise<unknown>) => void,
  render: () => Promise<Response>,
  now: () => number = Date.now,
): Promise<Response> {
  if (!cache || !isCacheableRequest(request)) return render();
  const key = new Request(request.url, { method: 'GET' });
  const store = (res: Response) => {
    if (!isCacheableResponse(res)) return;
    const copy = new Response(res.clone().body, res);
    copy.headers.set(STORED_AT, String(now()));
    copy.headers.set('Cache-Control', `public, max-age=${HTML_FRESH_SEC + HTML_SWR_SEC}`);
    waitUntil(cache.put(key, copy).catch(() => undefined));
  };
  const finish = (res: Response, state: string) => {
    const out = new Response(res.body, res);
    out.headers.delete(STORED_AT);
    out.headers.set('Cache-Control', HTML_CACHE_CONTROL);
    out.headers.set('X-Edge-Cache', state);
    return out;
  };

  const hit = await cache.match(key).catch(() => undefined);
  if (hit) {
    const age = (now() - Number(hit.headers.get(STORED_AT) ?? 0)) / 1000;
    if (age < HTML_FRESH_SEC) return finish(hit, 'HIT');
    if (age < HTML_FRESH_SEC + HTML_SWR_SEC) {
      waitUntil(render().then(store).catch(() => undefined));
      return finish(hit, 'STALE');
    }
  }
  const fresh = await render();
  store(fresh);
  return isCacheableResponse(fresh) ? finish(fresh, 'MISS') : fresh;
}
