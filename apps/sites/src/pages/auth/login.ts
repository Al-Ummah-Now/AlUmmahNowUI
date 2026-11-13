import type { APIRoute } from 'astro';
import { login } from '../../lib/auth-routes';

export const GET: APIRoute = (ctx) => login(ctx);
