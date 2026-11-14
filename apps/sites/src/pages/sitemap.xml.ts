import type { APIRoute } from 'astro';
import { sitemapRoot } from '../lib/sitemap';
import { sitemapRequest, sitemapResponse } from '../lib/sitemap-route';

/** This host's sitemap (§4.4; lib/sitemap.ts): one urlset for a small site, else an index of /sitemaps/ files. */
export const GET: APIRoute = async ({ request, locals }) => {
  const req = sitemapRequest(request, locals);
  if (!req) return new Response('Not found', { status: 404 });
  return sitemapResponse(await sitemapRoot(req.site, req.origin, req.deps));
};
