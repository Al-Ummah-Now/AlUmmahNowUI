/**
 * Real QA auth (deploy-qa.yml: WWW_URL is QA and QA_SEED_PASSWORD is set): signed in to auth
 * → www shows the account without a click; two accounts → the menu lists both, switching
 * works, and Sign out walks auth's logout chain back to www.
 *
 * Types the shared QA seed password: tracing is off and the password goes in through
 * fillSecret (see real-auth.ts for why).
 */
import { expect, test } from '@playwright/test';
import { accountButton, authAccountCount, authForm, openMenu, REAL_AUTH, WWW_ORIGIN } from './real-auth';
import { WWW_URL } from './env';

test.use({ trace: 'off' });

test.describe('signed in to auth (real QA auth)', () => {
  test.skip(!REAL_AUTH, 'needs WWW_URL on QA and QA_SEED_PASSWORD (deploy-qa.yml)');
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'one browser is enough for the shared seed accounts');

  const first = process.env.QA_ADMIN_EMAIL || 'qa-admin@delivered.resend.dev';
  const second = process.env.QA_NONADMIN_EMAIL || 'qa-viewer@delivered.resend.dev';

  test('www shows the account without a click; two accounts are listed and switching works', async ({ page, context }) => {
    test.setTimeout(120_000);
    await page.goto('/en/');
    // Auth allows www for credentialed CORS and has no session for this fresh browser yet
    expect(await authAccountCount(page)).toBe(0);
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
