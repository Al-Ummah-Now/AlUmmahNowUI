/**
 * Checks wrangler.jsonc against scripts/environments.ts (PLAN W9): worker names,
 * custom domains (www + apex; the apex serves the passkey domain files), workers_dev off, vars, CMS service
 * binding, KV snapshot, version metadata. Run in CI: npm run check:config
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENVIRONMENTS, type EnvName } from './environments.ts';
import { parseJsonc } from './jsonc.ts';

/** The CI pre-release signing key: trusted on QA and stage, never on production (Play-signed builds only). */
export const CI_ANDROID_CERT = '5A:1B:3D:2B:57:6E:9A:2D:F0:BF:1B:E3:F1:8C:40:20:13:F9:5C:09:EA:EE:7C:F7:31:10:C4:2F:B5:69:DD:C0';

interface Block {
  name?: string;
  workers_dev?: boolean;
  routes?: { pattern: string; custom_domain?: boolean }[];
  vars?: Record<string, string>;
  services?: { binding: string; service: string }[];
  kv_namespaces?: { binding: string; id: string }[];
  version_metadata?: { binding: string };
  triggers?: { crons?: string[] };
  secrets_store_secrets?: { binding: string; store_id: string; secret_name: string }[];
}

/** The account's Secrets Store (AlUmmahNow scripts/release/ensure-resources.ts SECRETS_STORE_ID). */
export const SECRETS_STORE_ID = 'f8eddc9944d041919ed8dc7d08d32308';
/**
 * The only Secrets Store secret www reads, per env: the videos admin API's internal key (the same
 * secret admin-api binds), for the newsletter (src/lib/newsletter.ts). Least privilege: one binding,
 * this env's secret only, never another env's.
 */
export const INTERNAL_API_KEY_SECRET: Record<EnvName, string> = { production: 'internal-api-key', stage: 'internal-api-key-stage', qa: 'internal-api-key-qa' };
interface WranglerConfig extends Block {
  main?: string;
  assets?: { directory?: string; binding?: string; run_worker_first?: boolean };
  env?: Record<string, Block>;
}

export function checkWranglerConfig(config: WranglerConfig): string[] {
  const errors: string[] = [];
  if (config.assets?.binding !== 'ASSETS' || config.assets?.directory !== './dist/client') errors.push('assets must be ./dist/client bound as ASSETS');
  if (config.assets?.run_worker_first !== true) errors.push('assets.run_worker_first must be true (apex redirect and security headers on every response)');
  if (config.main !== './dist/server/entry.mjs') errors.push('main must be ./dist/server/entry.mjs (Astro cloudflare output)');
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
    const store = block.secrets_store_secrets ?? [];
    const key = INTERNAL_API_KEY_SECRET[name];
    if (store.length !== 1 || store[0]!.binding !== 'INTERNAL_API_KEY' || store[0]!.store_id !== SECRETS_STORE_ID || store[0]!.secret_name !== key) {
      p(`secrets_store_secrets must be exactly INTERNAL_API_KEY → ${key} in store ${SECRETS_STORE_ID}`);
    }
    if (block.vars && 'INTERNAL_API_KEY' in block.vars) p('INTERNAL_API_KEY must come from the Secrets Store, never a var');
    if (block.vars && 'SESSION_SECRET' in block.vars) p('SESSION_SECRET must be a secret, never a var');
    if (name === 'production' && (block.vars?.ANDROID_APP_CERTS ?? '').toUpperCase().includes(CI_ANDROID_CERT)) {
      p('vars.ANDROID_APP_CERTS must not list the CI pre-release key (production trusts Play-signed builds only)');
    }
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
