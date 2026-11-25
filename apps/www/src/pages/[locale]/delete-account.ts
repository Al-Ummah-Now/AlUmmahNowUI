import type { APIRoute } from 'astro';
import { routeLocale, runtime } from '../../lib/context';
import { deleteAccountUrl } from '../../lib/delete-account';

/** /{en,ar}/delete-account → the account page's Delete account (same language, this environment's host). */
export const GET: APIRoute = (ctx) => {
  const locale = routeLocale(ctx);
  if (!locale) return new Response('Not found', { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: deleteAccountUrl(runtime(ctx).cfg.profileUrl, locale), 'Cache-Control': 'public, max-age=300' },
  });
};
