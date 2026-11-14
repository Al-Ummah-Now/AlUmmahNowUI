import type { APIRoute } from 'astro';
import { sitemapFile } from '../../lib/sitemap';
import { sitemapRequest, sitemapResponse } from '../../lib/sitemap-route';

/** One file of a big site's sitemap index (lib/sitemap.ts). */
export const GET: APIRoute = async ({ request, locals, params, url }) => {
  const req = sitemapRequest(request, locals);
  if (!req) return new Response('Not found', { status: 404 });
  return sitemapResponse(await sitemapFile(req.site, req.origin, req.deps, String(params.file ?? ''), url.searchParams.get('cursor')));
};
