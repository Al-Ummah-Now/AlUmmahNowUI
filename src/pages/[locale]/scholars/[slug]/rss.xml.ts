import type { APIRoute } from 'astro';
import { fmt } from '../../../../i18n';
import { RSS_ITEMS } from '../../../../lib/cms';
import { requestContext, routeLocale } from '../../../../lib/context';
import { escapeHtml as x } from '../../../../lib/html';

/** A scholar's articles in this language, newest first (AlUmmahNowCMS docs/SCHOLARS.md §3). */
export const GET: APIRoute = async (ctx) => {
  const locale = routeLocale(ctx);
  const slug = ctx.params.slug ?? '';
  if (!locale || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return new Response('Not found', { status: 404 });
  const rc = requestContext(ctx, locale);
  const { cfg, t } = rc;
  const res = await rc.cms.scholar(locale, slug, 1, RSS_ITEMS > 24 ? 24 : RSS_ITEMS);
  if (res.status === 'not_found') return new Response('Not found', { status: 404 });
  if (res.status !== 'ok') return new Response('Unavailable', { status: 503, headers: { 'Retry-After': '60' } });
  const { scholar, posts } = res.data;
  const link = `${cfg.siteUrl}/${locale}/scholars/${encodeURIComponent(slug)}/`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${x(fmt(t.scholars.rss, { name: scholar.name }))}</title>
<link>${x(link)}</link>
<description>${x(scholar.bio_excerpt ?? fmt(t.scholars.pageTitle, { name: scholar.name }))}</description>
<language>${locale}</language>
<atom:link href="${x(`${link}rss.xml`)}" rel="self" type="application/rss+xml"/>
${posts.items
  .map((p) => {
    const url = `${cfg.siteUrl}/${locale}/articles/${encodeURIComponent(p.slug)}/`;
    return `<item><title>${x(p.title)}</title><link>${x(url)}</link><guid isPermaLink="true">${x(url)}</guid><pubDate>${new Date(p.published_at).toUTCString()}</pubDate><author>${x(scholar.name)}</author>${p.excerpt ? `<description>${x(p.excerpt)}</description>` : ''}</item>`;
  })
  .join('\n')}
</channel>
</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'X-Content-Source': rc.cms.source() } });
};
