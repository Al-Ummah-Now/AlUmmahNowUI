/**
 * "If you are signed in, you are signed in" on www.
 *
 * 1. Client probe with auth stubbed (runs everywhere, including CI against local wrangler dev):
 *    the header asks {AUTH}/session/accounts; never loops; degrades to "Sign in".
 * 2. Real QA auth (deploy-qa.yml: WWW_URL is QA and QA_SEED_PASSWORD is set): signed in to
 *    auth → www shows the account without a click; two accounts → the menu lists both and
 *    switching works.
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import { AUTH_URL, WWW_URL } from './env';

const WWW_ORIGIN = new URL(WWW_URL).origin;
const cors = { 'Access-Control-Allow-Origin': WWW_ORIGIN, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' };

/**
 * Stubs auth: /session/accounts answers `accounts`; /authorize answers login_required.
 * Playwright does not route requests reached through a server redirect, so www's
 * /auth/login is fetched here and its redirect to /authorize answered directly.
 */
async function stubAuth(page: Page, accounts: (route: Route) => Promise<void>) {
  const calls = { accounts: 0, authorize: [] as URL[] };
  await page.route(`${AUTH_URL}/session/accounts`, async (route) => {
    calls.accounts++;
    await accounts(route);
  });
  await page.route((u) => u.origin === WWW_ORIGIN && u.pathname === '/auth/login', async (route) => {
    const res = await route.fetch({ maxRedirects: 0 });
    const url = new URL(res.headers().location!);
    calls.authorize.push(url);
    const back = new URL(url.searchParams.get('redirect_uri')!);
    back.searchParams.set('error', 'login_required');
    back.searchParams.set('state', url.searchParams.get('state') ?? '');
    const headers: Record<string, string> = { Location: back.toString() };
    const setCookie = res.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie');
    if (setCookie) headers['Set-Cookie'] = setCookie.value;
    await route.fulfill({ status: 302, headers });
  });
  return calls;
}

test.describe('client probe (auth stubbed)', () => {
  test.skip(!!process.env.WWW_URL && !WWW_URL.startsWith('http://localhost'), 'stubs auth; runs against local wrangler dev');

  test('no auth session (401): stays on "Sign in", asks auth once per tab', async ({ page }) => {
    const calls = await stubAuth(page, (r) => r.fulfill({ status: 401, headers: cors, body: '{"error":"session_not_found"}' }));
    await page.goto('/en/news/');
    await expect.poll(() => calls.accounts).toBe(1);
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    await page.goto('/en/');
    await page.waitForLoadState('networkidle');
    expect(calls.accounts).toBe(1);
    expect(calls.authorize).toHaveLength(0);
  });

  test('active account in auth: silent prompt=none sign-in; login_required returns to the page with no loop', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit cannot fulfill a route with a redirect (the stub needs one)');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const calls = await stubAuth(page, (r) =>
      r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ accounts: [{ userId: 'u1', isActive: true, email: 'a@example.com', name: 'A' }] }) }),
    );
    await page.goto('/ar/news/?page=1');
    await expect.poll(() => calls.authorize.length).toBe(1);
    const authorize = calls.authorize[0]!;
    expect(authorize.origin + authorize.pathname).toBe(`${AUTH_URL}/authorize`);
    expect(authorize.searchParams.get('prompt')).toBe('none');
    await expect(page).toHaveURL(/\/ar\/news\/\?page=1$/);
    await expect(page.getByRole('link', { name: 'تسجيل الدخول' }).first()).toBeVisible();
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(calls.authorize).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('accounts unreachable (CORS/network): plain "Sign in", no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const calls = await stubAuth(page, (r) => r.abort('failed'));
    await page.goto('/en/');
    await expect.poll(() => calls.accounts).toBe(1);
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    expect(calls.authorize).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('the Sign in link never forces a prompt; /auth/login forwards only none|login', async ({ request }) => {
    const plain = await request.get('/auth/login?return=/en/', { maxRedirects: 0 });
    expect(new URL(plain.headers().location!).searchParams.has('prompt')).toBe(false);
    const add = await request.get('/auth/login?prompt=login&return=/en/', { maxRedirects: 0 });
    expect(new URL(add.headers().location!).searchParams.get('prompt')).toBe('login');
    const chooser = await request.get('/auth/login?prompt=select_account&return=/en/', { maxRedirects: 0 });
    expect(new URL(chooser.headers().location!).searchParams.has('prompt')).toBe(false);
  });
});

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
    await page.fill('input[name=password]', password!);
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
