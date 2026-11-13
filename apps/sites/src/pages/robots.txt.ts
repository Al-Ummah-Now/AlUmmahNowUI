import type { APIRoute } from 'astro';
import { config, type SitesEnv } from '../lib/env';
import { siteFromRequest } from '../lib/site';

/** Per host (§4.4): its own sitemap; test environments, sites in setup and previews are never crawled. */
export const GET: APIRoute = ({ request, locals }) => {
  const cfg = config((locals as { runtime?: { env?: SitesEnv } }).runtime?.env ?? {});
  const site = siteFromRequest(request);
  if (!site) return new Response('Not found', { status: 404 });
  const open = cfg.isProduction && site.site.status === 'live' && !site.preview;
  const body = open
    ? `User-agent: *\nDisallow: /auth/\n\nSitemap: https://${site.site.primaryHost}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
