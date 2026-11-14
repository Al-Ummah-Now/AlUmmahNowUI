import { describe, expect, it } from 'vitest';
import { promote, waitForWwwHosts, waitForWwwVersion, type PromoteDeps, type ReleaseApp } from '../scripts/release/promote.ts';

const app: ReleaseApp = { worker: 'al-ummah-now-www-stage', cwd: '.', configArgs: ['-c', 'wrangler.jsonc', '--env', 'stage'] };
const CANDIDATE = '0ea73b06-7c5a-4061-af56-ddaabcfe1e60';
const SERVING = 'e62c5482-c227-428f-995f-46f1038c893a';
const unknownVersion = () =>
  new Error(`Command failed: npx wrangler versions deploy\n✘ [ERROR] A request to the Cloudflare API (/accounts/x/workers/scripts/w/versions/${CANDIDATE}) failed.\n  The requested Worker version could not be found, please check the ID being passed and try again. [code: 100146]`);

/** Fake wrangler: serving SERVING, upload returns CANDIDATE; `deployFailures` deploy calls throw first. */
function harness(deployFailures: (() => Error)[]) {
  const calls: string[][] = [];
  const logs: string[] = [];
  const sleeps: number[] = [];
  const failures = [...deployFailures];
  const deps: PromoteDeps = {
    run: (_cwd, args) => {
      calls.push(args);
      if (args[0] === 'deployments') return JSON.stringify({ versions: [{ version_id: SERVING, percentage: 100 }] });
      if (args[0] === 'versions' && args[1] === 'upload') return `Worker Version ID: ${CANDIDATE}`;
      if (args[0] === 'versions' && args[1] === 'deploy') {
        const next = failures.shift();
        if (next) throw next();
      }
      return '';
    },
    smoke: async (_env, overrides) => {
      calls.push(['<smoke>', overrides ? 'override' : 'plain']);
      return [];
    },
    waitForVersion: async () => {},
    waitForHosts: async () => void calls.push(['<waitForHosts>']),
    log: (l) => logs.push(l),
    sleep: async (ms) => void sleeps.push(ms),
  };
  return { deps, calls, logs, sleeps };
}

describe('promote: versions deploy right after upload', () => {
  it('retries while Cloudflare does not see the just-uploaded version yet, then promotes', async () => {
    const h = harness([unknownVersion, unknownVersion]);
    const released = await promote(app, 'stage', 'release 6970fe2', h.deps);
    expect(released).toEqual({ worker: app.worker, previous: SERVING, candidate: CANDIDATE });
    const deploys = h.calls.filter((a) => a[0] === 'versions' && a[1] === 'deploy');
    expect(deploys).toHaveLength(4); // 2 failed + 0% + 100%
    expect(deploys[2]!.slice(2, 4)).toEqual([`${CANDIDATE}@0%`, `${SERVING}@100%`]);
    expect(deploys[3]![2]).toBe(`${CANDIDATE}@100%`);
    expect(h.sleeps).toEqual([5_000, 10_000]);
    expect(h.calls.some((a) => a[0] === 'rollback')).toBe(false);
  });

  it('gives up after the retries and rolls back', async () => {
    const h = harness(Array(5).fill(unknownVersion));
    await expect(promote(app, 'stage', 'release x', h.deps)).rejects.toMatchObject({ rolledBack: true });
    expect(h.sleeps).toEqual([5_000, 10_000, 20_000, 30_000]);
    expect(h.calls.some((a) => a[0] === 'rollback')).toBe(true);
  });

  it('does not retry other wrangler errors', async () => {
    const h = harness([() => new Error('Command failed: authentication error [code: 10000]')]);
    await expect(promote(app, 'stage', 'release x', h.deps)).rejects.toMatchObject({ rolledBack: true });
    expect(h.sleeps).toEqual([]);
    expect(h.calls.filter((a) => a[0] === 'versions' && a[1] === 'deploy')).toHaveLength(1);
  });
});

