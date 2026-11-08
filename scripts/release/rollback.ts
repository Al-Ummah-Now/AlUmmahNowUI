/**
 * One-command rollback: puts the www Worker back on the version it served before its
 * latest deployment (or --to <version-id>), then smokes.
 *
 *   npm run release:rollback -- --env production
 *   npm run release:rollback -- --env production --to <version-id>
 *   npm run release:rollback -- --env production --dry-run     # resolve the target, change nothing
 *   npm run release:rollback -- --env production --dry-run --from-result release-result.json
 *
 * With --from-result the target is the `previous` version recorded by promote.ts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENVIRONMENTS } from '../environments.ts';
import type { ReleaseEnv } from './promote.ts';
import { runSmoke } from './smoke.ts';

export interface RollbackArgs {
  env: ReleaseEnv;
  to?: string;
  fromResult?: string;
  reason: string;
  dryRun: boolean;
}

export function parseRollbackArgs(argv: string[]): RollbackArgs {
  const value = (flag: string) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const env = value('--env');
  if (env !== 'stage' && env !== 'production') throw new Error('--env stage|production is required');
  const to = value('--to');
  if (to && !/^[0-9a-f-]{36}$/.test(to)) throw new Error('--to must be a version id');
  return { env, to, fromResult: value('--from-result'), reason: value('--reason') ?? 'manual rollback', dryRun: argv.includes('--dry-run') };
}

interface Deployment {
  created_on: string;
  versions: { version_id: string; percentage: number }[];
}

const mainVersion = (d: Deployment) => [...d.versions].sort((a, b) => b.percentage - a.percentage)[0]?.version_id;

/**
 * From `wrangler deployments list --json`: the version serving now and the one to roll
 * back to (the main version of the most recent earlier deployment that served something else).
 */
export function rollbackTarget(deploymentsJson: string, worker: string, to?: string): { current: string; target: string } {
  const deployments = (JSON.parse(deploymentsJson) as Deployment[]).slice().sort((a, b) => a.created_on.localeCompare(b.created_on));
  const latest = deployments.at(-1);
  if (!latest) throw new Error(`${worker} has no deployments`);
  if (latest.versions.length !== 1 && !to) {
    const split = latest.versions.map((v) => `${v.version_id}@${v.percentage}%`).join(', ');
    throw new Error(`${worker} is mid-promote (${split}); pick the version with --to`);
  }
  const current = mainVersion(latest)!;
  if (to) return { current, target: to };
  for (let i = deployments.length - 2; i >= 0; i--) {
    const v = mainVersion(deployments[i]!);
    if (v && v !== current) return { current, target: v };
  }
  throw new Error(`${worker} has no earlier version to roll back to`);
}

/** `previous` from release-result.json for this env's worker, if recorded. */
export function previousFromResult(resultJson: string, env: ReleaseEnv): string | undefined {
  const result = JSON.parse(resultJson) as { env?: string; released?: { worker: string; previous: string | null }[] };
  if (result.env !== env) return undefined;
  return result.released?.find((r) => r.worker === ENVIRONMENTS[env].worker)?.previous ?? undefined;
}

export function rollbackArgv(env: ReleaseEnv, target: string, reason: string): string[] {
  return ['rollback', target, '--name', ENVIRONMENTS[env].worker, '-y', '--message', reason.slice(0, 100)];
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseRollbackArgs(process.argv.slice(2));
  const root = resolve(new URL('../..', import.meta.url).pathname);
  const worker = ENVIRONMENTS[args.env].worker;
  const wrangler = (argv: string[]) =>
    execFileSync('npx', ['wrangler', ...argv], { cwd: root, encoding: 'utf8', env: { ...process.env, CI: 'true' }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  try {
    let to = args.to;
    if (!to && args.fromResult && existsSync(args.fromResult)) to = previousFromResult(readFileSync(args.fromResult, 'utf8'), args.env);
    const { current, target } = rollbackTarget(wrangler(['deployments', 'list', '--json', '--name', worker]), worker, to);
    const argv = rollbackArgv(args.env, target, args.reason);
    if (args.dryRun) {
      process.stdout.write(`${worker}: DRY RUN, would roll back ${current} -> ${target} (wrangler ${argv.join(' ')})\nDry run: no traffic moved.\n`);
      process.exit(0);
    }
    wrangler(argv);
    process.stdout.write(`${worker}: ${current} -> ${target}\n`);
  } catch (error) {
    process.stderr.write(`${worker}: ROLLBACK FAILED: ${(error as { stderr?: string }).stderr ?? (error as Error).message}\n`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 15000));
  const results = await runSmoke({ env: args.env });
  for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}: ${r.detail}\n`);
  if (results.some((r) => !r.ok)) process.exit(1);
}
