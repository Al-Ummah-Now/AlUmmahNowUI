import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AUTH_PAGES, LOCALES } from '../src/lib/pages';

for (const locale of LOCALES) {
  test(`${locale}: the reference filters, switches samples and opens the endpoint its address names`, async ({ page }) => {
    await page.goto(`/${locale}/auth/reference/#token`, { waitUntil: 'networkidle' });
    await expect(page.locator('#token details')).toHaveAttribute('open', '');
    const all = await page.locator('[data-ref-op]').count();

    await page.locator('#ref-find').fill('introspect');
    await expect(page.locator('[data-ref-op]:visible')).toHaveCount(1);
    await expect(page.locator('[data-ref-group]:visible')).toHaveCount(1);
    await expect(page.locator('#ref-count')).toContainText(locale === 'ar' ? '١' : '1');
    // a group's heading as the page shows it, and in the other language
    const heading = (await page.locator('[data-ref-group] h2').first().textContent())!;
    const inGroup = await page.locator('[data-ref-group]').first().locator('[data-ref-op]').count();
    for (const words of [heading, locale === 'ar' ? 'Discovery' : 'الاكتشاف']) {
      await page.locator('#ref-find').fill(words);
      expect(await page.locator('[data-ref-group]').first().locator('[data-ref-op]:visible').count(), words).toBe(inGroup);
    }
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

for (const locale of LOCALES)
  for (const slug of AUTH_PAGES)
    test(`/${locale}/${slug}/ fits 320 px, every endpoint open`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(`/${locale}/${slug}/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelectorAll<HTMLDetailsElement>('[data-ref-op] details').forEach((d) => (d.open = true)));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });

test('ar: every Latin token is isolated and reads left to right', async ({ page }) => {
  await page.goto('/ar/auth/reference/', { waitUntil: 'networkidle' });
  const bad = await page.evaluate(() => {
    document.querySelectorAll<HTMLDetailsElement>('[data-ref-op] details').forEach((d) => (d.open = true));
    const out: string[] = [];
    const walk = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const text = n.textContent ?? '';
      const el = n.parentElement!;
      if (!el.getClientRects().length || el.closest('script, style, button, input')) continue;
      for (const m of text.matchAll(/[A-Za-z][\w./:{}()-]*/g)) {
        const alone = el.closest('bdi[dir="ltr"], code[dir="ltr"], [dir="ltr"], pre');
        if (!alone) {
          out.push(`not isolated: ${m[0]}`);
          continue;
        }
        const at = (i: number) => {
          range.setStart(n!, i);
          range.setEnd(n!, i + 1);
          return range.getBoundingClientRect();
        };
        // along one line, each character is right of the one before
        for (let i = m.index! + 1; i < m.index! + m[0].length; i++) {
          const [a, b] = [at(i - 1), at(i)];
          if (Math.abs(a.top - b.top) < 2 && b.left < a.left - 0.5) {
            out.push(`reversed: ${m[0]}`);
            break;
          }
        }
      }
    }
    return [...new Set(out)];
  });
  expect(bad).toEqual([]);
});
