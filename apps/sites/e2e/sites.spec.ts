/**
 * Scholar sites on the local stack (wiki AUN-SCHOLAR-SITES phase 2): a site renders in English and
 * Arabic with its own theme and branding, canonical tags follow SS7, unknown hosts 404, an old
 * subdomain redirects, and sign-in is a one-click redirect round trip with a host-only session.
 */
import AxeBuilder from '@axe-core/playwright';

// Off by default even with the WCAG tags (experimental in axe): the language button's name must contain
// its visible label (WCAG 2.5.3), the bug the status page had in Arabic.
// Set before withTags(): AxeBuilder.options() replaces the whole options object, tags included.
const LABEL_IN_NAME = { rules: { 'label-content-name-mismatch': { enabled: true } } };
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { HOSTS, LOGO_URL, LONG_NAME, SITES_PORT } from './stub-data.ts';
import { langButtonHtml, menuButtonHtml, signInHtml } from '../../../packages/render/src/nav/header.js';
import { siteBrandHtml } from '../../../packages/render/src/site-brand.ts';
import { stubImage } from '../../www/e2e/stub-blocks.ts';

const at = (host: string, path = '/') => `http://${host}:${SITES_PORT}${path}`;

test('a site renders in English with its own theme, name, logo and menu', async ({ page }) => {
  const res = await page.goto(at(HOSTS.both, '/en/'));
  expect(res?.status()).toBe(200);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'nahas');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('dir', 'ltr');
  await expect(page.getByTestId('site-name')).toHaveText('Sh. Mustafa Elbadry');
  // the header lockup: the site's own logo in the round mark slot, its name as the wordmark
  await expect(page.locator('.site-header .aun-brand .aun-brand-mark')).toHaveAttribute('src', LOGO_URL);
  await expect(page.locator('.site-header .aun-brand .aun-brand-name')).toHaveText('Sh. Mustafa Elbadry');
  await expect(page.getByTestId('site-nav-books')).toHaveAttribute('href', 'https://example.com/books');
  await expect(page.getByTestId('site-video-card')).toHaveCount(2);
  // the five newest posts
  await expect(page.getByTestId('site-post')).toHaveCount(5);
  // minimal platform mark: a small link, the report link always
  await expect(page.getByTestId('site-platform-link')).toBeVisible();
  await expect(page.getByTestId('site-report-link')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `http://${HOSTS.both}:${SITES_PORT}/en/`);
  await expect(page.locator('link[hreflang="ar"]')).toHaveAttribute('href', `http://${HOSTS.both}:${SITES_PORT}/ar/`);
  // never indexed outside production
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('the same site in Arabic: right to left, Arabic name and video titles', async ({ page }) => {
  await page.goto(at(HOSTS.both, '/ar/'));
  const html = page.locator('html');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(html).toHaveAttribute('data-theme', 'nahas');
  await expect(page.getByTestId('site-name')).toHaveText('الشيخ مصطفى البدري');
  await expect(page.getByTestId('site-home-videos')).toContainText('المرئي الأول');
  await expect(page.locator('.site-header .aun-lang')).toHaveAttribute('href', '/en/');
});

test('Arabic: dates, durations, counts and the footer year in Eastern Arabic (Hindi) numerals ٠–٩', async ({ page }) => {
  await page.goto(at(HOSTS.both, '/ar/'));
  const values = [
    ...(await page.locator('.video-card .duration').allTextContents()),
    ...(await page.locator('.post-date time').allTextContents()),
    ...(await page.locator('.post-card span:has-text("إعجاب"), .post-card span:has-text("تعليق")').allTextContents()),
    ...(await page.locator('.footer-base').allTextContents()),
  ].map((s) => s.trim());
  expect(values.length).toBeGreaterThan(4);
  expect(values.filter((v) => /[0-9]/.test(v)), 'formatted values with Arabic numerals 0–9').toEqual([]);
  expect(values).toContain('٢:٠٥');
  await page.goto(at(HOSTS.both, '/en/'));
  expect(await page.locator('.video-card .duration').allTextContents()).toContain('2:05');
});

test('a single-language Arabic site: its own theme, / and /en/ go to Arabic, footer band', async ({ page }) => {
  await page.goto(at(HOSTS.arOnly, '/'));
  await expect(page).toHaveURL(at(HOSTS.arOnly, '/ar/'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'zujaj');
  await expect(page.locator('.site-header .aun-lang')).toHaveCount(0);
  await expect(page.locator('link[hreflang]')).toHaveCount(1);
  await expect(page.getByTestId('site-platform-band')).toBeVisible();
  await page.goto(at(HOSTS.arOnly, '/en/about/'));
  await expect(page).toHaveURL(at(HOSTS.arOnly, '/ar/about/'));
});

test('watch pages: canonical on the videos site for a subdomain, on the site for an own domain', async ({ page }) => {
  await page.goto(at(HOSTS.both, '/en/watch/vid-e2e-1/'));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://videos.qa.alummahnow.net/en/video/vid-e2e-1');
  await expect(page.getByTestId('site-player')).toHaveAttribute('src', /\/embed\/v\/vid-e2e-1/);
  await page.goto(at(HOSTS.custom, '/en/watch/vid-e2e-1/'));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `http://${HOSTS.custom}:${SITES_PORT}/en/watch/vid-e2e-1/`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'lantern');
  // posts are canonical on the site in both cases
  await page.goto(at(HOSTS.both, '/en/posts/post-e2e-1/'));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `http://${HOSTS.both}:${SITES_PORT}/en/posts/post-e2e-1/`);
});

