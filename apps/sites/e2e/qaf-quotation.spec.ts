import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { HOSTS, QAF_PASSAGE_TEXT, QAF_PASSAGE_URL, SITES_PORT } from './stub-data';

test.use({ colorScheme: 'dark' });

for (const locale of ['en', 'ar'] as const) {
  test(`shows every cited printed page on the ${locale} scholar post`, async ({ page }, testInfo) => {
    const response = await page.goto(`http://${HOSTS.both}:${SITES_PORT}/${locale}/posts/qaf-post-${locale}/`);
    expect(response?.status()).toBe(200);
    const figure = page.locator('figure.qaf-quotation');
    const quote = figure.locator('blockquote');
    await expect(quote).toHaveAttribute('dir', 'rtl');
    expect(await quote.textContent()).toBe(QAF_PASSAGE_TEXT);
    const citation = figure.getByRole('link');
    await expect(citation).toHaveAttribute('href', locale === 'ar' ? QAF_PASSAGE_URL.replace('/passages/', '/ar/passages/') : QAF_PASSAGE_URL);
    await expect(citation).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    await expect(citation).toHaveText(locale === 'ar'
      ? 'فيض القدير — عبد الرؤوف المناوي، ج ٤، ص ٢٣٣؛ ج ٤، ص ٢٣٤'
      : 'Fayd al-Qadir — Abd al-Rauf al-Munawi, vol. 4, p. 233; vol. 4, p. 234');
    const screenshots = process.env.QAF_SCREENSHOTS;
    if (screenshots && testInfo.project.name === 'desktop') {
      await mkdir(screenshots, { recursive: true });
      await page.screenshot({ path: join(screenshots, `scholar-quotation-${locale}.png`) });
    }
  });
}
