import { describe, expect, it } from 'vitest';
import { checkWranglerConfig } from '../check-wrangler-config.ts';
import { ENVIRONMENTS, parseEnvArg } from '../environments.ts';
import { parseJsonc } from '../jsonc.ts';
import { evaluateSecrets } from '../release/check-secrets.ts';
import { currentVersion, parseVersionId, promote, releaseApp, type PromoteDeps } from '../release/promote.ts';
import { parseRollbackArgs, previousFromResult, rollbackArgv, rollbackTarget } from '../release/rollback.ts';
import { overrideHeader, runSmoke } from '../release/smoke.ts';
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

  it('uploads, 0% + override smoke, 100%, triggers, smoke', async () => {
    const { deps, calls } = fakeDeps({});
    expect(await promote(app, 'production', 'release abc', deps)).toEqual({ worker: 'al-ummah-now-www', previous: V1, candidate: V2 });
    expect(calls.map((c) => c.slice(0, 3).join(' '))).toEqual([
      'deployments status --json',
      'versions upload -c',
      `versions deploy ${V2}@0%`,
      `versions deploy ${V2}@100%`,
      'triggers deploy -c',
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

describe('smoke', () => {
  const e = ENVIRONMENTS.production;
  function site(overrides: Partial<Record<string, () => Response>> = {}): typeof fetch {
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
  it('fails when the apex does not redirect', async () => {
    const results = await runSmoke({ env: 'production', fetchImpl: site({ 'https://alummahnow.net': () => new Response('hi', { status: 200 }) }) });
    expect(results.find((r) => r.name === 'apex → www')?.ok).toBe(false);
  });
});
