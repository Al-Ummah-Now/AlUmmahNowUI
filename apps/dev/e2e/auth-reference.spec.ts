import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { LOCALES } from '../src/lib/pages';

for (const locale of LOCALES) {
  test(`${locale}: the reference filters, switches samples and opens the endpoint its address names`, async ({ page }) => {
    await page.goto(`/${locale}/auth/reference/#token`, { waitUntil: 'networkidle' });
    await expect(page.locator('#token details')).toHaveAttribute('open', '');
    const all = await page.locator('[data-ref-op]').count();

    await page.locator('#ref-find').fill('introspect');
    await expect(page.locator('[data-ref-op]:visible')).toHaveCount(1);
    await expect(page.locator('[data-ref-group]:visible')).toHaveCount(1);
    await expect(page.locator('#ref-count')).toContainText(locale === 'ar' ? '١' : '1');
    await page.locator('#ref-find').fill('zzzz');
    await expect(page.locator('[data-ref-none]')).toBeVisible();
    await page.locator('#ref-find').fill('');
    await expect(page.locator('[data-ref-op]:visible')).toHaveCount(all);

    await expect(page.locator('#token [data-sample="curl"]')).toBeVisible();
    await page.getByRole('radio', { name: 'Python' }).check();
    await expect(page.locator('#token [data-sample="python"]')).toBeVisible();
    await expect(page.locator('#token [data-sample="curl"]')).toBeHidden();

    // everything open: nothing unreadable, nothing wider than the page
    await page.evaluate(() => document.querySelectorAll<HTMLDetailsElement>('[data-ref-op] details').forEach((d) => (d.open = true)));
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    // an address that names an endpoint the filter hid clears the filter
    await page.locator('#ref-find').fill('introspect');
    await page.evaluate(() => (location.hash = '#userinfo'));
    await expect(page.locator('#userinfo')).toBeVisible();
    await expect(page.locator('#ref-find')).toHaveValue('');
  });

  test.describe(`${locale} without scripts`, () => {
    test.use({ javaScriptEnabled: false });
    test('every endpoint and the curl samples still read', async ({ page }) => {
      await page.goto(`/${locale}/auth/reference/`);
      await expect(page.locator('[data-ref-tools]')).toBeHidden();
      await page.locator('#token summary').click();
      await expect(page.locator('#token [data-sample="curl"]')).toBeVisible();
    });
  });
}
