/**
 * Card posts read whole inside lists (CardViewer `inline`, src/scripts/cards.ts initInline): the
 * Articles list and the home timeline show every card a summary carries, with the title and date
 * linking to the post. Also the one-language article rule (docs/SPEC.md §4).
 *
 * Local only: the stub CMS (e2e/stub-blocks.ts) serves /posts and the card posts; the home timeline
 * comes from the seeded FEED KV (e2e/seed-feed.ts).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const LOCAL = !process.env.WWW_URL || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(process.env.WWW_URL);
test.skip(!LOCAL, 'needs the stub CMS (local E2E)');
test.use({ reducedMotion: 'reduce' });

const strip = (page: Page, title: string) => page.getByRole('region', { name: new RegExp(`^(Cards|بطاقات): ${title}$`) });
const pos = (viewer: Locator) => viewer.locator('[data-ci-pos]');
const live = (viewer: Locator) => viewer.locator('[data-ci-live]');

/** The card a strip shows: the slide whose box sits inside the track's box. */
async function shown(viewer: Locator): Promise<number> {
  return viewer.locator('[data-track]').evaluate((track) => {
    const t = track.getBoundingClientRect();
    const slides = [...track.querySelectorAll<HTMLElement>('.ci-slide')];
    return slides.findIndex((s) => Math.abs(s.getBoundingClientRect().left - t.left) < 2) + 1;
  });
}

/** A box in page coordinates (bounding boxes are viewport-relative, and the page may scroll). */
async function pageBox(v: Locator) {
  return v.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
  });
}

/** Sum of layout-shift scores since load (scrolling inside the strip does not count, by design). */
async function cls(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let sum = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) sum += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(sum), 300);
      }),
  );
}

async function axeAndShot(page: Page, name: string, project: string) {
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll('img')) img.loading = 'eager';
    await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => ((i.onload = r), (i.onerror = r)))));
    await document.fonts.ready;
  });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const dir = `e2e-artifacts/${project}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`)).toEqual([]);
}

