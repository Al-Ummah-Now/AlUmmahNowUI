/**
 * Stage-then-promote (modelled on AlUmmahNowAuth scripts/release/promote.ts):
 * upload the already-built dist/ as a new version, give it 0% traffic, smoke it
 * through Cloudflare-Workers-Version-Overrides, move 100%, smoke again, and roll
 * back automatically if anything fails. Writes release-result.json.
 *
 *   node --experimental-strip-types scripts/release/promote.ts --env stage|production [--message <text>]
 *
 * Expects `astro build` output in dist/ (the build job's artifact).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ENVIRONMENTS, parseEnvArg, type EnvName } from '../environments.ts';
import { runSmoke, type CheckResult } from './smoke.ts';

export type ReleaseEnv = Extract<EnvName, 'stage' | 'production'>;

export interface ReleaseApp {
  worker: string;
  cwd: string;
  configArgs: string[];
}

export function releaseApp(root: string, env: ReleaseEnv): ReleaseApp {
  return { worker: ENVIRONMENTS[env].worker, cwd: root, configArgs: ['-c', 'wrangler.jsonc', ...ENVIRONMENTS[env].envArgs] };
}

/** "Worker Version ID: <uuid>" (versions upload) or "Current Version ID: <uuid>" (deploy). */
export function parseVersionId(output: string): string {
  const match = output.match(/(?:Worker|Current) Version ID:\s*([0-9a-f-]{36})/i);
  if (!match?.[1]) throw new Error(`could not find the version id in wrangler output:\n${output.slice(-500)}`);
  return match[1];
}

/** The single version serving 100% (refuses to promote over an unfinished split). */
export function currentVersion(statusJson: string, worker: string): string {
  const status = JSON.parse(statusJson) as { versions: { version_id: string; percentage: number }[] };
  const full = status.versions.filter((v) => v.percentage === 100);
  if (status.versions.length !== 1 || full.length !== 1) {
    const split = status.versions.map((v) => `${v.version_id}@${v.percentage}%`).join(', ');
    throw new Error(`${worker} has a split deployment (${split}); finish or roll it back before releasing`);
  }
  return full[0]!.version_id;
}

export type Runner = (cwd: string, args: string[]) => string;

const runWrangler: Runner = (cwd, args) =>
  execFileSync('npx', ['wrangler', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });

export interface Released {
  worker: string;
  /** null on the very first deploy (nothing to roll back to) */
  previous: string | null;
  candidate: string;
}

export interface PromoteDeps {
  run: Runner;
  smoke: (env: ReleaseEnv, overrides?: Record<string, string>) => Promise<CheckResult[]>;
  waitForVersion: (env: ReleaseEnv, worker: string, version: string, override: boolean) => Promise<void>;
  log: (line: string) => void;
  /** waits between retries (tests pass a no-op) */
  sleep?: (ms: number) => Promise<void>;
}

export class ReleaseError extends Error {
  readonly released: Released | null;
  readonly rolledBack: boolean;
  constructor(message: string, released: Released | null, rolledBack: boolean) {
    super(message);
    this.released = released;
    this.rolledBack = rolledBack;
  }
}

/** Cloudflare can answer "version could not be found" (code 100146) for a version it accepted seconds earlier. */
export const isUnknownVersion = (error: unknown): boolean => /code: 100146|Worker version could not be found/i.test(String((error as Error)?.message ?? error));

/** `wrangler versions deploy`, retried only while Cloudflare does not see a just-uploaded version yet. */
export async function deployVersions(app: ReleaseApp, specs: string[], message: string, deps: Pick<PromoteDeps, 'run' | 'log' | 'sleep'>, delaysMs = [5_000, 10_000, 20_000, 30_000]): Promise<void> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      deps.run(app.cwd, ['versions', 'deploy', ...specs, ...app.configArgs, '-y', '--message', message]);
      return;
    } catch (error) {
      const delay = delaysMs[attempt];
      if (!isUnknownVersion(error) || delay === undefined) throw error;
      deps.log(`${app.worker}: Cloudflare does not see ${specs[0]} yet; retrying in ${delay / 1000}s`);
      await sleep(delay);
    }
  }
}

