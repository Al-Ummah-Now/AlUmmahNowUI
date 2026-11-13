import type { APIRoute } from 'astro';
import { logout } from '../../lib/auth-routes';

export const POST: APIRoute = (ctx) => logout(ctx);
