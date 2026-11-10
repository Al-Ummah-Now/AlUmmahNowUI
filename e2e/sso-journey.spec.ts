/**
 * SSO journey from www (SSO audit 2026-11-10), in en and ar, against real QA auth (deploy-qa.yml)
 * and stage (release.yml).
 *
 * www's "Sign in" opens auth's sign-in page in the page's language (www sent only ui_locales, and
 * auth reads ?lang=, so Arabic pages signed in in English), comes back to the same page, and the
 * videos site is then signed in too without a password. A link to /auth/logout signs out of every
 * app (it used to clear www alone and leave auth and every other app signed in).
 *
 * Types the shared QA seed password: tracing is off (see real-auth.ts).
 */
import { expect, test, type Page } from '@playwright/test';
import { AUTH_ORIGIN, authAccountCount, authForm, REAL_AUTH, WWW_ORIGIN } from './real-auth';

test.use({ trace: 'off' });

/** The videos site on the same parent domain as auth (videos.qa.x / videos.stage.x / videos.x). */
const VIDEOS_ORIGIN = AUTH_ORIGIN.replace('://auth.', '://videos.');

async function wwwSignedIn(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const res = await fetch('/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    return ((await res.json()) as { signedIn?: boolean }).signedIn === true;
  });
}

async function videosSignedIn(page: Page): Promise<boolean> {
  await page.goto(`${VIDEOS_ORIGIN}/en`);
  // The videos header signs in silently (client probe); give it time to come back
  let signedIn = false;
  await expect
    .poll(
      async () => {
        await page.waitForLoadState('load').catch(() => {});
        signedIn = await page
          .evaluate(async () => {
            const res = await fetch('/api/auth/token', { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
            return !!(res?.ok && ((await res.json()) as { accessToken?: string | null }).accessToken);
          })
          .catch(() => false);
        return signedIn;
      },
      { timeout: 25_000 },
    )
    .toBe(true)
    .catch(() => {});
  return signedIn;
}

test.describe('SSO journey from www (real QA auth)', () => {
  test.skip(!REAL_AUTH, 'needs WWW_URL on QA and QA_SEED_PASSWORD (deploy-qa.yml)');
  test.skip(({ browserName, isMobile }) => browserName === 'chromium' && isMobile, 'desktop Chromium and the iPhone (WebKit) project cover the engines');

  // Not the accounts the other real-auth specs use, so the specs can run in parallel
  const email = process.env.QA_SSO_EMAIL || 'qa-creator@delivered.resend.dev';

  for (const locale of ['en', 'ar'] as const) {
    test(`sign in once on www, signed in on videos, a sign-out link signs out everywhere (${locale})`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.goto(`${WWW_ORIGIN}/${locale}/`);
      await page.locator('a.signin-link').first().click();
      await page.waitForURL((u) => u.origin === AUTH_ORIGIN);
      // auth's sign-in page follows the www page's language
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await authForm(page, email);
      expect(new URL(page.url()).pathname).toBe(`/${locale}/`);
      expect(await wwwSignedIn(page)).toBe(true);

      // Signed in on www = signed in on the videos site, no password
      expect(await videosSignedIn(page), 'the videos site did not sign in silently').toBe(true);
      expect(new URL(page.url()).origin).toBe(VIDEOS_ORIGIN);

      // A link to www's sign-out: single sign-out through auth and every app, back to www
      await page.goto(`${WWW_ORIGIN}/auth/logout?locale=${locale}`);
      await page.waitForURL((u) => u.origin === WWW_ORIGIN && u.pathname === `/${locale}/`, { timeout: 60_000 });
      expect(await authAccountCount(page), 'auth still has the account').toBe(0);
      expect(await wwwSignedIn(page)).toBe(false);
      expect(await videosSignedIn(page), 'the videos site is still signed in after the sign-out').toBe(false);
    });
  }
});
