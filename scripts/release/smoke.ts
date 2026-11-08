/**
 * Release smoke checks: fast, read-only, safe against production.
 *
 *   node --experimental-strip-types scripts/release/smoke.ts --env stage
 *   node --experimental-strip-types scripts/release/smoke.ts --env production --override al-ummah-now-www=<version-id>
 *
 * With --override every request carries Cloudflare-Workers-Version-Overrides, so the
 * checks run on that 0%-traffic version, and /healthz must report it.
 * Production also checks apex → www (301, path and query kept) and that both hosts
 * answer over HTTPS. Exit 1 on any failure.
 */
import { resolve } from 'node:path';
import { ENVIRONMENTS, parseEnvArg, type EnvName } from '../environments.ts';

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface SmokeOptions {
  env: EnvName;
  /** worker name → version id */
  overrides?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export function overrideHeader(overrides: Record<string, string>): string {
  return Object.entries(overrides)
    .map(([worker, version]) => `${worker}="${version}"`)
    .join(', ');
}

export async function runSmoke(opts: SmokeOptions): Promise<CheckResult[]> {
  const e = ENVIRONMENTS[opts.env];
  const doFetch = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { 'User-Agent': 'al-ummah-now-www-release-smoke' };
  const version = opts.overrides?.[e.worker];
  if (opts.overrides && Object.keys(opts.overrides).length) headers['Cloudflare-Workers-Version-Overrides'] = overrideHeader(opts.overrides);
  const get = (url: string, extra: Record<string, string> = {}) =>
    doFetch(url, { headers: { ...headers, ...extra }, redirect: 'manual', signal: AbortSignal.timeout(15_000) });

  const results: CheckResult[] = [];
  const check = async (name: string, fn: () => Promise<string>) => {
    try {
      results.push({ name, ok: true, detail: await fn() });
    } catch (error) {
      results.push({ name, ok: false, detail: (error as Error).message });
    }
  };
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  await check('healthz', async () => {
    const res = await get(`${e.www}/healthz`);
    assert(res.status === 200, `status ${res.status}`);
    const body = (await res.json()) as { ok?: boolean; version?: string; cms?: string; env?: string };
    assert(body.ok === true, 'ok is not true');
    assert(body.env === e.vars.APP_ENV, `env ${body.env}, expected ${e.vars.APP_ENV}`);
    if (version) assert(body.version === version, `served by ${body.version}, expected candidate ${version}`);
    // cms "degraded" is reported, not fatal: www falls back by design (SPEC §5)
    return `version ${body.version}, cms ${body.cms}`;
  });

  for (const l of ['en', 'ar'] as const) {
    await check(`home ${l}`, async () => {
      const res = await get(`${e.www}/${l}/`);
      assert(res.status === 200, `status ${res.status}`);
      const html = await res.text();
      assert(html.includes(`<html lang="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}"`), 'lang/dir missing');
      assert(html.includes('الأمة الآن'), 'wordmark missing');
      const csp = res.headers.get('content-security-policy') ?? '';
      assert(csp.includes(`frame-src ${e.vars.VIDEOS_WEB_URL}`) && csp.includes("frame-ancestors 'none'"), 'CSP missing or wrong');
      assert(res.headers.get('strict-transport-security'), 'HSTS missing');
      if (e.env !== 'production') assert(res.headers.get('x-robots-tag')?.includes('noindex'), 'noindex missing off production');
      else assert(!res.headers.get('x-robots-tag'), 'production must be indexable');
      return `source ${res.headers.get('x-content-source')}`;
    });
  }

  await check('root redirect', async () => {
    const res = await get(`${e.www}/`, { 'Accept-Language': 'ar' });
    assert(res.status === 302 && res.headers.get('location') === '/ar/', `status ${res.status} → ${res.headers.get('location')}`);
    return '/ → /ar/';
  });

  await check('sign-in redirect', async () => {
    const res = await get(`${e.www}/auth/login?return=/en/`);
    assert(res.status === 302, `status ${res.status} (SESSION_SECRET set?)`);
    const loc = new URL(res.headers.get('location') ?? '');
    assert(`${loc.origin}${loc.pathname}` === `${e.vars.AUTH_URL}/authorize`, `goes to ${loc.origin}${loc.pathname}`);
    assert(loc.searchParams.get('client_id') === e.vars.WWW_CLIENT_ID, 'wrong client_id');
    assert(loc.searchParams.get('redirect_uri') === `${e.www}/auth/callback`, 'wrong redirect_uri');
    assert(loc.searchParams.get('code_challenge_method') === 'S256', 'no PKCE');
    return 'authorize with client_id, redirect_uri, S256';
  });

  await check('404', async () => {
    const res = await get(`${e.www}/en/this/does/not/exist/`);
    assert(res.status === 404, `status ${res.status}`);
    return 'localized 404';
  });

  await check('robots.txt', async () => {
    const text = await (await get(`${e.www}/robots.txt`)).text();
    if (e.env === 'production') assert(text.includes('Sitemap:'), 'no sitemap line');
    else assert(text.includes('Disallow: /\n'), 'must disallow all');
    return 'ok';
  });

  if (e.apex) {
    await check('apex → www', async () => {
      const res = await get(`${e.apex}/ar/news/?page=2&smoke=1`);
      assert(res.status === 301, `status ${res.status}`);
      const loc = res.headers.get('location');
      assert(loc === `${e.www}/ar/news/?page=2&smoke=1`, `location ${loc}`);
      return `HTTPS apex → ${loc}`;
    });
  }
  return results;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const argv = process.argv.slice(2);
  const env = parseEnvArg(argv);
  const overrides: Record<string, string> = {};
  argv.forEach((a, i) => {
    if (a === '--override') {
      const [worker, version] = (argv[i + 1] ?? '').split('=');
      if (worker && version) overrides[worker] = version;
    }
  });
  const results = await runSmoke({ env, overrides });
  for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}: ${r.detail}\n`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
