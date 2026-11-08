import type { APIRoute } from 'astro';
import { runtime } from '../lib/context';
import { robotsTxt } from '../lib/seo';

export const GET: APIRoute = (ctx) => {
  const { cfg } = runtime(ctx);
  return new Response(robotsTxt(cfg.isProduction, cfg.siteUrl), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
};
