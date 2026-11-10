/**
 * Real QA auth, end to end across apps (deploy-qa.yml):
 *
 * 1. Signed in elsewhere = signed in on www: the browser signs in at auth through another app
 *    (profile) and has never been on www; its first www page shows the account with no click.
 * 2. Sign out walks the whole chain: www's sign-out form → auth /logout → every app's
 *    front-channel logout (each hop back through auth) → www's locale home. Afterwards auth,
 *    www and the other app are all signed out, the probe does not sign www back in, and the
 *    form's redirects never trip www's CSP form-action (#15).
 *
 * Types the shared QA seed password: tracing is off (see real-auth.ts).
 */
import { expect, test, type Page } from '@playwright/test';
import { accountButton, AUTH_ORIGIN, authAccountCount, authForm, openMenu, PROFILE_URL, REAL_AUTH, WWW_ORIGIN } from './real-auth';

test.use({ trace: 'off' });

const PROFILE_ORIGIN = new URL(PROFILE_URL).origin;
/** Every app hop must stay on auth's parent site (auth.qa.x → *.qa.x). */
const SITE_SUFFIX = `.${new URL(AUTH_ORIGIN).hostname.split('.').slice(1).join('.')}`;

/** Main-frame navigations (method, URL, status) and CSP reports seen on www pages. */
function recordNavigations(page: Page) {
  const hops: { method: string; url: URL; status?: number }[] = [];
  const csp: string[] = [];
  page.on('request', (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) hops.push({ method: r.method(), url: new URL(r.url()) });
  });
  page.on('response', (r) => {
    const req = r.request();
    if (!req.isNavigationRequest() || req.frame() !== page.mainFrame()) return;
    const hop = hops.findLast((h) => h.url.href === req.url() && h.status === undefined);
    if (hop) hop.status = r.status();
  });
  page.on('console', (m) => {
    const at = m.location().url;
    if (at.startsWith(WWW_ORIGIN) && /content security policy/i.test(m.text())) csp.push(m.text());
  });
  return { hops, csp };
}

async function signInAtProfile(page: Page, email: string) {
  await page.goto(PROFILE_URL);
  await authForm(page, email, PROFILE_ORIGIN);
}

