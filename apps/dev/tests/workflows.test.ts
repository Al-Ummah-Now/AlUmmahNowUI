/**
 * The release workflow only runs on a tag, so a broken step there passes every PR's CI and fails
 * at release (v2026.11.14.8: `npm run registry` in www's job, and dev's checks before the registry
 * existed). This reads every workflow and checks, for each job, what the release would hit:
 *
 *  - every `npm run <script>` names a script of the package.json in the directory the step runs in
 *    (or of the workspace it passes with --workspace / -w);
 *  - every job that works in apps/dev produces the feature registry (`npm run registry`, or
 *    `npm run build`, which runs it first) before typecheck, unit tests or E2E need
 *    src/data/registry.json, which is git-ignored.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const WORKFLOWS = join(ROOT, '.github/workflows');

interface Step {
  name?: string;
  run?: string;
  'working-directory'?: string;
}
interface Job {
  name?: string;
  defaults?: { run?: { 'working-directory'?: string } };
  steps?: Step[];
}

const pkgCache = new Map<string, { name?: string; scripts?: Record<string, string> } | null>();
function pkg(dir: string) {
  if (!pkgCache.has(dir)) {
    const file = join(ROOT, dir, 'package.json');
    pkgCache.set(dir, existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);
  }
  return pkgCache.get(dir)!;
}

/** Workspace name → its directory, from the root package.json's workspaces. */
function workspaceDir(name: string): string | null {
  const globs: string[] = pkg('.')?.['workspaces' as never] ?? [];
  for (const g of globs) {
    const dirs = g.endsWith('/*') ? readdirSync(join(ROOT, g.slice(0, -2))).map((d) => `${g.slice(0, -2)}/${d}`) : [g];
    for (const d of dirs) if (pkg(d)?.name === name) return d;
  }
  return null;
}

/** `npm run [flags] <script> [-- args]` in a run block: the script and the --workspace it names, if any. */
export function npmRuns(run: string): { script: string; workspace: string | null }[] {
  const out: { script: string; workspace: string | null }[] = [];
  for (const m of run.matchAll(/\bnpm run\b([^\n;&|]*)/g)) {
    const tokens = m[1]!.trim().split(/\s+/).filter(Boolean);
    let script: string | null = null;
    let workspace: string | null = null;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (t === '--') break; // what follows goes to the script
      const ws = t.match(/^(?:--workspace|-w)(?:=(.+))?$/);
      if (ws) workspace = ws[1] ?? tokens[++i] ?? null;
      else if (!t.startsWith('-') && !script) script = t;
    }
    if (script) out.push({ script, workspace });
  }
  return out;
}

const workflows = readdirSync(WORKFLOWS)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ file: f, jobs: (parse(readFileSync(join(WORKFLOWS, f), 'utf8')) as { jobs?: Record<string, Job> }).jobs ?? {} }));

const NEEDS_REGISTRY = /\bnpm run(?:\s+-{1,2}[\w-]+)*\s+(typecheck|test|e2e)\b|\bnpx (?:playwright test|vitest|astro check)\b/;
const MAKES_REGISTRY = /\bnpm run(?:\s+-{1,2}[\w-]+)*\s+(registry|build)\b/;

describe('workflow steps match the code they run', () => {
  it('reads the workflows', () => {
    expect(workflows.map((w) => w.file)).toEqual(expect.arrayContaining(['ci.yml', 'release.yml', 'deploy-qa.yml', 'dev-registry.yml']));
  });

  for (const { file, jobs } of workflows) {
    for (const [id, job] of Object.entries(jobs)) {
      it(`${file} ${id}: every npm script exists where the step runs it`, () => {
        for (const step of job.steps ?? []) {
          if (!step.run) continue;
          const dir = step['working-directory'] ?? job.defaults?.run?.['working-directory'] ?? '.';
          for (const { script, workspace } of npmRuns(step.run)) {
            const where = workspace ? workspaceDir(workspace) : dir;
            expect(where, `${file} ${id} "${step.name ?? step.run}": workspace ${workspace} not found`).not.toBeNull();
            const scripts = pkg(where!)?.scripts ?? {};
            expect(Object.keys(scripts), `${file} ${id} "${step.name ?? step.run}": no "${script}" script in ${where}/package.json`).toContain(script);
          }
        }
      });

      const inDev = (s: Step) => (s['working-directory'] ?? job.defaults?.run?.['working-directory']) === 'apps/dev';
      if (!(job.steps ?? []).some((s) => s.run && inDev(s))) continue;
      it(`${file} ${id}: the feature registry exists before apps/dev's checks need it`, () => {
        let made = false;
        for (const step of job.steps ?? []) {
          if (!step.run || !inDev(step)) continue;
          // a step that both makes and needs it (`npm run build && npm test`) makes it first only if it says so first
          const need = step.run.search(NEEDS_REGISTRY);
          const make = step.run.search(MAKES_REGISTRY);
          if (need >= 0 && !made && (make < 0 || make > need)) {
            expect.fail(`${file} ${id} "${step.name ?? step.run}" needs src/data/registry.json before any step makes it (add \`npm run registry\` first)`);
          }
          if (make >= 0) made = true;
        }
      });
    }
  }
});

describe('npmRuns', () => {
  it('finds scripts with flags and workspaces', () => {
    expect(npmRuns('npm run -s registry && npm run --silent zone:check')).toEqual([
      { script: 'registry', workspace: null },
      { script: 'zone:check', workspace: null },
    ]);
    expect(npmRuns('npm run registry --workspace=al-ummah-now-www')).toEqual([{ script: 'registry', workspace: 'al-ummah-now-www' }]);
    expect(npmRuns('npm run release:smoke -- --env qa')).toEqual([{ script: 'release:smoke', workspace: null }]);
    expect(npmRuns('npm ci')).toEqual([]);
  });
});
