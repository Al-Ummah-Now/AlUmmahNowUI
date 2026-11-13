/**
 * No menu or popup renders outside the screen (owner bug 2026-11-13: on mobile the theme menu
 * opened off-screen; AlUmmahNow docs/design/NAV.md). Every popup www has, at phone widths
 * (320 / 375 / 414) and a landscape phone, in English (LTR) and Arabic (RTL):
 *  - the account menu (signed in: a session sealed with the local SESSION_SECRET, like
 *    header-profile-name.spec.ts; local wrangler dev only),
 *  - the header search suggestions (stubbed, so this also runs against QA/stage).
 * The Light / Dark control is a toggle with no menu (e2e/theme.spec.ts).
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { SESSION_COOKIE, SESSION_TTL_SEC, SESSION_VERSION, type Session } from '../src/lib/auth';
import { seal } from '../src/lib/session';
import { AUTH_URL, LOCALES, WWW_URL } from './env';

const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 375, height: 667 },
  { width: 414, height: 896 },
  { width: 844, height: 390 }, // a phone in landscape: the header wraps, the menu's button sits at the start
] as const;

const WWW_ORIGIN = new URL(WWW_URL).origin;
const DEV_VARS = new URL('../.dev.vars', import.meta.url);
const secret = () => /^SESSION_SECRET=([0-9a-f]{64})$/m.exec(existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf8') : '')?.[1];
const cors = { 'Access-Control-Allow-Origin': WWW_ORIGIN, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' };
const USER = { sub: 'usr_viewport_e2e', email: 'viewport.e2e@example.com' };
const OTHER = { sub: 'usr_viewport_other_e2e', email: 'viewport.other.e2e@example.com' };

async function signIn(context: BrowserContext, page: Page) {
  const session: Session = {
    sub: USER.sub,
    name: 'Viewport Tester With A Rather Long Name',
    email: USER.email,
    roles: [],
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
    v: SESSION_VERSION,
  };
  const value = await seal(secret()!, session as Session & Record<string, unknown>);
  await context.addCookies([
    { name: SESSION_COOKIE, value, domain: new URL(WWW_ORIGIN).hostname, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' },
    { name: 'aun_www_si', value: '1', url: WWW_ORIGIN },
  ]);
  await page.route(`${AUTH_URL}/session/accounts`, (r) =>
    r.fulfill({
      status: 200,
      headers: cors,
      body: JSON.stringify({ accounts: [USER, OTHER].map((a) => ({ userId: a.sub, email: a.email, name: null, isActive: a.sub === USER.sub })) }),
    }),
  );
}

/** The popup's box lies inside the viewport (1px tolerance for sub-pixel layout). */
async function expectInViewport(page: Page, popup: Locator, what: string) {
  await expect(popup, what).toBeVisible();
  // let a fit or a transition settle
  await page.waitForTimeout(150);
  const box = await popup.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, what).not.toBeNull();
  const { x, y, width, height } = box!;
  expect.soft(x, `${what}: left edge`).toBeGreaterThanOrEqual(-1);
  expect.soft(y, `${what}: top edge`).toBeGreaterThanOrEqual(-1);
  expect.soft(x + width, `${what}: right edge`).toBeLessThanOrEqual(vp.width + 1);
  expect.soft(y + height, `${what}: bottom edge`).toBeLessThanOrEqual(vp.height + 1);
  // and the page itself never scrolls sideways (the message names what sticks out)
  const sideways = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const r = el.getBoundingClientRect();
      const p = el.parentElement?.getBoundingClientRect();
      if (r.width && (r.right > vw + 0.5 || r.left < -0.5) && p && p.right <= vw + 0.5 && p.left >= -0.5) {
        out.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${String(el.className).trim().replace(/\s+/g, '.')} [${Math.round(r.left)}, ${Math.round(r.right)}]`);
      }
    }
    return { by: document.documentElement.scrollWidth - vw, out: out.slice(0, 6).join('; ') };
  });
  expect.soft(sideways.by, `${what}: page scrolls sideways: ${sideways.out}`).toBeLessThanOrEqual(0);
}

test.describe('menus stay inside the viewport', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'viewports are set per test: one browser project');

  for (const vp of VIEWPORTS) {
    for (const l of LOCALES) {
      test(`${vp.width}×${vp.height} ${l}: search suggestions`, async ({ page }) => {
        await page.setViewportSize(vp);
        await page.route('**/api/public/v1/search/suggest**', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(
              Array.from({ length: 8 }, (_, i) => ({ id: i + 1, type: 'article', title: `${l === 'ar' ? 'مقالة طويلة العنوان' : 'A long article title'} ${i + 1}`, slug: `a${i}`, locale: l, href: `/${l}/articles/a${i}/`, thumbnailUrl: null, excerpt: null, publishedAt: '2026-11-01T00:00:00.000Z' })),
            ),
          }),
        );
        await page.goto(`/${l}/`);
        const box = page.locator('.site-header [role="combobox"]').first();
        await box.fill(l === 'ar' ? 'مقالة' : 'article');
        await expectInViewport(page, page.locator('.site-header .search-popup').first(), 'search suggestions');
      });

      test(`${vp.width}×${vp.height} ${l}: account menu`, async ({ page, context }) => {
        test.skip(!!process.env.WWW_URL || !secret(), 'local wrangler dev only (seals a session with .dev.vars SESSION_SECRET)');
        await page.setViewportSize(vp);
        await signIn(context, page);
        await page.goto(`/${l}/`);
        const button = page.locator('#account .account-button');
        await button.click();
        await expectInViewport(page, page.locator('#account-menu'), 'account menu');
        // keyboard still reaches every row and Escape returns focus
        await page.keyboard.press('Escape');
        await expect(button).toBeFocused();
      });
    }
  }
});
