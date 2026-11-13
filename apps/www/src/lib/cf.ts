/**
 * Cloudflare Workers types, imported as a module so they do not replace the DOM
 * globals the browser scripts (src/scripts) are type-checked against.
 */
export type { ExecutionContext, KVNamespace } from '@cloudflare/workers-types/index';
