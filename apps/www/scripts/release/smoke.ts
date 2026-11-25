/**
 * Release smoke checks: fast, read-only, safe against production.
 *
 *   node --experimental-strip-types scripts/release/smoke.ts --env stage
 *   node --experimental-strip-types scripts/release/smoke.ts --env production --override al-ummah-now-www=<version-id>
 *
 * With --override every request carries Cloudflare-Workers-Version-Overrides, so the
 * checks run on that 0%-traffic version. /healthz must report it; every other check sends
 * X-Release-Check and counts only when that version answered all its requests
 * (src/lib/release-check.ts). Another version's answer is asked for again, up to
 * VERSION_WAIT_MS for the whole smoke. Without --override every check asks once.
 * Production also checks apex → www (301, path and query kept) and that both hosts
 * answer over HTTPS. Exit 1 on any failure.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENVIRONMENTS, parseEnvArg, type EnvName } from '../environments.ts';
import { RELEASE_CHECK_HEADER, RELEASE_CHECK_OK } from '../../src/lib/release-check.ts';
import { THEME_IDS } from '../../../../packages/render/src/themes/site-themes.generated.ts';

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
  /** Wait between site-theme retries (tests: 0). */
  retryMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** How long one request may take (tests). */
  requestTimeoutMs?: number;
}

/** How long the whole smoke may wait for answers of the candidate instead of another version, and the pause between tries. */
export const VERSION_WAIT_MS = 90_000;
export const VERSION_PAUSE_MS = 5_000;

/** Tries of the one check whose proof may be lost on the way (production robots.txt). */
export const ROBOTS_TRIES = 3;
/** One request may take this long (a stalled one must not outlive the waits around it). */
export const REQUEST_TIMEOUT_MS = 15_000;
export const isTimeout = (error: unknown): boolean => (error as Error)?.name === 'TimeoutError';

const SITE_THEMES: readonly string[] = THEME_IDS;

export function overrideHeader(overrides: Record<string, string>): string {
  return Object.entries(overrides)
    .map(([worker, version]) => `${worker}="${version}"`)
    .join(', ');
}

/** An error in words. fetch says only «fetch failed»: the reason (a reset, DNS, TLS, a timeout) is in its cause, or in each of the cause's errors. */
export function reason(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const { cause } = error;
  if (!(cause instanceof Error)) return error.message;
  const all = cause instanceof AggregateError && cause.errors.length ? (cause.errors as unknown[]) : [cause];
  const why = all.map((c) => [(c as { code?: string }).code, c instanceof Error ? c.message : String(c)].filter(Boolean).join(' '));
  return `${error.message} (${why.join('; ')})`;
}

