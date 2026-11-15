/**
 * The header is the Al Ummah Now header contract (AlUmmahNow docs/design/NAV.md "Header"; owner
 * 2026-11-14: "UNIFY"): the markup of the vendored builders (packages/render/src/nav/header.js),
 * their order (brand · env · links + search · app links · language · light/dark · account), the
 * sizes (40px controls, a 64px bar, 56px on phones), sticky, the phone collapse, and WCAG 2.2 AA
 * scoped to the header, signed out and signed in with the account menu open.
 */
import AxeBuilder from '@axe-core/playwright';

// Off by default even with the WCAG tags (experimental in axe): the language button's name must contain
// its visible label (WCAG 2.5.3), the bug the status page had in Arabic.
const LABEL_IN_NAME = { rules: { 'label-content-name-mismatch': { enabled: true } } };
import { expect, test, type Page } from '@playwright/test';
import { AUTH_URL, LOCALES, WWW_URL } from './env';
import { appLinksHtml, brandHtml, HEADER_LABELS, langButtonHtml, signInHtml } from '../../../packages/render/src/nav/header.js';

const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;

async function signedIn(page: Page) {
  await page.route((u) => u.origin === WWW_URL && u.pathname === '/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, sub: 'u1', name: 'Mahmoud', email: 'm@example.com', roles: [], canEditContent: false, profile: { displayName: 'Mahmoud', handle: 'meywd' } }) }),
  );
  const cors = { 'access-control-allow-origin': WWW_URL, 'access-control-allow-credentials': 'true', 'content-type': 'application/json' };
  await page.route(`${AUTH_URL}/session/accounts`, (r) => r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ accounts: [{ userId: 'u1', isActive: true, email: 'm@example.com', name: 'Mahmoud' }] }) }));
}

for (const l of LOCALES) {
  const other = l === 'en' ? 'ar' : 'en';

  test(`${l}: the header is the contract's markup (nav/header.js), in the contract's order`, async ({ page }) => {
    const html = await (await page.request.get(`/${l}/articles/`)).text();
    expect(html).toContain(brandHtml({ lang: l, href: `/${l}/`, logoSrc: '/brand/logo-192.webp' }));
    // the videos site of this environment (VIDEOS_WEB_URL), its library in the page's language
    const videos = /<a class="aun-app" href="([^"]+)">/.exec(html)?.[1] ?? '';
    expect(videos).toMatch(new RegExp(`^https://videos\\.[a-z.]*alummahnow\\.net/${l}$`));
    expect(html).toContain(appLinksHtml({ lang: l, links: [{ id: 'videos', href: videos }] }));
    expect(html).toContain(langButtonHtml({ lang: l, href: `/${other}/articles/` }));
    expect(html).toContain(signInHtml({ lang: l, href: `/auth/login?return=${encodeURIComponent(`/${l}/articles/`)}` }));

    await page.goto(`/${l}/articles/`);
    const row = await page.locator('.site-header .aun-header-row > *').evaluateAll((els) => els.map((e) => e.className.split(' ')[0]));
    // the environment badge shows only on QA and stage
    expect(row.filter((c) => c !== 'aun-env')).toEqual(['aun-brand', 'aun-header-primary', 'aun-header-tools']);
    const tools = await page.locator('.aun-header-tools > *').evaluateAll((els) => els.map((e) => e.id || e.className.split(' ')[0]));
    // language first, then light/dark (settled 2026-11-14), then the account
    expect(tools).toEqual(['aun-apps', 'aun-lang', 'mode-toggle', 'account']);
  });

  test(`${l}: one language button, named for its action, keeping the page`, async ({ page }) => {
    await page.goto(`/${l}/articles/`);
    const lang = page.locator('.site-header .aun-lang');
    await expect(lang).toHaveCount(1);
    await expect(lang).toBeVisible();
    await expect(lang).toHaveAccessibleName(`${HEADER_LABELS[l].switchLang}: ${HEADER_LABELS[l].otherLang}`);
    await expect(lang).toHaveAttribute('hreflang', other);
    await expect(lang.locator(`span[lang="${other}"]`)).toHaveText(HEADER_LABELS[l].otherLang);
    await expect(page.locator('.site-header select')).toHaveCount(0);
  });
}

test('sizes: 40px controls, the bar 64px (56px on phones), sticky; Sign in is the solid pill', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/en/articles/');
  const phone = (page.viewportSize()?.width ?? 1366) < 640;
  expect((await box(page, '.site-header .aun-header-tools')).height).toBe(phone ? 56 : 64);
  for (const sel of ['.aun-lang', '.aun-mode', '.aun-signin', '.site-header .search-field input']) expect((await box(page, sel)).height, sel).toBe(40);
  expect((await box(page, '.aun-mode')).width).toBe(40);
  expect((await box(page, '.aun-brand-mark')).width).toBe(phone ? 32 : 36);
  const signin = page.locator('.aun-signin');
  await expect(signin).toHaveText('Sign in');
  expect(await signin.evaluate((e) => getComputedStyle(e).borderRadius)).toBe('999px');
  // app links: icon and name at 1280px and up, icon only below, gone on phones
  const app = page.locator('.aun-apps .aun-app');
  if (phone) await expect(app).toBeHidden();
  else {
    await expect(app).toHaveAccessibleName('Videos');
    expect(await app.locator('.aun-app-name').isVisible()).toBe((page.viewportSize()?.width ?? 0) >= 1280);
  }
  // sticky: the bar stays at the top while the page scrolls
  await page.evaluate(() => (document.body.style.minHeight = '300vh'));
  await page.evaluate(() => scrollTo(0, 900));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200);
  expect((await box(page, '.site-header')).y, info.project.name).toBe(0);
});

test('signed in: the account button (name hidden below 768px) opens the menu', async ({ page }) => {
  await signedIn(page);
  await page.goto('/en/');
  const button = page.locator('#account .aun-acct-btn');
  await expect(button).toBeVisible();
  expect((await box(page, '#account .aun-acct-btn')).height).toBe(40);
  const wide = (page.viewportSize()?.width ?? 1366) >= 768;
  expect(await button.locator('.aun-acct-name').evaluate((e) => e.getBoundingClientRect().width > 1)).toBe(wide);
  await expect(button).toHaveAccessibleName(/Mahmoud/);
  await button.click();
  await expect(page.locator('#account-menu')).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  for (const l of LOCALES) {
    test(`axe (WCAG 2.2 AA), header only: ${l} ${scheme}, signed out and signed in with the menu open`, async ({ page }) => {
      const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/${l}/`);
      await page.evaluate(() => document.fonts.ready);
      const out = await new AxeBuilder({ page }).include('.site-header').withTags(tags).options(LABEL_IN_NAME).analyze();
      expect(out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

      await signedIn(page);
      await page.reload();
      await page.locator('#account .aun-acct-btn').click();
      await expect(page.locator('#account-menu')).toBeVisible();
      const open = await new AxeBuilder({ page }).include('.site-header').withTags(tags).options(LABEL_IN_NAME).analyze();
      expect(open.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}
