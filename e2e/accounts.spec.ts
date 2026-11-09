/**
 * "If you are signed in, you are signed in" on www.
 *
 * 1. Client probe with auth stubbed (runs everywhere, including CI against local wrangler dev):
 *    the header asks {AUTH}/session/accounts; never loops; degrades to "Sign in".
 * 2. Real QA auth: e2e/accounts-signed-in.spec.ts (types the seed password, so no traces).
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
