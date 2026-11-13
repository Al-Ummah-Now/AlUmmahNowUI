/**
 * Signed in, the cached (anonymous) HTML must not look signed out:
 *  - the home hero offers "Continue watching" instead of "Create your account", from the first paint
 *    (the `aun_www_si` hint → <html data-signed-in> in the head script), and corrects itself
 *    when /auth/me says the session is gone
 *  - the header shows the profile name (page language), then @handle, never the email when a
 *    profile name exists; long names truncate instead of overflowing on phones.
 * www's /auth/me and auth's account list are stubbed, so this runs against local wrangler dev.
 */
import { expect, test, type Page } from '@playwright/test';
import { AUTH_URL, WWW_URL } from './env';

const WWW_ORIGIN = new URL(WWW_URL).origin;
const cors = { 'Access-Control-Allow-Origin': WWW_ORIGIN, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' };
const email = 'a.very.long.address.for.testing@example.com';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

interface Profile {
  displayName?: string | null;
  displayNameLocalized?: Record<string, string>;
  handle?: string | null;
  avatarUrl?: string | null;
}

/** Signed in as u1; `hold` keeps /auth/me pending until released (first-paint checks). */
async function signedIn(page: Page, profile: Profile | null, opts: { hold?: boolean; signedIn?: boolean } = {}) {
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.context().addCookies([{ name: 'aun_www_si', value: '1', url: WWW_ORIGIN }]);
  await page.route((u) => u.origin === WWW_ORIGIN && u.pathname === '/auth/me', async (r) => {
    if (opts.hold) await held;
    const body = opts.signedIn === false ? { signedIn: false } : { signedIn: true, sub: 'u1', name: email, authName: null, email, roles: [], canEditContent: false, profile };
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route(`${AUTH_URL}/session/accounts`, (r) =>
    r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ accounts: opts.signedIn === false ? [] : [{ userId: 'u1', isActive: true, email, name: null }] }) }),
  );
  await page.route('https://images.alummahnow.net/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  return release;
}

const button = (page: Page) => page.locator('#account .account-button');
const hero = (page: Page) => page.locator('.hero-actions');

test.describe('signed-in home', () => {
  test('hero offers the library, never sign-up, from the first paint (en)', async ({ page }) => {
    const release = await signedIn(page, { displayName: 'Mahmoud', displayNameLocalized: { en: 'Mahmoud', ar: 'محمود' }, handle: 'meywd' }, { hold: true });
    await page.goto('/en/');
    // /auth/me has not answered yet: the hint alone already picks the signed-in hero
    await expect(hero(page).getByRole('link', { name: 'Continue watching' })).toBeVisible();
    await expect(hero(page).getByRole('link', { name: 'Create your account' })).toBeHidden();
    await expect(page.locator('#account .signin-link')).toBeHidden();
    release();
    await expect(button(page)).toContainText('Mahmoud');
    await expect(button(page)).not.toContainText(email);
    await expect(hero(page).getByRole('link', { name: 'Continue watching' })).toHaveAttribute('href', /\/en\/library$/);
    // still in the cached HTML (for anonymous visitors) but not rendered, so not in the a11y tree
    await expect(page.getByRole('link', { name: 'Create your account' })).toHaveCount(0);
  });

  test('Arabic shows the Arabic profile name and the avatar; a long name truncates on phones', async ({ page }) => {
    const long = 'محمود صالح درويش عبد الرحمن الطويل جدًا للاختبار';
    await signedIn(page, { displayName: 'Mahmoud', displayNameLocalized: { en: 'Mahmoud', ar: long }, handle: 'meywd', avatarUrl: 'https://images.alummahnow.net/u1_avatar.jpeg' });
    await page.goto('/ar/');
    await expect(hero(page).getByRole('link', { name: 'تابع المشاهدة' })).toBeVisible();
    await expect(hero(page).getByRole('link', { name: 'أنشئ حسابك' })).toBeHidden();
    await expect(button(page)).toContainText(long);
    await expect(button(page).locator('img.account-avatar')).toBeVisible();
    const box = (await button(page).boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    // the page itself never scrolls sideways
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test('no profile name: the email, never a handle (truncated, not overflowing)', async ({ page }) => {
    // handles belong to channels (owner, 2026-11-12): a profile without a name shows the email
    await signedIn(page, { displayName: null, displayNameLocalized: {}, handle: 'meywd' });
    await page.goto('/en/');
    await expect(button(page)).toContainText(email);
    await expect(button(page)).not.toContainText('@meywd');
    const width = page.viewportSize()!.width;
    const box = (await button(page).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test('a stale hint corrects itself: signed out shows sign-up and Sign in again', async ({ page, context }) => {
    await signedIn(page, null, { signedIn: false });
    await page.goto('/en/');
    await expect(page.locator('#account .signin-link')).toBeVisible();
    await expect(hero(page).getByRole('link', { name: 'Create your account' })).toBeVisible();
    await expect(hero(page).getByRole('link', { name: 'Continue watching' })).toBeHidden();
    await expect.poll(async () => (await context.cookies()).some((c) => c.name === 'aun_www_si' && c.value === '1')).toBe(false);
  });

  test('other pages have no signed-out leftovers', async ({ page }) => {
    await signedIn(page, { displayName: 'Mahmoud', displayNameLocalized: { en: 'Mahmoud' }, handle: 'meywd' });
    for (const path of ['/en/articles/', '/en/videos/', '/ar/articles/']) {
      await page.goto(path);
      await expect(button(page)).toBeVisible();
      await expect(page.locator('#account .signin-link')).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Create your account|أنشئ حسابك/ })).toHaveCount(0);
    }
  });
});
