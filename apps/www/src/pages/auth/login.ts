import type { APIRoute } from 'astro';
import { authDeps } from '../../lib/context';
import { login } from '../../lib/auth-routes';

export const GET: APIRoute = (ctx) => login(ctx.request, authDeps(ctx));
