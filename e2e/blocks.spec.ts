/**
 * Pages built from blocks and card posts (src/components/Blocks.astro, CardViewer.astro,
 * src/scripts/cards.ts). Local only: the stub CMS (e2e/stub-blocks.ts) serves /pages/stories,
 * /pages/qisas, the card posts and /cards. The CMS repo's e2e/blocks.spec.ts covers editor → API.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Local: the default webServer, or a local `wrangler dev` on another port (WWW_URL=http://localhost:…).
const LOCAL = !process.env.WWW_URL || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(process.env.WWW_URL);
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (k: string, id: number) => {
  const exp = Math.floor(Date.now() / 1000) + 1800;
  return `v1.${b64({ k, id, iat: exp - 1800, exp })}.good`;
};

test.skip(!LOCAL, 'needs the stub CMS (local E2E)');

/** Loads every lazy image (scrolls through), then axe (AA) and a full-page screenshot. */
async function axeAndShot(page: Page, name: string, project: string, fullPage = true) {
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
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

/** A horizontal touch swipe on `selector` (pointer events, as on a phone). */
async function swipe(page: Page, selector: string, dx: number) {
  await page.locator(selector).first().evaluate((el, dx) => {
    const r = el.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const x = r.left + r.width / 2;
    const ev = (type: string, cx: number) => new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: cx, clientY: y, isPrimary: true });
    el.dispatchEvent(ev('pointerdown', x - dx / 2));
    el.dispatchEvent(ev('pointerup', x + dx / 2));
  }, dx);
}

const viewer = (page: Page) => page.locator('[data-cards]');
const current = (page: Page) => page.locator('.cv-slide:not([hidden])');

test.describe('pages built from blocks', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`en page renders every block (${scheme})`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: scheme });
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && /Content Security Policy/.test(m.text()) && errors.push(m.text()));
      const res = await page.goto('/en/stories/');
      expect(res?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stories');
      await expect(page.getByRole('heading', { name: 'Stories from the Ummah' })).toBeVisible();
      await expect(page.locator('.blk-text strong')).toHaveText('one card at a time');
      // Images carry their size (no layout shift) and the first one is the LCP image.
      const hero = page.locator('.blk-image img');
      await expect(hero).toHaveAttribute('width', '1600');
      await expect(hero).toHaveAttribute('fetchpriority', 'high');
      await expect(page.locator('.blk-image figcaption')).toHaveText('Sunrise, seen from the hills.');
      await expect(page.locator('.blk-gallery li')).toHaveCount(3);
      await expect(page.locator('.blk-gallery')).toHaveClass(/blk-cols-3/);
      await expect(page.locator('.blk-quote blockquote')).toContainText('Travel through the earth');
      await expect(page.getByRole('note')).toHaveText('Every story is checked by our editors before it is published.');
      await expect(page.getByRole('heading', { name: 'Share your story' })).toBeVisible();
      await expect(page.locator('hr.blk-rule')).toHaveCount(1);
      const news = page.getByRole('region', { name: 'Latest news' });
      await expect(news.getByRole('link', { name: 'Community iftar this Friday' })).toBeVisible();
      await expect(news.locator('.articles-item').nth(1).locator('.cards-inline .ci-count')).toHaveText('2 cards');
      await expect(news.locator('.articles-item').nth(1).locator('.ci-slide')).toHaveCount(2);
      await expect(page.getByRole('link', { name: 'Contact the team' })).toHaveAttribute('href', '/en/contact');
      // The card grid: first card's image and heading, the count, a tag filter and paging.
      const grid = page.getByRole('region', { name: 'Card stories' });
      await expect(grid.locator('.card-tile')).toHaveCount(3);
      await expect(grid.locator('.card-tile').first()).toContainText('5 cards');
      await expect(grid.getByRole('link', { name: /A day in Madinah/ })).toHaveAttribute('href', '/en/articles/a-day-in-madinah/');
      await expect(grid.getByRole('navigation', { name: 'Filter by topic' }).getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
      await expect(grid.getByRole('link', { name: /Older/ })).toHaveAttribute('href', '/en/stories/?page=2');
      expect(errors).toEqual([]);
      await axeAndShot(page, `blocks-en-${scheme}`, info.project.name);
    });
  }

  test('card grid filter and paging are links with their own URLs', async ({ page }) => {
    await page.goto('/en/stories/');
    const grid = page.getByRole('region', { name: 'Card stories' });
    await grid.getByRole('link', { name: 'travel' }).click();
    await expect(page).toHaveURL(/\/en\/stories\/\?tag=travel$/);
    await expect(grid.locator('.card-tile')).toHaveCount(2);
    await expect(grid.getByRole('link', { name: 'travel' })).toHaveAttribute('aria-current', 'page');
    await page.goto('/en/stories/?page=2');
    await expect(grid.locator('.card-tile')).toHaveCount(1);
    await expect(grid.getByText('Page 2 of 2')).toBeVisible();
    // Past the end (an old link): the last page, not an empty grid.
    await page.goto('/en/stories/?page=9');
    await expect(grid.locator('.card-tile')).toHaveCount(1);
  });

  test('ar page renders right-to-left', async ({ page }, info) => {
    await page.goto('/ar/qisas/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.blocks')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.blocks')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { name: 'قصص بالبطاقات' })).toBeVisible();
    await expect(page.locator('.card-tile')).toHaveCount(1);
    await expect(page.locator('.card-tile')).toContainText('4 بطاقات');
    await expect(page.getByRole('link', { name: 'راسل الفريق' })).toHaveAttribute('href', '/ar/contact');
    await axeAndShot(page, 'blocks-ar', info.project.name);
  });

  test('a draft built from blocks previews as blocks', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit keeps no Secure cookie on http://localhost');
    await page.goto(`/preview?token=${token('pages', 3)}`);
    await expect(page).toHaveURL(/\/preview\/pages\/3$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stories (draft)');
    await expect(page.locator('.blk-gallery li')).toHaveCount(3);
    await expect(page.getByRole('note')).toBeVisible();
  });
});

