/**
 * www pages (AlUmmahNowCMS docs/specs/WWW-PAGES.md §6, §9): home is the hero and one timeline (no
 * rail, no tabs, no "All …" links); /videos, /articles and CMS list pages render GET /lists/:slug
 * with the timeline's cards and numbered pages; channel entries are channel cards.
 *
 * The home and route checks run everywhere (local, QA, stage). The seeded checks need the local
 * stub CMS (e2e/stub-blocks.ts serves /lists/videos with 25 items, /lists/articles and the curated
 * page `picks`) and the seeded FEED KV (e2e/seed-feed.ts: a channel entry on home).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LOCALES } from './env';

const LOCAL = !process.env.WWW_URL || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(process.env.WWW_URL);
const items = (page: Page) => page.locator('[data-days] li.tl-item');

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
}

test.describe('home is one list', () => {
  for (const l of LOCALES) {
    test(`${l}: the hero, then the timeline; no rail, no tabs, no "All …" links`, async ({ page }) => {
      const res = await page.goto(`/${l}/`);
      expect(res?.status()).toBe(200);
      await expect(page.locator('.hero')).toHaveCount(1);
      await expect(page.locator('#timeline-title')).toHaveCount(1);
      // The old "Chosen for you" rail and its links are gone
      await expect(page.locator('.tl-curated, .rail, #curated-title')).toHaveCount(0);
      await expect(page.getByRole('tablist')).toHaveCount(0);
      await expect(page.getByRole('tab')).toHaveCount(0);
      const main = page.locator('main');
      for (const name of l === 'en' ? ['Chosen for you', 'All featured videos', 'All articles'] : ['اخترناها لك', 'كل المرئيات المختارة', 'كل المقالات']) {
        await expect(main.getByText(name, { exact: true })).toHaveCount(0);
      }
      // Main's sections: the hero and the timeline only
      await expect(main.locator(':scope > section')).toHaveCount(2);
    });
  }
});

test.describe('list page routes', () => {
  for (const path of ['/en/videos/', '/ar/videos/', '/en/articles/', '/ar/articles/']) {
    test(`${path}: answers, one h1, ?page= validated`, async ({ page, request }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      for (const bad of ['0', 'abc', '01', '-1']) expect((await request.get(`${path}?page=${bad}`)).status(), bad).toBe(404);
    });
  }

  test('/videos keeps "Explore all videos"', async ({ page }) => {
    await page.goto('/en/videos/');
    await expect(page.locator('.page-head').getByRole('link', { name: 'Explore all videos' })).toHaveAttribute('href', /^https:\/\/videos\./);
  });
});

test.describe('list pages from /lists (stub CMS)', () => {
  test.skip(!LOCAL, 'needs the stub CMS (local E2E)');

  test('/videos: the timeline cards, a channel card, numbered pages with rel prev/next', async ({ page, request }) => {
    await page.goto('/en/videos/');
    await expect(page.locator('h1')).toHaveText('Videos');
    await expect(items(page)).toHaveCount(20);
    // Pages are numbered, never "Load more"
    await expect(page.getByRole('link', { name: 'Load more' })).toHaveCount(0);
    const nav = page.getByRole('navigation', { name: 'Pages' });
    await expect(nav.locator('[aria-current="page"]')).toHaveText('1');
    await expect(nav.locator('a[rel="next"]')).toHaveAttribute('href', '/en/videos/?page=2');
    await expect(nav.locator('a[rel="prev"]')).toHaveCount(0);
    // The channel card: name, @handle, 3 latest videos linking to their watch pages, Visit channel
    const channel = page.locator('li.tl-item', { has: page.locator('.tl-channel') });
    await expect(channel).toHaveCount(1);
    await expect(channel.getByRole('heading', { name: 'Knowledge channel' })).toHaveCount(1);
    await expect(channel.getByText('@knowledge')).toBeVisible();
    const latest = channel.getByRole('list', { name: 'Latest videos from Knowledge channel' }).getByRole('link');
    await expect(latest).toHaveCount(3);
    await expect(latest.first()).toHaveAttribute('href', /\/en\/video\/stub-latest-1$/);
    await expect(channel.getByRole('link', { name: 'Visit channel' })).toHaveAttribute('href', /\/en\/@knowledge$/);
    // An ItemList of the video items (their watch pages carry the VideoObject; wiki AUN-SEO)
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.filter((s) => s.includes('"ItemList"')).length).toBeGreaterThan(0);
    expect(ld.filter((s) => s.includes('"VideoObject"'))).toHaveLength(0);
    expect(await axe(page)).toEqual([]);

    await nav.locator('a[rel="next"]').click();
    await expect(page).toHaveURL(/\/en\/videos\/\?page=2$/);
    await expect(items(page)).toHaveCount(5);
    await expect(page.getByRole('navigation', { name: 'Pages' }).locator('a[rel="prev"]')).toHaveAttribute('href', '/en/videos/');
    await expect(page).toHaveTitle(/Page 2 of 2/);
    // Past the last page, the CMS said so: 404
    expect((await request.get('/en/videos/?page=3')).status()).toBe(404);
  });

  test('/ar/videos: right to left, the channel card in Arabic, the handle kept left to right', async ({ page }) => {
    await page.goto('/ar/videos/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const channel = page.locator('.tl-channel');
    await expect(channel.getByRole('heading', { name: 'قناة العلم' })).toHaveCount(1);
    await expect(channel.locator('bdi[dir="ltr"]')).toHaveText('@knowledge');
    await expect(channel.getByRole('link', { name: 'زيارة القناة' })).toHaveAttribute('href', /\/ar\/@knowledge$/);
    await expect(channel.getByRole('list', { name: 'أحدث مرئيات قناة العلم' }).getByRole('link')).toHaveCount(3);
    await expect(page.locator('.tl-channel .tl-kind')).toHaveText('قناة');
    expect(await axe(page)).toEqual([]);
  });

  test('/articles: posts and card posts as timeline cards', async ({ page }) => {
    await page.goto('/en/articles/');
    await expect(page.locator('h1')).toHaveText('Articles');
    await expect(page.locator('li.tl-item', { hasText: 'Community iftar this Friday' }).getByRole('link', { name: 'Community iftar this Friday' })).toHaveAttribute('href', '/en/articles/community-iftar/');
    await expect(page.getByRole('navigation', { name: 'Pages' })).toHaveCount(0); // one page
  });

  test('a curated CMS page: pinned first, then its items', async ({ page }) => {
    const res = await page.goto('/en/picks/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText('Editors’ picks');
    await expect(page.locator('.tl-pinned .tl-card-pinned')).toContainText('New Qur’an classes for children');
    await expect(items(page)).toHaveCount(2);
    await expect(page.locator('.tl-channel')).toHaveCount(1);
    expect((await page.request.get('/en/picks/?page=2')).status()).toBe(404);
    expect(await axe(page)).toEqual([]);
  });

  test('a content page still renders as before', async ({ page }) => {
    await page.goto('/en/stories/');
    await expect(page.locator('h1')).toHaveText('Stories');
    await expect(page.locator('[data-timeline]')).toHaveCount(0);
  });

  test('home: a channel entry is a channel card', async ({ page }) => {
    await page.goto('/en/');
    const channel = page.locator('.tl-channel');
    await expect(channel.getByRole('heading', { name: 'Knowledge channel' })).toHaveCount(1);
    await expect(channel.getByRole('list', { name: 'Latest videos from Knowledge channel' }).getByRole('link')).toHaveCount(3);
    await expect(channel.getByRole('link', { name: 'Visit channel' })).toHaveAttribute('href', /\/en\/@knowledge$/);
  });
});
