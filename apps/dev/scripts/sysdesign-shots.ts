/**
 * Review captures for the System design pages, from the built site (dist/):
 *  - viewport frames (top, middle, end; never full-page) per page × language × mode × width;
 *  - one element shot per diagram at full resolution;
 *  - an MP4 and a GIF per animated diagram, stepped frame by frame (SMIL clock + CSS animations
 *    paused and set), so recordings are smooth and loop exactly;
 *  - the quality gate (e2e/diagram-gate.ts) on every frame set; a defect fails the run.
 *
 *   node --experimental-strip-types scripts/sysdesign-shots.ts <outDir> [--pages=,video-pipeline/] [--record]
 * Needs ffmpeg for recordings. Run under the shared build lock.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
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
/** what a frame is made of: headings, leads, cards, paragraphs, the pager and the footer (document coordinates) */
const BLOCKS = 'main h2, main h3:not(.tile-title, .sd-index-title), main .section-lead, main .tile, main .band p, main .sd-index li, .sd-pager, footer.site-footer';
/**
 * Viewport frames over [from, to) of the page: each starts at a block's top (or the heading just above it), below
 * the sticky header, and is clipped at the bottom of the last block it shows whole, so no frame opens or ends on a
 * cut line; the next frame starts at the first block in range the last one didn't show whole.
 */
