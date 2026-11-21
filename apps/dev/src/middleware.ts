/**
 * Runs on every page as it is prerendered: spells out abbreviations where a page first uses them
 * (src/lib/expand.ts, src/lib/glossary.ts).
 */
import { defineMiddleware } from 'astro:middleware';
import { expandAbbreviations } from './lib/expand';
import { strings } from './i18n';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const res = await next();
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const locale = ctx.url.pathname.startsWith('/ar/') ? 'ar' : 'en';
  const html = expandAbbreviations(await res.text(), locale, strings(locale).diagrams.terms);
  return new Response(html, { status: res.status, statusText: res.statusText, headers: res.headers });
});
