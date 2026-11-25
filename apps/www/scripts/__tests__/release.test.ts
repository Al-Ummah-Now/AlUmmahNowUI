import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CI_ANDROID_CERT, checkWranglerConfig } from '../check-wrangler-config.ts';
import { ENVIRONMENTS, parseEnvArg } from '../environments.ts';
import { parseJsonc } from '../jsonc.ts';
import { evaluateSecrets } from '../release/check-secrets.ts';
import { currentVersion, parseVersionId, promote, releaseApp, type PromoteDeps } from '../release/promote.ts';
import { parseRollbackArgs, previousFromResult, rollbackArgv, rollbackTarget } from '../release/rollback.ts';
import { overrideHeader, reason, REQUEST_TIMEOUT_MS, runSmoke, VERSION_PAUSE_MS, VERSION_WAIT_MS, type CheckResult } from '../release/smoke.ts';
import { readFileSync } from 'node:fs';

const V1 = '11111111-1111-1111-1111-111111111111';
const V2 = '22222222-2222-2222-2222-222222222222';
const V3 = '33333333-3333-3333-3333-333333333333';

describe('wrangler config check', () => {
  const real = parseJsonc<Record<string, unknown>>(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'));
  it('passes on the committed wrangler.jsonc', () => {
    expect(checkWranglerConfig(real)).toEqual([]);
  });
  it('catches a missing apex, workers_dev, a wrong var and a secret var', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating a parsed config fixture
    const bad = structuredClone(real) as Record<string, any>;
    bad.routes = [{ pattern: 'www.alummahnow.net', custom_domain: true }];
    bad.env.qa.workers_dev = true;
    bad.env.stage.vars.AUTH_URL = 'https://auth.alummahnow.net';
    bad.vars.SESSION_SECRET = 'x';
    const errors = checkWranglerConfig(bad);
    expect(errors.join('\n')).toMatch(/production: custom domains must be alummahnow.net, www.alummahnow.net/);
    expect(errors.join('\n')).toMatch(/qa: workers_dev must be false/);
    expect(errors.join('\n')).toMatch(/stage: vars.AUTH_URL/);
    expect(errors.join('\n')).toMatch(/SESSION_SECRET must be a secret/);
  });
  it('keeps the CI pre-release key off production but allows it on QA and stage', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating a parsed config fixture
    const bad = structuredClone(real) as Record<string, any>;
    expect(bad.env.stage.vars.ANDROID_APP_CERTS).toContain(CI_ANDROID_CERT);
    bad.vars.ANDROID_APP_CERTS = JSON.stringify({ 'net.alummahnow.studio': [CI_ANDROID_CERT.toLowerCase()] });
    expect(checkWranglerConfig(bad)).toEqual(['production: vars.ANDROID_APP_CERTS must not list the CI pre-release key (production trusts Play-signed builds only)']);
  });
  it('binds only this env\'s internal API key from the Secrets Store (newsletter), never another env\'s or a var', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating a parsed config fixture
    const bad = structuredClone(real) as Record<string, any>;
    bad.env.qa.secrets_store_secrets = [{ ...bad.env.qa.secrets_store_secrets[0], secret_name: 'internal-api-key' }];
    bad.env.stage.secrets_store_secrets = [...bad.env.stage.secrets_store_secrets, { binding: 'OTHER', store_id: 'f8eddc9944d041919ed8dc7d08d32308', secret_name: 'google-oauth-client-secret-stage' }];
    delete bad.secrets_store_secrets;
    bad.vars.INTERNAL_API_KEY = 'x';
    const errors = checkWranglerConfig(bad).join('\n');
    expect(errors).toMatch(/qa: secrets_store_secrets must be exactly INTERNAL_API_KEY → internal-api-key-qa/);
    expect(errors).toMatch(/stage: secrets_store_secrets must be exactly INTERNAL_API_KEY → internal-api-key-stage/);
    expect(errors).toMatch(/production: secrets_store_secrets must be exactly INTERNAL_API_KEY → internal-api-key in store/);
    expect(errors).toMatch(/production: INTERNAL_API_KEY must come from the Secrets Store, never a var/);
  });
  it('requires the FEED namespace per env, separate from CONTENT_SNAPSHOT', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating a parsed config fixture
    const bad = structuredClone(real) as Record<string, any>;
    bad.env.qa.kv_namespaces = bad.env.qa.kv_namespaces.filter((k: { binding: string }) => k.binding !== 'FEED');
    bad.env.stage.kv_namespaces = bad.env.stage.kv_namespaces.map((k: { binding: string; id: string }) => (k.binding === 'FEED' ? { ...k, id: ENVIRONMENTS.stage.kvId } : k));
    const errors = checkWranglerConfig(bad).join('\n');
    expect(errors).toMatch(/qa: KV FEED must be 6e459b34fb954cf4a199cfef57036a8c/);
    expect(errors).toMatch(/stage: KV FEED must not share the CONTENT_SNAPSHOT namespace/);
  });
  it('parses JSONC with comments, URLs in strings and trailing commas', () => {
    expect(parseJsonc('{ // c\n "a": "https://x//y", /* b */ "b": [1,2,], }')).toEqual({ a: 'https://x//y', b: [1, 2] });
  });
  it('parseEnvArg', () => {
    expect(parseEnvArg(['--env', 'stage'])).toBe('stage');
    expect(() => parseEnvArg(['--env', 'qa'], ['stage', 'production'])).toThrow();
  });
});

