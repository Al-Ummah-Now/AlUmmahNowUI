/**
 * Worker entry (astro.config.mjs workerEntryPoint). Wraps Astro's Cloudflare handler:
 *   1. apex → www (301, path and query kept)
 *   2. `/` → /en/ or /ar/ (302)
 *   3. HTML edge cache for locale pages (Cache API, s-maxage 60, SWR 600)
 *   4. security headers on every response, static assets included (run_worker_first)
 * and the cron (wrangler.jsonc triggers): the single writer of the KV content snapshots.
 */
import { handle } from '@astrojs/cloudflare/handler';
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { apexRedirect, applySecurityHeaders, rootRedirect, withHtmlCache } from './lib/edge';
import type { ExecutionContext } from './lib/cf';
import { createCmsDeps } from './lib/cms';
import { config, type WwwEnv } from './lib/env';
import { writeSnapshots } from './lib/snapshot-writer';

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      async fetch(request: Request, env: WwwEnv, ctx: ExecutionContext): Promise<Response> {
        const cfg = config(env);
        const apex = apexRedirect(request.url, cfg.siteUrl);
        if (apex) return apex;
        const root = rootRedirect(request);
        if (root) return applySecurityHeaders(root, cfg, '/');
        const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
        const render = () => handle(manifest, app, request as never, env as never, ctx as never) as Promise<Response>;
        const response = await withHtmlCache(request, cache, (p) => ctx.waitUntil(p), render);
        return applySecurityHeaders(response, cfg, new URL(request.url).pathname);
      },
      async scheduled(_controller: unknown, env: WwwEnv, ctx: ExecutionContext): Promise<void> {
        const kv = env.CONTENT_SNAPSHOT;
        if (!kv) return;
        const deps = createCmsDeps(env, config(env), (p) => ctx.waitUntil(p), null);
        ctx.waitUntil(
          writeSnapshots({ fetchCms: deps.fetchCms, kv, log: deps.log }).then(
            (r) => console.log(JSON.stringify({ msg: 'content snapshots written', ...r })),
            (error) => console.error(JSON.stringify({ msg: 'content snapshot run failed', error: String(error) })),
          ),
        );
      },
    },
  };
}
