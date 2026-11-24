import type { APIRoute } from 'astro';
import { negotiateLocale } from '../lib/locale';

/** Bare /terms → /{locale}/terms/ based on cookie or Accept-Language (store & external links). */
export const GET: APIRoute = (ctx) => {
  const locale = negotiateLocale(ctx.request.headers.get('Cookie'), ctx.request.headers.get('Accept-Language'));
  const search = new URL(ctx.request.url).search;
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/${locale}/terms/${search}`,
      'Cache-Control': 'private, no-cache',
      Vary: 'Cookie, Accept-Language',
    },
  });
};
