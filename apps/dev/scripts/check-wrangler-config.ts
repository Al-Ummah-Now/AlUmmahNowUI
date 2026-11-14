/**
 * Checks wrangler.jsonc against scripts/environments.ts: worker names, one custom domain per env,
 * static assets only (no `main`, no bindings, no vars: the site holds no data and no secrets), and
 * workers.dev / preview URLs off so the only public hostnames are the custom domains.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJsonc } from '../../www/scripts/jsonc.ts';
import { ENVIRONMENTS, type EnvName } from './environments.ts';

interface Block {
  name?: string;
  main?: string;
  workers_dev?: boolean;
  preview_urls?: boolean;
  assets?: { directory?: string; binding?: string; not_found_handling?: string };
  routes?: { pattern: string; zone_id?: string; custom_domain?: boolean }[];
  vars?: Record<string, string>;
  env?: Record<string, Block>;
  [key: string]: unknown;
}

const DATA_KEYS = ['kv_namespaces', 'd1_databases', 'r2_buckets', 'services', 'queues', 'durable_objects', 'vars'];

export function checkDevConfig(config: Block): string[] {
  const errors: string[] = [];
  if (config.main) errors.push('main must not be set: the site is static assets only');
  if (config.assets?.directory !== './dist') errors.push('assets.directory must be ./dist');
  if (config.assets?.binding) errors.push('assets.binding must not be set (no Worker code reads it)');
  if (config.assets?.not_found_handling !== '404-page') errors.push('assets.not_found_handling must be 404-page');
  for (const env of Object.keys(ENVIRONMENTS) as EnvName[]) {
    const want = ENVIRONMENTS[env];
    const block = env === 'production' ? config : config.env?.[env];
    if (!block) {
      errors.push(`${env}: missing`);
      continue;
    }
    if (block.name !== want.worker) errors.push(`${env}: name ${block.name} != ${want.worker}`);
    if (block.workers_dev !== false) errors.push(`${env}: workers_dev must be false`);
    if (block.preview_urls !== false) errors.push(`${env}: preview_urls must be false`);
    const routes = block.routes ?? [];
    if (routes.length !== 1 || routes[0]?.pattern !== want.host || routes[0]?.custom_domain !== true) {
      errors.push(`${env}: routes must be exactly one custom domain ${want.host}`);
    }
    for (const key of DATA_KEYS) if (key in block) errors.push(`${env}: ${key} must not be set (static site, no data)`);
  }
  if (config.env && Object.keys(config.env).some((k) => !(k in ENVIRONMENTS))) errors.push(`unknown envs: ${Object.keys(config.env).join(', ')}`);
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = resolve(fileURLToPath(new URL('..', import.meta.url)), 'wrangler.jsonc');
  const errors = checkDevConfig(parseJsonc(readFileSync(file, 'utf8')) as Block);
  if (errors.length) {
    for (const e of errors) process.stderr.write(`FAIL  ${e}\n`);
    process.exit(1);
  }
  process.stdout.write('PASS  wrangler.jsonc (qa, stage, production)\n');
}
