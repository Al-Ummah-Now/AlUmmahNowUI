import type { APIRoute } from 'astro';
import { requestContext } from '../lib/context';
import { buildSitemap, withoutSiteCanonicals } from '../lib/sitemap';
import { channelSite, type SiteLookup } from '../lib/scholar-site';

/** www's sitemap (wiki AUN-SEO, "Sitemap architecture"); built in lib/sitemap.ts. */
export const GET: APIRoute = async (ctx) => {
  const rc = requestContext(ctx, 'en');
  const map = await rc.cms.sitemap();
  const raw = map.status === 'ok' ? map.data : { items: [], scholars: [] };
  // Scholar pages and posts canonical on a scholar's own site are listed by that site instead
  const memo = new Map<string, Promise<SiteLookup>>();
  const data = await withoutSiteCanonicals({ items: raw.items, scholars: raw.scholars ?? [] }, (c) => channelSite(rc.videos, c, memo), rc.videos.log);
  return new Response(buildSitemap(rc.cfg.siteUrl, data.items, data.scholars), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Source': rc.cms.source() },
  });
};