async function walkFrames(page: Page, file: (k: number) => string, from: number, to: number, max = 20): Promise<number> {
  const vh = page.viewportSize()?.height ?? 800;
  const vw = page.viewportSize()?.width ?? 1280;
  const { head, all } = await page.evaluate(
    ({ sel }) => {
      const head = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
      const blocks = [...document.querySelectorAll<HTMLElement>(sel)]
        .filter((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY), heading: /^H[23]$/.test(el.tagName) || el.classList.contains('section-lead') };
        })
        .sort((p, q) => p.top - q.top || p.bottom - q.bottom);
      return { head, all: blocks };
    },
    { sel: BLOCKS },
  );
  // the frames walk the blocks in range; every block on screen decides where a frame is clipped
  const blocks = all.filter((b) => b.top >= from - 1 && b.top < to - 1);
  if (!blocks.length) return 0;
  // a start steps back to the headings (and lead) directly above it, so a section never opens without its title
  const withTitle = (y: number) => {
    for (;;) {
      const above = all.filter((b) => b.heading && b.top >= from - 1 && b.bottom <= y + 1 && y - b.bottom < 96 && !all.some((o) => !o.heading && o.top > b.bottom - 1 && o.top < y - 1));
      const h = above.sort((p, q) => q.top - p.top)[0];
      if (!h || h.top >= y) return y;
      y = h.top;
    }
  };
  let y = withTitle(blocks[0]!.top);
  let k = 0;
  while (k < max) {
    k++;
    await page.evaluate((top) => window.scrollTo(0, top), y - head - 16);
    const sy = await page.evaluate(() => window.scrollY);
    // the page can't scroll that far: the frame starts below the header at the block's top instead
    let clipTop = Math.max(0, Math.round(y - sy - 16 > head + 1 ? y - sy - 16 : 0));
    const viewBottom = sy + vh;
    const whole = all.filter((b) => b.top >= y - 1 && b.bottom <= viewBottom);
    const cut = all.filter((b) => b.top >= y - 1 && b.bottom > viewBottom && b.top < viewBottom);
    const left = blocks.filter((b) => b.top >= y - 1 && b.bottom > viewBottom);
    // clipped at the last whole block's bottom when the next one would show cut (a single block taller than the
    // view is shown as far as it goes)
    const lastWhole = whole.length ? Math.max(...whole.map((b) => b.bottom)) : viewBottom;
    let clipBottom = cut.length && whole.length ? Math.min(vh, Math.round(lastWhole - sy + 16)) : vh;
    // a clipped edge never cuts through a line of the sticky page list beside the content: it moves into the
    // space around the blocks (above the start, below the last whole block) to clear it
    if (clipTop || clipBottom < vh) {
      const side = await page.evaluate(() =>
        [...document.querySelectorAll('.sd-aside .sd-nav-title, .sd-aside li')].map((el) => {
          const r = el.getBoundingClientRect();
          return [Math.round(r.top), Math.round(r.bottom)] as [number, number];
        }),
      );
      const inside = (c: number) => side.some(([t, b]) => c > t && c < b);
      // the free spot nearest the wanted edge, within [lo, hi]
      const nearest = (want: number, lo: number, hi: number) => {
        for (let d = 0; d <= Math.max(want - lo, hi - want); d++) {
          if (want - d >= lo && !inside(want - d)) return want - d;
          if (want + d <= hi && !inside(want + d)) return want + d;
        }
        return want;
      };
      if (clipTop) {
        // between the bottom of the last block above the start and the start itself
        const floor = Math.max(head, ...all.filter((b) => b.bottom <= y).map((b) => Math.ceil(b.bottom - sy + 4)));
        clipTop = nearest(clipTop, floor, Math.floor(y - sy - 2));
      }
      if (clipBottom < vh) {
        // between the last whole block's bottom and the top of the next one
        const ceil = Math.min(vh, ...cut.map((b) => Math.floor(b.top - sy - 4)));
        clipBottom = nearest(clipBottom, Math.ceil(lastWhole - sy + 2), ceil);
      }
    }
    await page.screenshot({ path: file(k), clip: { x: 0, y: clipTop, width: vw, height: clipBottom - clipTop } });
    const next = left.length ? Math.min(...left.map((b) => b.top)) : null;
    if (next === null) break;
    const n2 = withTitle(next);
    y = n2 > y ? n2 : next > y ? next : y + vh - head - 32;
  }
  return k;
}

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
        // viewport frames: top, then each diagram centred, then the end
        await page.evaluate(() => window.scrollTo(0, 0));
        if (!ONLY) await page.screenshot({ path: join(out, `${tag}-frame-1-top.png`) });
        // the hub's page list in full: as many frames as it takes, each opening on its heading or a row of cards and
        // ending on a whole one
        if (!ONLY && (await page.locator('.sd-index').count())) {
          const list = await page.locator('#pages-h').evaluate((el) => {
            const sec = el.closest('section')!.getBoundingClientRect();
            return { top: sec.top + window.scrollY, bottom: sec.bottom + window.scrollY };
          });
          await walkFrames(page, (k) => join(out, `${tag}-frame-1-pages-${k}.png`), list.top, list.bottom);
        }
        const figs = await page.locator('.an-figure').count();
        for (let i = 0; i < figs; i++) {
          const fig = page.locator('.an-figure').nth(i);
          const svg = fig.locator('svg.an:visible');
          const id = await svg.getAttribute('data-diagram');
          if (ONLY && !ONLY.has(id ?? '')) continue;
          await fig.evaluate((el) => el.scrollIntoView({ block: 'start' }));
          await page.evaluate(() => window.scrollBy(0, -72));
          await page.screenshot({ path: join(out, `${tag}-frame-${i + 2}-diagram-${i + 1}.png`) });
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
        // everything between the last figure and the pager (the cards after the diagrams): as many frames as it takes,
        // each opening on a heading or a row of cards and ending on a whole one, so no copy goes unseen
        if (!ONLY && figs && (await page.locator('.sd-pager').count())) {
          const span = await page.evaluate(() => {
            const figsAll = [...document.querySelectorAll('.an-figure')];
            const last = figsAll[figsAll.length - 1]!.getBoundingClientRect();
            const pager = document.querySelector('.sd-pager')!.getBoundingClientRect();
            return { top: last.bottom + window.scrollY, bottom: pager.top + window.scrollY };
          });
          await walkFrames(page, (k) => join(out, `${tag}-frame-after-${k}.png`), span.top, span.bottom);
        }
        // the end: from the first block whose run to the page's foot fits in one view, to the foot
        if (!ONLY) {
          const from = await page.evaluate((sel) => {
            const head = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
            const H = document.scrollingElement!.scrollHeight;
            const tops = [...document.querySelectorAll<HTMLElement>(sel)].map((el) => el.getBoundingClientRect().top + window.scrollY).filter((t) => H - t <= window.innerHeight - head - 16);
            return Math.min(...tops, H - 1);
          }, BLOCKS);
          await walkFrames(page, () => join(out, `${tag}-frame-${figs + 2}-end.png`), from, Infinity, 1);
        }
        // the previous/next links, opening on the pager itself
        if (!ONLY && (await page.locator('.sd-pager').count())) {
          const top = await page.locator('.sd-pager').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
          await walkFrames(page, () => join(out, `${tag}-frame-pager.png`), top - 1, top + 2, 1);
        }
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
if (defects.length) {
  console.error(defects.join('\n'));
  console.error(`GATE FAILED: ${defects.length} defects`);
  process.exit(1);
}
console.log('GATE OK — captures in', out);
