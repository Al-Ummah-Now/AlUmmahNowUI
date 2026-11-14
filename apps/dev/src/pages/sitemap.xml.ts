import type { APIRoute } from 'astro';
import { LOCALES, PAGES, SITE_ORIGIN, pagePath } from '../lib/pages';

/** Every page in both languages, each with its alternates (wiki AUN-DEV-SITE §Hosting, SEO). */
export const GET: APIRoute = () => {
  const urls = LOCALES.flatMap((l) =>
    PAGES.map((slug) => {
      const alts = [...LOCALES.map((a) => ({ hl: a, href: `${SITE_ORIGIN}${pagePath(a, slug)}` })), { hl: 'x-default', href: `${SITE_ORIGIN}${pagePath('en', slug)}` }]
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hl}" href="${a.href}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${SITE_ORIGIN}${pagePath(l, slug)}</loc>\n${alts}\n  </url>`;
    }),
  ).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
