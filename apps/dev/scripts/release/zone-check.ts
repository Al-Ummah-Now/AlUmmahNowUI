/**
 * Is alummahnow.dev a zone on this Cloudflare account, active, and can the release token attach
 * custom domains there? Read-only: two GETs, never a write, never prints the token.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node --experimental-strip-types scripts/release/zone-check.ts
 *
 * Writes `ready=true|false` to $GITHUB_OUTPUT (when set) so deploy steps can skip, with a notice,
 * while the owner's steps in apps/dev/docs/DOMAIN.md are pending, instead of failing every push.
 * Exit 0 either way; exit 1 only when the token or account id is missing.
 */
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZONE } from '../environments.ts';

const API = 'https://api.cloudflare.com/client/v4';

export interface ZoneAnswer {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: { id: string; name: string; status: string; account?: { id: string } }[] | null;
}

export type Verdict = { ready: true; zoneId: string; detail: string } | { ready: false; detail: string };

/** Pure: the API answer for GET /zones?name=… → ready or why not. */
export function verdict(answer: ZoneAnswer, accountId: string): Verdict {
  if (!answer.success) {
    const why = (answer.errors ?? []).map((e) => `${e.code} ${e.message}`).join('; ') || 'no detail';
    return { ready: false, detail: `the token cannot list zones (${why}); it needs Zone: Read on ${ZONE}` };
  }
  const zone = (answer.result ?? []).find((z) => z.name === ZONE);
  if (!zone) return { ready: false, detail: `${ZONE} is not a zone this token can see on the account` };
  if (zone.account?.id && zone.account.id !== accountId) return { ready: false, detail: `${ZONE} is on another account` };
  if (zone.status !== 'active') return { ready: false, detail: `${ZONE} is a zone but its status is ${zone.status} (nameservers not confirmed yet)` };
  return { ready: true, zoneId: zone.id, detail: `${ZONE} is an active zone on the account` };
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) {
    process.stderr.write('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required\n');
    process.exit(1);
  }
  const res = await fetch(`${API}/zones?name=${ZONE}&account.id=${account}`, { headers: { Authorization: `Bearer ${token}` } });
  const answer = (await res.json().catch(() => ({ success: false, errors: [{ code: res.status, message: 'no JSON' }] }))) as ZoneAnswer;
  let v = verdict(answer, account);
  if (v.ready) {
    // Custom domains are attached by `wrangler deploy`; it needs Workers Routes on the zone.
    const routes = await fetch(`${API}/zones/${v.zoneId}/workers/routes`, { headers: { Authorization: `Bearer ${token}` } });
    const body = (await routes.json().catch(() => ({ success: false }))) as { success: boolean };
    if (!body.success) v = { ready: false, detail: `${ZONE} is active but the token lacks Zone → Workers Routes: Edit there` };
  }
  process.stdout.write(`${v.ready ? 'READY' : '::notice::NOT READY'}  ${v.detail}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ready=${v.ready}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### alummahnow.dev zone\n${v.ready ? 'Ready' : 'Not ready'}: ${v.detail}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
