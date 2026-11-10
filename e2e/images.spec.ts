import { expect, test, type Page } from '@playwright/test';

/**
 * CMS images (CMS-10): covers and inline images are responsive <picture>s with AVIF/WebP sources,
 * a sized <img> (no layout shift), the cover eager + fetchpriority=high (LCP), inline ones lazy,
 * and the browser actually receives a modern format.
 *
 * Needs a published post with a cover; QA keeps one (`/en/news/image-variants-demo/`). Other
 * environments are searched through the sitemap; with none, the test is skipped (local runs use
 * the built-in fallback content, which has no images).
 */
async function postWithCover(page: Page): Promise<string | null> {
  const candidates = ['/en/news/image-variants-demo/'];
  const sitemap = await page.request.get('/sitemap.xml');
  if (sitemap.ok()) for (const m of (await sitemap.text()).matchAll(/<loc>[^<]*?(\/(?:en|ar)\/news\/[^<]+\/)<\/loc>/g)) candidates.push(m[1]!);
  for (const path of [...new Set(candidates)].slice(0, 12)) {
    const res = await page.request.get(path);
    if (res.ok() && (await res.text()).includes('class="cover"')) return path;
  }
  return null;
}

test('covers and inline images are responsive, sized, modern-format pictures', async ({ page, browserName }) => {
  const path = await postWithCover(page);
  test.skip(!path, 'no published post with a cover in this environment');

  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(path!);

  const cover = page.locator('picture img.cover');
  await expect(cover).toHaveCount(1);
  await expect(cover).toHaveAttribute('fetchpriority', 'high');
  await expect(cover).toHaveAttribute('loading', 'eager');
  await expect(cover).toHaveAttribute('width', /^\d+$/);
  await expect(cover).toHaveAttribute('height', /^\d+$/);
  await expect(cover).toHaveAttribute('sizes', /56rem/);
  const picture = page.locator('picture:has(img.cover)');
  await expect(picture.locator('source[type="image/avif"]')).toHaveAttribute('srcset', /\?w=\d+&f=avif \d+w/);
  await expect(picture.locator('source[type="image/webp"]')).toHaveAttribute('srcset', /\?w=\d+&f=webp \d+w/);

  // The browser picked a resized variant, and it is served as a modern format.
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const current = await cover.evaluate((img: HTMLImageElement) => img.currentSrc);
  expect(current).toMatch(/\?w=\d+&f=(avif|webp)$/);
  const res = await page.request.get(current);
  expect(res.ok()).toBe(true);
  const expected = current.endsWith('avif') ? 'image/avif' : 'image/webp';
  // Until the CMS job has made it, the original answers (X-Variant: pending); then the variant.
  if (res.headers()['x-variant'] === 'hit') expect(res.headers()['content-type']).toBe(expected);
  // Never wider than needed: the chosen width is at most the rendered width × DPR, one step up.
  const { w, rendered } = await cover.evaluate((img: HTMLImageElement) => ({ w: Number(new URL(img.currentSrc).searchParams.get('w')), rendered: img.clientWidth * devicePixelRatio }));
  expect(w).toBeLessThanOrEqual(Math.max(320, rendered * 2));

  const inline = page.locator('.prose picture img');
  if ((await inline.count()) > 0) {
    await expect(inline.first()).toHaveAttribute('loading', 'lazy');
    await expect(inline.first()).toHaveAttribute('width', /^\d+$/);
    await expect(inline.first()).toHaveAttribute('sizes', /42rem/);
    await expect(inline.first()).not.toHaveAttribute('alt', '');
  }

  // Width/height reserve the box: loading the images moves nothing.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  if (browserName === 'chromium') expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
});