describe('secrets manifest', () => {
  it('requires SESSION_SECRET on every www worker', () => {
    expect(evaluateSecrets('production', 'al-ummah-now-www', [{ type: 'plain_text', name: 'SESSION_SECRET' }]).missing).toEqual(['SESSION_SECRET']);
    expect(evaluateSecrets('qa', 'al-ummah-now-www-qa', [{ type: 'secret_text', name: 'SESSION_SECRET' }]).missing).toEqual([]);
    expect(evaluateSecrets('stage', 'al-ummah-now-www-stage', null)).toEqual({ worker: 'al-ummah-now-www-stage', missing: ['SESSION_SECRET'], exists: false });
  });
});

describe('promote', () => {
  it('parses wrangler output', () => {
    expect(parseVersionId(`Uploaded\nWorker Version ID: ${V2}\n`)).toBe(V2);
    expect(parseVersionId(`Deployed\nCurrent Version ID: ${V2}`)).toBe(V2);
    expect(() => parseVersionId('nope')).toThrow();
    expect(currentVersion(JSON.stringify({ versions: [{ version_id: V1, percentage: 100 }] }), 'w')).toBe(V1);
    expect(() => currentVersion(JSON.stringify({ versions: [{ version_id: V1, percentage: 90 }, { version_id: V2, percentage: 10 }] }), 'w')).toThrow(/split/);
  });

  function fakeDeps(opts: { smokeFailsAt?: 'pre' | 'post'; current?: string | null }) {
    const calls: string[][] = [];
    const deps: PromoteDeps = {
      run: (_cwd, args) => {
        calls.push(args);
        if (args[0] === 'deployments') {
          if (opts.current === null) throw new Error('no deployments');
          return JSON.stringify({ versions: [{ version_id: opts.current ?? V1, percentage: 100 }] });
        }
        if (args[0] === 'versions' && args[1] === 'upload') return `Worker Version ID: ${V2}`;
        if (args[0] === 'deploy') return `Current Version ID: ${V2}`;
        return 'ok';
      },
      smoke: async (_env, overrides) => {
        const pre = !!overrides;
        const fail = (opts.smokeFailsAt === 'pre' && pre) || (opts.smokeFailsAt === 'post' && !pre);
        return [{ name: 'healthz', ok: !fail, detail: fail ? 'boom' : 'ok' }];
      },
      waitForVersion: async () => undefined,
      log: () => undefined,
    };
    return { deps, calls };
  }
  const app = releaseApp('/repo', 'production');

  it('uploads, triggers (so new hosts exist), 0% + override smoke, 100%, smoke', async () => {
    const { deps, calls } = fakeDeps({});
    expect(await promote(app, 'production', 'release abc', deps)).toEqual({ worker: 'al-ummah-now-www', previous: V1, candidate: V2 });
    expect(calls.map((c) => c.slice(0, 3).join(' '))).toEqual([
      'deployments status --json',
      'versions upload -c',
      'triggers deploy -c',
      `versions deploy ${V2}@0%`,
      `versions deploy ${V2}@100%`,
    ]);
    expect(app.configArgs).toEqual(['-c', 'wrangler.jsonc']);
    expect(releaseApp('/repo', 'stage').configArgs).toEqual(['-c', 'wrangler.jsonc', '--env', 'stage']);
  });

  it('rolls back when the pre-traffic smoke fails, before any traffic moves', async () => {
    const { deps, calls } = fakeDeps({ smokeFailsAt: 'pre' });
    await expect(promote(app, 'production', 'r', deps)).rejects.toMatchObject({ rolledBack: true });
    expect(calls.some((c) => c[1] === `${V2}@100%`)).toBe(false);
    expect(calls.at(-1)?.slice(0, 2)).toEqual(['rollback', V1]);
  });

  it('rolls back when the post-promote smoke fails', async () => {
    const { deps, calls } = fakeDeps({ smokeFailsAt: 'post' });
    await expect(promote(app, 'production', 'r', deps)).rejects.toMatchObject({ rolledBack: true });
    expect(calls.at(-1)?.slice(0, 2)).toEqual(['rollback', V1]);
  });

  it('first deploy uses wrangler deploy and has nothing to roll back to', async () => {
    const { deps, calls } = fakeDeps({ current: null });
    expect(await promote(app, 'production', 'r', deps)).toEqual({ worker: 'al-ummah-now-www', previous: null, candidate: V2 });
    expect(calls.map((c) => c[0])).toEqual(['deployments', 'deploy']);
  });
});