describe('promote: routes and custom domains before the pre-traffic smoke', () => {
  it('attaches triggers and waits for the hosts before the 0% deploy and its smoke (2026-11-14: new stage apex)', async () => {
    const h = harness([]);
    await promote(app, 'stage', 'release x', h.deps);
    const at = (pred: (a: string[]) => boolean) => h.calls.findIndex(pred);
    const triggers = at((a) => a[0] === 'triggers' && a[1] === 'deploy');
    const hosts = at((a) => a[0] === '<waitForHosts>');
    const zero = at((a) => a[0] === 'versions' && a[1] === 'deploy' && a[2] === `${CANDIDATE}@0%`);
    const preSmoke = at((a) => a[0] === '<smoke>' && a[1] === 'override');
    expect(triggers).toBeGreaterThan(-1);
    expect(triggers).toBeLessThan(hosts);
    expect(hosts).toBeLessThan(zero);
    expect(zero).toBeLessThan(preSmoke);
    expect(h.calls.filter((a) => a[0] === 'triggers')).toHaveLength(1);
  });

  it('rolls back (and never moves traffic) when a host never answers', async () => {
    const h = harness([]);
    h.deps.waitForHosts = async () => {
      throw new Error('https://stage.alummahnow.net did not answer within 600s (last: fetch failed)');
    };
    await expect(promote(app, 'stage', 'release x', h.deps)).rejects.toMatchObject({ rolledBack: true });
    expect(h.calls.some((a) => a[0] === 'versions' && a[1] === 'deploy')).toBe(false);
  });
});

describe('waitForWwwHosts: a just-attached custom domain needs DNS and a certificate', () => {
  it('retries a host until it answers (any status), then checks the next', async () => {
    const seen: string[] = [];
    let apexFailures = 2;
    const doFetch = (async (url: string) => {
      seen.push(url);
      if (url.startsWith('https://stage.alummahnow.net') && apexFailures-- > 0) throw new TypeError('fetch failed');
      return new Response(null, { status: 301 });
    }) as unknown as typeof fetch;
    await waitForWwwHosts('stage', () => {}, 5_000, doFetch, 1);
    expect(seen).toEqual([
      'https://www.stage.alummahnow.net/healthz',
      'https://stage.alummahnow.net/healthz',
      'https://stage.alummahnow.net/healthz',
      'https://stage.alummahnow.net/healthz',
    ]);
  });

  it('fails with the host and the last error after the timeout', async () => {
    const doFetch = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(waitForWwwHosts('stage', () => {}, 20, doFetch, 5)).rejects.toThrow(/www\.stage\.alummahnow\.net did not answer .*fetch failed/);
  });
});

describe('waitForWwwVersion: the edge must serve the candidate steadily', () => {
  const serving = (versions: string[]) => {
    let i = 0;
    const seen: string[] = [];
    const doFetch = (async () => {
      const v = versions[Math.min(i++, versions.length - 1)] as string;
      seen.push(v);
      return new Response(JSON.stringify({ version: v }));
    }) as unknown as typeof fetch;
    return { doFetch, seen };
  };

  it('does not return on a single match that the edge then contradicts (the 2026-11-10 rollback)', async () => {
    const f = serving([CANDIDATE, SERVING, CANDIDATE, CANDIDATE, CANDIDATE]);
    await waitForWwwVersion('stage', app.worker, CANDIDATE, true, 5_000, 3, f.doFetch, 1);
    expect(f.seen).toEqual([CANDIDATE, SERVING, CANDIDATE, CANDIDATE, CANDIDATE]);
  });

  it('gives up with the last version seen when the candidate never holds', async () => {
    const f = serving([CANDIDATE, SERVING]);
    await expect(waitForWwwVersion('stage', app.worker, CANDIDATE, true, 50, 3, f.doFetch, 1)).rejects.toThrow(`last: version ${SERVING}`);
  });
});
