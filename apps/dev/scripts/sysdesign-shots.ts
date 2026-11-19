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
import { extname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { gateInBrowser } from '../e2e/diagram-gate.ts';

const out = process.argv[2];
if (!out) throw new Error('usage: sysdesign-shots.ts <outDir> [--pages=a/,b/] [--record]');
const pagesArg = process.argv.find((a) => a.startsWith('--pages='));
const PAGES = pagesArg ? pagesArg.slice(8).split(',') : ['', 'video-pipeline/'];
const RECORD = process.argv.includes('--record');
const DIST = join(import.meta.dirname, '../dist');
mkdirSync(out, { recursive: true });

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml' };
const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let f = join(DIST, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const browser = await chromium.launch();
const WIDTHS = { desktop: { width: 1440, height: 900, dsf: 2 }, phone: { width: 412, height: 915, dsf: 3 } } as const;
const name = (slug: string) => (slug ? slug.replace(/\/$/, '') : 'hub');
const defects: string[] = [];

for (const slug of PAGES)
  for (const lang of ['en', 'ar'])
    for (const mode of ['dark', 'light'] as const)
      for (const [w, vp] of Object.entries(WIDTHS)) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, colorScheme: mode, reducedMotion: 'no-preference' });
        await ctx.addInitScript((m) => localStorage.setItem('aun_mode', m), mode);
        const page = await ctx.newPage();
        await page.goto(`${base}/${lang}/system-design/${slug}`);
        await page.evaluate(() => document.fonts.ready);
        // freeze motion at a mid-flow instant so frames show pulses in flight
        await page.evaluate(() => {
          for (const s of document.querySelectorAll<SVGSVGElement>('svg.an')) {
            s.pauseAnimations();
            s.setCurrentTime(2.2);
          }
          for (const a of document.getAnimations()) {
            a.pause();
            a.currentTime = 400;
          }
        });
        const found = await page.evaluate(gateInBrowser);
        for (const d of found) defects.push(`${name(slug)} ${lang} ${mode} ${w}: ${d}`);
        const tag = `${name(slug)}-${mode}-${w}-${lang}`;
        const H = await page.evaluate(() => document.scrollingElement!.scrollHeight);
        // viewport frames: top, then each diagram centred, then the end
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: join(out, `${tag}-frame-1-top.png`) });
        const figs = await page.locator('.an-figure').count();
        for (let i = 0; i < figs; i++) {
          const fig = page.locator('.an-figure').nth(i);
          await fig.evaluate((el) => el.scrollIntoView({ block: 'start' }));
          await page.evaluate(() => window.scrollBy(0, -72));
          await page.screenshot({ path: join(out, `${tag}-frame-${i + 2}-diagram-${i + 1}.png`) });
          const svg = fig.locator('svg.an:visible');
          const id = await svg.getAttribute('data-diagram');
          await svg.screenshot({ path: join(out, `${tag}-diagram-${id}.png`) });
        }
        await page.evaluate((h) => window.scrollTo(0, h), H);
        await page.screenshot({ path: join(out, `${tag}-frame-${figs + 2}-end.png`) });
        await ctx.close();
      }

if (RECORD) {
  // one recording per animated diagram: dark, desktop, English; plus the pipeline on a phone
  const jobs: { slug: string; id: string; w: keyof typeof WIDTHS; secs: number }[] = [
    { slug: '', id: 'hero', w: 'desktop', secs: 9 },
    { slug: '', id: 'overview', w: 'desktop', secs: 9 },
    { slug: 'video-pipeline/', id: 'pipeline', w: 'desktop', secs: 0 },
    { slug: 'video-pipeline/', id: 'pipeline', w: 'phone', secs: 0 },
    { slug: 'video-pipeline/', id: 'sketch-play', w: 'desktop', secs: 8 },
  ];
  for (const mode of ['dark', 'light'] as const)
    for (const j of jobs) {
      const vp = WIDTHS[j.w];
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: j.w === 'phone' ? 2 : 1.5, colorScheme: mode });
      await ctx.addInitScript((m) => localStorage.setItem('aun_mode', m), mode);
      const page = await ctx.newPage();
      await page.goto(`${base}/en/system-design/${j.slug}`);
      await page.evaluate(() => document.fonts.ready);
      const svg = page.locator(`svg.an[data-diagram="${j.id}"]:visible`);
      await svg.scrollIntoViewIfNeeded();
      // a numbered flow records exactly one cycle, so the clip loops seamlessly
      const secs = j.secs || (await svg.evaluate((s) => Number(s.querySelector('.an-lit animate')?.getAttribute('dur')?.replace('s', '') ?? 10)));
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
        await svg.screenshot({ path: join(dir, `f${String(i).padStart(4, '0')}.png`) });
      }
      const stem = join(out, `${j.id}-${mode}-${j.w}-en`);
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
