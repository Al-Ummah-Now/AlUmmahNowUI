/**
 * Pre-promote check: the env's www Worker has every secret in scripts/secrets-manifest.ts.
 *   node --experimental-strip-types scripts/release/check-secrets.ts --env stage|production|qa
 * Prints names only. A Worker that does not exist yet passes with a warning (first deploy).
 */
import { resolve } from 'node:path';
import { parseEnvArg, type EnvName } from '../environments.ts';
import { SECRETS_MANIFEST } from '../secrets-manifest.ts';
import { getWorkerBindings, type WorkerBinding } from './cf-api.ts';

export interface SecretsReport {
  worker: string;
  missing: string[];
  exists: boolean;
}

export function evaluateSecrets(env: EnvName, worker: string, bindings: WorkerBinding[] | null): SecretsReport {
  const entry = SECRETS_MANIFEST.find((m) => m.env === env && m.worker === worker);
  if (!entry) throw new Error(`${worker} is not in the secrets manifest`);
  if (bindings === null) return { worker, missing: entry.required.map((r) => r.name), exists: false };
  const secrets = new Set(bindings.filter((b) => b.type === 'secret_text').map((b) => b.name));
  return { worker, missing: entry.required.filter((r) => !secrets.has(r.name)).map((r) => r.name), exists: true };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const env = parseEnvArg(process.argv.slice(2));
  let failed = false;
  for (const m of SECRETS_MANIFEST.filter((x) => x.env === env)) {
    const report = evaluateSecrets(env, m.worker, await getWorkerBindings(m.worker));
    if (!report.exists) {
      process.stdout.write(`WARN  ${m.worker}: Worker not deployed yet; set ${report.missing.join(', ')} right after the first deploy\n`);
    } else if (report.missing.length) {
      failed = true;
      process.stdout.write(`FAIL  ${m.worker}: missing ${report.missing.join(', ')} (wrangler secret put <NAME> ${env === 'production' ? '' : `--env ${env}`})\n`);
    } else {
      process.stdout.write(`PASS  ${m.worker}: ${m.required.map((r) => r.name).join(', ')}\n`);
    }
  }
  process.exit(failed ? 1 : 0);
}
