/**
 * Full-page screenshots of every page for review (wiki AUN-DEV-SITE; UI PRs wait for the owner's look):
 * desktop 1440 and phone 390, English and Arabic, dark and light mode.
 *
 *   DEV_SITE_URL=http://127.0.0.1:4323 node --experimental-strip-types scripts/screenshots.ts [outDir]
 *
 * Run against `npm run preview` (wrangler dev serving dist/). Writes <outDir>/<mode>-<viewport>-<locale>-<page>.png.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { LOCALES, PAGES, pagePath } from '../src/lib/pages.ts';

const base = process.env.DEV_SITE_URL ?? 'http://127.0.0.1:4323';
const out = resolve(process.argv[2] ?? 'screenshots');
mkdirSync(out, { recursive: true });

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;

async function shoot(browser: Browser, mode: 'dark' | 'light', vp: keyof typeof VIEWPORTS, locale: string, path: string, name: string) {
  const ctx = await browser.newContext({
    viewport: VIEWPORTS[vp],
    deviceScaleFactor: vp === 'phone' ? 2 : 1,
    colorScheme: mode,
    reducedMotion: 'reduce',
    isMobile: vp === 'phone',
    hasTouch: vp === 'phone',
  });
  const page = await ctx.newPage();
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const file = resolve(out, `${mode}-${vp}-${locale}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  process.stdout.write(`${file}\n`);
}

const browser = await chromium.launch();
try {
  for (const mode of ['dark', 'light'] as const) {
    for (const vp of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
      for (const locale of LOCALES) {
        for (const slug of PAGES) await shoot(browser, mode, vp, locale, pagePath(locale, slug), slug || 'home');
        await shoot(browser, mode, vp, locale, `/${locale}/no-such-page/`, '404');
      }
    }
  }
} finally {
  await browser.close();
}