describe('rollback', () => {
  const deployments = JSON.stringify([
    { created_on: '2026-11-01T00:00:00Z', versions: [{ version_id: V1, percentage: 100 }] },
    { created_on: '2026-11-02T00:00:00Z', versions: [{ version_id: V2, percentage: 0 }, { version_id: V1, percentage: 100 }] },
    { created_on: '2026-11-03T00:00:00Z', versions: [{ version_id: V2, percentage: 100 }] },
  ]);
  it('targets the previous main version', () => {
    expect(rollbackTarget(deployments, 'w')).toEqual({ current: V2, target: V1 });
    expect(rollbackTarget(deployments, 'w', V3)).toEqual({ current: V2, target: V3 });
  });
  it('refuses mid-promote without --to and with no history', () => {
    const split = JSON.stringify([{ created_on: '1', versions: [{ version_id: V2, percentage: 0 }, { version_id: V1, percentage: 100 }] }]);
    expect(() => rollbackTarget(split, 'w')).toThrow(/mid-promote/);
    expect(() => rollbackTarget(JSON.stringify([{ created_on: '1', versions: [{ version_id: V1, percentage: 100 }] }]), 'w')).toThrow(/no earlier/);
  });
  it('args, release-result and argv', () => {
    expect(parseRollbackArgs(['--env', 'production', '--dry-run'])).toMatchObject({ env: 'production', dryRun: true });
    expect(() => parseRollbackArgs(['--env', 'qa'])).toThrow();
    expect(() => parseRollbackArgs(['--env', 'stage', '--to', 'x'])).toThrow();
    const result = JSON.stringify({ env: 'production', status: 'promoted', released: [{ worker: 'al-ummah-now-www', previous: V1, candidate: V2 }] });
    expect(previousFromResult(result, 'production')).toBe(V1);
    expect(previousFromResult(result, 'stage')).toBeUndefined();
    expect(rollbackArgv('stage', V1, 'why')).toEqual(['rollback', V1, '--name', 'al-ummah-now-www-stage', '-y', '--message', 'why']);
  });
});