test('another channel\'s video and unknown posts are 404 on a site', async ({ page }) => {
  expect((await page.goto(at(HOSTS.both, '/en/watch/not-ours/')))?.status()).toBe(404);
  expect((await page.goto(at(HOSTS.both, '/en/posts/nope/')))?.status()).toBe(404);
});

test('unknown hosts and sites in setup are a bare 404; an old subdomain redirects', async ({ request }) => {
  for (const host of ['nobody.sites.localhost', HOSTS.setup]) {
    const res = await request.get(at(host, '/en/'), { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect(res.headers()['cache-control']).toBe('no-store');
  }
  const old = await request.get(at(HOSTS.old, '/en/posts/?page=2'), { maxRedirects: 0 });
  expect(old.status()).toBe(301);
  expect(old.headers()['location']).toBe(`http://${HOSTS.both}:${SITES_PORT}/en/posts/?page=2`);
});

test('a suspended site sends visitors to the channel (like a revoked one): no "not available" page', async ({ request }) => {
  for (const path of ['/', '/en/', '/ar/videos/']) {
    const res = await request.get(at(HOSTS.suspended, path), { maxRedirects: 0 });
    expect(res.status(), path).toBe(302);
    expect(res.headers()['location']).toBe('https://videos.qa.alummahnow.net/en/@mustafa-e2e');
    expect(res.headers()['cache-control']).toBe('no-store');
    expect(await res.text()).not.toMatch(/not available|try again/i);
  }
});

test('robots and sitemap are per host and complete; own-domain sitemaps list watch pages', async ({ request }) => {
  expect(await (await request.get(at(HOSTS.both, '/robots.txt'))).text()).toContain('Disallow: /');
  const subRes = await request.get(at(HOSTS.both, '/sitemap.xml'));
  expect(subRes.headers()['content-type']).toContain('application/xml');
  const sub = await subRes.text();
  const origin = `http://${HOSTS.both}:${SITES_PORT}`;
  // every post, past the API's first page of 50, in both languages, with lastmod and alternates
  for (const id of ['post-e2e-1', 'post-e2e-old-1', 'post-e2e-old-60']) {
    for (const l of ['en', 'ar']) expect(sub).toContain(`<loc>${origin}/${l}/posts/${id}/</loc>`);
  }
  expect(sub.match(/<loc>[^<]*\/en\/posts\/post-e2e-[^<]*<\/loc>/g)).toHaveLength(62);
  expect(sub).toContain(`<loc>${origin}/en/posts/post-e2e-1/</loc><lastmod>2026-11-10T10:00:00.000Z</lastmod>`);
  expect(sub).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/en/posts/post-e2e-1/"/>`);
  expect(sub).not.toContain('/watch/');
  const own = await (await request.get(at(HOSTS.custom, '/sitemap.xml'))).text();
  expect(own).toContain('/en/watch/vid-e2e-1/');
  expect(own).toContain('/ar/watch/vid-e2e-2/');
  expect(own).toContain('/en/watch/short-e2e-1/');
  // a single-language site: its language only, no alternates
  const ar = await (await request.get(at(HOSTS.arOnly, '/sitemap.xml'))).text();
  expect(ar).toContain('/ar/posts/post-e2e-old-60/');
  expect(ar).not.toContain('/en/');
  expect(ar).not.toContain('xhtml:link');
});

test('canonical, hreflang and x-default are absolute on the primary host on every page type', async ({ page }) => {
  const origin = `http://${HOSTS.custom}:${SITES_PORT}`;
  for (const path of ['', 'videos/', 'posts/', 'posts/post-e2e-1/', 'about/', 'watch/vid-e2e-1/']) {
    await page.goto(at(HOSTS.custom, `/ar/${path}`));
    await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute('href', `${origin}/ar/${path}`);
    await expect(page.locator('link[hreflang="en"]'), path).toHaveAttribute('href', `${origin}/en/${path}`);
    await expect(page.locator('link[hreflang="x-default"]'), path).toHaveAttribute('href', `${origin}/en/${path}`);
  }
  // a subdomain watch page is canonical on the videos site, so it lists no site alternates
  await page.goto(at(HOSTS.both, '/en/watch/vid-e2e-1/'));
  await expect(page.locator('link[hreflang]')).toHaveCount(0);
  await expect(page.locator('.site-header .aun-lang')).toHaveAttribute('href', '/ar/watch/vid-e2e-1/');
});

test('sign-in: one click, back on the same page, host-only session; sign-out ends it', async ({ page, context }) => {
  await page.goto(at(HOSTS.both, '/ar/posts/'));
  const signIn = page.locator('.site-header .aun-signin');
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveText('تسجيل الدخول');
  await signIn.click();
  // auth sends a signed-in browser straight back (no password) to this host's callback, then here
  await expect(page).toHaveURL(at(HOSTS.both, '/ar/posts/'));
  // the shared account button (avatar, name, caret) opens the account menu: who, apps, Sign out
  const button = page.getByTestId('site-account-button');
  await expect(button).toBeVisible();
  // the name in the page's language, from the videos profile, as www shows it (auth's token has only the Latin name)
  await expect(button).toContainText('مشاهد التجربة');
  await expect(page.locator('.site-header .aun-signin')).toBeHidden();
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const menu = page.locator('#account-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.aun-menu-who-name')).toHaveText('مشاهد التجربة');
  await expect(menu.locator('.aun-menu-who-sub')).toHaveAttribute('title', 'viewer@example.com');
  await expect(menu.getByRole('link', { name: 'الموقع' })).toHaveAttribute('href', 'https://www.qa.alummahnow.net/ar/');
  await expect(menu.getByRole('link', { name: 'المرئيات' })).toHaveAttribute('href', 'https://videos.qa.alummahnow.net/ar');
  await expect(menu.getByRole('link', { name: 'ملفك الشخصي' })).toHaveAttribute('href', /^https:\/\/profile\.auth\.qa\.alummahnow\.net\/?$/);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
  await button.click();
  const cookies = await context.cookies(at(HOSTS.both, '/'));
  const session = cookies.find((c) => c.name === '__Host-aun_site');
  expect(session?.httpOnly).toBe(true);
  expect(session?.domain).toBe(HOSTS.both); // host-only, never .sites.localhost / .alummahnow.org
  // another site on the same zone does not see it
  expect((await context.cookies(at(HOSTS.arOnly, '/'))).some((c) => c.name === '__Host-aun_site')).toBe(false);
  // the English page names the same account in English
  await page.keyboard.press('Escape');
  await page.goto(at(HOSTS.both, '/en/posts/'));
  await expect(page.getByTestId('site-account-button')).toContainText('Test Viewer');
  await page.goto(at(HOSTS.both, '/ar/posts/'));
  await page.getByTestId('site-account-button').click();
  await page.getByTestId('site-sign-out').click();
  await expect(page).toHaveURL(at(HOSTS.both, '/ar/'));
  await expect(page.locator('.site-header .aun-signin')).toBeVisible();
});

test('a11y: home and About in both languages have no axe violations', async ({ page }) => {
  for (const path of ['/en/', '/ar/', '/en/about/', '/ar/about/']) {
    await page.goto(at(HOSTS.both, path));
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, path).toEqual([]);
  }
});

