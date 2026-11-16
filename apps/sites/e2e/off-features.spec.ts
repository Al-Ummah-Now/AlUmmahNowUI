/**
 * Sign-in not configured (no valid SESSION_SECRET): a scholar site shows no Sign in and no account
 * menu, and /auth/login and /auth/callback are 404 (owner rule: off = invisible, no "not available"
 * text). Runs only as `SITES_FEATURES_OFF=1 npx playwright test` (playwright.config.ts), where
 * wrangler dev starts with SESSION_SECRET=off.
 */
import { expect, test } from '@playwright/test';
import { HOSTS, SITES_PORT } from './stub-data.ts';

const at = (host: string, path = '/') => `http://${host}:${SITES_PORT}${path}`;

for (const l of ['en', 'ar'] as const) {
  test(`${l}: no Sign in and no account menu; the rest of the header is there`, async ({ page }) => {
    const res = await page.goto(at(HOSTS.both, `/${l}/`));
    expect(res?.status()).toBe(200);
    await expect(page.locator('.site-header #mode-toggle')).toBeVisible();
    await expect(page.locator('.site-header .aun-signin')).toHaveCount(0);
    await expect(page.locator('#account')).toHaveCount(0);
    await expect(page.locator('a[href*="/auth/login"]')).toHaveCount(0);
  });
}

test('the page never asks /auth/me', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/auth/')) asked.push(r.url());
  });
  await page.goto(at(HOSTS.both, '/en/'));
  await page.waitForLoadState('networkidle');
  expect(asked).toEqual([]);
});

test('/auth/login and /auth/callback are 404 with no explanation', async ({ request }) => {
  for (const path of ['/auth/login?return=%2Fen%2F&lang=en', '/auth/callback?code=c&state=s']) {
    const res = await request.get(at(HOSTS.both, path), { maxRedirects: 0 });
    expect(res.status(), path).toBe(404);
    expect(await res.text()).not.toMatch(/not available|configured|SESSION_SECRET/i);
  }
});
