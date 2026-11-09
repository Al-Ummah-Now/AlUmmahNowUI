import type { APIRoute } from 'astro';
import { RSS_ITEMS } from '../../lib/cms';
import { requestContext, routeLocale } from '../../lib/context';
import { escapeHtml as x } from '../../lib/html';

export const GET: APIRoute = async (ctx) => {
  const locale = routeLocale(ctx);
  if (!locale) return new Response('Not found', { status: 404 });
  const rc = requestContext(ctx, locale);
  const { cfg, t } = rc;
  const [site, posts] = await Promise.all([rc.cms.site(locale), rc.cms.posts(locale, 1, RSS_ITEMS)]);
  const items = posts.status === 'ok' ? posts.data.items : [];
  const title = site.status === 'ok' && site.data.settings?.site_title ? site.data.settings.site_title : t.meta.siteName;
  const link = `${cfg.siteUrl}/${locale}/news/`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${x(`${title}: ${t.news.title}`)}</title>
<link>${x(link)}</link>
<description>${x(t.news.intro)}</description>
<language>${locale}</language>
<atom:link href="${x(`${cfg.siteUrl}/${locale}/rss.xml`)}" rel="self" type="application/rss+xml"/>
${items
  .map((p) => {
    const url = `${cfg.siteUrl}/${locale}/news/${encodeURIComponent(p.slug)}/`;
    return `<item><title>${x(p.title)}</title><link>${x(url)}</link><guid isPermaLink="true">${x(url)}</guid><pubDate>${new Date(p.published_at).toUTCString()}</pubDate>${p.excerpt ? `<description>${x(p.excerpt)}</description>` : ''}</item>`;
  })
  .join('\n')}
</channel>
</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'X-Content-Source': rc.cms.source() } });
};
