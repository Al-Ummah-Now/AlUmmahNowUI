import { expect, test } from '@playwright/test';
import { gateInBrowser } from './diagram-gate';

/**
 * The diagram quality gate (docs/SYSTEM-DESIGN-OUTLINE.md): on every System design page, in both
 * languages and both modes, at the desktop and phone widths of the Playwright projects, no icon
 * leaves its node or exceeds 48px, no two labels touch, no wire crosses a node it does not connect,
 * nothing leaves the viewBox, and every node has its icon. Motion is reduced so frames are stable.
 */
const PAGES = ['', 'video-pipeline/', 'delivery-caching/', 'data/', 'async/', 'realtime/', 'identity/', 'ai/', 'cost/', 'scaling/', 'clients/', 'release/'];
/** Every page shows 3 to 5 diagrams (owner request 2026-11-19). */
const MIN_DIAGRAMS = 3;

for (const lang of ['en', 'ar'])
  for (const mode of ['light', 'dark'] as const)
    for (const slug of PAGES)
      test(`diagrams: /${lang}/system-design/${slug} (${mode})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
        await page.addInitScript((m) => localStorage.setItem('aun_mode', m), mode);
        await page.goto(`/${lang}/system-design/${slug}`);
        await page.evaluate(() => document.fonts.ready);
        const visible = await page.locator('svg.an').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).length);
        expect(visible, 'diagrams on the page').toBeGreaterThanOrEqual(MIN_DIAGRAMS);
        const defects = await page.evaluate(gateInBrowser);
        expect(defects, defects.join('\n')).toEqual([]);
        // no horizontal scroll at any width
        const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
