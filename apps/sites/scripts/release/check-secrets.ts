/**
 * Pre-deploy check: the env's sites Worker has every secret in scripts/secrets-manifest.ts.
 *   node --experimental-strip-types scripts/release/check-secrets.ts --env qa|stage|production [--ensure]
 * Prints names only. With --ensure (run AFTER the deploy), a missing generated secret is created with
 * `wrangler secret put` from a fresh random value that is never printed or stored anywhere else.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWorkerBindings } from '../../../www/scripts/release/cf-api.ts';
import { ENVIRONMENTS, parseEnvArg } from '../environments.ts';
import { SECRETS_MANIFEST } from '../secrets-manifest.ts';

const argv = process.argv.slice(2);
const env = parseEnvArg(argv);
const ensure = argv.includes('--ensure');
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
let failed = false;
for (const m of SECRETS_MANIFEST.filter((x) => x.env === env)) {
  const bindings = await getWorkerBindings(m.worker);
  if (bindings === null) {
    process.stdout.write(`WARN  ${m.worker}: Worker not deployed yet; run with --ensure after the first deploy\n`);
    continue;
  }
  const have = new Set(bindings.filter((b) => b.type === 'secret_text').map((b) => b.name));
  for (const s of m.required.filter((r) => !have.has(r.name))) {
    if (ensure && s.generate) {
      const put = spawnSync('npx', ['wrangler', 'secret', 'put', s.name, '-c', 'wrangler.jsonc', ...ENVIRONMENTS[env].envArgs], { cwd: root, input: s.generate(), encoding: 'utf8' });
      if (put.status === 0) process.stdout.write(`SET   ${m.worker}: ${s.name} generated (value never printed)\n`);
      else {
        failed = true;
        process.stdout.write(`FAIL  ${m.worker}: could not set ${s.name}\n`);
      }
    } else {
      failed = true;
      process.stdout.write(`FAIL  ${m.worker}: missing ${s.name}${s.generate ? ' (run with --ensure to generate it)' : ''}\n`);
    }
  }
  if (!failed) process.stdout.write(`PASS  ${m.worker}: ${m.required.map((r) => r.name).join(', ')}\n`);
}
if (failed) process.exit(1);
