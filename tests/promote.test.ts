import { describe, expect, it } from 'vitest';
import { promote, waitForWwwVersion, type PromoteDeps, type ReleaseApp } from '../scripts/release/promote.ts';

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
    smoke: async () => [],
    waitForVersion: async () => {},
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

describe('waitForWwwVersion: the edge must serve the candidate steadily', () => {
  const serving = (versions: string[]) => {
    let i = 0;
    const seen: string[] = [];
    const doFetch = (async () => {
      const v = versions[Math.min(i++, versions.length - 1)];
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
