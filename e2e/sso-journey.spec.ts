/**
 * SSO journey from www (SSO audit 2026-11-10), in en and ar, against real QA auth (deploy-qa.yml)
 * and stage (release.yml).
 *
 * www's "Sign in" opens auth's sign-in page in the page's language (www sent only ui_locales, and
 * auth reads ?lang=, so Arabic pages signed in in English), comes back to the same page, and the
 * videos site is then signed in too without a password. A link to /auth/logout signs out of every
 * app (it used to clear www alone and leave auth and every other app signed in).
 *
 * The sign-out ends the account's sign-in everywhere, so this spec signs in as its own dedicated
 * account (qa-sso-ui, profile only), never a shared seed account other suites are signed in as.
 * Its tests run one after another so one test's sign-out does not end another's sign-in.
 *
 * Types the shared QA seed password: tracing is off (see real-auth.ts).
 */
import { expect, test, type Page } from '@playwright/test';
import { AUTH_ORIGIN, authAccountCount, authForm, REAL_AUTH, ssoAccount, WWW_ORIGIN } from './real-auth';

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
  // The silent sign-in may redirect while the page loads (an interrupted goto on WebKit)
  await page.goto(`${VIDEOS_ORIGIN}/en`).catch(() => {});
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

  test.describe.configure({ mode: 'default' }); // in order, one worker, a failure does not skip the rest

  // This spec's own account: no other spec or suite signs in as it (see ssoAccount)
  const email = ssoAccount('qa-sso-ui');

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
      // From a settled www page (the videos page may still be reloading after its silent sign-in,
      // which would cancel the sign-out navigation)
      await page.goto(`${WWW_ORIGIN}/${locale}/`, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle').catch(() => {});
      // The chain hops through every app; WebKit reports the hops as an interrupted goto
      await page.goto(`${WWW_ORIGIN}/auth/logout?locale=${locale}`).catch(() => {});
      await page.waitForURL((u) => u.origin === WWW_ORIGIN && u.pathname === `/${locale}/`, { timeout: 60_000 });
      expect(await authAccountCount(page), 'auth still has the account').toBe(0);
      expect(await wwwSignedIn(page)).toBe(false);
      expect(await videosSignedIn(page), 'the videos site is still signed in after the sign-out').toBe(false);
    });
  }
});
