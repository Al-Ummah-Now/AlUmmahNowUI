/**
 * The header is the Al Ummah Now header contract (AlUmmahNow docs/design/NAV.md "Header"; owner
 * 2026-11-14: "UNIFY"): the markup of the vendored builders (packages/render/src/nav/header.js),
 * their order (brand · env · links + search · app links · language · light/dark · account), the
 * sizes (40px controls, a 64px bar, 56px on phones: one line on every screen, full width, one typeface),
 * sticky, the menu panel below 1024px, and WCAG 2.2 AA
 * scoped to the header, signed out and signed in with the account menu open.
 */
import AxeBuilder from '@axe-core/playwright';

// Off by default even with the WCAG tags (experimental in axe): the language button's name must contain
// its visible label (WCAG 2.5.3), the bug the status page had in Arabic.
// Set before withTags(): AxeBuilder.options() replaces the whole options object, tags included.
const LABEL_IN_NAME = { rules: { 'label-content-name-mismatch': { enabled: true } } };
import { expect, test, type Page } from '@playwright/test';
import { AUTH_URL, LOCALES, WWW_URL } from './env';
import { appLinksHtml, brandHtml, HEADER_LABELS, langButtonHtml, menuButtonHtml, signInHtml } from '../../../packages/render/src/nav/header.js';

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
    expect(html).toContain(menuButtonHtml({ lang: l, panel: 'site-menu' }));

    await page.goto(`/${l}/articles/`);
    const row = await page.locator('.site-header .aun-header-row > *').evaluateAll((els) => els.map((e) => e.className.split(' ')[0]));
    // the environment badge shows only on QA and stage
    // the menu button first (slot 1; shown below 1024px only), then the brand
    expect(row.filter((c) => c !== 'aun-env')).toEqual(['aun-icon-btn', 'aun-brand', 'aun-header-primary', 'aun-header-tools']);
    const tools = await page.locator('.aun-header-tools > *').evaluateAll((els) => els.map((e) => e.id || e.className.split(' ')[0]));
    // language first, then light/dark (settled 2026-11-14), then the account
    expect(tools).toEqual(['aun-apps', 'aun-lang', 'mode-toggle', 'account']);
  });

  test(`${l}: one line on every screen, full width, one typeface; below 1024px the menu panel holds the links and search`, async ({ page }) => {
    const rtl = l === 'ar';
    for (const [w, bar] of [[1440, 64], [1024, 64], [1023, 64], [800, 64], [430, 56], [412, 56], [390, 56]] as const) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto(`/${l}/articles/`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w} no sideways scroll`).toBe(true);
      expect((await box(page, '.site-header')).height, `${w}`).toBe(bar);
      const mark = await box(page, '.aun-brand-mark');
      const menu = page.getByRole('button', { name: HEADER_LABELS[l].menu });
      if (w >= 1024) {
        // full width: the brand 16px from the edge, mirrored in Arabic
        expect(rtl ? w - (mark.x + mark.width) : mark.x, `${w}`).toBe(16);
        await expect(menu).toBeHidden();
        await expect(page.locator('.site-header .primary-nav')).toBeVisible();
        await expect(page.locator('#site-search-input')).toBeVisible();
        continue;
      }
      await expect(page.locator('.site-header .primary-nav')).toBeHidden();
      await expect(page.locator('#site-search-input')).toBeHidden();
      await expect(menu).toBeVisible();
      const mb = await box(page, '.aun-menu-collapse');
      expect([mb.width, mb.height]).toEqual([40, 40]);
      expect(rtl ? w - (mb.x + mb.width) : mb.x, `${w}`).toBe(w < 640 ? 12 : 16);
      // the panel opens without script, right under the bar: the same links (aria-current kept) and the search
      await menu.click();
      const panel = page.locator('#site-menu');
      await expect(panel).toBeVisible();
      expect((await panel.boundingBox())!.y).toBe(bar);
      await expect(panel.getByRole('link')).toHaveText(await page.locator('.primary-nav a').allTextContents());
      await expect(panel.locator('a[aria-current="page"]')).toHaveCount(await page.locator('.primary-nav a[aria-current="page"]').count());
      await expect(panel.getByRole('combobox', { name: rtl ? 'ابحث في المقالات' : 'Search articles' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }
    // one typeface: every text in the bar uses the header's font
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${l}/articles/`);
    const fonts = await page.locator('.site-header :is(.aun-brand-name, .primary-nav a, .aun-lang, .aun-signin, .aun-app-name)').evaluateAll((els) => [...new Set(els.map((e) => getComputedStyle(e).fontFamily))]);
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toContain(rtl ? 'Noto Naskh Arabic' : 'system-ui');
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
  expect((await box(page, '.site-header')).height).toBe(phone ? 56 : 64);
  const wide = (page.viewportSize()?.width ?? 1366) >= 1024;
  for (const sel of ['.aun-lang', '.aun-mode', '.aun-signin', wide ? '#site-search-input' : '.aun-menu-collapse']) expect((await box(page, sel)).height, sel).toBe(40);
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
      const out = await new AxeBuilder({ page }).include('.site-header').options(LABEL_IN_NAME).withTags(tags).analyze();
      expect(out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      // below 1024px: the menu panel open
      if ((page.viewportSize()?.width ?? 1366) < 1024) {
        await page.locator('.aun-menu-collapse').click();
        await expect(page.locator('#site-menu')).toBeVisible();
        const panel = await new AxeBuilder({ page }).include('.site-header').options(LABEL_IN_NAME).withTags(tags).analyze();
        expect(panel.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), 'menu panel').toEqual([]);
        await page.keyboard.press('Escape');
      }

      await signedIn(page);
      await page.reload();
      await page.locator('#account .aun-acct-btn').click();
      await expect(page.locator('#account-menu')).toBeVisible();
      const open = await new AxeBuilder({ page }).include('.site-header').options(LABEL_IN_NAME).withTags(tags).analyze();
      expect(open.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}
