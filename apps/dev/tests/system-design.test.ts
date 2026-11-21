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
import { DIAGRAMS, diagram } from '../src/lib/arch/all.ts';
import { pipeline } from '../src/lib/arch/specs/pipeline.ts';

const here = (p: string) => resolve(dirname(fileURLToPath(import.meta.url)), p);
function dirname(p: string) {
  return p.slice(0, Math.max(p.lastIndexOf('/'), 0));
}

/** Latin technical tokens (360p, R2, /priv/*, whisper-large-v3-turbo…) may keep 0-9; Arabic prose may not. */
const stripLatinTokens = (s: string): string => {
  // Latin technical tokens ('R2', 'whisper-large-v3-turbo', 'Gemma 4 26B', 'pub/<id>/<rev>/') may keep
  // 0-9; Arabic prose may not. A run of space-separated token words drops only when it holds a Latin letter.
  const words = s.replace(/[\u200e\u200f]/g, '').split(' ');
  const tokenWord = (w0: string): boolean => {
    // trailing Arabic punctuation (؟ ، ؛) belongs to the sentence, not the token
    const w = w0.replace(/[\u061F\u060C\u061B]+$/, '');
    if (/^[A-Za-z0-9:./_<>#…*&()+–-]+$/.test(w)) return true;
    // an attached Arabic particle (و/ب/ل…) before a Latin token, like و480p
    const m = /^[\u0600-\u06FF]{1,2}([A-Za-z0-9:./_<>#…*&()+–-]+)$/.exec(w);
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
    for (const [path, value] of walk(ar.systemDesign).concat(walk(ar.videoPipeline), walk(ar.diagrams, '.diagrams'), pagesAr.flatMap((page) => walk(page)))) {
      // {placeholders} are filled with ٠–٩ at render time (src/lib/arch/specs/costs.ts fill)
      expect(stripLatinTokens(value.replace(/\{N[\d.]+\}|\{\w+\}/g, '')), path).not.toMatch(/[0-9]/);
    }
  });

  it('every diagram renders in both languages with real nodes, a title and a description', () => {
    expect(DIAGRAMS.length).toBeGreaterThanOrEqual(30);
    for (const id of DIAGRAMS)
      for (const l of ['en', 'ar'] as const) {
        const d = diagram(id, l);
        for (const svg of [d.wide, d.narrow]) {
          expect((svg.match(/data-node="/g) ?? []).length, `${id} ${l}`).toBeGreaterThanOrEqual(3);
          expect(svg, `${id} ${l}`).toMatch(/<title id="[^"]+">[^<]+<\/title><desc id="[^"]+">[^<]+<\/desc>/);
        }
      }
  });

  it('the hub indexes every subpage, in PAGES order, and no link dangles', () => {
    expect(en.systemDesign.pages.map((x) => x.href)).toEqual(ar.systemDesign.pages.map((x) => x.href));
    for (const page of en.systemDesign.pages) {
      const slug = `system-design/${page.href.replace(/\/$/, '')}` as (typeof PAGES)[number];
      expect(PAGES, page.href).toContain(slug);
    }
  });

  it('the pipeline keeps its story: resumable upload, queue, container, both buckets, one play address', () => {
    const names = pipeline(en.diagrams.pipeline, en.diagrams.costs, 'en').spec.nodes.map((n) => `${n.name} ${n.role ?? ''}`).join('|');
    for (const part of ['resumable upload', 'Bunny Stream', 'R2 originals', 'R2 pub', 'transcode queue', 'Transcoder', 'api-videos']) expect(names).toContain(part);
  });
});