test.describe('Articles list: card posts inline', () => {
  test('en: every card, title and date link to the post, lazy after the first', async ({ page }, info) => {
    await page.goto('/en/articles/');
    const madinah = strip(page, 'A day in Madinah');
    await expect(madinah).toHaveAttribute('data-ready', '');
    await expect(madinah.locator('.ci-slide')).toHaveCount(5);
    await expect(madinah.locator('.ci-count')).toHaveText('5 cards');
    // Real, selectable text on every card, in the HTML (not only the visible one).
    await expect(madinah.locator('.ci-slide').nth(3).locator('.cv-heading')).toHaveText('Cool marble');
    const item = page.locator('.articles-item', { has: madinah });
    await expect(item.getByRole('heading', { name: 'A day in Madinah' }).getByRole('link')).toHaveAttribute('href', '/en/articles/a-day-in-madinah/');
    await expect(item.locator('time')).toHaveAttribute('datetime', '2026-11-07T08:00:00.000Z');
    // The first card of the first item is the LCP candidate; every later card waits (lazy).
    const imgs = madinah.locator('.ci-slide img');
    await expect(imgs.first()).toHaveAttribute('loading', 'eager');
    await expect(imgs.first()).toHaveAttribute('fetchpriority', 'high');
    for (const i of [2, 3, 4]) await expect(imgs.nth(i)).toHaveAttribute('loading', 'lazy');
    // A strip on screen readies its second card (a swipe never lands on a blank frame).
    await madinah.scrollIntoViewIfNeeded();
    await expect(imgs.nth(1)).toHaveAttribute('loading', 'eager');
    // CMS variants: AVIF/WebP sources would be here with a srcset; the stub has none, so a sized <img>.
    await expect(imgs.first()).toHaveAttribute('width', '1080');
    // Articles without cards keep their excerpt.
    await expect(page.locator('.articles-item', { hasText: 'Community iftar this Friday' })).toContainText('A short excerpt for the list.');
    await axeAndShot(page, 'articles-inline-en', info.project.name);
  });

  test('en: buttons, keys and the live "Card N of M" text, no layout shift', async ({ page }) => {
    await page.goto('/en/articles/');
    const v = strip(page, 'A day in Madinah');
    await expect(v).toHaveAttribute('data-ready', '');
    const box = await pageBox(v);
    const next = v.getByRole('button', { name: 'Next card' });
    const back = v.getByRole('button', { name: 'Previous card' });
    await expect(back).toBeDisabled();
    await expect(pos(v)).toHaveText('1 / 5');
    await next.click();
    await expect(pos(v)).toHaveText('2 / 5');
    await expect(live(v)).toHaveText('Card 2 of 5');
    await expect.poll(() => shown(v)).toBe(2);
    // The neighbours of the card shown load now.
    await expect(v.locator('.ci-slide').nth(2).locator('img')).toHaveAttribute('loading', 'eager');
    // Keys while focus is in the viewer: → forward in English, End and Home.
    await v.locator('[data-track]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(pos(v)).toHaveText('3 / 5');
    await page.keyboard.press('End');
    await expect(pos(v)).toHaveText('5 / 5');
    await expect(live(v)).toHaveText('Card 5 of 5');
    await expect(next).toBeDisabled();
    await expect.poll(() => shown(v)).toBe(5);
    await page.keyboard.press('Home');
    await expect(pos(v)).toHaveText('1 / 5');
    await expect.poll(() => shown(v)).toBe(1);
    // Keys do nothing to a strip when focus is elsewhere (no hijacked page scrolling).
    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('ArrowRight');
    await expect(pos(v)).toHaveText('1 / 5');
    // A fixed 4:5 frame: the list never moved.
    expect(await pageBox(v)).toEqual(box);
    expect(await cls(page)).toBeLessThan(0.01);
  });

  test('a post longer than the list carries ends with "See all 13 cards"', async ({ page }) => {
    await page.goto('/en/articles/');
    const v = strip(page, 'Thirteen lanterns');
    await expect(v.locator('.ci-count')).toHaveText('13 cards');
    await expect(v.locator('.ci-slide')).toHaveCount(11); // 10 cards + the link
    await v.locator('[data-track]').focus();
    await page.keyboard.press('End');
    await expect(pos(v)).toHaveText('See all 13 cards');
    const more = v.getByRole('link', { name: 'See all 13 cards' });
    await expect(more).toHaveAttribute('href', '/en/articles/thirteen-lanterns/');
    await more.click();
    await expect(page).toHaveURL(/\/en\/articles\/thirteen-lanterns\/$/);
    await expect(page.locator('[data-cards] .cv-slide')).toHaveCount(13);
  });

  test('ar (RTL): Next sits on the left, ← goes forward, the strip scrolls leftward', async ({ page }, info) => {
    await page.goto('/ar/articles/');
    const v = strip(page, 'رحلة إلى القدس');
    await expect(v).toHaveAttribute('data-ready', '');
    await expect(v.locator('.ci-count')).toHaveText('4 بطاقات');
    const next = v.getByRole('button', { name: 'البطاقة التالية' });
    const back = v.getByRole('button', { name: 'البطاقة السابقة' });
    expect((await next.boundingBox())!.x).toBeLessThan((await back.boundingBox())!.x);
    await next.click();
    await expect(pos(v)).toHaveText('2 من 4');
    await expect(live(v)).toHaveText('البطاقة 2 من 4');
    await expect.poll(() => shown(v)).toBe(2);
    expect(await v.locator('[data-track]').evaluate((t) => t.scrollLeft)).toBeLessThan(0);
    // The second card is the one to the left of the first.
    const [a, b] = [await v.locator('.ci-slide').nth(0).boundingBox(), await v.locator('.ci-slide').nth(1).boundingBox()];
    expect(b!.x).toBeLessThan(a!.x);
    await v.locator('[data-track]').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(pos(v)).toHaveText('3 من 4');
    await page.keyboard.press('ArrowRight');
    await expect(pos(v)).toHaveText('2 من 4');
    await expect.poll(() => shown(v)).toBe(2);
    await axeAndShot(page, 'articles-inline-ar', info.project.name);
  });

  test('square cards keep a square frame; a card of another shape shows whole', async ({ page }) => {
    await page.goto('/ar/articles/');
    const v = strip(page, 'بطاقات التوحيد');
    await expect(v).toHaveClass(/cv-r11/);
    const frame = (await v.locator('.cv-frame').first().boundingBox())!;
    expect(Math.abs(frame.width - frame.height)).toBeLessThan(1);
    await expect(v.locator('.ci-slide').nth(0).locator('img')).not.toHaveClass(/cv-contain/);
    await expect(v.locator('.ci-slide').nth(2).locator('img')).toHaveClass(/cv-contain/); // 4:5 in a square frame
    // English 4:5 posts stay 4:5; their 16:9 card is shown whole.
    await page.goto('/en/articles/');
    const m = strip(page, 'A day in Madinah');
    await expect(m).toHaveClass(/cv-r45/);
    await expect(m.locator('.ci-slide').nth(2).locator('img')).toHaveClass(/cv-contain/);
  });

  test('swipe on touch moves card by card, in the reading direction', async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== 'chromium' || !isMobile, 'real touch gestures need Chromium (CDP) on a phone');
    const cdp = await page.context().newCDPSession(page);
    // A finger drag in small steps (raw touch events: the browser scrolls and snaps natively),
    // past the half-way point so snapping settles on the next card.
    const gesture = async (v: Locator, dir: 1 | -1) => {
      const track = v.locator('[data-track]');
      await track.scrollIntoViewIfNeeded();
      const r = (await track.boundingBox())!;
      const y = Math.round(r.y + r.height / 2);
      const from = Math.round(r.x + r.width / 2 - (dir * r.width * 0.35));
      const step = (dir * r.width * 0.7) / 12;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
      for (let i = 1; i <= 12; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(from + step * i), y }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await page.goto('/en/articles/');
    const en = strip(page, 'A day in Madinah');
    await expect(en).toHaveAttribute('data-ready', '');
    await gesture(en, -1); // finger right → left: forward in English
    await expect(pos(en)).toHaveText('2 / 5');
    await expect.poll(() => shown(en)).toBe(2);
    await gesture(en, 1);
    await expect(pos(en)).toHaveText('1 / 5');

    await page.goto('/ar/articles/');
    const ar = strip(page, 'رحلة إلى القدس');
    await expect(ar).toHaveAttribute('data-ready', '');
    await gesture(ar, 1); // finger left → right: forward in Arabic
    await expect(pos(ar)).toHaveText('2 من 4');
    await expect.poll(() => shown(ar)).toBe(2);
  });

  test('works without JS: every card is in the page and the strip scrolls', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/en/articles/');
    const v = strip(page, 'A day in Madinah');
    await expect(v.locator('.ci-slide')).toHaveCount(5);
    await expect(v.locator('.ci-nav')).toBeHidden(); // the buttons need the script
    const track = v.locator('[data-track]');
    await expect(track).toHaveAttribute('tabindex', '0'); // keyboard-scrollable region
    expect(await track.evaluate((t) => t.scrollWidth > t.clientWidth * 4)).toBe(true);
    await context.close();
  });
});

