/**
 * Real QA auth (deploy-qa.yml: WWW_URL is QA and QA_SEED_PASSWORD is set): signed in to auth
 * → www shows the account without a click; two accounts → the menu lists both, switching
 * works, and Sign out walks auth's logout chain back to www.
 *
 * This file types the shared QA seed password, and E2E output is uploaded as a public
 * workflow artifact: Playwright puts action arguments in traces and in step titles
 * (`Fill "<value>"`, embedded in the HTML report even with tracing off). So tracing is off
 * here and the password goes in through fillSecret (an "Evaluate" step, no value in the
 * title). deploy-qa.yml also scans the output for the secret before uploading
 * (scripts/scan-artifacts-for-secrets.py).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { AUTH_URL, WWW_URL } from './env';

test.use({ trace: 'off' });

const WWW_ORIGIN = new URL(WWW_URL).origin;

/** Types a secret without it appearing in the report's step titles (keep tracing off too). */
async function fillSecret(field: Locator, value: string) {
  await field.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.describe('signed in to auth (real QA auth)', () => {
  const password = process.env.QA_SEED_PASSWORD;
  const remote = !!process.env.WWW_URL && !WWW_URL.startsWith('http://localhost');
  test.skip(!password || !remote, 'needs WWW_URL on QA and QA_SEED_PASSWORD (deploy-qa.yml)');
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'one browser is enough for the shared seed accounts');

  const first = process.env.QA_ADMIN_EMAIL || 'qa-admin@delivered.resend.dev';
  const second = process.env.QA_NONADMIN_EMAIL || 'qa-viewer@delivered.resend.dev';

  async function authForm(page: Page, email: string) {
    await page.waitForURL((u) => u.origin === new URL(AUTH_URL).origin);
    await page.fill('input[name=email]', email);
    await fillSecret(page.locator('input[name=password]'), password!);
    await page.click('button[data-component="button"]');
    await page.waitForURL((u) => u.origin === WWW_ORIGIN, { timeout: 30_000 });
  }
  const accountButton = (page: Page) => page.locator('#account .account-button');
  async function openMenu(page: Page) {
    await accountButton(page).click();
    await expect(page.locator('#account-menu')).toBeVisible();
  }

  test('www shows the account without a click; two accounts are listed and switching works', async ({ page, context }) => {
    test.setTimeout(120_000);
    await page.goto('/en/');
    // Auth must allow this origin for credentialed CORS (prod/stage do; QA once AlUmmahNowAuth widens it)
    const corsOk = await page.evaluate(async (auth) => {
      try {
        await fetch(`${auth}/session/accounts`, { credentials: 'include' });
        return true;
      } catch {
        return false;
      }
    }, AUTH_URL);
    test.skip(!corsOk, `${AUTH_URL} does not allow ${WWW_ORIGIN} for credentialed CORS yet`);
    // Sign in to auth (through www), then drop www's own cookies: auth still has the browser
    await page.getByRole('link', { name: 'Sign in' }).first().click();
    await authForm(page, first);
    await expect(accountButton(page)).toBeVisible();
    await context.clearCookies({ domain: new URL(WWW_URL).hostname });
    await page.evaluate(() => sessionStorage.clear());

    // Fresh page: the probe signs www in silently
    await page.goto('/en/news/');
    await expect(accountButton(page)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/en\/news\/$/);

    // Add a second account
    await openMenu(page);
    await page.getByRole('link', { name: 'Add another account' }).click();
    await authForm(page, second);
    await openMenu(page);
    const menu = page.locator('#account-menu');
    await expect(menu.locator('.account-list > li')).toHaveCount(2);
    await expect(menu.locator('.account-entry[aria-current="true"]')).toContainText(second.split('@')[0]!);

    // Switch back to the first account. Switching is POST /session/switch, then a silent
    // prompt=none round trip through auth that lands on this same URL, so the URL alone
    // proves nothing: wait for the page to actually reload, showing the first account.
    const reloaded = page.waitForEvent('framenavigated', { predicate: (f) => f === page.mainFrame(), timeout: 30_000 });
    await menu.locator('button.account-entry').click();
    await reloaded;
    await expect(accountButton(page)).toContainText(first.split('@')[0]!, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/en\/news\/$/);
    await openMenu(page);
    await expect(page.locator('#account-menu .account-entry[aria-current="true"]')).toContainText(first.split('@')[0]!);

    // Clean up: single sign-out of everything
    await page.getByRole('button', { name: 'Sign out of all accounts' }).click();
    // Auth walks every app's logout and returns to the locale home: wait for that page
    // (the current /en/news/ already satisfies a looser "back on www" check)
    await page.waitForURL((u) => u.origin === WWW_ORIGIN && u.pathname === '/en/', { timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    await expect(accountButton(page)).toHaveCount(0);
  });
});
