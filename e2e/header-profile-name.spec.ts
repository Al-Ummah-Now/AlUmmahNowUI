/**
 * A signed-in user who has a profile is never shown by email (production bug, 2026-11-12:
 * v2026.11.12.2 showed "meywd@msn.com" because the owner's profile has only first/last name,
 * which the public profile view does not carry).
 *
 * Unlike home-signed-in.spec.ts this does not stub /auth/me: the session cookie is sealed with
 * the local server's SESSION_SECRET (.dev.vars) exactly as /auth/callback seals it, from the
 * owner's production profile shape, so the real /auth/me → header chain is under test.
 * Auth's account list is stubbed (two accounts, like the owner's browser).
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { SESSION_COOKIE, SESSION_TTL_SEC, SESSION_VERSION, type Session } from '../src/lib/auth';
import { profileNames } from '../src/lib/auth-routes';
import { seal } from '../src/lib/session';
import { AUTH_URL, WWW_URL } from './env';

const WWW_ORIGIN = new URL(WWW_URL).origin;
const cors = { 'Access-Control-Allow-Origin': WWW_ORIGIN, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' };
const DEV_VARS = new URL('../.dev.vars', import.meta.url);
const secret = () => /^SESSION_SECRET=([0-9a-f]{64})$/m.exec(existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf8') : '')?.[1];

// The owner's production profile shape (2026-11-12): displayName "", names only in first/last
const OWNER = {
  sub: 'usr_owner_e2e',
  email: 'owner.e2e@example.com',
  profile: {
    displayName: '',
    displayNameLocalized: { en: '', ar: '' },
    firstName: 'Mahmoud',
    firstNameLocalized: { en: 'Mahmoud', ar: '' },
    lastName: 'Darwish',
    lastNameLocalized: { en: 'Darwish', ar: '' },
  },
};
// The second account in the browser: a localized display name and a handle
const SECOND = {
  sub: 'usr_second_e2e',
  email: 'second.account.e2e@example.com',
  profile: { displayName: 'Test Account', displayNameLocalized: { en: 'Test Account', ar: 'حساب التجربة' }, userName: 'tester' },
};

async function signInAs(context: BrowserContext, who: typeof OWNER | typeof SECOND) {
  const session: Session = {
    sub: who.sub,
    name: null,
    email: who.email,
    roles: [],
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
    v: SESSION_VERSION,
    profile: profileNames(who.profile),
  };
  const value = await seal(secret()!, session as Session & Record<string, unknown>);
  await context.addCookies([
    { name: SESSION_COOKIE, value, domain: new URL(WWW_ORIGIN).hostname, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' },
    { name: 'aun_www_si', value: '1', url: WWW_ORIGIN },
  ]);
}

async function stubAccounts(page: Page, active: string) {
  await page.route(`${AUTH_URL}/session/accounts`, (r) =>
    r.fulfill({
      status: 200,
      headers: cors,
      body: JSON.stringify({
        accounts: [OWNER, SECOND].map((a) => ({ userId: a.sub, email: a.email, name: null, isActive: a.sub === active })),
      }),
    }),
  );
}

const button = (page: Page) => page.locator('#account .account-button');

test.describe('header: a user with a profile is shown by name, never by email', () => {
  test.skip(!!process.env.WWW_URL || !secret(), 'local wrangler dev only (seals a session with .dev.vars SESSION_SECRET)');
  test.skip(({ browserName }) => browserName !== 'chromium', 'Secure cookie on http://localhost: Chromium');

  test('first + last name in the button, "Signed in as", and the other accounts by name (en and ar)', async ({ page, context }) => {
    // The second account signed in to www earlier in this browser: www remembers its name
    await signInAs(context, SECOND);
    await stubAccounts(page, SECOND.sub);
    await page.goto('/ar/');
    await expect(button(page)).toContainText('حساب التجربة');

    // Now the owner (switched): the owner's own name, and the second account by its name
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await signInAs(context, OWNER);
    await stubAccounts(page, OWNER.sub);
    for (const [l, second, signedInAs] of [
      ['en', 'Test Account', 'Signed in as Mahmoud Darwish'],
      ['ar', 'حساب التجربة', 'مسجّل الدخول باسم Mahmoud Darwish'],
    ] as const) {
      await page.goto(`/${l}/`);
      await expect(button(page)).toContainText('Mahmoud Darwish');
      await expect(button(page)).not.toContainText('@');
      await button(page).click();
      const menu = page.locator('#account-menu');
      await expect(menu).toBeVisible();
      // The current account is the menu's top block (AlUmmahNow docs/design/NAV.md): the name, then
      // its email as the small second line; screen readers hear "Signed in as {name}"
      const who = menu.locator('.account-who');
      await expect(who.locator('.aun-menu-who-name')).toHaveText('Mahmoud Darwish');
      await expect(who.locator('.visually-hidden')).toHaveText(signedInAs);
      await expect(who.locator('.aun-menu-who-sub')).toHaveAttribute('title', OWNER.email);
      // "More accounts" lists only the other accounts: the second one, by its name, email under it
      const rows = menu.locator('.account-list .account-entry');
      await expect(rows).toHaveCount(1);
      await expect(rows.nth(0).locator('.account-name')).toHaveText(second);
      await expect(rows.nth(0).locator('.account-email')).toHaveAttribute('title', SECOND.email);
      // no row, button or greeting is named by an email
      for (const email of [OWNER.email, SECOND.email]) {
        await expect(menu.locator('.account-name', { hasText: email })).toHaveCount(0);
        await expect(who.locator('.aun-menu-who-name')).not.toContainText(email);
      }
      await page.keyboard.press('Escape');
    }
  });
});
