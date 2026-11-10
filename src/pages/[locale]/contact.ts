import type { APIRoute } from 'astro';
import { routeLocale, runtime } from '../../lib/context';
import { contactUrl } from '../../lib/contact';

/** /{en,ar}/contact → the videos site's Contact us page (same language). */
export const GET: APIRoute = (ctx) => {
  const locale = routeLocale(ctx);
  if (!locale) return new Response('Not found', { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: contactUrl(runtime(ctx).cfg.videosWebUrl, locale), 'Cache-Control': 'public, max-age=300' },
  });
};
