/**
 * Review captures for the System design pages, from the built site (dist/):
 *  - viewport frames over the whole page (never full-page shots), proved to cover every block once with no cut
 *    edges (COVERAGE.md lists each block and its frame), per page × language × mode × width;
 *  - one element shot per diagram at full resolution;
 *  - an MP4 and a GIF per animated diagram, stepped frame by frame (SMIL clock + CSS animations
 *    paused and set), so recordings are smooth and loop exactly;
 *  - the quality gate (e2e/diagram-gate.ts) on every frame set; a defect fails the run.
 *
 *   node --experimental-strip-types scripts/sysdesign-shots.ts <outDir> [--pages=,video-pipeline/] [--record]
 * Needs ffmpeg for recordings. Run under the shared build lock.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { gateInBrowser } from '../e2e/diagram-gate.ts';
import { GATE_GLOSSARY, NEAR } from '../src/lib/glossary.ts';

const out = process.argv[2];
if (!out) throw new Error('usage: sysdesign-shots.ts <outDir> [--pages=a/,b/] [--record]');
const pagesArg = process.argv.find((a) => a.startsWith('--pages='));
const PAGES = pagesArg ? pagesArg.slice(8).split(',') : ['', 'video-pipeline/'];
const RECORD = process.argv.includes('--record');
/** --only=id,id: reshoot just these diagrams (their frame and shot, and clips of them); skip the rest */
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;
/** --langs=ar: reshoot only these languages */
const langsArg = process.argv.find((a) => a.startsWith('--langs='));
const LANGS = langsArg ? langsArg.slice(8).split(',') : ['en', 'ar'];
const DIST = resolve(import.meta.dirname, '../dist');
mkdirSync(out, { recursive: true });

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml' };
/** The site's own headers (dist/_headers "/*" block), so captures run under the production CSP. */
const SITE_HEADERS: Record<string, string> = {};
{
  const lines = existsSync(join(DIST, '_headers')) ? readFileSync(join(DIST, '_headers'), 'utf8').split('\n') : [];
  let inAll = false;
  for (const line of lines) {
    if (/^\S/.test(line)) inAll = line.trim() === '/*';
    else if (inAll && line.includes(':')) {
      const i = line.indexOf(':');
      SITE_HEADERS[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  if (!SITE_HEADERS['Content-Security-Policy']) throw new Error('dist/_headers has no CSP: build first');
}
const server = createServer((req, res) => {
  // only files under dist/ are served, whatever the request path says
  const p = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
  let f = resolve(DIST, `.${normalize(`/${p}`)}`);
  if (f !== DIST && !f.startsWith(DIST + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { ...SITE_HEADERS, 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const browser = await chromium.launch();
const WIDTHS = { desktop: { width: 1440, height: 900, dsf: 2 }, phone: { width: 412, height: 915, dsf: 3 } } as const;
const name = (slug: string) => (slug ? slug.replace(/\/$/, '') : 'hub');
const defects: string[] = [];

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof browser.newContext>>['newPage']>>;
/**
 * What a frame is made of, in document coordinates: every heading, paragraph, list item, card, figure, the pager and
 * the footer, outermost only (a card's own heading and text belong to the card). The page list beside the content
 * and the header are not blocks; the sidebar is checked on its own.
 */
type Block = { top: number; bottom: number; heading: boolean; label: string; diagram: string | null; tall: boolean };
type Frame = { file: string; sy: number; top: number; bottom: number; side: [number, number][] };
async function readBlocks(page: Page) {
  return page.evaluate(() => {
    const head = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0 && r.width > 0;
    };
    // a figure is read part by part (its heading, lead, key, the drawing, the cards under it): the drawing alone may be
    // too tall for a frame, and its capture holds the drawing, not the text around it
    const sel = 'main h1, main h2, main h3, main h4, main p, main li, main pre, main table, main .tile, main .an-figure > *, main .sd-pager, footer.site-footer';
    const found = [...document.querySelectorAll<HTMLElement>(sel)].filter((el) => !el.closest('.sd-aside, header, svg') && shown(el));
    const set = new Set<Element>(found);
    const outer = found.filter((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
      return true;
    });
    // a block reaches as far as anything drawn inside it (a legend's step badge may hang below its box)
    const extent = (el: Element) => {
      const r = el.getBoundingClientRect();
      let top = r.top;
      let bottom = r.bottom;
      for (const d of el.querySelectorAll('*')) {
        const q = d.getBoundingClientRect();
        if (q.width > 0 && q.height > 0) {
          top = Math.min(top, q.top);
          bottom = Math.max(bottom, q.bottom);
        }
      }
      return { top, bottom };
    };
    const blocks = outer
      .map((el) => {
        const r = extent(el);
        const svg = [...el.querySelectorAll<SVGSVGElement>('svg.an')].find((x) => x.getBoundingClientRect().width > 0);
        const cls = el.classList[0] ? `.${el.classList[0]}` : '';
        return {
          top: Math.round(r.top + window.scrollY),
          bottom: Math.round(r.bottom + window.scrollY),
          heading: /^H[1-4]$/.test(el.tagName),
          label: `${el.tagName.toLowerCase()}${cls} “${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 56)}”`,
          diagram: svg?.dataset.diagram ?? null,
          tall: false,
        };
      })
      .sort((p, q) => p.top - q.top || p.bottom - q.bottom);
    // where the page list sits once the page is at its foot (its column's end pushes it up): the end frame's top edge
    // must clear it
    const H = document.scrollingElement!.scrollHeight;
    const was = window.scrollY;
    window.scrollTo(0, H);
    const endSide = [...document.querySelectorAll('.sd-aside .sd-nav-title, .sd-aside li')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.height > 0)
      .map((r) => [Math.round(r.top + window.scrollY), Math.round(r.bottom + window.scrollY)] as [number, number]);
    window.scrollTo(0, was);
    return { head, blocks, H, endSide };
  });
}
const sideRects = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.sd-aside .sd-nav-title, .sd-aside li')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.height > 0)
      .map((r) => [Math.round(r.top), Math.round(r.bottom)] as [number, number]),
  );
/**
 * The page top to bottom as groups of blocks, one group per frame: each group opens on the first block no group holds
 * yet and takes every block after it that fits whole in a view below the sticky header, never ending on a heading
 * (its section opens the next group). The pager and the footer always share the last group. A figure taller than the
 * view is in no group: its standalone capture shows it whole.
 */
function planFrames(blocks: Block[], head: number, vh: number, H: number, endSide: [number, number][]): number[][] {
  const flow = blocks.map((b, i) => ({ b, i })).filter((x) => !x.b.tall);
  // the end frame holds the pager and the footer, opening on the nearest whole block above them whose top edge cuts no
  // line of the page list as it sits at the page's foot
  let endAt = blocks.findIndex((b) => /^(nav|div|section)\.sd-pager|^footer/.test(b.label));
  if (endAt > 0 && endSide.length) {
    const cuts = (e: number) => endSide.some(([t, b]) => e > t + 0.5 && e < b - 0.5);
    let i = endAt;
    while (i > 0 && cuts(blocks[i]!.top - 16)) {
      const j = i - 1;
      if (blocks[j]!.tall) break;
      i = j;
    }
    // never inside a row of cards: the row opens on its first card
    while (i > 0 && !blocks[i - 1]!.tall && Math.abs(blocks[i - 1]!.top - blocks[i]!.top) <= 1) i--;
    endAt = i;
  }
  const groups: number[][] = [];
  const taken = new Set<number>();
  for (let first = true; groups.length < 60; first = false) {
    const start = flow.find((x) => !taken.has(x.i));
    if (!start) break;
    if (endAt >= 0 && start.i >= endAt) {
      groups.push(flow.filter((x) => !taken.has(x.i)).map((x) => x.i));
      break;
    }
    const y = first ? 0 : start.b.top;
    const sy = Math.max(0, Math.min(first ? 0 : y - head - 16, H - vh));
    const visTop = first ? head : Math.max(sy + head, y - 16);
    const viewBottom = sy + vh;
    let whole = flow.filter((x) => !taken.has(x.i) && x.b.top >= visTop - 1 && x.b.bottom <= viewBottom - 16 && (endAt < 0 || x.i < endAt));
    // whole means whole: nothing in the group sits past a block the view cuts
    const cutTop = Math.min(...blocks.filter((b) => b.top >= visTop - 1 && b.bottom > viewBottom - 16).map((b) => b.top), Infinity);
    whole = whole.filter((x) => x.b.bottom <= cutTop);
    while (whole.length > 1 && whole[whole.length - 1]!.b.heading) whole.pop();
    if (!whole.length) whole = [start];
    groups.push(whole.map((x) => x.i));
    for (const x of whole) taken.add(x.i);
  }
  // a sliver (a terms line alone before a drawing too tall to frame) joins the frame before it, grown to hold it
  const span = (g: number[]) => Math.max(...g.map((i) => blocks[i]!.bottom)) - Math.min(...g.map((i) => blocks[i]!.top));
  for (let k = groups.length - 2; k >= 1; k--) if (span(groups[k]!) < 160) groups.splice(k - 1, 2, [...groups[k - 1]!, ...groups[k]!]);
  return groups;
}
/** frame plans by page and width, made on the first language shot and reused for the other */
const plans = new Map<string, { groups: number[][]; shape: string }>();
const shapeOf = (blocks: Block[]) => blocks.map((b) => `${b.label.split(' ')[0]}${b.tall ? '!' : ''}`).join(',');
/**
 * Shoots one frame per group: opening 16 px above its first block (just under the header), clipped 16 px under its
 * last; a group taller than the view gets a taller viewport rather than a second frame. A clipped edge moves (within
 * the gap between blocks) to a spot where it cuts no line of the page list.
 */
async function shootFrames(page: Page, tag: string, blocks: Block[], head: number, groups: number[][]): Promise<Frame[]> {
  const base = page.viewportSize()!;
  const frames: Frame[] = [];
  for (let k = 0; k < groups.length; k++) {
    const g = groups[k]!;
    const first = k === 0;
    const y = first ? 0 : blocks[g[0]!]!.top;
    const last = Math.max(...g.map((i) => blocks[i]!.bottom));
    const need = first ? last + 16 : last - y + head + 32;
    const vh = Math.max(base.height, Math.ceil(need));
    if (vh !== base.height) {
      await page.setViewportSize({ width: base.width, height: vh });
      const again = (await readBlocks(page)).blocks;
      if (again.length !== blocks.length || g.some((i) => Math.abs(again[i]!.top - blocks[i]!.top) > 1)) defects.push(`${tag}: the page moved when the view grew for frame ${k + 1}`);
    }
    const nextTop = Math.min(...blocks.filter((b) => b.top > last - 1).map((b) => b.top), Infinity);
    const prev = Math.max(0, ...blocks.filter((b) => b.bottom <= y + 1).map((b) => b.bottom));
    // the page list stays pinned while the page scrolls under it: when a gap between blocks is narrower than a line
    // of the list, scrolling a few px moves the gap onto the line between two items
    type Spot = { sy: number; side: [number, number][]; eTop: number; clipBottom: number };
    let pick: Spot | null = null;
    let fallback: Spot | null = null;
    for (const d of first ? [0] : [0, -2, 2, -4, 4, -6, 6, -8, 8, -10, 10, -12, 12, -14, 14, -16, -18, -20, -22, -24, -26, -28, -30]) {
      // the header's lower edge lands 16px above the first block, or in the gap above it when that gap is narrower
      await page.evaluate((top) => window.scrollTo(0, top), first ? 0 : Math.max(y - 16, prev + 2) - head + d);
      const sy = await page.evaluate(() => window.scrollY);
      const side = await sideRects(page);
      // the line between two items of the list is free; only a cut through an item's own box is not
      // the list's first and last lines also keep 4px of margin to an edge
      const listTop = Math.min(...side.map(([t]) => t));
      const listBottom = Math.max(...side.map(([, b]) => b));
      const inside = (c: number) => side.some(([t, b]) => c > t + 0.5 && c < b - 0.5) || (side.length > 0 && ((c > listTop - 4 && c < listTop + 0.5) || (c > listBottom - 0.5 && c < listBottom + 4)));
      const free = (want: number, lo: number, hi: number) => {
        for (let e = 0; e <= Math.max(want - lo, hi - want, 0); e++) {
          if (want - e >= lo && want - e <= hi && !inside(want - e)) return want - e;
          if (want + e <= hi && want + e >= lo && !inside(want + e)) return want + e;
        }
        return null;
      };
      const topWant = first ? head : Math.max(head, y - sy - 16);
      const eTop = first ? head : free(topWant, Math.max(head, prev - sy + 2), y - sy - 2);
      const hi = Math.min(vh, Math.floor(nextTop - sy - 2));
      // 16 px under the last block, or the view's foot when that's nearer; never past the next block's top
      const cb = free(Math.min(hi, last - sy + 16), Math.min(hi, Math.ceil(last - sy + 2)), hi);
      const got = { sy, side, eTop: Math.round(eTop ?? topWant), clipBottom: Math.round(Math.min(vh, cb ?? Math.min(hi, last - sy + 16))) };
      fallback ??= got;
      if (eTop !== null && cb !== null) {
        pick = got;
        break;
      }
    }
    // no clean edge anywhere (a gap too narrow beside the list's end): the frame hands its last block to the next one
    // (the plan is shared, so the other language follows)
    if (!pick && g.length > 1) {
      // a card goes with the rest of its row
      const moved = [g.pop()!];
      while (g.length > 1 && Math.abs(blocks[g[g.length - 1]!]!.top - blocks[moved[0]!]!.top) <= 1) moved.unshift(g.pop()!);
      if (k + 1 < groups.length) groups[k + 1]!.unshift(...moved);
      else groups.push(moved);
      if (vh !== base.height) await page.setViewportSize(base);
      k--;
      continue;
    }
    const { sy, side, eTop, clipBottom } = pick ?? fallback!;
    if (!pick) await page.evaluate((top) => window.scrollTo(0, top), sy);
    const clipTop = eTop <= head ? 0 : eTop;
    const file = join(out, `${tag}-frame-${String(k + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: clipTop, width: base.width, height: clipBottom - clipTop } });
    frames.push({ file, sy, top: sy + Math.max(eTop, head), bottom: sy + clipBottom, side });
    if (vh !== base.height) await page.setViewportSize(base);
  }
  return frames;
}
async function walkPage(page: Page, tag: string, key: string, blocks: Block[], head: number, H: number, endSide: [number, number][]): Promise<{ frames: Frame[]; note: string }> {
  const shape = shapeOf(blocks);
  const prior = plans.get(key);
  let note = 'plan made here';
  let groups: number[][];
  if (prior && prior.shape === shape) {
    groups = prior.groups;
    note = 'plan shared with the first language';
  } else if (prior) {
    // a block one language has and the other doesn't (a terms line a figure needs in English only): the blocks are
    // lined up in order; a missing one leaves its group, an extra one joins the group of the block before it
    // lined up by kind of block only: a drawing may be too tall for a frame in one language and not the other
    const aTall = prior.shape.split(',').map((t) => t.endsWith('!'));
    const a = prior.shape.split(',').map((t) => t.replace(/!$/, ''));
    const b = shape.split(',').map((t) => t.replace(/!$/, ''));
    const map = new Map<number, number>();
    for (let i = 0, j = 0; i < a.length && j < b.length; ) {
      if (a[i] === b[j]) map.set(i++, j++);
      else if (a.indexOf(b[j]!, i) === -1) j++;
      else i++;
    }
    const groupOf = new Map<number, number>();
    groups = prior.groups.map((g, k) => {
      // a block that fit a frame in the first language keeps its frame here, the view grown to hold it
      const out = g.flatMap((i) => (map.has(i) && (!blocks[map.get(i)!]!.tall || !aTall[i]) ? [map.get(i)!] : []));
      for (const j of out) groupOf.set(j, k);
      return out;
    });
    b.forEach((_, j) => {
      if (groupOf.has(j) || blocks[j]!.tall) return;
      let k = 0;
      for (let q = j - 1; q >= 0; q--) if (groupOf.has(q)) {
        k = groupOf.get(q)!;
        break;
      }
      groups[k]!.push(j);
      groupOf.set(j, k);
    });
    groups = groups.map((g) => g.sort((x, y) => x - y)).filter((g) => g.length);
    note = `plan shared with the first language (lined up: ${a.length - map.size} block(s) only there, ${b.length - map.size} only here)`;
  } else {
    groups = planFrames(blocks, head, page.viewportSize()!.height, H, endSide);
    plans.set(key, { groups, shape });
  }
  return { frames: await shootFrames(page, tag, blocks, head, groups), note };
}
/**
 * Proof the frames cover the page, checked from what was shot, not from how it was planned: (1) every block whole in
 * exactly one frame (a figure taller than the view: its capture); (2) no two frames the same bytes or sharing more than a
 * header's height; (3) every edge in a gap between blocks, with no empty band at a frame's top or bottom; (4) no edge
 * through a line of the page list. Returns the block → frame table.
 */
function proveFrames(tag: string, blocks: Block[], frames: Frame[], head: number, H: number, captures: Set<string>, note: string): string {
  const fail = (m: string) => defects.push(`${tag}: ${m}`);
  const base = (f: string) => f.slice(f.lastIndexOf('/') + 1).replace(`${tag}-`, '');
  const rows: string[] = [];
  for (const b of blocks) {
    const inFrames = frames.filter((f) => b.top >= f.top - 1 && b.bottom <= f.bottom + 1).map((f) => base(f.file));
    let where = inFrames.join(', ');
    if (!where && b.diagram && b.tall && captures.has(b.diagram)) where = `diagram-${b.diagram}.png (taller than the view)`;
    if (!where) fail(`“${b.label}” (${b.top}–${b.bottom}) appears whole in no frame`);
    if (inFrames.length > 1) fail(`“${b.label}” appears whole in ${inFrames.length} frames (${where})`);
    rows.push(`| ${b.top}–${b.bottom} | ${b.label.replace(/\|/g, '/')} | ${where || '**MISSING**'} |`);
  }
  const hashes = new Map<string, string>();
  frames.forEach((f, i) => {
    const h = createHash('sha1').update(readFileSync(f.file)).digest('hex');
    if (hashes.has(h)) fail(`${base(f.file)} is byte-identical to ${hashes.get(h)}`);
    hashes.set(h, base(f.file));
    for (const g of frames.slice(i + 1)) {
      const shared = Math.min(f.bottom, g.bottom) - Math.max(f.top, g.top);
      if (shared > head) fail(`${base(f.file)} and ${base(g.file)} share ${Math.round(shared)} px (more than the header's ${Math.round(head)})`);
    }
    const inside = blocks.filter((b) => b.top >= f.top - 1 && b.bottom <= f.bottom + 1);
    for (const b of blocks) {
      if (b.top < f.top - 1 && b.bottom > f.top + 1) fail(`${base(f.file)} opens inside “${b.label}”`);
      if (b.top < f.bottom - 1 && b.bottom > f.bottom + 1) fail(`${base(f.file)} ends inside “${b.label}”`);
    }
    if (i > 0 && inside.length && Math.min(...inside.map((b) => b.top)) - f.top > 48) fail(`${base(f.file)} opens on an empty band of ${Math.round(Math.min(...inside.map((b) => b.top)) - f.top)} px`);
    if (inside.length && f.bottom < H - 1 && f.bottom - Math.max(...inside.map((b) => b.bottom)) > 48) fail(`${base(f.file)} ends on an empty band of ${Math.round(f.bottom - Math.max(...inside.map((b) => b.bottom)))} px`);
    for (const [t, b] of f.side)
      for (const e of [f.top - f.sy, f.bottom - f.sy]) if (t < e - 0.5 && b > e + 0.5) fail(`${base(f.file)} cuts a line of the page list (${t}–${b} at edge ${Math.round(e)})`);
    if (f.side.length) {
      const lt = Math.min(...f.side.map(([t]) => t));
      const lb = Math.max(...f.side.map(([, b]) => b));
      for (const e of [f.top - f.sy, f.bottom - f.sy]) if ((e > lt - 4 && e < lt - 0.5) || (e > lb + 0.5 && e < lb + 4)) fail(`${base(f.file)}: the page list ends ${Math.round(Math.min(Math.abs(e - lt), Math.abs(e - lb)))} px from an edge (min 4)`);
    }
  });
  return [`## ${tag}`, '', `${frames.length} frames · header ${Math.round(head)} px · page ${H} px · ${note}`, '', '| block (px) | block | shown whole in |', '|---|---|---|', ...rows, ''].join('\n');
}
const coverage: string[] = [];
const frameCounts = new Map<string, number>();

for (const slug of PAGES)
  for (const lang of LANGS)
    for (const mode of ['dark', 'light'] as const)
      for (const [w, vp] of Object.entries(WIDTHS)) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, colorScheme: mode, reducedMotion: 'reduce' });
        // stills show the final state with no moving dots over the arrowheads; recordings use their own context
        await ctx.addInitScript((m) => localStorage.setItem('aun_mode', m), mode);
        const page = await ctx.newPage();
        const cspViolations: string[] = [];
        page.on('console', (m) => {
          if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text().slice(0, 200));
        });
        await page.goto(`${base}/${lang}/system-design/${slug}`);
        await page.evaluate(() => document.fonts.ready);
        // freeze motion at a mid-flow instant so frames show pulses in flight
        await page.evaluate(() => {
          for (const s of document.querySelectorAll<SVGSVGElement>('svg.an')) {
            s.pauseAnimations();
            // a diagram with cost meters is shown at the end of its cycle (every total counted)
            s.setCurrentTime(s.querySelector('[data-meter]') ? Number(s.dataset.cycle) - 0.25 : 2.2);
          }
          for (const a of document.getAnimations()) {
            a.pause();
            a.currentTime = 400;
          }
        });
        await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(null)))));
        const found = await page.evaluate(gateInBrowser, { glossary: GATE_GLOSSARY(), near: NEAR });
        for (const v of cspViolations.splice(0)) found.push(`CSP blocked: ${v}`);
        for (const d of found) defects.push(`${name(slug)} ${lang} ${mode} ${w}: ${d}`);
        const tag = `${name(slug)}-${mode}-${w}-${lang}`;
        // viewport frames: the whole page top to bottom, walked block by block (proved after the captures)
        const read = await readBlocks(page);
        const room = vp.height - read.head - 32;
        const blocks: Block[] = read.blocks.map((x) => ({ ...x, tall: x.bottom - x.top > room }));
        for (const x of blocks) if (x.tall && !x.diagram) defects.push(`${tag}: “${x.label}” is taller than the view (${x.bottom - x.top} px), so no frame can show it whole`);
        const walked = ONLY ? { frames: [], note: '' } : await walkPage(page, tag, `${slug}|${w}|${mode}`, blocks, read.head, read.H, read.endSide);
        const frames = walked.frames;
        // both languages tell a page in the same frames
        const pk = `${slug}|${w}|${mode}`;
        if (!ONLY && frameCounts.has(pk) && frameCounts.get(pk) !== frames.length) defects.push(`${tag}: ${frames.length} frames, the first language had ${frameCounts.get(pk)}`);
        if (!ONLY && !frameCounts.has(pk)) frameCounts.set(pk, frames.length);
        const captures = new Set<string>();
        const figs = await page.locator('.an-figure').count();
        for (let i = 0; i < figs; i++) {
          const fig = page.locator('.an-figure').nth(i);
          const svg = fig.locator('svg.an:visible');
          const id = await svg.getAttribute('data-diagram');
          if (ONLY && !ONLY.has(id ?? '')) continue;
          // the figure alone and whole: a copy of the drawing at its natural size, over the page, in a
          // viewport big enough to hold it (the page scrolls a wide figure, so an element shot would clip it)
          const size = await svg.evaluate((el) => ({ w: (el as SVGSVGElement).width.baseVal.value, h: (el as SVGSVGElement).height.baseVal.value }));
          // copy first: a bigger viewport may switch the page to its other layout
          await svg.evaluate((el) => {
            const host = document.createElement('div');
            host.id = 'shot-host';
            host.setAttribute('dir', 'ltr');
            // an opaque backdrop in the page's own colour under the capture, so nothing of the page can show at its edges
            const paint = [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.documentElement).backgroundColor].find((c) => !/rgba\(.*,\s*0\)$|transparent/.test(c)) ?? '#ffffff';
            const backdrop = document.createElement('div');
            backdrop.id = 'shot-backdrop';
            for (const [k, v] of Object.entries({ position: 'fixed', inset: '0', 'z-index': '2147483646', background: paint })) backdrop.style.setProperty(k, v);
            document.body.append(backdrop);
            for (const [k, v] of Object.entries({ position: 'fixed', top: '0', left: '0', 'z-index': '2147483647', padding: '20px 24px 24px', display: 'grid', gap: '14px', width: 'max-content', background: paint })) host.style.setProperty(k, v);
            // the figure's own key, as the page shows it above the drawing
            const legend = [...(el.closest('.an-figure')?.querySelectorAll<HTMLElement>('.an-legend') ?? [])].find((l) => getComputedStyle(l).display !== 'none');
            if (legend) {
              const key = legend.cloneNode(true) as HTMLElement;
              // the layout classes would hide it at the capture's (wider) viewport
              key.classList.remove('an-legend-wide', 'an-legend-narrow');
              key.style.setProperty('display', 'flex');
              key.setAttribute('dir', document.documentElement.dir || 'ltr');
              key.style.setProperty('max-width', `${(el as SVGSVGElement).width.baseVal.value}px`);
              host.append(key);
            }
            // the copy gets its own ids: otherwise its markers and symbols point at the original's, which a
            // bigger viewport may hide (its layout switches), and arrowheads would vanish from the shot
            host.insertAdjacentHTML('beforeend', el.outerHTML.replace(/\bid="/g, 'id="shot-').replace(/url\(#/g, 'url(#shot-').replace(/href="#/g, 'href="#shot-').replace(/aria-labelledby="([^"]*)"/g, (_m, ids: string) => `aria-labelledby="${ids.split(' ').map((i) => `shot-${i}`).join(' ')}"`));
            document.body.append(host);
          });
          const vp = page.viewportSize()!;
          // a viewport that holds the whole capture (legend + drawing + padding), with room to spare
          const hostSize = await page.evaluate(() => {
            const r = document.getElementById('shot-host')!.getBoundingClientRect();
            return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
          });
          await page.setViewportSize({ width: Math.max(vp.width, hostSize.w + 40, Math.ceil(size.w) + 60), height: Math.max(vp.height, hostSize.h + 80) });
          // the capture holds the figure only: its legend when the figure has one, and nothing from the page
          // around it (every point along its edges belongs to the capture itself)
          const capture = await page.evaluate(() => {
            const host = document.getElementById('shot-host')!;
            const problems: string[] = [];
            if (Number((getComputedStyle(host).backgroundColor.match(/[\d.]+/g) ?? [])[3] ?? 1) < 1) problems.push('capture background is see-through');
            const r = host.getBoundingClientRect();
            if (r.bottom > innerHeight || r.right > innerWidth) problems.push('the capture is larger than the viewport (the page shows below it)');
            for (const [x, y] of [...[0.05, 0.3, 0.5, 0.7, 0.95].map((f) => [r.left + r.width * f, r.bottom - 1]), [r.left + 1, r.top + r.height / 2], [r.right - 1, r.top + r.height / 2]] as [number, number][]) {
              const el = document.elementFromPoint(x, y);
              if (el && el !== host && !host.contains(el)) problems.push(`pixels from outside the figure at the capture's edge (${el.tagName.toLowerCase()})`);
            }
            return problems;
          });
          const legendHad = await svg.evaluate((el) => [...(el.closest('.an-figure')?.querySelectorAll('.an-legend li') ?? [])].length > 0);
          // visible, not merely present: a hidden legend in the capture is as good as none
          const legendShot = await page.locator('#shot-host .an-legend li:visible').count();
          if (legendHad && !legendShot) capture.push('standalone capture is missing its legend');
          for (const c of capture) defects.push(`${name(slug)} ${lang} ${mode} ${w}: ${id} capture: ${c}`);
          const png = await page.locator('#shot-host').screenshot({ path: join(out, `${tag}-diagram-${id}.png`) });
          if (id) captures.add(id);
          // the capture's padding is plain background: its bottom rows and right column must be that colour only
          // (a row of the page below showing through fails the capture)
          const bg = await page.evaluate(() => (getComputedStyle(document.getElementById('shot-host')!).backgroundColor.match(/\d+/g) ?? []).slice(0, 3).map(Number));
          const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          const off = (x: number, y: number) => (y * info.width + x) * info.channels;
          const differs = (x: number, y: number) => [0, 1, 2].some((c) => Math.abs(data[off(x, y) + c]! - (bg[c] ?? 0)) > 12);
          let edge = false;
          for (let y = info.height - 4; y < info.height && !edge; y++) for (let x = 0; x < info.width && !edge; x += 2) edge = differs(x, y);
          for (let y = 0; y < info.height && !edge; y += 2) edge = differs(info.width - 2, y);
          if (edge) defects.push(`${name(slug)} ${lang} ${mode} ${w}: ${id} capture: pixels along its edge aren't the figure's background (something outside the figure shows)`);
          await page.evaluate(() => {
            document.getElementById('shot-host')?.remove();
            document.getElementById('shot-backdrop')?.remove();
          });
          await page.setViewportSize(vp);
          // let the sticky header settle after the resize (a stale band above it otherwise lands in the next frame)
          await page.evaluate(() => new Promise<void>((res) => {
            window.scrollBy(0, 1);
            window.scrollBy(0, -1);
            requestAnimationFrame(() => requestAnimationFrame(() => res()));
          }));
        }
        if (!ONLY) coverage.push(proveFrames(tag, blocks, frames, read.head, read.H, captures, walked.note));
        await ctx.close();
      }

if (RECORD) {
  // one recording per animated diagram: dark, desktop, English; plus the pipeline on a phone
  /** what to film: the svg, the whole figure (with the comparison bars), or one lane group */
  type Target = 'svg' | 'figure' | { group: string };
  const jobs: { slug: string; id: string; w: keyof typeof WIDTHS; secs: number; target?: Target; name?: string }[] = [
    { slug: 'video-pipeline/', id: 'costs', w: 'desktop', secs: 0, target: 'figure', name: 'costs-both' },
    { slug: 'video-pipeline/', id: 'costs', w: 'desktop', secs: 0, target: { group: 'laneBunny' }, name: 'costs-bunny' },
    { slug: 'video-pipeline/', id: 'costs', w: 'desktop', secs: 0, target: { group: 'laneR2' }, name: 'costs-r2' },
    { slug: 'video-pipeline/', id: 'costs', w: 'phone', secs: 0, target: 'figure', name: 'costs-both' },
    { slug: '', id: 'hero', w: 'desktop', secs: 9 },
    { slug: '', id: 'overview', w: 'desktop', secs: 9 },
    { slug: 'video-pipeline/', id: 'pipeline', w: 'desktop', secs: 0 },
    { slug: 'video-pipeline/', id: 'pipeline', w: 'phone', secs: 0 },
    { slug: 'video-pipeline/', id: 'sketch-play', w: 'desktop', secs: 8 },
    // one animated flow per page (numbered hops; the AI map carries its cost meter)
    { slug: 'delivery-caching/', id: 'delivery-miss', w: 'desktop', secs: 0 },
    { slug: 'data/', id: 'data-write', w: 'desktop', secs: 0 },
    { slug: 'async/', id: 'async-fail', w: 'desktop', secs: 0 },
    { slug: 'realtime/', id: 'realtime-views', w: 'desktop', secs: 0 },
    { slug: 'identity/', id: 'identity-signin', w: 'desktop', secs: 0 },
    { slug: 'ai/', id: 'ai-scan', w: 'desktop', secs: 0 },
    { slug: 'ai/', id: 'ai-map', w: 'desktop', secs: 9 },
    { slug: 'scaling/', id: 'scaling-slot', w: 'desktop', secs: 0 },
    { slug: 'clients/', id: 'clients-device', w: 'desktop', secs: 0 },
    { slug: 'release/', id: 'release-train', w: 'desktop', secs: 0 },
  ];
  for (const mode of ['dark', 'light'] as const)
    for (const j of jobs.filter((x) => !ONLY || ONLY.has(x.id))) {
      const vp = WIDTHS[j.w];
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: j.w === 'phone' ? 2 : 1.5, colorScheme: mode });
      await ctx.addInitScript((m) => localStorage.setItem('aun_mode', m), mode);
      const page = await ctx.newPage();
      await page.goto(`${base}/en/system-design/${j.slug}`);
      await page.evaluate(() => document.fonts.ready);
      const svg = page.locator(`svg.an[data-diagram="${j.id}"]:visible`);
      await svg.scrollIntoViewIfNeeded();
      // a numbered flow records exactly one cycle, so the clip loops seamlessly
      const secs = j.secs || (await svg.evaluate((s) => Number((s as SVGSVGElement).dataset.cycle ?? 10)));
      const target = j.target ?? 'svg';
      const fig = page.locator('.an-figure').filter({ has: page.locator(`svg.an[data-diagram="${j.id}"]`) });
      // a clip of a whole figure: a viewport tall enough to hold it, page chrome that sticks to the
      // viewport hidden (clips only; review frames keep it), cropped to the figure plus its bleed
      let figClip: { x: number; y: number; width: number; height: number } | null = null;
      if (target === 'figure') {
        await page.evaluate(() => {
          for (const el of document.querySelectorAll<HTMLElement>('body *')) {
            const p = getComputedStyle(el).position;
            if (p === 'fixed' || p === 'sticky') el.style.visibility = 'hidden';
          }
        });
        const h = await fig.evaluate((el) => el.getBoundingClientRect().height);
        await page.setViewportSize({ width: vp.width, height: Math.ceil(h) + 64 });
        await fig.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 32));
        figClip = await fig.evaluate((el) => {
          const a = el.getBoundingClientRect();
          const b = el.querySelector('.an-frame')!.getBoundingClientRect();
          const x = Math.max(0, Math.min(a.left, b.left) - 12);
          return { x, y: Math.max(0, a.top - 12), width: Math.min(window.innerWidth, Math.max(a.right, b.right) + 12) - x, height: a.height + 24 };
        });
      }
      const clip = typeof target === 'object' ? await svg.locator(`[data-group="${target.group}"]`).boundingBox() : null;
      const fps = 25;
      const dir = join(out, `rec-${j.id}-${j.w}-${mode}`);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const n = Math.round(secs * fps);
      for (let i = 0; i < n; i++) {
        await svg.evaluate((s, t) => {
          (s as SVGSVGElement).pauseAnimations();
          (s as SVGSVGElement).setCurrentTime(t);
          for (const a of document.getAnimations()) {
            a.pause();
            a.currentTime = t * 1000;
          }
        }, i / fps);
        await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(null)))));
        const file = join(dir, `f${String(i).padStart(4, '0')}.png`);
        if (figClip) await page.screenshot({ path: file, clip: figClip });
        else if (clip) await page.screenshot({ path: file, clip: { x: clip.x - 14, y: clip.y - 24, width: clip.width + 28, height: clip.height + 38 } });
        else await svg.screenshot({ path: file });
      }
      const stem = join(out, `${j.name ?? j.id}-${mode}-${j.w}-en`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', `${stem}.mp4`]);
      const gw = j.w === 'phone' ? 480 : 1100;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'), '-vf', `fps=20,scale=${gw}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle`, '-loop', '0', `${stem}.gif`]);
      rmSync(dir, { recursive: true, force: true });
      await ctx.close();
    }
}

await browser.close();
server.close();
if (coverage.length) writeFileSync(join(out, 'COVERAGE.md'), [`# Frame coverage`, '', 'Every block on every page, and the frames that show it whole. Written by scripts/sysdesign-shots.ts, which fails the run when a block is missing, two frames repeat or overlap, the languages differ in frame count, an edge cuts a block or a line of the page list, or a frame opens or ends on an empty band.', '', ...coverage].join('\n'));
if (defects.length) {
  console.error(defects.join('\n'));
  console.error(`GATE FAILED: ${defects.length} defects`);
  process.exit(1);
}
console.log('GATE OK — captures in', out);