export async function runSmoke(opts: SmokeOptions): Promise<CheckResult[]> {
  const e = ENVIRONMENTS[opts.env];
  const doFetch = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const headers: Record<string, string> = { 'User-Agent': 'al-ummah-now-www-release-smoke' };
  const version = opts.overrides?.[e.worker];
  if (opts.overrides && Object.keys(opts.overrides).length) headers['Cloudflare-Workers-Version-Overrides'] = overrideHeader(opts.overrides);
  const requestTimeout = opts.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const get = (url: string, extra: Record<string, string> = {}, timeoutMs = requestTimeout) =>
    doFetch(url, { headers: { ...headers, ...extra }, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });

  type Get = (url: string, extra?: Record<string, string>) => Promise<Response>;
  const results: CheckResult[] = [];
  const deadline = now() + VERSION_WAIT_MS;
  const started = now();
  const timeLeft = () => Math.min(requestTimeout, Math.max(VERSION_PAUSE_MS, deadline - now()));
  const waited = () => Math.round((now() - started) / 1000);

  /**
   * One check. With a candidate, the verdict counts only when the candidate answered every request of the check
   * (X-Release-Check, src/lib/release-check.ts); otherwise (an older version, an edge error page, a stalled request)
   * the whole check runs again, one deadline for the whole smoke. A verdict of the candidate, pass or fail, and a
   * failed connection end it at once.
   * `proofMayBeLost`: something in front may rewrite the answer and drop the header; then it is a printed warning,
   * however little of the deadline is left. The answer's content still decides.
   */
  const check = async (name: string, fn: (get: Get) => Promise<string>, proofMayBeLost = false) => {
    let unproven: CheckResult | null = null;
    for (let tries = 1; ; tries++) {
      const proven: boolean[] = [];
      let broken = false;
      const ask: Get = async (url, extra = {}) => {
        try {
          const res = await get(url, version ? { ...extra, [RELEASE_CHECK_HEADER]: version } : extra, version ? timeLeft() : requestTimeout);
          proven.push(res.headers.get(RELEASE_CHECK_HEADER) === RELEASE_CHECK_OK);
          return res;
        } catch (error) {
          broken = broken || !isTimeout(error);
          throw error;
        }
      };
      let result: CheckResult;
      let stalled = false;
      try {
        result = { name, ok: true, detail: await fn(ask) };
      } catch (error) {
        stalled = isTimeout(error);
        result = { name, ok: false, detail: reason(error) };
      }
      // A check that ended before it asked www (the admin API's site theme) says nothing about a version: its verdict stands
      const decided = proven.every(Boolean) && !stalled;
      // A try that breaks after an answer without the proof was only there to look for the proof
      const lostOnly = proofMayBeLost && broken && unproven !== null;
      if (!lostOnly && (!version || broken || decided)) {
        if (version && tries > 1 && result.ok) result.detail += ` (after ${waited()} s)`;
        results.push(result);
        return;
      }
      if (!stalled && !broken) unproven = result;
      const timeUp = now() + VERSION_PAUSE_MS > deadline;
      if (proofMayBeLost && unproven && (tries >= ROBOTS_TRIES || timeUp || broken)) {
        results.push({ ...unproven, detail: `${unproven.detail} (WARNING: no proof that candidate ${version} answered; not required yet)` });
        return;
      }
      if (timeUp) {
        const last = stalled ? 'no answer in time' : `last answer, of another version: ${result.detail}`;
        results.push({ name, ok: false, detail: `not answered by candidate ${version} of ${e.worker} (after ${waited()} s; ${last})` });
        return;
      }
      await sleep(VERSION_PAUSE_MS);
    }
  };
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  // Says which version answered in its body, the same rule otherwise
  try {
    // With overrides the candidate itself has to answer: no version to ask for is no proof
    assert(version || !Object.keys(opts.overrides ?? {}).length, `no candidate version of ${e.worker} given`);
    for (;;) {
      let served: string;
      try {
        const res = await get(`${e.www}/healthz`, {}, version ? timeLeft() : requestTimeout);
        assert(res.status === 200, `status ${res.status}`);
        const body = (await res.json()) as { ok?: boolean; version?: string; cms?: string; env?: string; feed?: string; feedBuiltAt?: string | null };
        assert(body.ok === true, 'ok is not true');
        assert(body.env === e.vars.APP_ENV, `env ${body.env}, expected ${e.vars.APP_ENV}`);
        if (!version || body.version === version) {
          // cms "degraded" and feed "missing" are reported, not fatal: www falls back by design (SPEC §5)
          results.push({ name: 'healthz', ok: true, detail: `version ${body.version}${waited() >= 1 && version ? ` (after ${waited()} s)` : ''}, cms ${body.cms}, feed ${body.feed ?? 'unknown'}${body.feedBuiltAt ? ` (built ${body.feedBuiltAt})` : ''}` });
          break;
        }
        served = `served by ${body.version}`;
      } catch (error) {
        // A request that stalls says nothing about the candidate yet
        if (!version || !isTimeout(error)) throw error;
        served = 'no answer in time';
      }
      // Edge locations learn of a new deployment at different times: one can still answer with the version
      // before it, after waitForWwwVersion saw the candidate. Only that (and a stalled request) is waited for: an
      // error, another status or an unhealthy answer fails above, at once, on every try.
      assert(now() + VERSION_PAUSE_MS <= deadline, `${served}, expected candidate ${version} (after ${waited()} s)`);
      await sleep(VERSION_PAUSE_MS);
    }
  } catch (error) {
    results.push({ name: 'healthz', ok: false, detail: reason(error) });
  }

  for (const l of ['en', 'ar'] as const) {
    await check(`home ${l}`, async (get) => {
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
      return `source ${res.headers.get('x-content-source')}, timeline ${res.headers.get('x-feed-source') ?? 'unknown'}`;
    });
  }

  // The admin's site theme is what www renders (src/lib/site-theme.ts); read-only, never changes it
  await check('site theme', async (get) => {
    const admin = await doFetch(`${e.vars.ADMIN_API_URL}/public/site-theme`, { headers, signal: AbortSignal.timeout(requestTimeout) });
    assert(admin.ok, `${e.vars.ADMIN_API_URL}/public/site-theme: status ${admin.status}`);
    const wanted = ((await admin.json()) as { theme?: string }).theme;
    const rendered = async () => /<html[^>]*\sdata-theme="([a-z][a-z0-9-]*)"/.exec(await (await get(`${e.www}/en/`)).text())?.[1];
    let theme = await rendered();
    // A switch in the admin takes up to a minute to arrive (admin API and www each cache 30 s)
    for (let i = 0; i < 3 && theme !== wanted && SITE_THEMES.includes(wanted ?? ''); i++) {
      await new Promise((r) => setTimeout(r, opts.retryMs ?? 20_000));
      theme = await rendered();
    }
    assert(theme, 'no data-theme on <html>');
    // A theme package from the admin's theme builder is not vendored in www: the default renders
    const expected = SITE_THEMES.includes(wanted ?? '') ? wanted : 'fawanees';
    assert(theme === expected, `renders ${theme}, the admin chose ${wanted}`);
    return `data-theme ${theme}`;
  });

  // `/` is the visitor's language page itself (no redirect hop): Accept-Language picks it, the
  // canonical names the language URL, and no shared cache may keep it (it varies per visitor)
  await check('root serves the visitor language', async (get) => {
    const seen: string[] = [];
    for (const [lang, dir] of [['ar', 'rtl'], ['en', 'ltr']] as const) {
      const res = await get(`${e.www}/`, { 'Accept-Language': lang });
      assert(res.status === 200, `${lang}: status ${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}`);
      assert(res.headers.get('content-language') === lang, `${lang}: Content-Language ${res.headers.get('content-language')}`);
      const cacheControl = res.headers.get('cache-control') ?? '';
      assert(/\bprivate\b/.test(cacheControl) && /\bno-cache\b/.test(cacheControl), `${lang}: Cache-Control "${cacheControl}" (want private, no-cache)`);
      assert(/accept-language/i.test(res.headers.get('vary') ?? ''), `${lang}: Vary "${res.headers.get('vary')}" (want Accept-Language)`);
      const html = await res.text();
      const tag = /<html\b[^>]*>/i.exec(html)?.[0] ?? '';
      assert(new RegExp(`\\blang="${lang}"`).test(tag) && new RegExp(`\\bdir="${dir}"`).test(tag), `${lang}: ${tag || 'no <html> tag'}`);
      const canonical = /<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i.exec(html)?.[1] ?? /<link\b[^>]*href="([^"]+)"[^>]*rel="canonical"/i.exec(html)?.[1];
      assert(canonical === `${e.www}/${lang}/`, `${lang}: canonical ${canonical ?? 'missing'} (want ${e.www}/${lang}/)`);
      seen.push(`${lang}: 200 ${lang}/${dir}, canonical /${lang}/`);
    }
    return seen.join('; ');
  });

  await check('sign-in redirect', async (get) => {
    const res = await get(`${e.www}/auth/login?return=/en/`);
    assert(res.status === 302, `status ${res.status} (SESSION_SECRET set?)`);
    const loc = new URL(res.headers.get('location') ?? '');
    assert(`${loc.origin}${loc.pathname}` === `${e.vars.AUTH_URL}/authorize`, `goes to ${loc.origin}${loc.pathname}`);
    assert(loc.searchParams.get('client_id') === e.vars.WWW_CLIENT_ID, 'wrong client_id');
    assert(loc.searchParams.get('redirect_uri') === `${e.www}/auth/callback`, 'wrong redirect_uri');
    assert(loc.searchParams.get('code_challenge_method') === 'S256', 'no PKCE');
    return 'authorize with client_id, redirect_uri, S256';
  });

  await check('404', async (get) => {
    const res = await get(`${e.www}/en/this/does/not/exist/`);
    assert(res.status === 404, `status ${res.status}`);
    return 'localized 404';
  });

  await check('news → articles', async (get) => {
    const res = await get(`${e.www}/ar/news/?page=2&smoke=1`);
    const loc = res.headers.get('location');
    assert(res.status === 301 && loc === '/ar/articles/?page=2&smoke=1', `status ${res.status} → ${loc}`);
    return `/ar/news/ → ${loc}`;
  });

  await check('robots.txt', async (get) => {
    const text = await (await get(`${e.www}/robots.txt`)).text();
    if (e.env === 'production') assert(text.includes('Sitemap:'), 'no sitemap line');
    else assert(text.includes('Disallow: /\n'), 'must disallow all');
    return 'ok';
    // Cloudflare's managed robots.txt rewrites production's answer: whether the header survives is seen first, then required
  }, e.env === 'production');

  if (e.apex) {
    await check('apex → www', async (get) => {
      const res = await get(`${e.apex}/ar/articles/?page=2&smoke=1`);
      assert(res.status === 301, `status ${res.status}`);
      const loc = res.headers.get('location');
      assert(loc === `${e.www}/ar/articles/?page=2&smoke=1`, `location ${loc}`);
      return `HTTPS apex → ${loc}`;
    });
    // Native passkey sign-in: Apple and Google fetch these from the RP ID (the apex), no redirect
    await check('passkey domain files', async (get) => {
      const aasa = await get(`${e.apex}/.well-known/apple-app-site-association`);
      assert(aasa.status === 200, `AASA status ${aasa.status}`);
      assert((aasa.headers.get('content-type') ?? '').startsWith('application/json'), 'AASA is not JSON');
      const apps = ((await aasa.json()) as { webcredentials?: { apps?: unknown } }).webcredentials?.apps;
      assert(Array.isArray(apps), 'AASA has no webcredentials.apps');
      const links = await get(`${e.apex}/.well-known/assetlinks.json`);
      assert(links.status === 200, `assetlinks status ${links.status}`);
      const statements = (await links.json()) as unknown;
      assert(Array.isArray(statements), 'assetlinks is not a list');
      return `${(apps as unknown[]).length} Apple app(s), ${(statements as unknown[]).length} Android app(s)`;
    });
  }
  return results;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(new URL(import.meta.url)));
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
