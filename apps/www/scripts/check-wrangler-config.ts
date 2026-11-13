/**
 * Checks wrangler.jsonc against scripts/environments.ts (PLAN W9): worker names,
 * custom domains (www + apex on production), workers_dev off, vars, CMS service
 * binding, KV snapshot, version metadata. Run in CI: npm run check:config
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENVIRONMENTS, type EnvName } from './environments.ts';
import { parseJsonc } from './jsonc.ts';

interface Block {
  name?: string;
  workers_dev?: boolean;
  routes?: { pattern: string; custom_domain?: boolean }[];
  vars?: Record<string, string>;
  services?: { binding: string; service: string }[];
  kv_namespaces?: { binding: string; id: string }[];
  version_metadata?: { binding: string };
  triggers?: { crons?: string[] };
}
interface WranglerConfig extends Block {
  main?: string;
  assets?: { directory?: string; binding?: string; run_worker_first?: boolean };
  env?: Record<string, Block>;
}

export function checkWranglerConfig(config: WranglerConfig): string[] {
  const errors: string[] = [];
  if (config.assets?.binding !== 'ASSETS' || config.assets?.directory !== './dist') errors.push('assets must be ./dist bound as ASSETS');
  if (config.assets?.run_worker_first !== true) errors.push('assets.run_worker_first must be true (apex redirect and security headers on every response)');
  if (config.main !== './dist/_worker.js/index.js') errors.push('main must be ./dist/_worker.js/index.js (Astro cloudflare output)');
  const extra = Object.keys(config.env ?? {}).filter((e) => e !== 'qa' && e !== 'stage');
  if (extra.length) errors.push(`unexpected envs: ${extra.join(', ')} (production is the top level)`);

  for (const name of Object.keys(ENVIRONMENTS) as EnvName[]) {
    const want = ENVIRONMENTS[name];
    const block: Block | undefined = name === 'production' ? config : config.env?.[name];
    const p = (msg: string) => errors.push(`${name}: ${msg}`);
    if (!block) {
      p('missing');
      continue;
    }
    if (block.name !== want.worker) p(`name must be ${want.worker}, got ${block.name}`);
    if (block.workers_dev !== false) p('workers_dev must be false');
    const hosts = [new URL(want.www).host, ...(want.apex ? [new URL(want.apex).host] : [])].sort();
    const routes = (block.routes ?? []).filter((r) => r.custom_domain === true).map((r) => r.pattern).sort();
    if (JSON.stringify(routes) !== JSON.stringify(hosts)) p(`custom domains must be ${hosts.join(', ')}, got ${routes.join(', ') || 'none'}`);
    if ((block.routes ?? []).some((r) => r.custom_domain !== true)) p('every route must be a custom domain');
    for (const [k, v] of Object.entries(want.vars)) if (block.vars?.[k] !== v) p(`vars.${k} must be ${v}, got ${block.vars?.[k]}`);
    const cms = block.services?.find((s) => s.binding === 'CMS');
    if (cms?.service !== want.cmsService) p(`service binding CMS must point at ${want.cmsService}`);
    const kv = block.kv_namespaces?.find((k) => k.binding === 'CONTENT_SNAPSHOT');
    if (kv?.id !== want.kvId) p(`KV CONTENT_SNAPSHOT must be ${want.kvId}`);
    const feed = block.kv_namespaces?.find((k) => k.binding === 'FEED');
    if (feed?.id !== want.feedKvId) p(`KV FEED must be ${want.feedKvId} (the home timeline)`);
    if (feed && feed.id === want.kvId) p('KV FEED must not share the CONTENT_SNAPSHOT namespace (one writer per namespace)');
    if (block.version_metadata?.binding !== 'CF_VERSION_METADATA') p('version_metadata binding CF_VERSION_METADATA is required (healthz version, release smoke)');
    // The single writer of the KV snapshots (src/lib/snapshot-writer.ts SNAPSHOT_CRON); triggers are not inherited.
    if (!(block.triggers?.crons ?? []).includes('*/5 * * * *')) p('triggers.crons must include "*/5 * * * *" (KV snapshot writer)');
    if (block.vars && 'SESSION_SECRET' in block.vars) p('SESSION_SECRET must be a secret, never a var');
  }
  return errors;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(new URL(import.meta.url)));
if (isMain) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const errors = checkWranglerConfig(parseJsonc<WranglerConfig>(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8')));
  if (errors.length) {
    for (const e of errors) process.stderr.write(`✗ ${e}\n`);
    process.exit(1);
  }
  process.stdout.write('wrangler.jsonc: production, stage and qa OK\n');
}
