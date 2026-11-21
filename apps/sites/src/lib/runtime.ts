/**
 * The Worker's bindings and the request's ExecutionContext, as Astro 6+ hands them out: bindings from
 * `cloudflare:workers` (Astro.locals.runtime is gone), waitUntil from Astro.locals.cfContext.
 */
import { env as workerEnv } from 'cloudflare:workers';
import type { SitesEnv } from './env';

export const workerBindings = (): SitesEnv => (workerEnv ?? {}) as SitesEnv;

/** ctx.waitUntil of this request; a no-op outside the Worker (tests, prerender). */
export function waitUntilFor(locals: unknown): (p: Promise<unknown>) => void {
  const cfContext = (locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } } | undefined)?.cfContext;
  return (p) => cfContext?.waitUntil(p);
}
