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
import { deliveryNarrow, deliveryWide } from '../src/lib/diagrams/delivery.ts';
import { dataNarrow, dataWide } from '../src/lib/diagrams/data.ts';
import { asyncNarrow, asyncWide } from '../src/lib/diagrams/async.ts';
import { realtimeNarrow, realtimeWide } from '../src/lib/diagrams/realtime.ts';
import { identityNarrow, identityWide } from '../src/lib/diagrams/identity.ts';
import { aiNarrow, aiWide } from '../src/lib/diagrams/ai.ts';
import { costNarrow, costWide } from '../src/lib/diagrams/cost.ts';
import { scalingNarrow, scalingWide } from '../src/lib/diagrams/scaling.ts';
import { clientsNarrow, clientsWide } from '../src/lib/diagrams/clients.ts';
import { releaseNarrow, releaseWide } from '../src/lib/diagrams/release.ts';

const here = (p: string) => resolve(dirname(fileURLToPath(import.meta.url)), p);
function dirname(p: string) {
  return p.slice(0, Math.max(p.lastIndexOf('/'), 0));
}

/** Latin technical tokens (360p, R2, /priv/*, whisper-large-v3-turbo…) may keep 0-9; Arabic prose may not. */
const stripLatinTokens = (s: string): string => {
  // Latin technical tokens ('R2', 'whisper-large-v3-turbo', 'Gemma 4 26B', 'pub/<id>/<rev>/') may keep
  // 0-9; Arabic prose may not. A run of space-separated token words drops only when it holds a Latin letter.
  const words = s.replace(/[\u200e\u200f]/g, '').split(' ');
  const tokenWord = (w: string): boolean => {
    if (/^[A-Za-z0-9:./_<>#…*&()+-]+$/.test(w)) return true;
    // an attached Arabic particle (و/ب/ل…) before a Latin token, like و480p
    const m = /^[\u0600-\u06FF]{1,2}([A-Za-z0-9:./_<>#…*&()+-]+)$/.exec(w);
    return !!m && /[A-Za-z]/.test(m[1]!);
  };
  const out: string[] = [];
  let group: string[] = [];
  for (const w of words) {
    if (tokenWord(w)) group.push(w);
    else {
      if (group.length) {
        out.push(group.some((g) => /[A-Za-z]/.test(g)) ? '' : group.join(' '));
        group = [];
      }
      out.push(w);
    }
  }
  if (group.length) out.push(group.some((g) => /[A-Za-z]/.test(g)) ? '' : group.join(' '));
  return out.join(' ');
};

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
      const stages = [
        ...t.videoPipeline.stages,
        ...t.systemDesign.zones,
        ...Object.values(t.systemDesignPages).flatMap((page) => page.stages),
      ];
      for (const item of stages) {
        expect(item.feature === undefined || ids.has(item.feature), item.feature ?? '(none)').toBe(true);
      }
    }
  });

  it('Arabic prose uses ٠-٩; Latin tokens alone keep 0-9', () => {
    const walk = (v: unknown, path = ''): [string, string][] =>
      typeof v === 'string' ? [[path, v]] : Array.isArray(v) ? v.flatMap((x, i) => walk(x, `${path}[${i}]`)) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => walk(x, `${path}.${k}`)) : [];
    const pagesAr = Object.values(ar.systemDesignPages);
    for (const [path, value] of walk(ar.systemDesign).concat(walk(ar.videoPipeline), pagesAr.flatMap((page) => walk(page)))) {
      expect(stripLatinTokens(value), path).not.toMatch(/[0-9]/);
    }
  });

  it('the diagrams name the real components and keep every box inside the canvas', () => {
    const KEY: Record<string, keyof typeof en.systemDesignPages> = { delivery: 'deliveryCaching', async: 'asyncWork', data: 'data', realtime: 'realtime', identity: 'identity', ai: 'ai', cost: 'cost', scaling: 'scaling', clients: 'clients', release: 'release' };
    const labelsFor = (name: string) => (name.startsWith('overview') ? en.systemDesign.diagram : name.startsWith('pipeline') ? en.videoPipeline.diagram : en.systemDesignPages[KEY[name.replace(/(Wide|Narrow)$/, '')]!].diagram);
    for (const build of [overviewWide, overviewNarrow, deliveryWide, deliveryNarrow, dataWide, dataNarrow, asyncWide, asyncNarrow, realtimeWide, realtimeNarrow, identityWide, identityNarrow, aiWide, aiNarrow, costWide, costNarrow, scalingWide, scalingNarrow, clientsWide, clientsNarrow, releaseWide, releaseNarrow]) {
      const spec = build(labelsFor(build.name) as never);
      expect(spec.shapes.filter((s) => s.kind === 'node').length).toBeGreaterThanOrEqual(10);
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

  it('the hub indexes every subpage, in PAGES order, and no link dangles', () => {
    expect(en.systemDesign.pages.map((x) => x.href)).toEqual(ar.systemDesign.pages.map((x) => x.href));
    for (const page of en.systemDesign.pages) {
      const slug = `system-design/${page.href.replace(/\/$/, '')}` as (typeof PAGES)[number];
      expect(PAGES, page.href).toContain(slug);
    }
  });

  it('the pipeline keeps its story: tee, queue, container, both buckets, one play address', () => {
    const titles = pipelineWide(en.videoPipeline.diagram).shapes.filter((s): s is Extract<typeof s, { kind: 'node' }> => s.kind === 'node').map((s) => s.title);
    for (const part of ['TUS', 'Bunny Stream', 'R2', 'api-videos']) expect(titles.join('|')).toContain(part);
  });
});