test.describe('home timeline: card posts inline', () => {
  test('en: all five cards in the feed card, with the title linking to the post', async ({ page }, info) => {
    await page.goto('/en/');
    const v = strip(page, 'Five lessons from Surat al-Kahf');
    await expect(v).toHaveAttribute('data-ready', '');
    await expect(v.locator('.ci-slide')).toHaveCount(5);
    await expect(v.locator('.ci-count')).toHaveText('5 cards');
    const card = page.locator('.tl-card', { has: v });
    await expect(card.getByRole('heading', { name: 'Five lessons from Surat al-Kahf' }).getByRole('link')).toHaveAttribute('href', /\/en\/articles\/post-30\/$/);
    await expect(card.locator('time[datetime]')).toHaveCount(1);
    const box = await pageBox(v);
    await v.getByRole('button', { name: 'Next card' }).click();
    await expect(pos(v)).toHaveText('2 / 5');
    await expect(live(v)).toHaveText('Card 2 of 5');
    await expect(v.locator('.ci-slide').nth(1).locator('.cv-heading')).toHaveText('Lesson two');
    await v.locator('[data-track]').focus();
    await page.keyboard.press('End');
    await expect.poll(() => shown(v)).toBe(5);
    expect(await pageBox(v)).toEqual(box);
    expect(await cls(page)).toBeLessThan(0.01);
    await axeAndShot(page, 'timeline-inline-en', info.project.name);
  });

  test('ar: the strip runs right to left', async ({ page }, info) => {
    await page.goto('/ar/');
    const v = strip(page, 'خمس فوائد من سورة الكهف');
    await expect(v).toHaveAttribute('data-ready', '');
    await expect(v.locator('.ci-count')).toHaveText('5 بطاقات');
    await v.getByRole('button', { name: 'البطاقة التالية' }).click();
    await expect(pos(v)).toHaveText('2 من 5');
    await expect.poll(() => shown(v)).toBe(2);
    expect(await v.locator('[data-track]').evaluate((t) => t.scrollLeft)).toBeLessThan(0);
    await axeAndShot(page, 'timeline-inline-ar', info.project.name);
  });
});

test.describe('an article in one language only (docs/SPEC.md §4)', () => {
  test('shown with "Only available in العربية", linked to its own URL, noindex', async ({ page }) => {
    const res = await page.goto('/en/articles/rihla-ila-al-quds/');
    expect(res?.status()).toBe(200);
    const note = page.getByRole('note');
    await expect(note).toContainText('This article is only available in العربية.');
    await expect(note.getByRole('link', { name: 'Read it in العربية' })).toHaveAttribute('href', '/ar/articles/rihla-ila-al-quds/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ar\/articles\/rihla-ila-al-quds\/$/);
    await expect(page.locator('main')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('[data-cards] .cv-slide')).toHaveCount(4);
  });

  test('a translation under another slug: 301 to it (alternates)', async ({ request }) => {
    const res = await request.get('/ar/articles/ramadan-nights/', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toMatch(/\/ar\/articles\/layali-ramadan\/$/);
    expect((await request.get('/en/articles/layali-ramadan/', { maxRedirects: 0 })).headers().location).toMatch(/\/en\/articles\/ramadan-nights\/$/);
  });
});
