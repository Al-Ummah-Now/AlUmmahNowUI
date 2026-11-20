import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDist, expectedFiles } from '../scripts/check-dist.ts';
import { SYSTEM_DESIGN } from '../src/lib/pages.ts';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function dist(skip: string[] = []) {
  const d = mkdtempSync(join(tmpdir(), 'dev-dist-'));
  dirs.push(d);
  for (const { file, html } of expectedFiles()) {
    if (skip.includes(file)) continue;
    mkdirSync(dirname(join(d, file)), { recursive: true });
    writeFileSync(join(d, file), html ? `<!doctype html>${html}><head></head></html>` : 'not found');
  }
  return d;
}

describe('check-dist', () => {
  it('expects every system design page in en and ar', () => {
    const files = expectedFiles().map((f) => f.file);
    for (const page of SYSTEM_DESIGN) {
      expect(files).toContain(`en/${page}/index.html`);
      expect(files).toContain(`ar/${page}/index.html`);
    }
    expect(files).toContain('404.html');
  });

  it('passes a complete dist', () => {
    expect(checkDist(dist())).toEqual([]);
  });

  it('names a missing page', () => {
    expect(checkDist(dist(['en/system-design/clients/index.html']))).toEqual(['missing en/system-design/clients/index.html']);
  });
});
