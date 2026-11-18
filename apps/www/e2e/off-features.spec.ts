/**
 * Owner rule: a feature switched off by an admin or blocked by missing config is invisible. Runs only
 * as `E2E_FEATURES_OFF=1 npx playwright test` (playwright.config.ts): the stub admin API says the
 * newsletter is off (STUB_NEWSLETTER=off, e2e/stub-newsletter.ts) and wrangler dev has no valid
 * SESSION_SECRET. Then:
 *   - no footer newsletter section, /newsletter and /newsletter/confirm are 404 (GET and POST);
 *     unsubscribe still works (people can always leave) but has no "Sign up" link;
 *   - no Sign in, no home "Create your account", no silent sign-in probe; /auth/login and
 *     /auth/callback are 404;
 *   - none of the old "not working" / "not configured" texts anywhere. en and ar, axe clean.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import { LOCALES } from './env';
import { NL_TOKENS } from './stub-newsletter';

const T = { en, ar };

async function expectAxeClean(page: Page) {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
}

for (const l of LOCALES) {
  const t = T[l];

  test(`${l}: home has no newsletter section, no Sign in, no "Create your account"`, async ({ page }) => {
    const res = await page.goto(`/${l}/`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('.site-footer')).toBeVisible();
    await expect(page.getByTestId('footer-help')).toBeVisible();
    await expect(page.getByTestId('footer-newsletter')).toHaveCount(0);
    await expect(page.locator('form[data-newsletter]')).toHaveCount(0);
    await expect(page.locator('a[href*="/newsletter"]')).toHaveCount(0);
    await expect(page.locator('#mode-toggle')).toBeVisible();
    await expect(page.locator('#account')).toHaveCount(0);
    await expect(page.locator('a[href*="/auth/login"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: t.home.profileCta })).toHaveCount(0);
    // the hero doesn't describe what needs an account (uploading, going live, posting)
    await expect(page.locator('.hero-body')).toHaveText(t.home.heroBodyWatch);
    const text = await page.locator('body').innerText();
    for (const gone of [t.newsletter.unavailable, t.newsletter.title, 'not configured', 'SESSION_SECRET']) expect(text).not.toContain(gone);
    await expectAxeClean(page);
  });

  test(`${l}: /newsletter and /newsletter/confirm are 404, GET and POST`, async ({ request }) => {
    expect((await request.get(`/${l}/newsletter/`)).status()).toBe(404);
    expect((await request.post(`/${l}/newsletter/`, { form: { email: 'a@example.com' }, maxRedirects: 0 })).status()).toBe(404);
    expect((await request.post(`/${l}/newsletter/`, { data: { email: 'a@example.com' }, headers: { Accept: 'application/json' } })).status()).toBe(404);
    expect((await request.get(`/${l}/newsletter/confirm?token=${NL_TOKENS.confirm}`)).status()).toBe(404);
    expect((await request.post(`/${l}/newsletter/confirm`, { form: { token: NL_TOKENS.confirm }, maxRedirects: 0 })).status()).toBe(404);
  });

  test(`${l}: unsubscribe still works, without a "Sign up" link`, async ({ page }) => {
    const res = await page.goto(`/${l}/newsletter/unsubscribe?token=${NL_TOKENS.unsubscribe}`);
    expect(res?.status()).toBe(200);
    await page.getByRole('button', { name: t.newsletter.unsubscribeButton }).click();
    await expect(page.getByRole('heading', { level: 1, name: t.newsletter.unsubscribedTitle })).toBeVisible();
    await expect(page.getByRole('link', { name: t.newsletter.signUp })).toHaveCount(0);
    // nothing links to the sign-up page (the language switch links this same unsubscribe page)
    await expect(page.locator('a[href$="/newsletter/"], a[href$="/newsletter"]')).toHaveCount(0);
    await expectAxeClean(page);
  });
}

test('the one-click unsubscribe from mail clients still works', async ({ request }) => {
  const res = await request.post(`/en/newsletter/unsubscribe?token=${NL_TOKENS.unsubscribe}`, { form: { 'List-Unsubscribe': 'One-Click' } });
  expect(res.status()).toBe(200);
});

test('no silent sign-in probe: the page never asks /auth/me or goes to /auth/login', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/auth/')) asked.push(r.url());
  });
  await page.goto('/en/');
  await page.waitForLoadState('networkidle');
  expect(asked).toEqual([]);
  await expect(page).toHaveURL(/\/en\/$/);
});

test('/auth/login and /auth/callback are 404 with no explanation', async ({ request }) => {
  for (const path of ['/auth/login?return=%2Fen%2F', '/auth/login?prompt=none&return=%2Fen%2F', '/auth/callback?code=c&state=s']) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(404);
    expect(await res.text()).not.toMatch(/configured|SESSION_SECRET/i);
  }
});
