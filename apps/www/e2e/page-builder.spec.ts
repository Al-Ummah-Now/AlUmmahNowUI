/**
 * The page builder on www (wiki AUN-CMS-PAGE-BUILDER): the shared sample page, one of every block type,
 * rendered by the shared renderer (src/lib/blocks.ts, src/components/Blocks.astro) in English and
 * Arabic, dark and light, on every project's viewport. Local only: the stub CMS serves the page the
 * way the CMS serves it (e2e/stub-blocks.ts). The CMS repo's e2e/local/page-builder.local.spec.ts
 * covers editor → publish → public API.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { SAMPLE_TYPES } from '../../../packages/render/src/page-blocks/page-blocks.sample.generated.ts';
import { SAMPLE_THUMB_IMAGE, SAMPLE_THUMBS, stubImage } from './stub-blocks.ts';

const LOCAL = !process.env.WWW_URL || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(process.env.WWW_URL);
test.skip(!LOCAL, 'needs the stub CMS (local E2E)');

/** Answers the sample's video thumbnails in the browser (they name the videos origin; nothing leaves the machine). */
async function thumbs(page: Page) {
  await page.route(`${SAMPLE_THUMBS}**`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: stubImage(SAMPLE_THUMB_IMAGE) }));
}

/** Loads every lazy image (scrolls through), then axe (AA) and a full-page screenshot. */
async function axeAndShot(page: Page, name: string, project: string) {
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll('img')) img.loading = 'eager';
    const settle = (i: HTMLImageElement) =>
      new Promise((r) => {
        i.addEventListener('load', r, { once: true });
        i.addEventListener('error', r, { once: true });
      });
    await Promise.all([...document.images].filter((i) => !i.complete).map(settle));
    await document.fonts.ready;
  });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const dir = `e2e-artifacts/${project}`;
  mkdirSync(dir, { recursive: true });
  // CSS pixels: the whole sample page at a phone's 3x density would pass Chromium's 32767px limit
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true, scale: 'css' });
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
}

const PAGES = [
  { locale: 'en', path: '/en/every-block/', h1: 'Videos, Shorts and posts from the community', faq: 'Is Al Ummah Now free to watch?' },
  { locale: 'ar', path: '/ar/kull-al-kutal/', h1: 'مرئيات ومقاطع قصيرة ومنشورات من المجتمع', faq: 'هل المشاهدة في الأمة الآن مجانية؟' },
] as const;

for (const p of PAGES) {
  for (const scheme of ['dark', 'light'] as const) {
    test(`the sample page renders every block type (${p.locale}, ${scheme})`, async ({ page }, info) => {
      await thumbs(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(p.path);
      await expect(page.locator('html')).toHaveAttribute('dir', p.locale === 'ar' ? 'rtl' : 'ltr');
      const root = page.locator('[data-testid=page-blocks] .pb');
      await expect(root).toHaveAttribute('lang', p.locale);

      // One of every type, in the sample's order; a page opening with a hero shows no header of its own.
      const types = await page.locator('[data-block-type]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-block-type')))]);
      expect([...types].sort()).toEqual([...SAMPLE_TYPES].sort());
      await expect(page.locator('.page-head')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('[data-block-type=hero] h1')).toHaveText(p.h1);

      // www's parts inside the renderer's frames: responsive pictures, the video facade, the card grid and posts.
      await expect(page.locator('[data-block-type=image] img')).toHaveAttribute('width', '1200');
      await expect(page.locator('[data-block-type=video] .facade, [data-block-type=video] .pb-facade').first()).toBeVisible();
      await expect(page.locator('[data-block-type=cards] .card-tile').first()).toBeVisible();
      await expect(page.locator('[data-block-type=posts] .articles-item').first()).toBeVisible();
      // Site paths get the locale; the contact block goes to www's contact page.
      await expect(page.locator('[data-block-type=hero] a').first()).toHaveAttribute('href', `/${p.locale}/videos/`);

      // The FAQ opens and closes without JS.
      const qa = page.locator('[data-block-type=faq] details').first();
      await qa.locator('summary').click();
      await expect(qa).toHaveAttribute('open', '');
      if (p.faq) await expect(qa.locator('summary')).toHaveText(p.faq);

      // No block overflows the viewport sideways (phones included).
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      await axeAndShot(page, `page-builder-${p.locale}-${scheme}`, info.project.name);
    });
  }
}
