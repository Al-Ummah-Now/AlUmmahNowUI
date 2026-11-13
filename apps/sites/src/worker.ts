/**
 * The scholar sites Worker (wiki AUN-SCHOLAR-SITES §5.2). Wraps Astro's Cloudflare handler:
 *   1. /healthz answers on any host (release smoke), before any lookup
 *   2. the zone's own names (apex, www., sites.) → 301 www.alummahnow.net
 *   3. Host → site (src/lib/site.ts). Unknown host: a bare 404, never cached. Old or non-primary
 *      host: 301 to the primary (path and query kept). api-videos down: the host's last good config.
 *   4. suspended: a neutral "unavailable" page; `/` and unserved languages → the site's default
 *   5. the site goes to Astro in a request header; HTML edge cache keyed by URL (host included),
 *      build, config version and theme; previews and signed-in views are never cached
 *   6. security headers on every response, static assets included (run_worker_first)
 * The host is only ever used as a registry key: every URL the site prints comes from the
 * registry's primaryHost, so a spoofed Host can't poison the cache.
 */
import { handle } from '@astrojs/cloudflare/handler';
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { cachedHtml } from '../../../packages/render/src/html-cache';
import { config, type SitesEnv } from './lib/env';
import { applySecurityHeaders, isCacheableRequest, isCacheableResponse, localeRedirect, pathRedirect, RENDER_STATE_HEADER, siteCacheKey, zoneRedirect } from './lib/edge';
import { isPreviewToken, lookupSite, normalizeHost, withSiteHeader } from './lib/site';
import { renderTheme } from './lib/theme';
import { strings } from './lib/i18n';
import { escapeHtml } from '../../../packages/render/src/html';

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** Local runs (APP_ENV=local) only: the site host can come from a header, for E2E on localhost. */
export const LOCAL_HOST_HEADER = 'x-aun-site-host';

function bare(status: number, text: string): Response {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function unavailablePage(locale: 'en' | 'ar'): Response {
  const t = strings(locale);
  const html = `<!doctype html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(t.unavailableTitle)}</title></head><body><main><h1>${escapeHtml(t.unavailableTitle)}</h1><p>${escapeHtml(t.unavailableBody)}</p></main></body></html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '300' } });
}

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      async fetch(request: Request, env: SitesEnv, ctx: ExecutionContext): Promise<Response> {
        const cfg = config(env);
        const url = new URL(request.url);
        const host = normalizeHost(cfg.appEnv === 'local' ? (request.headers.get(LOCAL_HOST_HEADER) ?? url.hostname) : url.hostname) ?? '';
        const secure = (res: Response, preview = false, noindex = false) => applySecurityHeaders(res, cfg, { host, preview, noindex });

        if (url.pathname === '/healthz') {
          return secure(new Response(JSON.stringify({ ok: true, app: 'sites', env: cfg.appEnv, version: cfg.version, ...(cfg.appEnv === 'local' ? { host } : {}) }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }));
        }
        const zone = zoneRedirect(host, cfg);
        if (zone) return secure(zone);

        const preview = url.searchParams.get('preview');
        const waitUntil = (p: Promise<unknown>) => ctx.waitUntil(p);
        const found = await lookupSite(host, isPreviewToken(preview) ? preview : null, {
          apiUrl: cfg.videosApiUrl,
          kv: env.CONTENT_SNAPSHOT,
          waitUntil,
          log: (message, data) => console.warn(JSON.stringify({ msg: message, ...data })),
        });
        if (found.kind === 'not_found') return secure(bare(404, 'Not found'), false, true);
        if (found.kind === 'unavailable') return secure(unavailablePage('en'), false, true);
        if (found.kind === 'redirect') {
          const target = new URL(found.location);
          // An old or secondary host keeps the path and query on the primary; a revoked site goes to the channel
          const location = target.pathname === '/' && !target.search ? `${target.origin}${url.pathname}${url.search}` : target.toString();
          return secure(new Response(null, { status: 301, headers: { Location: location, 'Cache-Control': 'public, max-age=300' } }));
        }

        const site = found.site;
        const isPreview = site.preview;
        if (site.site.status === 'suspended') return secure(unavailablePage(site.site.locales[0] ?? 'en'), isPreview, true);
        const redirected = pathRedirect(url, site);
        if (redirected) return secure(redirected, isPreview, isPreview);
        const moved = localeRedirect(url, site);
        if (moved) return secure(moved, isPreview, isPreview);

        const theme = renderTheme(site.site.themeRef);
        const forAstro = withSiteHeader(request, site);
        const render = async () => {
          const res = (await handle(manifest, app, forAstro as never, env as never, ctx as never)) as Response;
          const out = new Response(res.body, res);
          out.headers.set(RENDER_STATE_HEADER, found.source !== 'snapshot' && theme.exact && !isPreview ? 'ok' : found.source === 'snapshot' ? 'snapshot' : 'uncached');
          return out;
        };
        const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
        const response = isPreview
          ? await render()
          : await cachedHtml(request, cache, waitUntil, render, {
              key: siteCacheKey(request.url, cfg.version, site),
              cacheableRequest: isCacheableRequest,
              cacheableResponse: isCacheableResponse,
            });
        return secure(response, isPreview, isPreview);
      },
    },
  };
}
