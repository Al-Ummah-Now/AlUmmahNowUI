/**
 * The one-time alummahnow.org zone setup for the sites Worker (apps/sites/docs/DOMAINS.md), and a
 * check of what the release token (CLOUDFLARE_API_TOKEN) may do there.
 *
 *   node --experimental-strip-types scripts/sites-zone.ts --check   what the token can do; one
 *        reversible write: a TXT record _aun-token-check is created and deleted at once (DNS Edit)
 *   node --experimental-strip-types scripts/sites-zone.ts --apply   the proxied AAAA 100:: records
 *        (*, @, www, sites, *.qa, sites.qa, *.stage, sites.stage), Always Use HTTPS, and the Cloudflare
 *        for SaaS fallback origin sites.alummahnow.org (needs SaaS enabled on the zone). Idempotent.
 *   node --experimental-strip-types scripts/sites-zone.ts --own-domain-smoke qa|stage   a throwaway
 *        own domain end to end (ownDomainSmoke): custom hostname, records in SMOKE_TEST_ZONE
 *        (default alummahnow.com), route to the env's Worker, validation, HTTPS /healthz, cleanup
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

export type SmokeEnv = 'qa' | 'stage';
export const SMOKE_WORKER: Record<SmokeEnv, string> = { qa: 'al-ummah-now-sites-qa', stage: 'al-ummah-now-sites-stage' };

export interface SmokeDeps {
  /** GET https://<host>/healthz; answers the status and the parsed body (or null). */
  probe: (url: string) => Promise<{ status: number; body: unknown }>;
  sleep: (ms: number) => Promise<void>;
  /** Random part of the test host. */
  id: string;
  /** How long to wait for the hostname and certificate to go active. */
  activeTimeoutMs?: number;
  /** How long to wait for the site to answer over the new certificate. */
  probeTimeoutMs?: number;
  pollMs?: number;
}

interface SmokeHostname {
  id: string;
  status?: string;
  ssl?: { status?: string; validation_records?: { txt_name?: string; txt_value?: string }[] };
  ownership_verification?: { type?: string; name?: string; value?: string };
  verification_errors?: string[];
}

/**
 * The own-domain path end to end, as a scholar would do it, with a throwaway host in a test zone
 * we own: create the custom hostname on alummahnow.org, add the scholar's records (CNAME to the
 * fallback origin plus every TXT Cloudflare asks for) in the test zone, route the host to the env's
 * sites Worker, wait for the hostname and certificate to go active, fetch /healthz over HTTPS, and
 * remove everything again (also when a step fails).
 */