test('Light / Dark is the videos site\'s icon toggle: Moon in light, Sun in dark, named for the other mode, en and ar', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(at(HOSTS.both, '/en/'));
  const toggle = page.getByTestId('theme-toggle');
  await expect(toggle).toHaveAccessibleName('Switch to dark mode');
  await expect(toggle).toHaveAttribute('title', 'Switch to dark mode');
  await expect(toggle).not.toHaveAttribute('aria-pressed', /./);
  await expect(toggle.locator('svg.lucide-moon')).toBeVisible();
  await expect(toggle.locator('svg.lucide-sun')).toBeHidden();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(toggle).toHaveAccessibleName('Switch to light mode');
  await expect(toggle.locator('svg.lucide-sun')).toBeVisible();
  await expect(toggle).toBeFocused();
  await page.goto(at(HOSTS.both, '/ar/'));
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('التبديل إلى الوضع الفاتح');
});

test('the header is the Al Ummah Now header contract: builders, order, sizes, phone collapse', async ({ page, request }) => {
  const html = await (await request.get(at(HOSTS.both, '/en/videos/'))).text();
  expect(html).toContain(siteBrandHtml({ lang: 'en', href: '/en/', name: 'Sh. Mustafa Elbadry', logoSrc: LOGO_URL }));
  // no links to other sites in the header (owner, 2026-11-15): Website and Videos stay in the account menu
  expect(html).not.toMatch(/class="aun-apps?[" ]/);
  expect(html).toContain(langButtonHtml({ lang: 'en', href: '/ar/videos/' }));
  expect(html).toContain(signInHtml({ lang: 'en', href: `/auth/login?return=${encodeURIComponent('/en/videos/')}&lang=en` }));
  expect(html).toContain(menuButtonHtml({ lang: 'en', panel: 'site-menu' }));
  // no environment badge on a local run (QA and stage only)
  expect(html).not.toContain('class="aun-env"');

  await page.goto(at(HOSTS.both, '/en/videos/'));
  const row = await page.locator('.site-header .aun-header-row > *').evaluateAll((els) => els.map((e) => e.className.split(' ')[0]));
  // the menu button first (slot 1; shown below 1024px only), then the lockup
  expect(row).toEqual(['aun-icon-btn', 'aun-brand', 'aun-header-primary', 'aun-header-tools']);
  const tools = await page.locator('.aun-header-tools > *').evaluateAll((els) => els.map((e) => e.id || e.className.split(' ')[0]));
  // language first, then light/dark, then the account (Sign in signed out)
  expect(tools).toEqual(['aun-lang', 'mode-toggle', 'aun-signin', 'account']);
  await expect(page.locator('.aun-lang')).toHaveAccessibleName('Switch to Arabic: العربية');
  const phone = (page.viewportSize()?.width ?? 1366) < 640;
  const h = async (sel: string) => (await page.locator(sel).first().boundingBox())!.height;
  expect(await h('.site-header')).toBe(phone ? 56 : 64);
  for (const sel of ['.aun-lang', '.aun-mode', '.aun-signin']) expect(await h(sel), sel).toBe(40);
  expect((await page.locator('.aun-brand-mark').boundingBox())!.width).toBe(phone ? 32 : 36);
  // sticky
  await page.evaluate(() => (document.body.style.minHeight = '300vh'));
  await page.evaluate(() => scrollTo(0, 900));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  expect((await page.locator('.site-header').boundingBox())!.y).toBe(0);
});

