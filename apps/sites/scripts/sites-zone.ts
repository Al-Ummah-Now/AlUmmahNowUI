/**
 * The one-time alummahnow.org zone setup for the sites Worker (apps/sites/docs/DOMAINS.md), and a
 * check of what the release token (CLOUDFLARE_API_TOKEN) may do there.
 *
 *   node --experimental-strip-types scripts/sites-zone.ts --check   what the token can do; one
 *        reversible write: a TXT record _aun-token-check is created and deleted at once (DNS Edit)
 *   node --experimental-strip-types scripts/sites-zone.ts --apply   the proxied AAAA 100:: records
 *        (*, @, www, sites, *.qa, sites.qa, *.stage, sites.stage), Always Use HTTPS, and the Cloudflare
 *        for SaaS fallback origin sites.alummahnow.org (needs SaaS enabled on the zone). Idempotent.
 *
 * Worker routes are not made here: every sites deploy attaches them (wrangler.jsonc).
 * Output: one line per capability or step, never the token. Exit 1 when --check finds a missing
 * permission or --apply could not finish.
 */

export const ZONE_ID = 'c3cbc1b54070d957cdcef91444b746a9';
export const ZONE = 'alummahnow.org';
const API = 'https://api.cloudflare.com/client/v4';

export const RECORDS = ['*', '@', 'www', 'sites', '*.qa', 'sites.qa', '*.stage', 'sites.stage'] as const;
export const FALLBACK_ORIGIN = `sites.${ZONE}`;

export const fqdn = (name: string) => (name === '@' ? ZONE : `${name}.${ZONE}`);

interface CfAnswer<T = unknown> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result: T;
}

export type Call = <T = unknown>(method: string, path: string, body?: unknown) => Promise<{ status: number; body: CfAnswer<T> }>;

export function cfCall(token: string, fetchImpl: typeof fetch = fetch): Call {
  return async (method, path, body) => {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed = (await res.json().catch(() => ({ success: false, errors: [{ code: res.status, message: 'no JSON' }], result: null }))) as CfAnswer<never>;
    return { status: res.status, body: parsed };
  };
}

const why = (b: CfAnswer) => (b.errors ?? []).map((e) => `${e.code} ${e.message}`).join('; ') || 'no detail';

export interface Capability {
  name: string;
  ok: boolean;
  detail: string;
  /** The token permission that is missing when not ok. */
  needs: string;
}

/** What the token may do on the zone. Pure apart from the calls; one reversible TXT write. */
export async function checkToken(call: Call): Promise<Capability[]> {
  const out: Capability[] = [];
  const probe = async (name: string, needs: string, method: string, path: string, body?: unknown) => {
    const r = await call(method, path, body);
    out.push({ name, needs, ok: r.body.success, detail: r.body.success ? 'ok' : `${r.status}: ${why(r.body)}` });
    return r;
  };
  await probe('zone read', 'Zone: Read on alummahnow.org', 'GET', `/zones/${ZONE_ID}`);
  await probe('DNS read', 'Zone → DNS: Read', 'GET', `/zones/${ZONE_ID}/dns_records?per_page=5`);
  const created = await probe('DNS edit (TXT created and deleted)', 'Zone → DNS: Edit', 'POST', `/zones/${ZONE_ID}/dns_records`, {
    type: 'TXT',
    name: `_aun-token-check.${ZONE}`,
    content: 'sites-zone token check; deleted right away',
    ttl: 60,
  });
  const id = (created.body.result as { id?: string } | null)?.id;
  if (created.body.success && id) await call('DELETE', `/zones/${ZONE_ID}/dns_records/${id}`);
  await probe('Worker routes read', 'Zone → Workers Routes: Edit', 'GET', `/zones/${ZONE_ID}/workers/routes`);
  await probe('SSL settings read', 'Zone → SSL and Certificates: Read/Edit', 'GET', `/zones/${ZONE_ID}/ssl/universal/settings`);
  await probe('zone settings read (Always Use HTTPS)', 'Zone → Zone Settings: Edit', 'GET', `/zones/${ZONE_ID}/settings/always_use_https`);
  const fo = await call('GET', `/zones/${ZONE_ID}/custom_hostnames/fallback_origin`);
  const foOk = fo.body.success || (fo.body.errors ?? []).some((e) => e.code === 1551 || /not found/i.test(e.message));
  out.push({
    name: 'Custom Hostnames (fallback origin read)',
    needs: 'Zone → SSL and Certificates: Edit, and Cloudflare for SaaS enabled on the zone',
    ok: foOk,
    detail: foOk ? (fo.body.success ? 'ok' : 'ok (no fallback origin yet)') : `${fo.status}: ${why(fo.body)}`,
  });
  return out;
}

/** The one-time setup; returns one line per step and whether every step finished. */
export async function applyZone(call: Call): Promise<{ lines: string[]; ok: boolean }> {
  const lines: string[] = [];
  let ok = true;
  const existing = await call<{ name: string; type: string }[]>('GET', `/zones/${ZONE_ID}/dns_records?per_page=500`);
  if (!existing.body.success) return { lines: [`DNS read failed: ${why(existing.body)}`], ok: false };
  const have = new Set(existing.body.result.map((r) => `${r.type}:${r.name}`));
  for (const name of RECORDS) {
    const host = fqdn(name);
    if (have.has(`AAAA:${host}`)) {
      lines.push(`DNS AAAA ${host}: already there`);
      continue;
    }
    const r = await call('POST', `/zones/${ZONE_ID}/dns_records`, { type: 'AAAA', name: host, content: '100::', proxied: true, ttl: 1, comment: 'sites Worker (apps/sites/docs/DOMAINS.md)' });
    lines.push(`DNS AAAA ${host}: ${r.body.success ? 'created' : `FAILED ${why(r.body)}`}`);
    ok &&= r.body.success;
  }
  const https = await call('PATCH', `/zones/${ZONE_ID}/settings/always_use_https`, { value: 'on' });
  lines.push(`Always Use HTTPS: ${https.body.success ? 'on' : `FAILED ${why(https.body)}`}`);
  ok &&= https.body.success;
  const fo = await call('PUT', `/zones/${ZONE_ID}/custom_hostnames/fallback_origin`, { origin: FALLBACK_ORIGIN });
  lines.push(`Fallback origin ${FALLBACK_ORIGIN}: ${fo.body.success ? 'set' : `FAILED ${why(fo.body)} (Cloudflare for SaaS must be enabled on the zone)`}`);
  ok &&= fo.body.success;
  return { lines, ok };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (isMain) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    process.stderr.write('CLOUDFLARE_API_TOKEN is not set\n');
    process.exit(2);
  }
  const call = cfCall(token);
  if (process.argv.includes('--apply')) {
    const { lines, ok } = await applyZone(call);
    for (const l of lines) process.stdout.write(`${l}\n`);
    process.exit(ok ? 0 : 1);
  }
  const caps = await checkToken(call);
  for (const c of caps) process.stdout.write(`${c.ok ? 'OK  ' : 'MISSING'} ${c.name}: ${c.detail}${c.ok ? '' : ` → needs ${c.needs}`}\n`);
  process.exit(caps.every((c) => c.ok) ? 0 : 1);
}
