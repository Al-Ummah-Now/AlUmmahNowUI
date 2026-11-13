/**
 * Post-deploy smoke of the sites Worker:
 *   node --experimental-strip-types scripts/release/smoke.ts --env qa|stage|production
 * GET https://<smokeHost>/healthz must answer {ok, app: 'sites'} with no Set-Cookie. While the owner's
 * DNS step for the alummahnow.org zone is pending (docs/DOMAINS.md) the host doesn't resolve: the smoke
 * then SKIPS with a notice instead of failing (the deploy itself succeeded). QA and stage hosts are two
 * levels deep and need the Advanced Certificate (DOMAINS.md §2): until it exists Cloudflare refuses
 * the TLS handshake, which also SKIPS there (never in production).
 */
import { resolve4 } from 'node:dns/promises';
import { ENVIRONMENTS, parseEnvArg } from '../environments.ts';

const env = parseEnvArg(process.argv.slice(2));
const host = ENVIRONMENTS[env].smokeHost;
try {
  await resolve4(host);
} catch {
  process.stdout.write(`::notice::SKIP sites smoke: ${host} does not resolve yet (owner DNS step pending, apps/sites/docs/DOMAINS.md)\n`);
  process.exit(0);
}
let last = '';
for (let attempt = 0; attempt < 10; attempt++) {
  try {
    const res = await fetch(`https://${host}/healthz`, { headers: { 'User-Agent': 'al-ummah-now-sites-smoke' }, signal: AbortSignal.timeout(10_000) });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; app?: string; env?: string } | null;
    if (res.status === 200 && body?.ok && body.app === 'sites' && body.env === env) {
      if (res.headers.get('set-cookie')) throw new Error('healthz must not set cookies');
      process.stdout.write(`PASS  https://${host}/healthz (${env})\n`);
      process.exit(0);
    }
    last = `${res.status} ${JSON.stringify(body)}`;
  } catch (error) {
    const code = String((error as { cause?: { code?: unknown } }).cause?.code ?? '');
    if (env !== 'production' && code.startsWith('ERR_SSL') && code.includes('HANDSHAKE_FAILURE')) {
      process.stdout.write(`::notice::SKIP sites smoke: ${host} has no certificate yet (Advanced Certificate pending, apps/sites/docs/DOMAINS.md §2)\n`);
      process.exit(0);
    }
    last = String(error);
  }
  await new Promise((r) => setTimeout(r, 3_000));
}
process.stderr.write(`FAIL  https://${host}/healthz: ${last}\n`);
process.exit(1);
