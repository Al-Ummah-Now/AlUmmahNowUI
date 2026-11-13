/**
 * Edge behaviour of the sites Worker around Astro (src/worker.ts): zone hosts that are not sites,
 * `/` → the site's default language, a language the site doesn't serve → its default, security
 * headers, and what the HTML edge cache may keep (packages/render/src/html-cache.ts).
 */
import { embedOrigin } from '../../../../packages/render/src/embeds';
import { VIDEO_IMAGE_HOSTS } from '../../../../packages/render/src/images';
import { isLocale } from '../../../../packages/render/src/locale';
import { cacheKeyUrl } from '../../../../packages/render/src/html-cache';
import { HOST_SUFFIX, type Config } from './env';
import type { PublicSite } from './site-types';
import { MODE_SCRIPT_HASH } from './theme-mode';

/**
 * The zone's own names (§4.0): alummahnow.org, www. and the SaaS fallback origin `sites.` are not
 * sites; they 301 to www.alummahnow.net. Test zones (qa./stage.) follow the same rule.
 */
export function zoneRedirect(host: string, cfg: Config): Response | null {
  const suffix = HOST_SUFFIX[cfg.appEnv];
  if (host === suffix || host === `www.${suffix}` || host === `sites.${suffix}`) {
    return new Response(null, { status: 301, headers: { Location: `${cfg.wwwUrl}/`, 'Cache-Control': 'public, max-age=3600' } });
  }
  return null;
}

/** The site's own path redirects (Studio → Site → Redirects, SS16): exact path, 301. */
export function pathRedirect(url: URL, site: PublicSite): Response | null {
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  const path = norm(url.pathname);
  const hit = (site.site.redirects ?? []).find((r) => typeof r.from === 'string' && r.from.startsWith('/') && norm(r.from) === path);
  if (!hit) return null;
  const to = hit.to;
  // Only our own paths or https:// addresses (api-videos validates; checked again here)
  if (!(/^\/(?!\/)/.test(to) || /^https:\/\//.test(to))) return null;
  return new Response(null, { status: 301, headers: { Location: to, 'Cache-Control': 'public, max-age=300' } });
}

/** `/` → `/<default>/`; `/<lang>/…` for a language the site doesn't serve → the default language (SS13). */
export function localeRedirect(url: URL, site: PublicSite): Response | null {
  const [, first] = url.pathname.split('/');
  const def = site.site.locales[0] ?? 'en';
  if (url.pathname === '/') {
    return new Response(null, { status: 302, headers: { Location: `/${def}/${url.search}`, 'Cache-Control': 'private, no-cache' } });
  }
  if (isLocale(first) && !(site.site.locales as string[]).includes(first)) {
    const rest = url.pathname.split('/').slice(2).join('/');
    return new Response(null, { status: 301, headers: { Location: `/${def}/${rest}${url.search}`, 'Cache-Control': 'public, max-age=3600' } });
  }
  return null;
}

export function contentSecurityPolicy(cfg: Config, opts: { preview: boolean; https: boolean }): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' ${MODE_SCRIPT_HASH}`,
    "style-src 'self'",
    `img-src 'self' data: https://${VIDEO_IMAGE_HOSTS.join(' https://')}`,
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${embedOrigin(cfg.videosWebUrl)}`,
    // Studio previews the site in a frame on the videos site; everything else is never framed
    `frame-ancestors ${opts.preview ? embedOrigin(cfg.videosWebUrl) : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    // sign-out posts here, then redirects to auth's logout
    `form-action 'self' ${new URL(cfg.authUrl).origin}`,
  ];
  if (opts.https) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/**
 * Security headers on every response. HSTS covers subdomains only on our own zone (we own every
 * name under alummahnow.org); a scholar's own domain gets HSTS without includeSubDomains.
 */
export function applySecurityHeaders(response: Response, cfg: Config, opts: { host: string; preview: boolean; noindex: boolean }): Response {
  const res = new Response(response.body, response);
  const h = res.headers;
  const https = cfg.appEnv !== 'local';
  if ((h.get('Content-Type') ?? '').includes('text/html')) h.set('Content-Security-Policy', contentSecurityPolicy(cfg, { preview: opts.preview, https }));
  if (https) h.set('Strict-Transport-Security', opts.host.endsWith('.alummahnow.org') ? 'max-age=31536000; includeSubDomains' : 'max-age=31536000');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', opts.preview ? 'no-referrer' : 'strict-origin-when-cross-origin');
  if (!opts.preview) h.set('X-Frame-Options', 'DENY');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  if (!cfg.isProduction || opts.noindex) h.set('X-Robots-Tag', 'noindex, nofollow');
  if (opts.preview) {
    h.set('Cache-Control', 'private, no-store, no-transform');
    h.delete('X-Edge-Cache');
  }
  return res;
}

/** Locale pages, feeds and the sitemap, with only bounded query strings, and never a preview. */
export function isCacheableRequest(request: Request): boolean {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (!/^\/(en|ar)(\/|$)/.test(url.pathname) && url.pathname !== '/sitemap.xml' && url.pathname !== '/robots.txt') return false;
  for (const [k, v] of url.searchParams) {
    if (k === 'page' && /^[1-9]\d{0,2}$/.test(v)) continue;
    if (k === 'cursor' && v.length <= 200) continue;
    return false;
  }
  return true;
}

export const RENDER_STATE_HEADER = 'X-Site-Render';

export function isCacheableResponse(response: Response): boolean {
  if (response.status !== 200 || response.headers.has('Set-Cookie')) return false;
  // Rendered from the outage snapshot or with a theme this build can't render: don't keep it
  if (response.headers.get(RENDER_STATE_HEADER) !== 'ok') return false;
  const type = response.headers.get('Content-Type') ?? '';
  return type.includes('text/html') || type.includes('xml') || type.includes('text/plain');
}

/** The URL (with its host) + build + the site's config version and theme (§5.2 step 4). */
export function siteCacheKey(url: string, version: string, site: PublicSite): string {
  return cacheKeyUrl(url, { __v: version, __c: String(site.site.configVersion), __t: site.site.themeRef });
}
