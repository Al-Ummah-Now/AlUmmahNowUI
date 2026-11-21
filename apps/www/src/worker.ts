/**
 * Worker entry (wrangler.build.jsonc `main`, built by the Cloudflare Vite plugin). Wraps Astro's Cloudflare handler:
 *   0. passkey domain files (/.well-known/apple-app-site-association, assetlinks.json) on every
 *      host, apex included, never redirected (src/lib/well-known.ts)
 *   1. apex → www (301, path and query kept)
 *   2. `/` served as /en/ or /ar/ (no redirect: rootRewrite); old News urls `/{l}/news/…` → `/{l}/articles/…` (301)
 *   3. the site theme the admin chose (src/lib/site-theme.ts) and the optional features that can work
 *      (src/lib/features.ts), handed to Astro in request headers
 *   4. HTML edge cache for locale pages (Cache API, s-maxage 60, SWR 600), keyed by version, theme and features
 *   5. security headers on every response, static assets included (run_worker_first)
 * and the cron (wrangler.jsonc triggers): the single writer of the KV content snapshots.
 */
import { handle } from '@astrojs/cloudflare/handler';
import { apexRedirect, applySecurityHeaders, legacyArticlesRedirect, rootResponse, rootRewrite, withHtmlCache } from './lib/edge';
import type { ExecutionContext } from './lib/cf';
import { createCmsDeps } from './lib/cms';
import { THEME_HEADER, THEME_SOURCE_HEADER, resolveTheme, withThemeHeader } from './lib/site-theme';
import { FEATURES_HEADER, featuresToken, resolveFeatures, withFeaturesHeader } from './lib/features';
import { config, type WwwEnv } from './lib/env';
import { writeSnapshots } from './lib/snapshot-writer';
import { passkeyFilesResponse } from './lib/well-known';

/** A client never chooses the theme or features header Astro reads. */
function stripThemeHeader(request: Request): Request {
  if (!request.headers.has(THEME_HEADER) && !request.headers.has(FEATURES_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.delete(THEME_HEADER);
  headers.delete(FEATURES_HEADER);
  return new Request(request, { headers });
}

export default {
  async fetch(incoming: Request, env: WwwEnv, ctx: ExecutionContext): Promise<Response> {
    // The passkey RP ID is the apex host: Apple and Google fetch these there and never follow a redirect
    const wellKnown = await passkeyFilesResponse(incoming, env);
    if (wellKnown) return wellKnown;
    const cfg = config(env);
    const apex = apexRedirect(incoming.url, cfg.siteUrl);
    if (apex) return apex;
    // `/` is the visitor's language page itself, not a redirect to it
    const root = rootRewrite(incoming);
    const request = root ?? incoming;
    const moved = legacyArticlesRedirect(request.url);
    if (moved) return applySecurityHeaders(moved, cfg, new URL(request.url).pathname);
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
    const waitUntil = (p: Promise<unknown>) => ctx.waitUntil(p);
    // Pages need the theme; files (hashed assets, fonts, images, feeds) never wait for it
    const page = !/\.[a-z0-9]{1,8}$/i.test(new URL(request.url).pathname);
    const [theme, features] = page ? await Promise.all([resolveTheme(request, cfg, waitUntil), resolveFeatures(env, cfg, waitUntil)]) : [null, null];
    const forAstro = theme && features ? withFeaturesHeader(withThemeHeader(request, theme), features) : stripThemeHeader(request);
    const render = async () => {
      const res = (await handle(forAstro as never, env as never, ctx as never)) as unknown as Response;
      if (!theme) return res;
      const out = new Response(res.body, res);
      out.headers.set(THEME_SOURCE_HEADER, theme.source);
      return out;
    };
    const served = await withHtmlCache(request, cache, waitUntil, render, Date.now, undefined, cfg.version, theme?.id ?? '', features ? featuresToken(features) : '');
    const response = root ? rootResponse(served, new URL(request.url).pathname.split('/')[1] ?? 'en') : served;
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
};