for (const l of ['en', 'ar'] as const) {
  test(`${l}: one line on every screen, full width, one typeface; below 1024px the menu panel holds the links`, async ({ page }) => {
    const rtl = l === 'ar';
    for (const [w, bar] of [[1440, 64], [1280, 64], [1024, 64], [1023, 64], [800, 64], [640, 64], [639, 56], [480, 56], [430, 56], [412, 56], [390, 56], [360, 56], [320, 56]] as const) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto(at(HOSTS.both, `/${l}/videos/`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w} no sideways scroll`).toBe(true);
      const header = page.locator('.site-header');
      expect((await header.boundingBox())!.height, `${w}`).toBe(bar);
      // full width: the lockup 16px from the edge (12px on phones), mirrored in Arabic
      const mark = (await page.locator('.aun-brand-mark').boundingBox())!;
      const menu = page.getByRole('button', { name: l === 'ar' ? 'القائمة' : 'Menu' });
      if (w >= 1024) {
        expect(rtl ? w - (mark.x + mark.width) : mark.x, `${w}`).toBe(16);
        await expect(menu).toBeHidden();
        await expect(page.locator('.site-nav')).toBeVisible();
        continue;
      }
      await expect(page.locator('.site-nav')).toBeHidden();
      await expect(menu).toBeVisible();
      const mb = (await menu.boundingBox())!;
      expect([mb.width, mb.height]).toEqual([40, 40]);
      expect(rtl ? w - (mb.x + mb.width) : mb.x, `${w}`).toBe(w < 640 ? 12 : 16);
      // the panel opens without script, right under the bar, with the same links (aria-current kept)
      await menu.click();
      const panel = page.locator('#site-menu');
      await expect(panel).toBeVisible();
      expect((await panel.boundingBox())!.y).toBe(bar);
      await expect(panel.getByRole('link')).toHaveText(await page.locator('.site-nav a').allTextContents());
      await expect(panel.locator('a[aria-current="page"]')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }
    // signed in: the account button in place of Sign in, still one line
    const isMe = (u: URL) => u.pathname === '/auth/me';
    await page.route(isMe, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, sub: 'u1', name: 'Test Viewer', email: 'viewer@example.com', profile: { displayName: 'Test Viewer', displayNameLocalized: { ar: 'مشاهد التجربة' } } }) }));
    for (const [w, bar] of [[1440, 64], [1280, 64], [1024, 64], [1023, 64], [800, 64], [640, 64], [639, 56], [480, 56], [430, 56], [412, 56], [390, 56], [360, 56], [320, 56]] as const) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto(at(HOSTS.both, `/${l}/videos/`));
      await expect(page.getByTestId('site-account-button')).toBeVisible();
      expect((await page.locator('.site-header').boundingBox())!.height, `signed in ${w}`).toBe(bar);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `signed in ${w} no sideways scroll`).toBe(true);
    }
    await page.unroute(isMe);
    // a long site name: still one line at every width, the wordmark is whole or gives way to the logo alone (never cut), and the tools stay whole
    for (const [w, bar] of [[1440, 64], [1100, 64], [800, 64], [480, 56], [412, 56], [390, 56], [320, 56]] as const) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto(at(HOSTS.custom, `/${l}/`));
      await expect(page.locator('.aun-brand-name')).toHaveText(LONG_NAME[l]);
      expect((await page.locator('.site-header').boundingBox())!.height, `long name ${w}`).toBe(bar);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `long name ${w} no sideways scroll`).toBe(true);
      const mode = (await page.locator('.aun-mode').boundingBox())!;
      expect(mode.width, `long name ${w}`).toBe(40);
      expect(mode.x >= 0 && mode.x + mode.width <= w, `long name ${w} tools inside`).toBe(true);
      // never a cut name: when it doesn't fit whole the bar shows the logo alone (fitBrand), the name stays the link's name
      await expect(page.locator('.site-header .aun-brand')).toHaveAccessibleName(LONG_NAME[l]);
      await expect.poll(() => page.locator('.aun-brand-name').evaluate((e) => e.scrollWidth <= e.clientWidth + 1 || !e.checkVisibility() || e.getBoundingClientRect().width <= 1), `long name ${w} never cut`).toBe(true);
    }
    // one typeface: every text in the bar uses the header's font
    const fonts = await page.locator('.site-header :is(.aun-brand-name, .site-nav a, .aun-lang, .aun-signin)').evaluateAll((els) => [...new Set(els.map((e) => getComputedStyle(e).fontFamily))]);
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toContain(rtl ? 'Noto Naskh Arabic' : 'system-ui');
    // Latin inside the Arabic header falls to system-ui, as in English
    if (rtl) expect(fonts[0]).toMatch(/"?Geeza Pro"?, system-ui/);
  });
}

// Owner (2026-11-15): a scholar site keeps its own theme's colours in the shared header; the layout
// and controls are every app's. The colours come only from the theme's --fanous-c-nav-* tokens.
test('the header wears the site\'s own theme (nahas), from its nav tokens, never Fawanees\'; contrast holds', async ({ page }) => {
  const read = () =>
    page.evaluate(() => {
      const probe = document.createElement('div');
      document.body.append(probe);
      const resolve = (token: string, prop: 'backgroundColor' | 'color' | 'borderTopColor') => {
        probe.style.cssText = `background-color: var(${token}); color: var(${token}); border: 1px solid var(${token})`;
        return getComputedStyle(probe)[prop];
      };
      const header = getComputedStyle(document.querySelector('.site-header')!);
      const lang = getComputedStyle(document.querySelector('.aun-lang')!);
      const out = {
        header: header.backgroundColor,
        langText: lang.color,
        langBorder: lang.borderTopColor,
        navBg: resolve('--fanous-c-nav-bg', 'backgroundColor'),
        navText: resolve('--fanous-c-nav-text', 'color'),
        navBorder: resolve('--fanous-c-nav-search-border', 'borderTopColor'),
      };
      probe.remove();
      return out;
    });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const l of ['en', 'ar'] as const) {
      await page.goto(at(HOSTS.both, `/${l}/`));
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'nahas');
      const own = await read();
      expect([own.header, own.langText, own.langBorder], `${scheme} ${l}`).toEqual([own.navBg, own.navText, own.navBorder]);
      // the same page in Fawanees would have other colours: the site's theme is what shows
      const fawanees = await page.evaluate(async () => {
        document.documentElement.setAttribute('data-theme', 'fawanees');
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        return getComputedStyle(document.querySelector('.site-header')!).backgroundColor;
      });
      expect(fawanees, `${scheme} ${l}`).not.toBe(own.header);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'nahas'));
      // one line, the contract's height, in the site's theme
      const phone = (page.viewportSize()?.width ?? 1366) < 640;
      expect((await page.locator('.site-header').boundingBox())!.height).toBe(phone ? 56 : 64);
      // the controls' contrast in the site's theme (and in the menu panel below 1024px)
      const contrast = async (what: string) => {
        const out = await new AxeBuilder({ page }).include('.site-header').withRules(['color-contrast']).analyze();
        expect(out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `${scheme} ${l} ${what}`).toEqual([]);
      };
      await contrast('bar');
      if ((page.viewportSize()?.width ?? 1366) < 1024) {
        await page.locator('.aun-menu-collapse').click();
        await expect(page.locator('#site-menu')).toBeVisible();
        await contrast('menu panel');
        await page.keyboard.press('Escape');
      }
    }
  }
});

test('a11y (WCAG 2.2 AA), header only: en and ar, light and dark, signed out', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ['/en/', '/ar/']) {
      await page.goto(at(HOSTS.both, path));
      const out = await new AxeBuilder({ page }).include('.site-header').options(LABEL_IN_NAME).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `${scheme} ${path}`).toEqual([]);
      if ((page.viewportSize()?.width ?? 1366) < 1024) {
        await page.locator('.aun-menu-collapse').click();
        await expect(page.locator('#site-menu')).toBeVisible();
        const panel = await new AxeBuilder({ page }).include('.site-header').options(LABEL_IN_NAME).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        expect(panel.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `${scheme} ${path} menu panel`).toEqual([]);
        await page.keyboard.press('Escape');
      }
    }
  }
});

test('a11y (WCAG 2.2 AA), header only: signed in with the account menu open', async ({ page }) => {
  await page.route((u) => u.pathname === '/auth/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, name: 'Test Viewer', email: 'viewer@example.com' }) }));
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ['/en/', '/ar/']) {
      await page.goto(at(HOSTS.both, path));
      await page.getByTestId('site-account-button').click();
      await expect(page.locator('#account-menu')).toBeVisible();
      const out = await new AxeBuilder({ page }).include('.site-header').options(LABEL_IN_NAME).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `${scheme} ${path}`).toEqual([]);
    }
  }
});

test('a site page renders its blocks with the shared page-builder renderer, en and ar', async ({ page }, info) => {
  // The banner image is on the image host: answer it here (nothing leaves the machine).
  await page.route('https://images.alummahnow.net/e2e/banner.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: stubImage(1) }));
  await page.emulateMedia({ colorScheme: 'dark' });

  await page.goto(at(HOSTS.both, '/en/welcome/'));
  const blocks = page.getByTestId('site-page-blocks');
  await expect(blocks.locator('.pb')).toHaveAttribute('dir', 'ltr');
  const types = await blocks.locator('[data-block-type]').evaluateAll((els) => els.map((e) => e.getAttribute('data-block-type')));
  // The bad link and the unknown block are left out; every Studio block id became a safe one.
  expect(types).toEqual(['markdown', 'image', 'video', 'cta', 'quote', 'divider', 'posts', 'videos']);
  await expect(blocks.locator('[data-block-type=markdown] li')).toHaveCount(2);
  // Raw HTML in Studio text is escaped: shown as text, never run.
  await expect(blocks.locator('[data-block-type=markdown]')).toContainText('<script>alert(1)</script>');
  expect(await blocks.locator('script').count()).toBe(0);
  await expect(blocks.locator('[data-block-type=image] img')).toHaveAttribute('alt', 'A lantern-lit street');
  await expect(blocks.locator('[data-block-type=image] figcaption')).toHaveText('The street at dusk.');
  await expect(blocks.locator('[data-block-type=video] iframe')).toHaveAttribute('title', 'First video');
  await expect(blocks.getByRole('link', { name: 'All videos' })).toHaveAttribute('href', '/en/videos/');
  await expect(blocks.getByRole('link', { name: 'Bad link' })).toHaveCount(0);
  await expect(blocks.locator('[data-block-type=quote] blockquote')).toContainText('righteousness');
  await expect(blocks.getByTestId('site-post')).toHaveCount(2);
  await expect(blocks.getByTestId('site-video-card')).toHaveCount(2);
  let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  mkdirSync(`e2e-artifacts/${info.project.name}`, { recursive: true });
  await page.screenshot({ path: `e2e-artifacts/${info.project.name}/site-page-blocks-en-dark.png`, fullPage: true });

  await page.goto(at(HOSTS.both, '/ar/welcome/'));
  await expect(blocks.locator('.pb')).toHaveAttribute('dir', 'rtl');
  await expect(blocks.locator('.pb')).toHaveAttribute('lang', 'ar');
  await expect(blocks.getByRole('link', { name: 'كل المرئيات' })).toHaveAttribute('href', '/ar/videos/');
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.screenshot({ path: `e2e-artifacts/${info.project.name}/site-page-blocks-ar-dark.png`, fullPage: true });
});

// Owner rule: no truncated words. On a phone with Sign in the site's name doesn't fit beside the
// tools: the bar shows the logo alone rather than «الشي…»; where it fits it shows whole.
for (const l of ['en', 'ar'] as const) {
  test(`${l}: the site's name in the bar is whole or not shown, never cut`, async ({ page }) => {
    const name = l === 'ar' ? 'الشيخ مصطفى البدري' : 'Sh. Mustafa Elbadry';
    for (const w of [1366, 800, 412, 390, 360]) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto(at(HOSTS.both, `/${l}/`));
      await expect(page.locator('.site-header .aun-brand')).toHaveAccessibleName(name);
      const state = () =>
        page.locator('.site-header .aun-brand-name').evaluate((e) => {
          const r = e.getBoundingClientRect();
          return r.width <= 1 ? 'hidden' : e.scrollWidth <= e.clientWidth + 1 ? 'whole' : 'cut';
        });
      await expect.poll(state, `${l} ${w}`).not.toBe('cut');
      if (w >= 800) expect(await state(), `${l} ${w} room for the name`).toBe('whole');
    }
  });
}

