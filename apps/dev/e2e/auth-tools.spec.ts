import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { LOCALES } from '../src/lib/pages';

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const token = () => {
  const now = Math.floor(Date.now() / 1000);
  return `${enc({ alg: 'ES256', kid: 'k' })}.${enc({ mode: 'access', type: 'user', iss: 'https://auth.example.com', aud: 'app', sub: 'user:1', iat: now, exp: now + 900 })}.sig`;
};

for (const locale of LOCALES) {
  test(`${locale}: both tools work, send nothing, store nothing and stay out of the address`, async ({ page, context }) => {
    const requests: string[] = [];
    await page.goto(`/${locale}/auth/tools/`, { waitUntil: 'networkidle' });
    page.on('request', (r) => requests.push(r.url()));
    const address = page.url();

    await page.locator('#rq-make').click();
    await expect(page.locator('#rq-client')).toBeFocused();
    await expect(page.locator('#rq-client-err')).toBeVisible();
    await expect(page.locator('#rq-out')).toBeHidden();
    await page.locator('#rq-client').fill('my-app');
    await page.locator('#rq-make').click();
    await expect(page.locator('#rq-url')).toContainText('code_challenge_method=S256');
    await expect(page.locator('#rq-client-err')).toBeHidden();
    const first = await page.locator('#rq-verifier').textContent();
    await page.locator('#rq-make').click();
    await expect(page.locator('#rq-verifier')).not.toHaveText(first!);

    await page.locator('#tk-text').fill(token());
    await expect(page.locator('#tk-checks li')).toHaveCount(4);
    await expect(page.locator('#tk-checks .tool-bad')).toHaveCount(0);
    // minutes in the page's own numerals
    await expect(page.locator('#tk-checks')).toContainText(locale === 'ar' ? '١٥' : '15');
    await expect(page.locator('#tk-payload')).toContainText('"mode": "access"');
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.locator('#tk-text').fill('user:usr_1:abc-def');
    await expect(page.locator('#tk-note')).toBeVisible();
    await expect(page.locator('#tk-out')).toBeHidden();
    await page.locator('#tk-clear').click();
    await expect(page.locator('#tk-text')).toHaveValue('');

    expect(requests).toEqual([]);
    expect(page.url()).toBe(address);
    expect(await context.cookies()).toEqual([]);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toContain('my-app');
    expect(stored).not.toContain('ES256');
  });
}

test('a token is gone after leaving the page and coming back', async ({ page }) => {
  await page.goto('/en/auth/tools/');
  await page.locator('#tk-text').fill(token());
  await page.goto('/en/auth/');
  await page.goBack();
  await expect(page.locator('#tk-text')).toHaveValue('');
  await expect(page.locator('#tk-out')).toBeHidden();
});
