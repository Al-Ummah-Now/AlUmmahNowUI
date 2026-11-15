import type { APIRoute } from 'astro';
import { authDeps } from '../../lib/context';
import { continueWatching } from '../../lib/continue-watching';

export const GET: APIRoute = (ctx) => continueWatching(ctx.request, authDeps(ctx));
