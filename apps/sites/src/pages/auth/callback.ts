import type { APIRoute } from 'astro';
import { callback } from '../../lib/auth-routes';

export const GET: APIRoute = (ctx) => callback(ctx);
