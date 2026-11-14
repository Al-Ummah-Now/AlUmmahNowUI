/** Shared by /sitemap.xml and /sitemaps/<file>.xml: the site, its origin and the data deps of this request. */
import { config, type SitesEnv } from './env';
import { siteFromRequest } from './site';
import type { DataDeps } from './data';
import type { SitemapResult } from './sitemap';
import type { PublicSite } from './site-types';

type Locals = { runtime?: { env?: SitesEnv; ctx?: { waitUntil(p: Promise<unknown>): void } } };

export function sitemapRequest(request: Request, locals: unknown): { site: PublicSite; origin: string; deps: DataDeps } | null {
  const runtime = (locals as Locals).runtime;
  const cfg = config(runtime?.env ?? {});
  const site = siteFromRequest(request);
  if (!site) return null;
  return {
    site,
    origin: `${cfg.appEnv === 'local' ? 'http' : 'https'}://${site.site.primaryHost}`,
    deps: {
      apiUrl: cfg.videosApiUrl,
      cache: typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null,
      waitUntil: (p: Promise<unknown>) => runtime?.ctx?.waitUntil(p),
      log: (message, data) => console.warn(JSON.stringify({ msg: message, ...data })),
    },
  };
}

export const sitemapResponse = (r: SitemapResult) =>
  r.status === 200 ? new Response(r.body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }) : new Response(r.body, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
