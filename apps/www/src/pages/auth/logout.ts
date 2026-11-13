import type { APIRoute } from 'astro';
import { authDeps } from '../../lib/context';
import { logout } from '../../lib/auth-routes';

export const GET: APIRoute = (ctx) => logout(ctx.request, authDeps(ctx));
export const POST: APIRoute = (ctx) => logout(ctx.request, authDeps(ctx));
