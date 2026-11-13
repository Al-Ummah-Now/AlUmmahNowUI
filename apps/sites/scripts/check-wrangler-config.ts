/**
 * Checks wrangler.jsonc against scripts/environments.ts: worker names, zone routes (no custom
 * domains: sites are routes on alummahnow.org), vars, the shared snapshot KV, and that nothing
 * local or from another environment leaks into a deployed one.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJsonc } from '../../www/scripts/jsonc.ts';
import { ENVIRONMENTS, ZONE_ID, type EnvName } from './environments.ts';

interface Block {
  name?: string;
  workers_dev?: boolean;
  routes?: { pattern: string; zone_id?: string; custom_domain?: boolean }[];
  vars?: Record<string, string>;
  kv_namespaces?: { binding: string; id: string }[];
  env?: Record<string, Block>;
}

export function checkSitesConfig(config: Block): string[] {
  const errors: string[] = [];
  for (const env of Object.keys(ENVIRONMENTS) as EnvName[]) {
    const want = ENVIRONMENTS[env];
    const block = env === 'production' ? config : config.env?.[env];
    if (!block) {
      errors.push(`${env}: missing`);
      continue;
    }
    if (block.name !== want.worker) errors.push(`${env}: name ${block.name} != ${want.worker}`);
    if (block.workers_dev !== false) errors.push(`${env}: workers_dev must be false`);
    const routes = block.routes ?? [];
    const patterns = routes.map((r) => r.pattern).sort();
    if (JSON.stringify(patterns) !== JSON.stringify([...want.routes].sort())) errors.push(`${env}: routes ${patterns.join(', ')} != ${want.routes.join(', ')}`);
    for (const r of routes) {
      if (r.custom_domain) errors.push(`${env}: ${r.pattern} must be a zone route, not a custom domain`);
      if (r.zone_id !== ZONE_ID) errors.push(`${env}: ${r.pattern} must be on the alummahnow.org zone (${ZONE_ID})`);
    }
    for (const [k, v] of Object.entries(want.vars)) if (block.vars?.[k] !== v) errors.push(`${env}: vars.${k} = ${block.vars?.[k]} (want ${v})`);
    const kv = block.kv_namespaces?.find((n) => n.binding === 'CONTENT_SNAPSHOT');
    if (kv?.id !== want.kvId) errors.push(`${env}: CONTENT_SNAPSHOT must be www's snapshot KV ${want.kvId}`);
    const text = JSON.stringify(block.env ? { ...block, env: undefined } : block);
    if (/localhost|127\.0\.0\.1/.test(text)) errors.push(`${env}: contains a local host`);
    for (const other of Object.keys(ENVIRONMENTS) as EnvName[]) {
      if (other === env || other === 'production') continue;
      if (text.includes(`.${other}.alummahnow`)) errors.push(`${env}: refers to the ${other} environment`);
    }
  }
  if (config.env && Object.keys(config.env).some((k) => !(k in ENVIRONMENTS))) errors.push(`unknown envs: ${Object.keys(config.env).join(', ')}`);
  return errors;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(new URL(import.meta.url)));
if (isMain) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const errors = checkSitesConfig(parseJsonc<Block>(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8')));
  if (errors.length) {
    for (const e of errors) process.stderr.write(`wrangler.jsonc: ${e}\n`);
    process.exit(1);
  }
  process.stdout.write('wrangler.jsonc: production, stage and qa OK\n');
}
