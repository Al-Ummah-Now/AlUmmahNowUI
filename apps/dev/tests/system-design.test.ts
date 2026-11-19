/**
 * The System design section (wiki AUN-DEV-SITE): statuses only from the registry, Arabic copy in
 * Eastern Arabic numerals outside Latin technical tokens, and every declared page built for both
 * languages.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en.ts';
import { ar } from '../src/i18n/ar.ts';
import { FEATURES } from '../src/lib/registry.ts';
import { LOCALES, PAGES, pagePath } from '../src/lib/pages.ts';
import { overviewNarrow, overviewWide } from '../src/lib/diagrams/overview.ts';
import { pipelineNarrow, pipelineWide } from '../src/lib/diagrams/pipeline.ts';

const here = (p: string) => resolve(dirname(fileURLToPath(import.meta.url)), p);
function dirname(p: string) {
  return p.slice(0, Math.max(p.lastIndexOf('/'), 0));
}

/** Latin technical tokens (360p, R2, /priv/*, whisper-large-v3-turbo…) may keep 0-9; Arabic prose may not. */
const stripLatinTokens = (s: string) => s.replace(/[A-Za-z0-9./_<>#-]*[A-Za-z][A-Za-z0-9./_<>#-]*/g, '');

describe('system design section', () => {
  it('every declared page has a source file, so PAGES can never name a missing route', () => {
    for (const slug of PAGES) {
      const base = slug === '' ? '' : `${slug}/`;
      expect(existsSync(here(`../src/pages/[lang]/${base}index.astro`)), `${slug} index`).toBe(true);
    }
  });

  it('every page exists in both languages on disk paths PAGES derives', () => {
    for (const slug of PAGES) for (const l of LOCALES) expect(pagePath(l, slug)).toMatch(/^\/(en|ar)\//);
  });

  it('each item that names a feature names one the registry holds', () => {
    const ids = new Set(FEATURES.map((f) => f.id));
    for (const t of [en, ar]) {
      for (const item of [...t.videoPipeline.stages, ...t.systemDesign.zones]) {
        expect(item.feature === undefined || ids.has(item.feature), item.feature ?? '(none)').toBe(true);
      }
    }
  });

  it('Arabic prose uses ٠-٩; Latin tokens alone keep 0-9', () => {
    const walk = (v: unknown, path = ''): [string, string][] =>
      typeof v === 'string' ? [[path, v]] : Array.isArray(v) ? v.flatMap((x, i) => walk(x, `${path}[${i}]`)) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => walk(x, `${path}.${k}`)) : [];
    for (const [path, value] of walk(ar.systemDesign).concat(walk(ar.videoPipeline))) {
      expect(stripLatinTokens(value), path).not.toMatch(/[0-9]/);
    }
  });

  it('the diagrams name the real components and keep every box inside the canvas', () => {
    for (const build of [overviewWide, overviewNarrow]) {
      const spec = build(en.systemDesign.diagram);
      expect(spec.shapes.filter((s) => s.kind === 'node').length).toBeGreaterThan(10);
      for (const s of spec.shapes) {
        if (s.kind === 'node' || s.kind === 'zone') {
          expect(s.x, `${spec.id} ${s.id}`).toBeGreaterThanOrEqual(0);
          expect(s.y, `${spec.id} ${s.id}`).toBeGreaterThanOrEqual(0);
          expect(s.x + s.w, `${spec.id} ${s.id}`).toBeLessThanOrEqual(spec.width);
          expect(s.y + s.h, `${spec.id} ${s.id}`).toBeLessThanOrEqual(spec.height);
        }
        if (s.kind === 'node') expect(s.title.length, `${spec.id} ${s.id}`).toBeGreaterThan(0);
      }
    }
    const pipeline = pipelineWide(en.videoPipeline.diagram);
    expect(pipeline.shapes.filter((s) => s.kind === 'node').length).toBeGreaterThan(10);
    expect(pipelineNarrow(en.videoPipeline.diagram).width).toBeLessThan(pipeline.width);
  });

  it('the pipeline keeps its story: tee, queue, container, both buckets, one play address', () => {
    const titles = pipelineWide(en.videoPipeline.diagram).shapes.filter((s): s is Extract<typeof s, { kind: 'node' }> => s.kind === 'node').map((s) => s.title);
    for (const part of ['TUS', 'Bunny Stream', 'R2', 'api-videos']) expect(titles.join('|')).toContain(part);
  });
});
