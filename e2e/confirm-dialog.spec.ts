/**
 * Destructive account actions ask first, in the site's own dialog (never window.confirm):
 * signing out of one account, or of every account, in this browser.
 * www's /auth/me and auth's account list are stubbed, so this runs against local wrangler dev.
 */
import { expect, test, type Page } from '@playwright/test';
import { AUTH_URL, WWW_URL } from './env';

const WWW_ORIGIN = new URL(WWW_URL).origin;
const cors = { 'Access-Control-Allow-Origin': WWW_ORIGIN, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' };
const accounts = [
  { userId: 'u1', isActive: true, email: 'amina@example.com', name: 'Amina' },
  { userId: 'u2', isActive: false, email: 'bilal@example.com', name: 'Bilal' },
];

/** Signed in as u1 with u2 also in auth's browser session; records sign-out requests. */
async function signedInWithTwoAccounts(page: Page) {
  const calls = { removed: [] as string[], logout: 0, dialogs: 0 };
  page.on('dialog', (d) => {
    calls.dialogs++;
    void d.dismiss();
  });
  await page.route((u) => u.origin === WWW_ORIGIN && u.pathname === '/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, sub: 'u1', name: 'Amina', email: 'amina@example.com' }) }),
  );
  await page.route(`${AUTH_URL}/session/accounts`, (r) => r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ accounts }) }));
  await page.route(`${AUTH_URL}/session/accounts/*`, (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS') {
      return r.fulfill({ status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'DELETE', 'Access-Control-Allow-Headers': 'Accept' } });
    }
    calls.removed.push(decodeURIComponent(new URL(req.url()).pathname.split('/').pop()!));
    return r.fulfill({ status: 200, headers: cors, body: '{"success":true}' });
  });
  await page.route((u) => u.origin === WWW_ORIGIN && u.pathname === '/auth/logout', (r) => {
    calls.logout++;
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>signed out</title>' });
  });
  return calls;
}

async function openMenu(page: Page) {
  await page.locator('#account .account-button').click();
  await expect(page.locator('#account-menu')).toBeVisible();
}

test.describe('confirmation dialog (auth stubbed)', () => {
  test.skip(!!process.env.WWW_URL && !WWW_URL.startsWith('http://localhost'), 'stubs auth; runs against local wrangler dev');

  test('sign out of one account: Cancel and Esc keep it; confirming removes it', async ({ page }) => {
    const calls = await signedInWithTwoAccounts(page);
    await page.goto('/en/');
    await openMenu(page);
    await page.getByRole('button', { name: 'Sign out of Bilal' }).click();

    const dialog = page.getByRole('dialog', { name: 'Sign out of Bilal?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Your other accounts stay signed in.');
    // Focus starts on the safe choice
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#account .account-button')).toBeFocused();

    await openMenu(page);
    await page.getByRole('button', { name: 'Sign out of Bilal' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(calls.removed).toEqual([]);

    await openMenu(page);
    await page.getByRole('button', { name: 'Sign out of Bilal' }).click();
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect.poll(() => calls.removed).toEqual(['u2']);
    expect(calls.dialogs).toBe(0);
  });

  test('sign out of all accounts asks first, in Arabic on /ar/', async ({ page }) => {
    const calls = await signedInWithTwoAccounts(page);
    await page.goto('/ar/');
    await openMenu(page);
    await page.getByRole('button', { name: 'تسجيل الخروج من جميع الحسابات' }).click();

    const dialog = page.getByRole('dialog', { name: 'تسجيل الخروج من جميع الحسابات؟' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'إلغاء' })).toBeFocused();
    await dialog.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dialog).toBeHidden();
    expect(calls.logout).toBe(0);

    await openMenu(page);
    await page.getByRole('button', { name: 'تسجيل الخروج من جميع الحسابات' }).click();
    await dialog.getByRole('button', { name: 'تسجيل الخروج من جميع الحسابات' }).click();
    await page.waitForURL((u) => u.pathname === '/auth/logout');
    expect(calls.logout).toBe(1);
    expect(calls.dialogs).toBe(0);
  });
});