export async function ownDomainSmoke(call: Call, env: SmokeEnv, testZone: string, deps: SmokeDeps): Promise<{ lines: string[]; ok: boolean }> {
  const lines: string[] = [];
  const say = (l: string) => lines.push(l);
  const poll = deps.pollMs ?? 15_000;
  const z = await call<{ id: string; name: string }[]>('GET', `/zones?name=${encodeURIComponent(testZone)}`);
  const zoneId = z.body.success ? z.body.result[0]?.id : undefined;
  if (!zoneId) {
    const all = await call<{ name: string }[]>('GET', '/zones?per_page=50');
    say(`Test zone ${testZone}: not visible to the token (${z.body.success ? 'no such zone' : why(z.body)}); zones it sees: ${all.body.success ? all.body.result.map((r) => r.name).join(', ') || 'none' : why(all.body)}`);
    return { lines, ok: false };
  }
  const host = `saas-smoke-${deps.id}.${env}-sites.${testZone}`;
  say(`Test host: ${host} (env ${env}, worker ${SMOKE_WORKER[env]})`);
  const cleanup: (() => Promise<string>)[] = [];
  let ok = false;
  try {
    const created = await call<SmokeHostname>('POST', `/zones/${ZONE_ID}/custom_hostnames`, { hostname: host, ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.2' } } });
    if (!created.body.success) {
      say(`Custom hostname: FAILED ${why(created.body)}`);
      return { lines, ok: false };
    }
    const chId = created.body.result.id;
    cleanup.push(async () => {
      const r = await call('DELETE', `/zones/${ZONE_ID}/custom_hostnames/${chId}`);
      return `Custom hostname removed: ${r.body.success ? 'yes' : `FAILED ${why(r.body)}`}`;
    });
    say(`Custom hostname: created (status ${created.body.result.status ?? '?'}, certificate ${created.body.result.ssl?.status ?? '?'})`);

    // Cloudflare fills in the certificate TXT a few seconds after the create
    let h = created.body.result;
    for (let i = 0; i < 8 && !(h.ssl?.validation_records ?? []).some((r) => r.txt_name && r.txt_value); i++) {
      await deps.sleep(Math.min(poll, 5_000));
      const g = await call<SmokeHostname>('GET', `/zones/${ZONE_ID}/custom_hostnames/${chId}`);
      if (g.body.success) h = g.body.result;
    }
    const records: { type: string; name: string; content: string; why: string }[] = [{ type: 'CNAME', name: host, content: FALLBACK_ORIGIN, why: 'traffic' }];
    const own = h.ownership_verification;
    if (own?.type === 'txt' && own.name && own.value) records.push({ type: 'TXT', name: own.name, content: own.value, why: 'ownership' });
    for (const r of h.ssl?.validation_records ?? []) if (r.txt_name && r.txt_value) records.push({ type: 'TXT', name: r.txt_name, content: r.txt_value, why: 'certificate' });
    say(`Records the owner adds: ${records.map((r) => `${r.type} ${r.name.replace(host, '<host>')} (${r.why})`).join(', ')}`);
    for (const r of records) {
      const made = await call<{ id: string }>('POST', `/zones/${zoneId}/dns_records`, { type: r.type, name: r.name, content: r.content, ttl: 60, proxied: false, comment: 'own-domain smoke; deleted by the run' });
      if (!made.body.success) {
        say(`DNS ${r.type} (${r.why}) in ${testZone}: FAILED ${why(made.body)} → the token needs Zone → DNS: Edit on ${testZone}`);
        return { lines, ok: false };
      }
      const recId = made.body.result.id;
      cleanup.push(async () => {
        const d = await call('DELETE', `/zones/${zoneId}/dns_records/${recId}`);
        return `DNS ${r.type} (${r.why}) removed: ${d.body.success ? 'yes' : `FAILED ${why(d.body)}`}`;
      });
    }
    say(`DNS in ${testZone}: ${records.length} records added (DNS only)`);

    const route = await call<{ id: string }>('POST', `/zones/${ZONE_ID}/workers/routes`, { pattern: `${host}/*`, script: SMOKE_WORKER[env] });
    if (!route.body.success) {
      say(`Worker route ${host}/* → ${SMOKE_WORKER[env]}: FAILED ${why(route.body)}`);
      return { lines, ok: false };
    }
    const routeId = route.body.result.id;
    cleanup.push(async () => {
      const d = await call('DELETE', `/zones/${ZONE_ID}/workers/routes/${routeId}`);
      return `Worker route removed: ${d.body.success ? 'yes' : `FAILED ${why(d.body)}`}`;
    });
    say(`Worker route ${host}/* → ${SMOKE_WORKER[env]}: added`);

    const activeBy = Date.now() + (deps.activeTimeoutMs ?? 10 * 60_000);
    const started = Date.now();
    let last = '';
    for (;;) {
      const g = await call<SmokeHostname>('GET', `/zones/${ZONE_ID}/custom_hostnames/${chId}`);
      if (g.body.success) {
        h = g.body.result;
        last = `status ${h.status ?? '?'}, certificate ${h.ssl?.status ?? '?'}${h.verification_errors?.length ? `, ${h.verification_errors[0]}` : ''}`;
        if (h.status === 'active' && h.ssl?.status === 'active') break;
      }
      if (Date.now() >= activeBy) {
        say(`Validation: NOT active in time (${last})`);
        return { lines, ok: false };
      }
      await deps.sleep(poll);
    }
    say(`Validation: hostname and certificate active after ${Math.round((Date.now() - started) / 1000)} s`);

    const probeBy = Date.now() + (deps.probeTimeoutMs ?? 3 * 60_000);
    let seen = '';
    for (;;) {
      const r = await deps.probe(`https://${host}/healthz`).catch((error: unknown) => ({ status: 0, body: String(error) as unknown }));
      const b = r.body as { app?: string; env?: string } | null;
      seen = `${r.status} ${typeof r.body === 'string' ? r.body.slice(0, 120) : JSON.stringify(r.body)?.slice(0, 120)}`;
      if (r.status === 200 && b?.app === 'sites' && b.env === env) break;
      if (Date.now() >= probeBy) {
        say(`Routing: https://${host}/healthz did not reach the ${env} sites Worker (${seen})`);
        return { lines, ok: false };
      }
      await deps.sleep(Math.min(poll, 10_000));
    }
    say(`Routing: https://${host}/healthz → ${seen}`);
    ok = true;
    return { lines, ok };
  } finally {
    for (const undo of cleanup.reverse()) say(await undo().catch((error: unknown) => `cleanup FAILED ${String(error)}`));
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (isMain) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    process.stderr.write('CLOUDFLARE_API_TOKEN is not set\n');
    process.exit(2);
  }
  const call = cfCall(token);
  const smoke = process.argv.indexOf('--own-domain-smoke');
  if (smoke !== -1) {
    const env = (process.argv[smoke + 1] ?? 'qa') as SmokeEnv;
    const testZone = process.env.SMOKE_TEST_ZONE || 'alummahnow.com';
    if (!(env in SMOKE_WORKER)) {
      process.stderr.write('--own-domain-smoke takes qa or stage\n');
      process.exit(2);
    }
    const { lines, ok } = await ownDomainSmoke(call, env, testZone, {
      id: crypto.randomUUID().slice(0, 8),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      probe: async (url) => {
        const res = await fetch(url, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000) });
        const text = await res.text();
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          // not JSON: keep the text for the report
        }
        return { status: res.status, body };
      },
    });
    for (const l of lines) process.stdout.write(`${l}\n`);
    process.exit(ok ? 0 : 1);
  }
  if (process.argv.includes('--apply')) {
    const { lines, ok } = await applyZone(call);
    for (const l of lines) process.stdout.write(`${l}\n`);
    process.exit(ok ? 0 : 1);
  }
  const caps = await checkToken(call);
  for (const c of caps) process.stdout.write(`${c.ok ? 'OK  ' : 'MISSING'} ${c.name}: ${c.detail}${c.ok ? '' : ` → needs ${c.needs}`}\n`);
  process.exit(caps.every((c) => c.ok) ? 0 : 1);
}
