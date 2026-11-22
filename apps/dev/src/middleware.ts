/**
 * Runs on every page as it is prerendered: spells out abbreviations where a page first uses them
 * (src/lib/expand.ts, src/lib/glossary.ts), and on Arabic pages isolates every Latin run of the prose.
 */
import { defineMiddleware } from 'astro:middleware';
import { bindProse, expandAbbreviations, isolateLatinProse } from './lib/expand';
import { strings } from './i18n';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const res = await next();
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const locale = ctx.url.pathname.startsWith('/ar/') ? 'ar' : 'en';
  const expanded = expandAbbreviations(await res.text(), locale, strings(locale).diagrams.terms);
  // values kept on one line in every page's prose; on Arabic pages every Latin run isolated too
  const html = locale === 'ar' ? isolateLatinProse(expanded) : bindProse(expanded);
  return new Response(html, { status: res.status, statusText: res.statusText, headers: res.headers });
});
