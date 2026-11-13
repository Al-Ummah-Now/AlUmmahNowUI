/**
 * Worker entry (astro.config.mjs workerEntryPoint). Wraps Astro's Cloudflare handler:
 *   1. apex → www (301, path and query kept)
 *   2. `/` → /en/ or /ar/ (302); old News urls `/{l}/news/…` → `/{l}/articles/…` (301)
 *   3. the site theme the admin chose (src/lib/site-theme.ts), handed to Astro in a request header
 *   4. HTML edge cache for locale pages (Cache API, s-maxage 60, SWR 600), keyed by version and theme
 *   5. security headers on every response, static assets included (run_worker_first)
 * and the cron (wrangler.jsonc triggers): the single writer of the KV content snapshots.
 */
import { handle } from '@astrojs/cloudflare/handler';
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { apexRedirect, applySecurityHeaders, legacyArticlesRedirect, rootRedirect, withHtmlCache } from './lib/edge';
import type { ExecutionContext } from './lib/cf';
import { createCmsDeps } from './lib/cms';
import { THEME_HEADER, THEME_SOURCE_HEADER, resolveTheme, withThemeHeader } from './lib/site-theme';
import { config, type WwwEnv } from './lib/env';
import { writeSnapshots } from './lib/snapshot-writer';

/** A client never chooses the theme header Astro reads. */
function stripThemeHeader(request: Request): Request {
  if (!request.headers.has(THEME_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.delete(THEME_HEADER);
  return new Request(request, { headers });
}

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
        const moved = legacyArticlesRedirect(request.url);
        if (moved) return applySecurityHeaders(moved, cfg, new URL(request.url).pathname);
        const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
        const waitUntil = (p: Promise<unknown>) => ctx.waitUntil(p);
        // Pages need the theme; files (hashed assets, fonts, images, feeds) never wait for it
        const page = !/\.[a-z0-9]{1,8}$/i.test(new URL(request.url).pathname);
        const theme = page ? await resolveTheme(request, cfg, waitUntil) : null;
        const forAstro = theme ? withThemeHeader(request, theme) : stripThemeHeader(request);
        const render = async () => {
          const res = (await handle(manifest, app, forAstro as never, env as never, ctx as never)) as Response;
          if (!theme) return res;
          const out = new Response(res.body, res);
          out.headers.set(THEME_SOURCE_HEADER, theme.source);
          return out;
        };
        const response = await withHtmlCache(request, cache, waitUntil, render, Date.now, undefined, cfg.version, theme?.id ?? '');
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