// Arabic numbers in ٠–٩ and counts that agree with their nouns (packages/render/src/count-nouns.ts:
// AlUmmahNow's formatCountNoun rules): the post with 3 likes and 1 comment, and the footer year.
test('post counts agree with their nouns and Arabic uses ٠–٩: dates, durations and the footer year', async ({ page }) => {
  await page.goto(at(HOSTS.both, '/en/posts/post-e2e-1/'));
  await expect(page.getByTestId('site-post').first()).toContainText('3 likes · 1 comment');
  await expect(page.getByTestId('site-post').first()).not.toContainText('1 comments');
  await expect(page.locator('.site-footer .footer-base')).toHaveText(/^© \d{4} Sh\. Mustafa Elbadry$/);
  await page.goto(at(HOSTS.both, '/ar/posts/post-e2e-1/'));
  await expect(page.getByTestId('site-post').first()).toContainText('٣ إعجابات · تعليق واحد');
  expect(await page.locator('.post-date').first().innerText()).not.toMatch(/[0-9]/);
  await expect(page.locator('.site-footer .footer-base')).toHaveText(/^© [٠-٩]{4} الشيخ مصطفى البدري$/);
  await page.goto(at(HOSTS.both, '/ar/'));
  for (const d of await page.locator('.video-card .duration').allInnerTexts()) expect(d).toMatch(/^[٠-٩:]+$/);
});
