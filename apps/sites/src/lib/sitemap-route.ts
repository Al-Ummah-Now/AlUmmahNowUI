/** Shared by /sitemap.xml and /sitemaps/<file>.xml: the site, its origin and the data deps of this request. */
import { config } from './env';
import { waitUntilFor, workerBindings } from './runtime';
import { siteFromRequest } from './site';
import type { DataDeps } from './data';
import type { SitemapResult } from './sitemap';
import type { PublicSite } from './site-types';

export function sitemapRequest(request: Request, locals: unknown): { site: PublicSite; origin: string; deps: DataDeps } | null {
  const cfg = config(workerBindings());
  const site = siteFromRequest(request);
  if (!site) return null;
  return {
    site,
    origin: `${cfg.appEnv === 'local' ? 'http' : 'https'}://${site.site.primaryHost}`,
    deps: {
      apiUrl: cfg.videosApiUrl,
      cache: typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null,
      waitUntil: waitUntilFor(locals),
      log: (message, data) => console.warn(JSON.stringify({ msg: message, ...data })),
    },
  };
}

export const sitemapResponse = (r: SitemapResult) =>
  r.status === 200 ? new Response(r.body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }) : new Response(r.body, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
