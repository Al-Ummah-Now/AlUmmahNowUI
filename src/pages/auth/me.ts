import type { APIRoute } from 'astro';
import { authDeps } from '../../lib/context';
import { me } from '../../lib/auth-routes';

export const GET: APIRoute = (ctx) => me(ctx.request, authDeps(ctx));