test.describe('card posts', () => {
  test.use({ reducedMotion: 'reduce' });

  test('en: next and back, keys, dots, the address bar, no layout shift', async ({ page }, info) => {
    const res = await page.goto('/en/articles/a-day-in-madinah/');
    expect(res?.status()).toBe(200);
    await expect(viewer(page)).toHaveAttribute('data-ready', '');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/media\/10\.png$/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Before dawn/);
    await expect(current(page)).toHaveCount(1);
    await expect(current(page).getByRole('heading', { name: 'Before dawn' })).toBeVisible();
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('1 / 5');
    const back = page.getByRole('link', { name: 'Previous card' });
    const next = page.getByRole('link', { name: 'Next card' });
    await expect(back).toHaveAttribute('aria-disabled', 'true');
    // Neighbours load ahead (eager); far slides wait.
    await expect(page.locator('#card-2 img')).toHaveAttribute('loading', 'eager');
    await expect(page.locator('#card-5 img')).toHaveAttribute('loading', 'lazy');
    // Where the arrows sit inside the viewer (page scroll doesn't matter): it must never move.
    const navAt = () => page.locator('.cv-nav').evaluate((el) => el.getBoundingClientRect().top - el.closest('[data-cards]')!.getBoundingClientRect().top);
    const navTop = await navAt();

    await next.click();
    await expect(current(page).getByRole('heading', { name: 'The umbrellas open' })).toBeVisible();
    await expect(page).toHaveURL(/\?slide=2$/);
    await expect(page.locator('[data-live]')).toHaveText('Card 2 of 5');
    expect(await navAt()).toBe(navTop); // the frame never resizes
    // The text is real text (selectable), not baked into the image.
    expect(await current(page).locator('.cv-body').evaluate((el) => getComputedStyle(el).userSelect)).not.toBe('none');

    await current(page).locator('.cv-frame').click({ position: { x: 10, y: 200 } });
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('3 / 5');
    // Home / End need focus in the viewer (on the page they scroll).
    await next.focus();
    await page.keyboard.press('End');
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('5 / 5');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('4 / 5');
    await page.getByRole('link', { name: 'Go to card 1' }).click();
    await expect(page).toHaveURL(/\/a-day-in-madinah\/$/);
    await expect(page.getByRole('link', { name: 'Go to card 1' })).toHaveAttribute('aria-current', 'step');

    await swipe(page, '.cv-stage', -120);
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('2 / 5');
    await swipe(page, '.cv-stage', 120);
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('1 / 5');
    await axeAndShot(page, 'card-post-en', info.project.name);
  });

  test('deep links: ?slide=N from the server, #N in the browser, junk falls back', async ({ page }) => {
    await page.goto('/en/articles/a-day-in-madinah/?slide=4');
    await expect(current(page).getByRole('heading', { name: 'Cool marble' })).toBeVisible();
    await expect(page.locator('#card-4 img')).toHaveAttribute('fetchpriority', 'high');
    await page.goto('/en/articles/a-day-in-madinah/#3');
    await expect(viewer(page)).toHaveAttribute('data-ready', '');
    await expect(current(page).getByRole('heading', { name: 'The city wakes' })).toBeVisible();
    await page.goto('/en/articles/a-day-in-madinah/?slide=99');
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('1 / 5');
  });

  test('works without JS: the arrows are links', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/en/articles/a-day-in-madinah/');
    await expect(page.locator('.cv-enlarge:visible')).toHaveCount(0);
    await page.getByRole('link', { name: 'Next card' }).click();
    await expect(page).toHaveURL(/\?slide=2$/);
    await expect(current(page).getByRole('heading', { name: 'The umbrellas open' })).toBeVisible();
    await ctx.close();
  });

  test('enlarge: navigation continues, Esc closes on the same card, focus returns', async ({ page }, info) => {
    await page.goto('/en/articles/a-day-in-madinah/');
    await expect(viewer(page)).toHaveAttribute('data-ready', '');
    await current(page).getByRole('button', { name: 'Enlarge card 1' }).click();
    const dlg = page.getByRole('dialog', { name: 'Enlarged cards' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Close' })).toBeFocused();
    await expect(dlg.locator('.lb-pos')).toHaveText('1 / 5');
    await expect(dlg.getByRole('heading', { name: 'Before dawn' })).toBeVisible();
    await dlg.getByRole('button', { name: 'Next card' }).click();
    await expect(dlg.locator('.lb-pos')).toHaveText('2 / 5');
    await page.keyboard.press('ArrowRight');
    await expect(dlg.locator('.lb-pos')).toHaveText('3 / 5');
    await expect(dlg.locator('.lb-live')).toHaveText('Card 3 of 5');
    await swipe(page, '.lb-stage', -120);
    await expect(dlg.locator('.lb-pos')).toHaveText('4 / 5');
    // Focus stays in the dialog (modal): Tab cycles its buttons.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
    }
    await axeAndShot(page, 'card-post-enlarged', info.project.name, false); // the dialog covers the viewport
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await expect(page).toHaveURL(/\?slide=4$/);
    await expect(current(page).getByRole('heading', { name: 'Cool marble' })).toBeVisible();
    await expect(current(page).getByRole('button', { name: 'Enlarge card 4' })).toBeFocused();
  });

  test('ar (dark): Next points left, ← goes forward, → goes back', async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/ar/articles/rihla-ila-al-quds/');
    await expect(viewer(page)).toHaveAttribute('data-ready', '');
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('1 من 4');
    const next = page.getByRole('link', { name: 'البطاقة التالية' });
    const back = page.getByRole('link', { name: 'البطاقة السابقة' });
    // In RTL the Next arrow sits on the left.
    const [nb, bb] = [await next.boundingBox(), await back.boundingBox()];
    expect(nb!.x).toBeLessThan(bb!.x);
    await current(page).locator('.cv-frame').click({ position: { x: 200, y: 200 } });
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('2 من 4');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('1 من 4');
    // Swipe left-to-right is forward in Arabic.
    await swipe(page, '.cv-stage', 120);
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('2 من 4');
    await current(page).getByRole('button', { name: /كبّر/ }).click();
    const dlg = page.getByRole('dialog');
    await page.keyboard.press('ArrowLeft');
    await expect(dlg.locator('.lb-pos')).toHaveText('3 من 4');
    await page.keyboard.press('Escape');
    await expect(page.locator('.cv-pos [data-pos]')).toHaveText('3 من 4');
    await axeAndShot(page, 'card-post-ar-dark', info.project.name);
  });

  test('an Arabic card post draft previews in the viewer', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit keeps no Secure cookie on http://localhost');
    await page.goto(`/preview?token=${token('posts', 4)}`);
    await expect(page).toHaveURL(/\/preview\/posts\/4$/);
    await expect(viewer(page)).toHaveAttribute('data-ready', '');
    await expect(page.locator('.cv-slide')).toHaveCount(4);
    await page.getByRole('link', { name: 'البطاقة التالية' }).click();
    await expect(page).toHaveURL(/\/preview\/posts\/4\?slide=2$/);
  });
});
