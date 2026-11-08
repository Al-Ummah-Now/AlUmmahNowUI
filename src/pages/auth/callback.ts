import type { APIRoute } from 'astro';
import { authDeps } from '../../lib/context';
import { callback } from '../../lib/auth-routes';

export const GET: APIRoute = (ctx) => callback(ctx.request, authDeps(ctx));
