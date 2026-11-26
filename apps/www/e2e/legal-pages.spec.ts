import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { LOCALES } from './env';

const TITLES = {
  en: { privacy: 'Privacy Policy', terms: 'Terms of Service' },
  ar: { privacy: 'سياسة الخصوصية', terms: 'شروط الاستخدام' },
} as const;

const PRIVACY_DISCLOSURES = {
  en: { guest: 'Reporting content without an account', hash: 'IPv6 network prefixes (/64 and /48)', retention: 'at least one year' },
  ar: { guest: 'الإبلاغ عن محتوى دون حساب', hash: 'بطولي ٦٤ و٤٨ بتًا', retention: 'سنة واحدة على الأقل' },
} as const;

for (const l of LOCALES) {
  for (const slug of ['privacy', 'terms'] as const) {
    test(`${l}: /${l}/${slug}/ renders frosted-glass sections, canonical, hreflang, and passes a11y`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      const res = await page.goto(`/${l}/${slug}/`);
      expect(res?.status()).toBe(200);
      await page.evaluate(() => document.fonts.ready);

      await expect(page.locator('html')).toHaveAttribute('lang', l);
      await expect(page.locator('html')).toHaveAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLES[l][slug]);

      const cards = page.locator('[data-testid="page-sections"] .pb-glass');
      expect(await cards.count()).toBeGreaterThanOrEqual(5);
      if (slug === 'privacy') {
        const { guest, hash, retention } = PRIVACY_DISCLOSURES[l];
        await expect(cards.filter({ has: page.getByRole('heading', { name: guest, exact: true }) })).toContainText(hash);
        await expect(cards.filter({ hasText: retention })).toBeVisible();
      }

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(new URL(canonical!).pathname).toBe(`/${l}/${slug}/`);

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(blocking).toEqual([]);
    });
  }

  test(`${l}: footer links to privacy and terms`, async ({ page }) => {
    await page.goto(`/${l}/`);
    await expect(page.locator(`footer a[href="/${l}/privacy/"]`)).toBeVisible();
    await expect(page.locator(`footer a[href="/${l}/terms/"]`)).toBeVisible();
  });
}

test('bare /privacy and /terms redirect to negotiated locale', async ({ request }) => {
  const en = await request.get('/privacy', { headers: { 'Accept-Language': 'en-US,en;q=0.9' }, maxRedirects: 0 });
  expect(en.status()).toBe(302);
  expect(en.headers().location).toBe('/en/privacy/');

  const ar = await request.get('/terms', { headers: { 'Accept-Language': 'ar-SA,ar;q=0.9' }, maxRedirects: 0 });
  expect(ar.status()).toBe(302);
  expect(ar.headers().location).toBe('/ar/terms/');
});
