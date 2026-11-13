import type { APIRoute } from 'astro';
import { requestContext } from '../lib/context';
import { buildSitemap } from '../lib/sitemap';

/** www's sitemap (wiki AUN-SEO, "Sitemap architecture"); built in lib/sitemap.ts. */
export const GET: APIRoute = async (ctx) => {
  const rc = requestContext(ctx, 'en');
  const map = await rc.cms.sitemap();
  const data = map.status === 'ok' ? map.data : { items: [], scholars: [] };
  return new Response(buildSitemap(rc.cfg.siteUrl, data.items, data.scholars ?? []), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Source': rc.cms.source() },
  });
};
