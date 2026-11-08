import type { APIRoute } from 'astro';
import { requestContext } from '../lib/context';

/** { ok, version, env, cms: "ok" | "degraded" }: degraded when the CMS answer did not come from the CMS. */
export const GET: APIRoute = async (ctx) => {
  const rc = requestContext(ctx, 'en');
  const site = await rc.cms.site('en');
  const cms = site.status === 'ok' && site.source === 'cms' ? 'ok' : 'degraded';
  return new Response(JSON.stringify({ ok: true, version: rc.cfg.version, env: rc.cfg.appEnv, cms }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Source': site.source },
  });
};
