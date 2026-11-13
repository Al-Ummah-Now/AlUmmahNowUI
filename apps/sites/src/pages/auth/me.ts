import type { APIRoute } from 'astro';
import { me } from '../../lib/auth-routes';

export const GET: APIRoute = (ctx) => me(ctx);
