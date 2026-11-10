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

async function stubSuggest(page: Page, status = 200) {
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
  const box = page.getByRole('combobox', { name: 'ابحث في المقالات' });
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
  const box = page.getByRole('combobox', { name: 'Search articles' });
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
  const box = page.getByRole('combobox', { name: 'Search articles' });
  await box.fill('ramadan');
  await page.waitForTimeout(400);
  await expect(page.getByRole('listbox')).toBeHidden();
  await box.press('Enter');
  await expect(page).toHaveURL(/\/en\/search\?q=ramadan$/);
  expect((await page.goto('/en/search?q=ramadan'))?.status()).toBe(200);
});
