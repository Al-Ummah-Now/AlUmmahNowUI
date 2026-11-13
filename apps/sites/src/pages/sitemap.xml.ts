import type { APIRoute } from 'astro';
import { escapeHtml as x } from '../../../../packages/render/src/html';
import { config, type SitesEnv } from '../lib/env';
import { siteFromRequest } from '../lib/site';
import { channelPosts, channelVideos } from '../lib/data';
import { watchPagesInSitemap } from '../lib/seo';

/**
 * This host's sitemap (§4.4): the site's built-in pages, its published pages (SS16) and posts in each of its languages, and watch pages
 * only when they are canonical here (the scholar's own domain; otherwise the videos site lists them).
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as { runtime?: { env?: SitesEnv; ctx?: { waitUntil(p: Promise<unknown>): void } } }).runtime;
  const cfg = config(runtime?.env ?? {});
  const site = siteFromRequest(request);
  if (!site) return new Response('Not found', { status: 404 });
  const origin = `${cfg.appEnv === 'local' ? 'http' : 'https'}://${site.site.primaryHost}`;
  const deps = { apiUrl: cfg.videosApiUrl, cache: typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null, waitUntil: (p: Promise<unknown>) => runtime?.ctx?.waitUntil(p) };
  const [posts, videos] = await Promise.all([
    channelPosts(deps, site.channel.id, 1, 50),
    watchPagesInSitemap(site) ? channelVideos(deps, site.channel.id, { limit: 24 }) : Promise.resolve({ items: [], cursor: '' }),
  ]);
  // Published site pages (SS16); a page shows in the languages it has a title in
  const pages = (site.site.pages ?? []).filter((p) => p.status === 'published');
  const paths = ['', 'videos/', 'posts/', 'about/', ...posts.items.map((p) => `posts/${p.id}/`), ...videos.items.map((v) => `watch/${v.id}/`)];
  const pageUrls = pages.flatMap((p) => site.site.locales.filter((l) => p.title[l]).map((l) => `${origin}/${l}/${p.slug}/`));
  const urls = [...paths.flatMap((p) => site.site.locales.map((l) => `${origin}/${l}/${p}`)), ...pageUrls];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${x(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
