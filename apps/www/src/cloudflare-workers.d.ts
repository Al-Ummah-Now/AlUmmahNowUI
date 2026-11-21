/**
 * `cloudflare:workers` as lib/context.ts uses it: the Worker's bindings. Declared here because the
 * Workers types are imported as a module (lib/cf.ts), never as globals over the DOM ones.
 */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
