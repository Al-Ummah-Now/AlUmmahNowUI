import type { APIRoute } from 'astro';
import { requestContext } from '../lib/context';
import { escapeHtml as x } from '../lib/html';
import { LOCALES } from '../lib/locale';

/** Static routes in both locales (with hreflang pairs) plus CMS pages and posts. */
export const GET: APIRoute = async (ctx) => {
  const rc = requestContext(ctx, 'en');
  const { cfg } = rc;
  const map = await rc.cms.sitemap();
  const items = map.status === 'ok' ? map.data.items : [];
  const urls: string[] = [];
  for (const path of ['/', '/news/', '/videos/']) {
    const alts = LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${x(`${cfg.siteUrl}/${l}${path}`)}"/>`).join('');
    for (const l of LOCALES) urls.push(`<url><loc>${x(`${cfg.siteUrl}/${l}${path}`)}</loc>${alts}</url>`);
  }
  for (const item of items) {
    if (item.locale !== 'en' && item.locale !== 'ar') continue;
    if (item.type === 'page' && item.slug === 'home') continue;
    const path = item.type === 'post' ? `/${item.locale}/news/${encodeURIComponent(item.slug)}/` : `/${item.locale}/${encodeURIComponent(item.slug)}/`;
    const lastmod = /^\d{4}-\d{2}-\d{2}/.test(item.updated_at) ? `<lastmod>${item.updated_at.slice(0, 10)}</lastmod>` : '';
    urls.push(`<url><loc>${x(cfg.siteUrl + path)}</loc>${lastmod}</url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Source': rc.cms.source() },
  });
};
