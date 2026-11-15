/**
 * Search boxes (src/components/SearchBox.astro + src/scripts/search-combobox.ts). Suggestions are
 * stubbed in the browser (page.route), so this runs the same locally and against QA/stage.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const HITS = [
  { id: 1, type: 'article', title: 'أَحمد شوقي', slug: 'ahmad', locale: 'ar', href: '/ar/articles/ahmad/', thumbnailUrl: null, excerpt: null, publishedAt: '2026-11-01T00:00:00.000Z' },
  { id: 2, type: 'cards', title: 'بطاقات أحمد', slug: 'cards', locale: 'ar', href: '/ar/articles/cards/', thumbnailUrl: null, excerpt: null, publishedAt: '2026-11-02T00:00:00.000Z' },
];

/** The videos API's suggestions, in the browser: none by default (so QA's real videos never show up here). */
async function stubVideoSuggest(page: Page, body: unknown = []) {
  const seen: string[] = [];
  await page.route('**/api/search/suggestions**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  });
  return seen;
}

async function stubSuggest(page: Page, status = 200) {
  await stubVideoSuggest(page);
  const seen: string[] = [];
  await page.route('**/api/public/v1/search/suggest**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: status === 200 ? JSON.stringify(HITS) : JSON.stringify({ error: 'not_found' }),
    });
  });
  return seen;
}

test('ar: the header box suggests as you type, with the combobox ARIA, marks and keyboard', async ({ page }) => {
  const seen = await stubSuggest(page);
  await page.goto('/ar/');
  const box = page.getByRole('combobox', { name: 'ابحث في المرئيات والمقالات' });
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  await box.fill('احمد');
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  expect(new URL(seen[seen.length - 1]!).searchParams.get('q')).toBe('احمد');
  await expect(list.getByRole('option')).toHaveCount(3);
  await expect(list.getByRole('group')).toHaveCount(2);
  await expect(list.locator('mark').first()).toHaveText('أَحمد');
  await expect(page.locator('form[data-search] [role="status"]').first()).toHaveText('اقتراحان');

  const results = await new AxeBuilder({ page }).include('form[data-search]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);

  await box.press('ArrowDown');
  const first = list.getByRole('option').first();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(box).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);
  await box.press('Escape');
  await expect(list).toBeHidden();
});

test('en: Enter with no suggestion picked runs the full search; the search is remembered', async ({ page }) => {
  await stubSuggest(page);
  await page.goto('/en/');
  const box = page.getByRole('combobox', { name: 'Search videos and articles' });
  await box.fill('prayer times');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/en\/search\?q=prayer\+times$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search');
  const pageBox = page.locator('#page-search-input');
  await expect(pageBox).toHaveValue('prayer times');

  // The empty header box shows the recent search on focus.
  await expect(page.locator('form[data-search][data-enhanced="true"]')).toHaveCount(2);
  const header = page.locator('#site-search-input');
  await header.focus();
  await expect(page.locator('#site-search-list').getByRole('option')).toHaveText(['prayer times×']);
  await page.getByRole('button', { name: 'Clear recent searches' }).first().click();
  await expect(page.locator('#site-search-list')).toBeHidden();
});

test('en: the suggest endpoint failing leaves the full search working', async ({ page }) => {
  await stubSuggest(page, 404);
  await page.goto('/en/');
  const box = page.getByRole('combobox', { name: 'Search videos and articles' });
  await box.fill('ramadan');
  await page.waitForTimeout(400);
  await expect(page.getByRole('listbox')).toBeHidden();
  await box.press('Enter');
  await expect(page).toHaveURL(/\/en\/search\?q=ramadan$/);
  expect((await page.goto('/en/search?q=ramadan'))?.status()).toBe(200);
});

test('ar: the header box suggests matching videos after the scholars, linking to the videos site', async ({ page }) => {
  await stubSuggest(page);
  const seen = await stubVideoSuggest(page, [
    { text: 'الصبر في الشدائد', type: 'video', id: 'vid-sabr', thumbnailUrl: null, subtitle: 'قناة العلم', metadata: { videoId: 'vid-sabr', isShort: false, duration: 754 } },
  ]);
  await page.goto('/ar/');
  const box = page.getByRole('combobox', { name: 'ابحث في المرئيات والمقالات' });
  await box.fill('الصبر');
  const list = page.getByRole('listbox');
  await expect(list.getByRole('group')).toHaveCount(3);
  await expect(list.getByRole('group').first()).toContainText('المرئيات');
  expect(new URL(seen[seen.length - 1]!).searchParams.get('types')).toBe('video');
  const results = await new AxeBuilder({ page }).include('form[data-search]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  // Picking it opens its watch page on the videos site
  await page.route('**/ar/video/vid-sabr', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>watch</title>' }));
  await box.press('ArrowDown');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/ar\/video\/vid-sabr$/);
});

test.describe('full search: videos', () => {
  test.skip(!!process.env.WWW_URL, 'the videos answer comes from the local stub (e2e/stub-video-search.ts)');

  for (const l of ['en', 'ar'] as const) {
    test(`${l}: page 1 lists matching videos (watch links, duration or Short) above the articles`, async ({ page }) => {
      const res = await page.goto(`/${l}/search?q=${encodeURIComponent(l === 'ar' ? 'الصبر' : 'patience')}`);
      expect(res?.status()).toBe(200);
      const section = page.locator('[data-search-videos]');
      await expect(section.getByRole('heading', { level: 3 })).toHaveText(l === 'ar' ? 'المرئيات' : 'Videos');
      const links = section.locator('.search-video-link');
      await expect(links).toHaveCount(2);
      await expect(links.first()).toHaveAttribute('href', new RegExp(`/${l}/video/stub-video-1$`));
      await expect(links.first()).toContainText(l === 'ar' ? 'الصبر في الشدائد' : 'Patience in hard times');
      await expect(links.first().locator('.search-video-badge')).toHaveText('12:34');
      await expect(links.nth(1).locator('.search-video-badge')).toHaveText(l === 'ar' ? 'مقطع قصير' : 'Short');
      await expect(section.locator('.search-video-channel').first()).toHaveText(l === 'ar' ? 'قناة العلم' : 'Knowledge channel');
      await expect(section.locator('.search-section-more')).toHaveAttribute('href', new RegExp(`/${l}/search\\?q=`));
      // The articles section follows (the stub CMS has no search: its message, not an error page)
      await expect(page.locator('#search-posts-heading')).toHaveText(l === 'ar' ? 'مقالات' : 'Articles');
      const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    });
  }

  test('no matching videos: no Videos section; page 2 shows none either', async ({ page }) => {
    await page.goto('/en/search?q=novideos');
    await expect(page.locator('[data-search-videos]')).toHaveCount(0);
    await expect(page.locator('#search-posts-heading')).toHaveText('Articles');
    await page.goto('/en/search?q=patience&page=2');
    await expect(page.locator('[data-search-videos]')).toHaveCount(0);
  });
});