/** A real server whose answers stall: no headers, or headers and half a body, then nothing. */
async function stalling(run: (url: string) => Promise<void>): Promise<void> {
  const server = createServer((req, res) => {
    if (req.url === '/body') res.writeHead(200, { 'Content-Type': 'application/json' }).write('{"status":');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

describe('smoke', () => {
  afterEach(() => void vi.restoreAllMocks());
  const e = ENVIRONMENTS.production;
  /** A healthy site whose candidate answers every request that asks for it (X-Release-Check). */
  function site(overrides: Partial<Record<string, () => Response>> = {}): typeof fetch {
    const base = answers(overrides);
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await base(input, init);
      if (new Headers(init?.headers).has('X-Release-Check')) response.headers.set('X-Release-Check', 'ok');
      return response;
    }) as typeof fetch;
  }
  function answers(overrides: Partial<Record<string, () => Response>> = {}): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      for (const [k, fn] of Object.entries(overrides)) if (url.includes(k)) return fn!();
      const ok = (body: string, h: Record<string, string> = {}) => new Response(body, { status: 200, headers: h });
      if (url === `${e.vars.ADMIN_API_URL}/public/site-theme`) return ok(JSON.stringify({ theme: 'lantern' }));
      if (url.endsWith('/healthz')) {
        const v = /="([^"]+)"/.exec(headers.get('Cloudflare-Workers-Version-Overrides') ?? '')?.[1] ?? V1;
        return ok(JSON.stringify({ ok: true, version: v, env: 'production', cms: 'ok' }));
      }
      const m = url.includes('/auth/') ? null : /\/(en|ar)\/$/.exec(url);
      if (m) {
        return ok(`<html lang="${m[1]}" dir="${m[1] === 'ar' ? 'rtl' : 'ltr'}" data-theme="lantern">الأمة الآن`, {
          'content-security-policy': `frame-src ${e.vars.VIDEOS_WEB_URL}; frame-ancestors 'none'`,
          'strict-transport-security': 'max-age=1',
          'x-content-source': 'cms',
        });
      }
      if (url === `${e.www}/`) {
        const lang = headers.get('Accept-Language') === 'ar' ? 'ar' : 'en';
        return ok(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><link rel="canonical" href="${e.www}/${lang}/">`, {
          'content-language': lang,
          'cache-control': 'private, no-cache',
          vary: 'Cookie, Accept-Language',
        });
      }
      if (url.includes('/auth/login')) {
        const loc = new URL(`${e.vars.AUTH_URL}/authorize`);
        loc.searchParams.set('client_id', e.vars.WWW_CLIENT_ID);
        loc.searchParams.set('redirect_uri', `${e.www}/auth/callback`);
        loc.searchParams.set('code_challenge_method', 'S256');
        return new Response(null, { status: 302, headers: { location: loc.toString() } });
      }
      if (url.includes('/this/does/not/exist')) return new Response('', { status: 404 });
      if (url.endsWith('/robots.txt')) return ok('User-agent: *\nAllow: /\n\nSitemap: x');
      if (url.startsWith(`${e.www}/ar/news/`)) return new Response(null, { status: 301, headers: { location: '/ar/articles/?page=2&smoke=1' } });
      if (url === `${e.apex}/.well-known/apple-app-site-association`) return Response.json({ webcredentials: { apps: [] } });
      if (url === `${e.apex}/.well-known/assetlinks.json`) return Response.json([]);
      if (url.startsWith(e.apex!)) return new Response(null, { status: 301, headers: { location: `${e.www}/ar/articles/?page=2&smoke=1` } });
      return new Response('', { status: 500 });
    }) as typeof fetch;
  }

  it('passes on a healthy production, including apex → www', async () => {
    const results = await runSmoke({ env: 'production', fetchImpl: site() });
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(results.map((r) => r.name)).toContain('apex → www');
    expect(results.map((r) => r.name)).toContain('passkey domain files');
  });
  it('fails when / redirects instead of serving the visitor language, or a shared cache could keep it', async () => {
    const e = ENVIRONMENTS.production;
    const base = site();
    const redirecting = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === `${e.www}/` ? new Response(null, { status: 302, headers: { location: '/ar/' } }) : base(input, init)) as typeof fetch;
    const failed = (await runSmoke({ env: 'production', fetchImpl: redirecting })).find((r) => r.name === 'root serves the visitor language');
    expect(failed).toMatchObject({ ok: false, detail: expect.stringContaining('status 302') });
    const cached = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await base(input, init);
      if (String(input) !== `${e.www}/`) return res;
      const out = new Response(await res.text(), res);
      out.headers.set('cache-control', 'public, max-age=300');
      return out;
    }) as typeof fetch;
    const shared = (await runSmoke({ env: 'production', fetchImpl: cached })).find((r) => r.name === 'root serves the visitor language');
    expect(shared).toMatchObject({ ok: false, detail: expect.stringContaining('private, no-cache') });
  });
  it('asserts the candidate version through the override header', async () => {
    const ok = await runSmoke({ env: 'production', overrides: { 'al-ummah-now-www': V2 }, fetchImpl: site() });
    expect(ok.find((r) => r.name === 'healthz')).toMatchObject({ ok: true, detail: expect.stringContaining(V2) });
    expect(overrideHeader({ a: V1, b: V2 })).toBe(`a="${V1}", b="${V2}"`);
  });
  /** A clock that moves only when somebody sleeps. */
  const clock = () => {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  };
  const healthz = (results: CheckResult[]) => results.find((r) => r.name === 'healthz')!;
  it('fails when overrides name no candidate of www', async () => {
    const c = clock();
    const results = await runSmoke({ env: 'production', overrides: { other: V2 }, fetchImpl: site(), ...c });
    expect(healthz(results)).toMatchObject({ ok: false, detail: 'no candidate version of al-ummah-now-www given' });
    expect(c.now()).toBe(0);
  });
  describe('who answered the other checks (X-Release-Check)', () => {
    const overrides = { 'al-ummah-now-www': V2 };
    type Page = (url: URL, init: RequestInit | undefined, n: number) => Response | null | Promise<Response | null>;
    const env = (page: Page = () => null) => {
      const base = site();
      const seen: { url: string; check: string | null }[] = [];
      let n = 0;
      const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        seen.push({ url: String(input), check: new Headers(init?.headers).get('X-Release-Check') });
        return (url.pathname === '/healthz' ? null : await page(url, init, n++)) ?? base(input, init);
      }) as typeof fetch;
      return { fetchImpl, seen };
    };
    const isHome = (url: URL) => String(url) === `${e.www}/en/`;
    const bare = answers();
    const oldAnswer = (url: URL, init?: RequestInit) => bare(String(url), { ...init, headers: new Headers([...new Headers(init?.headers)].filter(([k]) => k !== 'x-release-check')) });
    const smoke = (h: { fetchImpl: typeof fetch }, c: ReturnType<typeof clock>, o: Record<string, string> | undefined = overrides) => runSmoke({ env: 'production', overrides: o, fetchImpl: h.fetchImpl, retryMs: 0, ...c });
    const result = (results: CheckResult[], name: string) => results.find((r) => r.name === name)!;

    it('asks www for its candidate and passes at once when it answers; the admin API is not asked', async () => {
      const c = clock();
      const h = env();
      expect((await smoke(h, c)).filter((r) => !r.ok)).toEqual([]);
      expect(c.now()).toBe(0);
      for (const { url, check } of h.seen.filter((x) => !x.url.endsWith('/healthz'))) expect(check, url).toBe(url.startsWith(e.vars.ADMIN_API_URL!) ? null : V2);
    });
    it('sends nothing and asks once without overrides', async () => {
      const c = clock();
      const h = env((url, init) => oldAnswer(url, init));
      expect((await smoke(h, c, {})).filter((r) => !r.ok)).toEqual([]);
      expect([c.now(), h.seen.every((x) => x.check === null)]).toEqual([0, true]);
    });
    it('an old version that would pass every check passes none, except production robots.txt with a warning', async () => {
      const c = clock();
      const results = await smoke(env((url, init) => oldAnswer(url, init)), c);
      expect(c.now()).toBe(VERSION_WAIT_MS);
      const robots = result(results, 'robots.txt');
      expect(robots).toMatchObject({ ok: true, detail: expect.stringContaining('WARNING: no proof that candidate') });
      const rest = results.filter((r) => r !== robots && r.name !== 'healthz');
      expect(rest.length).toBeGreaterThan(7);
      for (const r of rest) expect([r.ok, r.detail.startsWith(`not answered by candidate ${V2} of al-ummah-now-www (after 90 s; last answer, of another version:`)], `${r.name}: ${r.detail}`).toEqual([false, true]);
    });
    it('a check with two requests counts only when the candidate answered both', async () => {
      const c = clock();
      const h = env((url, init) => (url.pathname === '/.well-known/assetlinks.json' ? oldAnswer(url, init) : null));
      expect(result(await smoke(h, c), 'passkey domain files')).toMatchObject({ ok: false, detail: expect.stringContaining('not answered by candidate') });
      expect(c.now()).toBe(VERSION_WAIT_MS);
    });
    it('what an old version answers wrongly is asked again; what the candidate answers wrongly fails at once', async () => {
      const c = clock();
      let n = 0;
      const late = await smoke(env((url) => (isHome(url) && n++ < 2 ? new Response('', { status: 500 }) : null)), c);
      expect(late.filter((r) => !r.ok)).toEqual([]);
      expect(result(late, 'home en').detail).toContain('(after 10 s)');
      expect(c.now()).toBe(2 * VERSION_PAUSE_MS);
      const d = clock();
      const bad = await smoke(env((url) => (isHome(url) ? new Response('', { status: 503, headers: { 'X-Release-Check': 'ok' } }) : null)), d);
      expect([result(bad, 'home en').detail, d.now()]).toEqual(['status 503', 0]);
    });
    it('a failed connection fails at once, and only an exact ok is proof', async () => {
      const c = clock();
      const broken = await smoke(env((url) => { if (isHome(url)) throw new TypeError('fetch failed'); return null; }), c);
      expect([result(broken, 'home en').ok, result(broken, 'home en').detail, c.now()]).toEqual([false, 'fetch failed', 0]);
      for (const value of ['OK', V2, 'ok, ok']) {
        const r = await smoke(env(async (url, init) => { if (!isHome(url)) return null; const res = await oldAnswer(url, init); res.headers.set('X-Release-Check', value); return res; }), clock());
        expect(result(r, 'home en').detail, value).toContain('not answered by candidate');
      }
    });
    it('production robots.txt: a lost proof never fails, whatever is left of the 90 s; wrong content and stalls do', async () => {
      const GOOD = 'User-agent: *\nAllow: /\n\nSitemap: x';
      const run = async (used: number, ...robots: (string | null)[]) => {
        const c = clock();
        let asked = 0;
        const h = env((url, init) => {
          if (url.pathname === '/robots.txt') {
            const body = robots[Math.min(asked++, robots.length - 1)]!;
            if (body === null) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
            if (body === 'broken') throw new TypeError('fetch failed');
            return new Response(body);
          }
          return isHome(url) && c.now() < used ? oldAnswer(url, init) : null;
        });
        const results = await smoke(h, c);
        expect(result(results, 'home en').ok, `home within ${used} ms`).toBe(true);
        return { robots: result(results, 'robots.txt'), asked, end: c.now() };
      };
      for (const used of [0, 80_000, 85_000, VERSION_WAIT_MS]) {
        const lost = await run(used, GOOD);
        expect([lost.robots.ok, /WARNING: no proof/.test(lost.robots.detail), lost.end <= VERSION_WAIT_MS], `${used}: ${lost.robots.detail}`).toEqual([true, true, true]);
        expect((await run(used, GOOD, null)).robots.ok, `${used}, then stalls`).toBe(true);
        expect((await run(used, 'no sitemap')).robots, `${used}`).toMatchObject({ ok: false, detail: expect.stringContaining('no sitemap line') });
        expect((await run(used, null)).robots, `${used}`).toMatchObject({ ok: false, detail: expect.stringContaining('no answer in time') });
      }
      expect((await run(0, GOOD, 'broken')).robots.ok).toBe(true);
      expect((await run(0, 'broken')).robots).toMatchObject({ ok: false, detail: 'fetch failed' });
      expect([(await run(0, GOOD)).asked, (await run(VERSION_WAIT_MS, GOOD)).asked]).toEqual([3, 1]);
    });
    it('an admin API that does not answer fails the site theme at once', async () => {
      const c = clock();
      const r = await smoke(env((url) => (url.pathname === '/public/site-theme' ? new Response('', { status: 503 }) : null)), c);
      expect([result(r, 'site theme').ok, result(r, 'site theme').detail, c.now()]).toEqual([false, `${e.vars.ADMIN_API_URL}/public/site-theme: status 503`, 0]);
    });
    it('stage requires the proof of robots.txt too', async () => {
      const r = await runSmoke({ env: 'stage', overrides: { [ENVIRONMENTS.stage.worker]: V2 }, retryMs: 0, ...clock(), fetchImpl: (async (input: RequestInfo | URL) => (String(input).endsWith('/robots.txt') ? new Response('User-agent: *\nDisallow: /\n') : new Response('', { status: 500, headers: { 'X-Release-Check': 'ok' } }))) as typeof fetch });
      expect(result(r, 'robots.txt')).toMatchObject({ ok: false, detail: expect.stringContaining('not answered by candidate') });
    });
    it('the Worker entry answers through withReleaseCheck, last, and every env binds the version', () => {
      const worker = readFileSync(new URL('../../src/worker.ts', import.meta.url), 'utf8');
      expect(worker).toMatch(/export default \{\n {2}\/\/ [^\n]+\n {2}fetch: async \(request: Request, env: WwwEnv, ctx: ExecutionContext\): Promise<Response> => withReleaseCheck\(request, env, await site\.fetch\(request, env, ctx\)\),\n/);
      const config = parseJsonc(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8')) as { version_metadata?: object; env: Record<string, { version_metadata?: object }> };
      for (const block of [config, config.env.stage, config.env.qa]) expect(block!.version_metadata).toEqual({ binding: 'CF_VERSION_METADATA' });
    });
  });
  it('gives every request a timeout, and one that stalls in any other check is a failure', async () => {
    const signals: unknown[] = [];
    const base = site();
    const results = await runSmoke({
      env: 'production',
      overrides: { 'al-ummah-now-www': V2 },
      requestTimeoutMs: 30,
      retryMs: 0,
      ...clock(),
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init?.signal);
        if (String(input).endsWith('/healthz')) return base(input, init);
        return new Promise((_, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason as Error)));
      }) as typeof fetch,
    });
    expect(signals.length).toBeGreaterThan(5);
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
    expect(healthz(results).ok).toBe(true);
    for (const r of results.filter((x) => x.name !== 'healthz')) expect([r.ok, /no answer in time/.test(r.detail)], `${r.name}: ${r.detail}`).toEqual([false, true]);
  });
  it.each(['/headers', '/body'])('a stalled answer (%s) is not yet while the candidate is waited for, and a failure otherwise', async (path) => {
    await stalling(async (url) => {
      const base = site();
      const run = async (overrides?: Record<string, string>) => {
        let n = 0;
        const results = await runSmoke({
          env: 'production',
          overrides,
          requestTimeoutMs: 50,
          retryMs: 0,
          sleep: async () => {},
          fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) =>
            String(input).endsWith('/healthz') && n++ === 0 ? fetch(url + path, init) : base(input, init)) as typeof fetch,
        });
        return { health: healthz(results), asked: n };
      };
      expect(await run({ 'al-ummah-now-www': V2 })).toMatchObject({ health: { ok: true }, asked: 2 });
      expect(await run()).toMatchObject({ health: { ok: false, detail: expect.stringMatching(/timeout/i) } });
    });
  });
  it('never waits past the deadline when every answer stalls', async () => {
    const c = clock();
    let t = 0;
    const timeouts: number[] = [];
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => (timeouts.push(ms), new AbortController().signal));
    const base = site();
    const results = await runSmoke({
      env: 'production',
      overrides: { 'al-ummah-now-www': V2 },
      retryMs: 0,
      now: () => c.now() + t,
      sleep: c.sleep,
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) !== `${e.www}/healthz`) return base(input, init);
        t += timeouts.at(-1)!;
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      }) as typeof fetch,
    });
    expect(healthz(results)).toMatchObject({ ok: false, detail: `no answer in time, expected candidate ${V2} (after 90 s)` });
    expect(c.now() + t).toBe(VERSION_WAIT_MS);
    expect(Math.max(...timeouts)).toBe(REQUEST_TIMEOUT_MS);
  });
  describe.each(['stage', 'production'] as const)('the version that answers on %s', (env) => {
    const worker = ENVIRONMENTS[env].worker;
    const overrides = { [worker]: V2 };
    /** /healthz answers with these in turn (the last one from then on); the other checks are not under test. */
    const answering = (...answers: (() => Response)[]) => {
      let n = 0;
      const fetchImpl = (async (input: RequestInfo | URL) =>
        String(input) === `${ENVIRONMENTS[env].www}/healthz` ? answers[Math.min(n++, answers.length - 1)]!() : new Response('', { status: 500, headers: { 'X-Release-Check': 'ok' } })) as typeof fetch;
      return { fetchImpl, asked: () => n };
    };
    const says = (version: string | null, over: object = {}, status = 200) => () =>
      Response.json({ ok: true, version, env: ENVIRONMENTS[env].vars.APP_ENV, cms: 'ok', ...over }, { status });
    const smoke = async (h: { fetchImpl: typeof fetch }, c: ReturnType<typeof clock>, o: Record<string, string> | undefined = overrides) =>
      healthz(await runSmoke({ env, overrides: o, fetchImpl: h.fetchImpl, retryMs: 0, ...c }));

    it('fails when the candidate never answers, after waiting as long as allowed and no longer', async () => {
      const c = clock();
      expect(await smoke(answering(says(V1)), c)).toMatchObject({ ok: false, detail: `served by ${V1}, expected candidate ${V2} (after 90 s)` });
      expect(c.now()).toBe(VERSION_WAIT_MS);
    });
    it('waits for the candidate while an edge location still answers with the version before', async () => {
      const c = clock();
      const h = answering(says(V1), says(null), says(V2));
      expect(await smoke(h, c)).toMatchObject({ ok: true, detail: expect.stringContaining(`version ${V2} (after ${(2 * VERSION_PAUSE_MS) / 1000} s), cms ok`) });
      expect([h.asked(), c.now()]).toEqual([3, 2 * VERSION_PAUSE_MS]);
    });
    it('does not wait for an error, a status, an unhealthy answer or another environment, not even between tries', async () => {
      const bad: [string, () => Response, RegExp][] = [
        ['status', says(V2, {}, 500), /status 500/],
        ['unhealthy', says(V2, { ok: false }), /ok is not true/],
        ['unhealthy, old version', says(V1, { ok: false }), /ok is not true/],
        ['environment', says(V2, { env: 'qa' }), /env qa/],
        ['not JSON', () => new Response('<html>'), /./],
        ['network', () => { throw new TypeError('fetch failed'); }, /fetch failed/],
      ];
      for (const [name, answer, detail] of bad) {
        const first = clock();
        const a = answering(answer, says(V2));
        const atOnce = await smoke(a, first);
        expect([atOnce.ok, a.asked(), first.now()], name).toEqual([false, 1, 0]);
        expect(atOnce.detail, name).toMatch(detail);
        const later = clock();
        const b = answering(says(V1), answer, says(V2));
        const afterOne = await smoke(b, later);
        expect([afterOne.ok, b.asked(), later.now()], name).toEqual([false, 2, VERSION_PAUSE_MS]);
        expect(afterOne.detail, name).toMatch(detail);
      }
    });
    it('asks once without overrides (after the promotion waitForWwwVersion reads the version)', async () => {
      const c = clock();
      const h = answering(says(V1));
      expect(healthz(await runSmoke({ env, fetchImpl: h.fetchImpl, retryMs: 0, ...c }))).toMatchObject({ ok: true, detail: expect.stringContaining(`version ${V1}, cms ok`) });
      expect([h.asked(), c.now()]).toEqual([1, 0]);
    });
    it('promotes only when the candidate itself answered the pre-traffic smoke', async () => {
      const release = async (version: string) => {
        const calls: string[][] = [];
        const deps: PromoteDeps = {
          run: (_cwd, args) => {
            calls.push(args);
            if (args[0] === 'deployments') return JSON.stringify({ versions: [{ version_id: V1, percentage: 100 }] });
            return args[1] === 'upload' ? `Worker Version ID: ${V2}` : 'ok';
          },
          smoke: async (_env, o) => [healthz(await runSmoke({ env, overrides: o, fetchImpl: answering(says(version)).fetchImpl, retryMs: 0, ...clock() }))],
          waitForVersion: async () => undefined,
          log: () => undefined,
        };
        return { calls, done: await promote(releaseApp('/repo', env), env, 'r', deps).catch((e: Error) => e) };
      };
      const stale = await release(V1);
      expect(stale.done).toMatchObject({ rolledBack: true, message: expect.stringContaining(`expected candidate ${V2}`) });
      expect(stale.calls.some((c) => c.includes(`${V2}@100%`))).toBe(false);
      const fresh = await release(V2);
      expect(fresh.done).toMatchObject({ candidate: V2 });
      expect(fresh.calls.some((c) => c.includes(`${V2}@100%`))).toBe(true);
    });
  });
  it('checks www renders the theme the admin chose', async () => {
    const ok = await runSmoke({ env: 'production', fetchImpl: site(), retryMs: 0 });
    expect(ok.find((r) => r.name === 'site theme')).toMatchObject({ ok: true, detail: 'data-theme lantern' });
    const wrong = await runSmoke({
      env: 'production',
      retryMs: 0,
      fetchImpl: site({ '/public/site-theme': () => new Response(JSON.stringify({ theme: 'nahas' }), { status: 200 }) }),
    });
    expect(wrong.find((r) => r.name === 'site theme')).toMatchObject({ ok: false, detail: 'renders lantern, the admin chose nahas' });
  });
  it('says why a request failed, not only that it did', async () => {
    const reset = new TypeError('fetch failed', { cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }) });
    const answer = site();
    const results = await runSmoke({ env: 'production', retryMs: 0, fetchImpl: (async (url: string, init?: RequestInit) => (String(url).includes('/ar/news/') ? Promise.reject(reset) : answer(url, init))) as typeof fetch });
    expect(results.find((r) => r.name === 'news → articles')).toEqual({ name: 'news → articles', ok: false, detail: 'fetch failed (UND_ERR_SOCKET other side closed)' });
    const both = new TypeError('fetch failed', { cause: new AggregateError([Object.assign(new Error('a'), { code: 'ECONNREFUSED' }), Object.assign(new Error('b'), { code: 'ETIMEDOUT' })]) });
    expect(reason(both)).toBe('fetch failed (ECONNREFUSED a; ETIMEDOUT b)');
    expect(reason(new Error('status 500'))).toBe('status 500');
    expect(reason('odd')).toBe('odd');
  });
  it('fails when the apex does not redirect', async () => {
    const results = await runSmoke({ env: 'production', fetchImpl: site({ 'https://alummahnow.net': () => new Response('hi', { status: 200 }) }) });
    expect(results.find((r) => r.name === 'apex → www')?.ok).toBe(false);
  });
});
