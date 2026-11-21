/** `cloudflare:workers` outside workerd (vitest runs in Node): no bindings unless a test sets them. */
export const env: Record<string, unknown> = {};

/** Tests: the bindings the code under test reads from `cloudflare:workers`. */
export function setTestEnv(next: Record<string, unknown>): void {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, next);
}