test.describe('signed in across apps (real QA auth)', () => {
  test.skip(!REAL_AUTH, 'needs WWW_URL on QA and QA_SEED_PASSWORD (deploy-qa.yml)');
  test.skip(({ browserName, isMobile }) => browserName === 'chromium' && isMobile, 'desktop Chromium and the iPhone (WebKit) project cover the engines');

  // Not the accounts the switching test uses, so the specs can run in parallel
  const email = process.env.QA_CHAIN_EMAIL || 'qa-moderator@delivered.resend.dev';
  const user = email.split('@')[0]!;

  test('signed in through another app: the first www page shows the account without a click', async ({ page, context }) => {
    test.setTimeout(120_000);
    await signInAtProfile(page, email);
    // The browser has never been on www
    expect((await context.cookies(WWW_ORIGIN)).map((c) => c.name)).toEqual([]);

    const { hops } = recordNavigations(page);
    await page.goto('/en/articles/?page=1');
    await expect(accountButton(page)).toContainText(user, { timeout: 20_000 });
    // It came back to the same page, through one silent prompt=none round trip
    await expect(page).toHaveURL(/\/en\/articles\/\?page=1$/);
    const authorize = hops.filter((h) => h.url.origin === AUTH_ORIGIN && h.url.pathname === '/authorize');
    expect(authorize).toHaveLength(1);
    expect(authorize[0]!.url.searchParams.get('prompt')).toBe('none');
    const me = await page.evaluate(async () => (await fetch('/auth/me')).json());
    expect(me).toMatchObject({ signedIn: true, email });

    // A second page is already signed in: no further trip to auth
    const before = hops.length;
    await page.goto('/en/videos/');
    await expect(accountButton(page)).toContainText(user);
    expect(hops.slice(before).map((h) => h.url.origin)).toEqual([WWW_ORIGIN]);

    // Clean up (the next test checks the sign-out itself)
    await openMenu(page);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL((u) => u.origin === WWW_ORIGIN && u.pathname === '/en/', { timeout: 45_000 });
  });

  test('sign out walks auth\'s whole logout chain and signs out every app', async ({ page, context }) => {
    test.setTimeout(150_000);
    // Signed in to two apps: profile, then www (silently)
    await signInAtProfile(page, email);
    await page.goto('/ar/articles/');
    await expect(accountButton(page)).toContainText(user, { timeout: 20_000 });

    const { hops, csp } = recordNavigations(page);
    await openMenu(page);
    await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
    // Back on the locale of the page signed out from (the current /ar/articles/ must not satisfy this)
    await page.waitForURL((u) => u.origin === WWW_ORIGIN && u.pathname === '/ar/', { timeout: 45_000 });
    await page.waitForLoadState('load');

    const chain = hops.map((h) => `${h.method} ${h.url.origin}${h.url.pathname} ${h.status ?? '-'}`);
    // Starts with www's sign-out form, hands over to auth, ends on www's locale home
    expect(chain[0], chain.join('\n')).toBe(`POST ${WWW_ORIGIN}/auth/logout 303`);
    expect(`${hops[1]!.url.origin}${hops[1]!.url.pathname}`).toBe(`${AUTH_ORIGIN}/logout`);
    expect(chain.at(-1)).toBe(`GET ${WWW_ORIGIN}/ar/ 200`);
    // Every hop is https on auth's site and answered without an error
    for (const h of hops) {
      expect(h.url.protocol, chain.join('\n')).toBe('https:');
      expect(h.url.hostname.endsWith(SITE_SUFFIX), chain.join('\n')).toBe(true);
      expect(h.status, chain.join('\n')).toBeLessThan(400);
    }
    // Front channel: each app's logout is visited once, and every app hop returns to auth /logout
    const apps = hops.slice(2, -1).filter((h) => h.url.origin !== AUTH_ORIGIN);
    const appLogouts = apps.map((h) => `${h.url.origin}${h.url.pathname}`);
    expect(new Set(appLogouts).size, chain.join('\n')).toBe(appLogouts.length);
    expect(appLogouts, chain.join('\n')).toEqual(expect.arrayContaining([`${PROFILE_ORIGIN}/logout`, `${WWW_ORIGIN}/auth/logout`]));
    hops.slice(2, -1).forEach((h, i, mid) => {
      if (h.url.origin !== AUTH_ORIGIN) expect(`${mid[i + 1]?.url.origin}${mid[i + 1]?.url.pathname}`, chain.join('\n')).toBe(`${AUTH_ORIGIN}/logout`);
    });
    // The form's redirects never tripped www's CSP (form-action)
    expect(csp).toEqual([]);

    // Everything is signed out: www, auth, and the other app
    await expect(page.getByRole('link', { name: 'تسجيل الدخول' }).first()).toBeVisible();
    await expect(accountButton(page)).toHaveCount(0);
    expect(await page.evaluate(async () => (await fetch('/auth/me')).json())).toEqual({ signedIn: false });
    expect(await authAccountCount(page)).toBe(0);
    expect((await context.cookies(WWW_ORIGIN)).filter((c) => /session/i.test(c.name))).toEqual([]);

    // Reloading does not sign www back in (the probe asks auth, which has no session)
    const reload = hops.length;
    await page.goto('/en/articles/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    expect(hops.slice(reload).some((h) => h.url.pathname === '/authorize')).toBe(false);

    // The other app asks for a password again
    await page.goto(PROFILE_URL);
    await page.waitForURL((u) => u.origin === AUTH_ORIGIN, { timeout: 20_000 });
    await expect(page.locator('input[name=password]')).toBeVisible();
  });
});
