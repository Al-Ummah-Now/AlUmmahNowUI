/**
 * Guard: the site never uses browser prompts (owner rule). ESLint covers scripts; this also
 * covers Astro templates and inline on*="" attributes, which ESLint does not parse.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');
const FORBIDDEN = [/(?<![\w.$-])(?:window\.)?(?:alert|confirm|prompt)\s*\(/, /beforeunload/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(astro|ts|tsx|js|mjs|html)$/.test(name) ? [path] : [];
  });
}

describe('no browser prompts', () => {
  it('src has no alert/confirm/prompt calls or beforeunload handlers', () => {
    const offenders = files(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => (FORBIDDEN.some((re) => re.test(line)) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  it('the header ships the in-app confirmation dialog', () => {
    const header = readFileSync(join(SRC, 'components', 'Header.astro'), 'utf8');
    expect(header).toMatch(/<dialog class="confirm-dialog" id="confirm-dialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-body">/);
  });
});
