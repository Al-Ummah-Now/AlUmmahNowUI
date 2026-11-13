import type { APIRoute } from 'astro';
import { requestContext } from '../lib/context';
import { feedHealth } from '../lib/feed';

/**
 * { ok, version, env, cms, feed, feedBuiltAt }: cms is "degraded" when the CMS answer did not come
 * from the CMS; feed is "missing" when the home timeline's KV head can't be read (the home page
 * then shows the CMS posts list instead). Neither is fatal: www falls back by design.
 */
export const GET: APIRoute = async (ctx) => {
  const rc = requestContext(ctx, 'en');
  const [site, feed] = await Promise.all([rc.cms.site('en'), feedHealth(rc.env.FEED, 'en')]);
  const cms = site.status === 'ok' && site.source === 'cms' ? 'ok' : 'degraded';
  return new Response(JSON.stringify({ ok: true, version: rc.cfg.version, env: rc.cfg.appEnv, cms, feed: feed.feed, feedBuiltAt: feed.builtAt }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Source': site.source },
  });
};
