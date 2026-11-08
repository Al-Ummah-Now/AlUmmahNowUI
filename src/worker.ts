/**
 * Worker entry (astro.config.mjs workerEntryPoint). Wraps Astro's Cloudflare handler:
 *   1. apex → www (301, path and query kept)
 *   2. `/` → /en/ or /ar/ (302)
 *   3. HTML edge cache for locale pages (Cache API, s-maxage 60, SWR 600)
 *   4. security headers on every response, static assets included (run_worker_first)
 */
import { handle } from '@astrojs/cloudflare/handler';
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { apexRedirect, applySecurityHeaders, rootRedirect, withHtmlCache } from './lib/edge';
import type { ExecutionContext } from './lib/cf';
import { config, type WwwEnv } from './lib/env';

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      async fetch(request: Request, env: WwwEnv, ctx: ExecutionContext): Promise<Response> {
        const cfg = config(env);
        const apex = apexRedirect(request.url, cfg.siteUrl);
        if (apex) return apex;
        const root = rootRedirect(request);
        if (root) return applySecurityHeaders(root, cfg);
        const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
        const render = () => handle(manifest, app, request as never, env as never, ctx as never) as Promise<Response>;
        const response = await withHtmlCache(request, cache, (p) => ctx.waitUntil(p), render);
        return applySecurityHeaders(response, cfg);
      },
    },
  };
}