const failures = (results: CheckResult[]) => results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.detail}`);

export async function promote(app: ReleaseApp, env: ReleaseEnv, message: string, deps: PromoteDeps): Promise<Released> {
  const { run, log } = deps;
  // 1. What serves now (rollback target), then upload the candidate (no traffic yet)
  let previous: string | null = null;
  try {
    previous = currentVersion(run(app.cwd, ['deployments', 'status', '--json', ...app.configArgs]), app.worker);
  } catch (error) {
    if (/split deployment/.test((error as Error).message)) throw error;
    log(`${app.worker}: no current deployment found (first deploy?)`);
  }
  if (!previous) {
    // First deploy: `versions upload` needs an existing Worker, and there is no traffic to protect
    const candidate = parseVersionId(run(app.cwd, ['deploy', ...app.configArgs, '--message', message]));
    const released: Released = { worker: app.worker, previous, candidate };
    log(`${app.worker}: first deploy ${candidate}`);
    try {
      await deps.waitForVersion(env, app.worker, candidate, false);
      const post = failures(await deps.smoke(env));
      if (post.length) throw new Error(`smoke failed after the first deploy: ${post.join('; ')}`);
    } catch (error) {
      throw new ReleaseError((error as Error).message, released, false);
    }
    return released;
  }
  const serving: string = previous;
  const candidate = parseVersionId(run(app.cwd, ['versions', 'upload', ...app.configArgs, '--message', message]));
  const released: Released = { worker: app.worker, previous: serving, candidate };
  log(`${app.worker}: uploaded ${candidate} (serving ${serving})`);

  const rollback = (reason: string) => {
    log(`Rolling back: ${reason}`);
    try {
      run(app.cwd, ['rollback', serving, ...app.configArgs, '-y', '--message', `auto-rollback: ${reason}`.slice(0, 100)]);
      log(`${app.worker}: rolled back to ${serving}`);
    } catch (error) {
      throw new ReleaseError(`ROLLBACK FAILED, fix by hand (npm run release:rollback): ${(error as Error).message}`, released, false);
    }
  };

  // 2. Candidate at 0%: reachable only through the override header
  try {
    await deployVersions(app, [`${candidate}@0%`, `${serving}@100%`], `${message} (0%)`, deps);
    await deps.waitForVersion(env, app.worker, candidate, true);
    const pre = failures(await deps.smoke(env, { [app.worker]: candidate }));
    if (pre.length) throw new Error(`pre-traffic smoke failed: ${pre.join('; ')}`);
    log('Pre-traffic smoke passed on the candidate');
  } catch (error) {
    rollback((error as Error).message);
    throw new ReleaseError((error as Error).message, released, true);
  }

  // 3. 100% traffic (custom domains are attached by triggers deploy), then the smoke a visitor would see
  try {
    await deployVersions(app, [`${candidate}@100%`], message, deps);
    run(app.cwd, ['triggers', 'deploy', ...app.configArgs]);
    await deps.waitForVersion(env, app.worker, candidate, false);
    const post = failures(await deps.smoke(env));
    if (post.length) throw new Error(`post-promote smoke failed: ${post.join('; ')}`);
    log('Promoted; smoke passed');
  } catch (error) {
    rollback((error as Error).message);
    throw new ReleaseError((error as Error).message, released, true);
  }
  return released;
}

/** Polls /healthz until the given version answers (deployments take a few seconds to propagate). */
export async function waitForWwwVersion(env: ReleaseEnv, worker: string, version: string, override: boolean, timeoutMs = 90_000): Promise<void> {
  const headers: Record<string, string> = { 'User-Agent': 'al-ummah-now-www-release' };
  if (override) headers['Cloudflare-Workers-Version-Overrides'] = `${worker}="${version}"`;
  const deadline = Date.now() + timeoutMs;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${ENVIRONMENTS[env].www}/healthz`, { headers });
      const body = (await res.json()) as { version?: string | null };
      if (body.version === version) return;
      last = `version ${body.version}`;
    } catch (error) {
      last = (error as Error).message;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`${worker} did not serve ${version} within ${timeoutMs / 1000}s (last: ${last})`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const argv = process.argv.slice(2);
  const env = parseEnvArg(argv, ['stage', 'production']) as ReleaseEnv;
  const message = argv.includes('--message') ? (argv[argv.indexOf('--message') + 1] ?? 'release') : `release ${process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'}`;
  const root = resolve(new URL('../..', import.meta.url).pathname);
  if (!existsSync(join(root, 'dist/_worker.js/index.js'))) {
    process.stderr.write('dist/ is missing: run `npm run build` (or download the build artifact) first\n');
    process.exit(2);
  }
  const log = (line: string) => process.stdout.write(`${line}\n`);
  const writeResult = (result: object) => writeFileSync(join(root, 'release-result.json'), JSON.stringify(result, null, 2));
  try {
    const released = await promote(releaseApp(root, env), env, message, {
      run: runWrangler,
      smoke: (e, overrides) => runSmoke({ env: e, overrides }),
      waitForVersion: waitForWwwVersion,
      log,
    });
    writeResult({ env, status: 'promoted', released: [released] });
  } catch (error) {
    const released = error instanceof ReleaseError && error.released ? [error.released] : [];
    const rolledBack = error instanceof ReleaseError && error.rolledBack;
    writeResult({ env, status: rolledBack ? 'rolled-back' : 'failed', error: (error as Error).message, released });
    process.stderr.write(`Release failed: ${(error as Error).message}\n`);
    process.exit(1);
  }
}
