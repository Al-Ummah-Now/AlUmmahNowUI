import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SYSTEM_DESIGN_PAGES = [
  '',
  'video-pipeline/',
  'delivery-caching/',
  'data/',
  'async/',
  'realtime/',
  'identity/',
  'ai/',
  'cost/',
  'scaling/',
  'clients/',
  'release/',
];

test.describe('responsive diagrams & expanded viewer', () => {
  test('no system-design page has horizontal or figure overflow at 390px and 1440px in en and ar', async ({ page }) => {
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      for (const lang of ['en', 'ar'] as const) {
        for (const slug of SYSTEM_DESIGN_PAGES) {
          await page.goto(`/${lang}/system-design/${slug}`);
          await page.evaluate(() => document.fonts.ready);

          const result = await page.evaluate(() => {
            const pageOverflow = document.documentElement.scrollWidth - window.innerWidth;
            const frames = [...document.querySelectorAll<HTMLElement>('.an-frame')];
            const problems: string[] = [];
            for (const frame of frames) {
              if (frame.scrollWidth > frame.clientWidth + 1) {
                problems.push(`frame scrollWidth ${frame.scrollWidth} > clientWidth ${frame.clientWidth}`);
              }
              const surface = [...frame.querySelectorAll<HTMLElement>('.an-diagram-surface')].find(
                (el) => getComputedStyle(el).display !== 'none',
              );
              if (!surface) {
                problems.push('no visible diagram surface');
                continue;
              }
              if (surface.scrollWidth > surface.clientWidth + 1 || surface.scrollHeight > surface.clientHeight + 1) {
                problems.push(`surface overflow ${surface.scrollWidth}x${surface.scrollHeight} > ${surface.clientWidth}x${surface.clientHeight}`);
              }
              const svg = surface.querySelector<SVGSVGElement>('svg.an');
              if (!svg) {
                problems.push('missing svg.an');
                continue;
              }
              const r = svg.getBoundingClientRect();
              const fr = frame.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) problems.push('zero-size svg');
              if (r.width > fr.width + 1) problems.push(`svg width ${r.width} > frame width ${fr.width}`);
              const vb = svg.viewBox.baseVal;
              if (vb.width > 0 && vb.height > 0) {
                const expectedRatio = vb.width / vb.height;
                const actualRatio = r.width / r.height;
                if (Math.abs(expectedRatio - actualRatio) > 0.05) {
                  problems.push(`aspect ratio drift ${actualRatio.toFixed(3)} vs ${expectedRatio.toFixed(3)}`);
                }
              }
            }
            return { pageOverflow, frameCount: frames.length, problems };
          });

          expect(result.frameCount, `/${lang}/system-design/${slug} @ ${width}px`).toBeGreaterThanOrEqual(3);
          expect(result.pageOverflow, `/${lang}/system-design/${slug} @ ${width}px page overflow`).toBeLessThanOrEqual(0);
          expect(result.problems, `/${lang}/system-design/${slug} @ ${width}px`).toEqual([]);
        }
      }
    }
  });

  test('viewer opens from button and diagram click, fits, zooms, pans, navigates, traps focus, and closes cleanly', async ({ page }) => {
    const csp: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy/i.test(m.text())) csp.push(m.text());
    });

    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/system-design/video-pipeline/');
    await page.evaluate(() => document.fonts.ready);

    const firstExpand = page.locator('[data-diagram-expand]').first();
    await firstExpand.click();

    const viewer = page.locator('[data-diagram-viewer]');
    await expect(viewer).toBeVisible();
    await expect(viewer).toHaveAttribute('role', 'dialog');
    await expect(viewer).toHaveAttribute('aria-modal', 'true');

    // Axe clean while open
    const axe = await new AxeBuilder({ page }).include('[data-diagram-viewer]').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    const pctEl = viewer.locator('[data-viewer-zoom-pct]');
    const fitText = await pctEl.textContent();
    expect(fitText).toMatch(/^\d+%$/);

    // Diagram fits centered inside the stage initially (all four edges inside stage)
    const fitBox = await viewer.evaluate((el) => {
      const stage = el.querySelector('[data-viewer-stage]')!.getBoundingClientRect();
      const svg = el.querySelector('[data-viewer-canvas] svg.an')!.getBoundingClientRect();
      return {
        fitsW: svg.width <= stage.width + 2,
        fitsH: svg.height <= stage.height + 2,
        inL: svg.left >= stage.left - 2,
        inR: svg.right <= stage.right + 2,
        inT: svg.top >= stage.top - 2,
        inB: svg.bottom <= stage.bottom + 2,
      };
    });
    expect(fitBox).toEqual({ fitsW: true, fitsH: true, inL: true, inR: true, inT: true, inB: true });

    // Zoom in via button & keyboard, zoom out, reset via Fit
    const zoomIn = viewer.locator('[data-viewer-zoom-in]');
    const zoomOut = viewer.locator('[data-viewer-zoom-out]');
    const fitBtn = viewer.locator('[data-viewer-fit]');

    await zoomIn.click();
    const afterZoomIn = await pctEl.textContent();
    expect(parseInt(afterZoomIn ?? '0', 10)).toBeGreaterThan(parseInt(fitText ?? '0', 10));

    await page.keyboard.press('+');
    const afterPlusKey = await pctEl.textContent();
    expect(parseInt(afterPlusKey ?? '0', 10)).toBeGreaterThan(parseInt(afterZoomIn ?? '0', 10));

    // Wheel zoom
    const stage = viewer.locator('[data-viewer-stage]');
    const stageBox = (await stage.boundingBox())!;
    await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
    await page.mouse.wheel(0, -120);
    const afterWheel = await pctEl.textContent();
    expect(parseInt(afterWheel ?? '0', 10)).toBeGreaterThan(parseInt(afterPlusKey ?? '0', 10));

    // Pan by drag
    const canvas = viewer.locator('[data-viewer-canvas]');
    const beforeDrag = await canvas.evaluate((el) => getComputedStyle(el).transform);
    await page.mouse.down();
    await page.mouse.move(stageBox.x + stageBox.width / 2 + 80, stageBox.y + stageBox.height / 2 + 40, { steps: 4 });
    await page.mouse.up();
    const afterDrag = await canvas.evaluate((el) => getComputedStyle(el).transform);
    expect(afterDrag).not.toBe(beforeDrag);

    // Zoom out and Fit reset
    await zoomOut.click();
    await fitBtn.click();
    await expect(pctEl).toHaveText(fitText!);

    // Next / Previous navigation
    const countEl = viewer.locator('.an-viewer-count');
    const initialCount = await countEl.textContent();
    await viewer.locator('[data-viewer-next]').click();
    expect(await countEl.textContent()).not.toBe(initialCount);
    await viewer.locator('[data-viewer-prev]').click();
    expect(await countEl.textContent()).toBe(initialCount);

    // Focus trap: Tab wraps inside the dialog
    const closeBtn = viewer.locator('[data-viewer-close]');
    await closeBtn.focus();
    await page.keyboard.press('Tab');
    const focusInside = await page.evaluate(() => !!document.activeElement?.closest('[data-diagram-viewer]'));
    expect(focusInside).toBe(true);

    // Esc closes and returns focus to the diagram's Expand button
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(firstExpand).toBeFocused();

    // Clicking the diagram surface itself also opens the viewer, and Close button exits
    await page.locator('.an-diagram-surface:visible').nth(1).click();
    await expect(viewer).toBeVisible();
    await viewer.locator('[data-viewer-close]').click();
    await expect(viewer).toBeHidden();
    await expect(page.locator('[data-diagram-expand]').nth(1)).toBeFocused();

    expect(csp).toEqual([]);
  });

  test('Arabic RTL viewer uses Eastern Arabic numerals and RTL controls', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/system-design/');
    await page.evaluate(() => document.fonts.ready);

    const expandBtn = page.locator('[data-diagram-expand]').first();
    await expect(expandBtn).toContainText('تكبير');
    await expandBtn.click();

    const viewer = page.locator('[data-diagram-viewer]');
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('.an-viewer-count')).toHaveText(/^[٠-٩]+ \/ [٠-٩]+$/);
    await expect(viewer.locator('[data-viewer-zoom-pct]')).toHaveText(/^[٠-٩]+[٪%\u061c]+$/);
    expect(await viewer.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
    const arFitBox = await viewer.evaluate((el) => {
      const stage = el.querySelector('[data-viewer-stage]')!.getBoundingClientRect();
      const svg = el.querySelector('[data-viewer-canvas] svg.an')!.getBoundingClientRect();
      return {
        inL: svg.left >= stage.left - 2,
        inR: svg.right <= stage.right + 2,
        inT: svg.top >= stage.top - 2,
        inB: svg.bottom <= stage.bottom + 2,
      };
    });
    expect(arFitBox).toEqual({ inL: true, inR: true, inT: true, inB: true });

    // RTL keyboard navigation: ArrowLeft advances to next diagram in RTL
    const before = await viewer.locator('.an-viewer-count').textContent();
    await page.keyboard.press('ArrowLeft');
    expect(await viewer.locator('.an-viewer-count').textContent()).not.toBe(before);

    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
  });
});
