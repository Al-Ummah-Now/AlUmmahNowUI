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
import { HOSTS, SITES_PORT } from './stub-data.ts';
import { appLinksHtml, langButtonHtml, signInHtml } from '../../../packages/render/src/nav/header.js';
import { siteBrandHtml } from '../../../packages/render/src/site-brand.ts';

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
  await expect(page.locator('.site-header .aun-brand .aun-brand-mark')).toHaveAttribute('src', 'https://images.alummahnow.net/e2e/logo.png');
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
  await expect(button).toContainText('Test Viewer');
  await expect(page.locator('.site-header .aun-signin')).toBeHidden();
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const menu = page.locator('#account-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.aun-menu-who-name')).toHaveText('Test Viewer');
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
  expect(html).toContain(siteBrandHtml({ lang: 'en', href: '/en/', name: 'Sh. Mustafa Elbadry', logoSrc: 'https://images.alummahnow.net/e2e/logo.png' }));
  expect(html).toContain(appLinksHtml({ lang: 'en', links: [{ id: 'www', href: 'https://www.qa.alummahnow.net/en/' }, { id: 'videos', href: 'https://videos.qa.alummahnow.net/en' }] }));
  expect(html).toContain(langButtonHtml({ lang: 'en', href: '/ar/videos/' }));
  expect(html).toContain(signInHtml({ lang: 'en', href: `/auth/login?return=${encodeURIComponent('/en/videos/')}&lang=en` }));
  // no environment badge on a local run (QA and stage only)
  expect(html).not.toContain('class="aun-env"');

  await page.goto(at(HOSTS.both, '/en/videos/'));
  const row = await page.locator('.site-header .aun-header-row > *').evaluateAll((els) => els.map((e) => e.className.split(' ')[0]));
  expect(row).toEqual(['aun-brand', 'aun-header-primary', 'aun-header-tools']);
  const tools = await page.locator('.aun-header-tools > *').evaluateAll((els) => els.map((e) => e.id || e.className.split(' ')[0]));
  // language first, then light/dark, then the account (Sign in signed out)
  expect(tools).toEqual(['aun-apps', 'aun-lang', 'mode-toggle', 'aun-signin', 'account']);
  await expect(page.locator('.aun-lang')).toHaveAccessibleName('Switch to Arabic: العربية');
  const phone = (page.viewportSize()?.width ?? 1366) < 640;
  const h = async (sel: string) => (await page.locator(sel).first().boundingBox())!.height;
  expect(await h('.site-header .aun-header-tools')).toBe(phone ? 56 : 64);
  for (const sel of ['.aun-lang', '.aun-mode', '.aun-signin']) expect(await h(sel), sel).toBe(40);
  expect((await page.locator('.aun-brand-mark').boundingBox())!.width).toBe(phone ? 32 : 36);
  if (phone) await expect(page.locator('.aun-apps')).toBeHidden();
  else await expect(page.locator('.aun-app')).toHaveCount(2);
  // sticky
  await page.evaluate(() => (document.body.style.minHeight = '300vh'));
  await page.evaluate(() => scrollTo(0, 900));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  expect((await page.locator('.site-header').boundingBox())!.y).toBe(0);
});

test('a11y (WCAG 2.2 AA), header only: en and ar, light and dark, signed out', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ['/en/', '/ar/']) {
      await page.goto(at(HOSTS.both, path));
      const out = await new AxeBuilder({ page }).include('.site-header').options(LABEL_IN_NAME).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `${scheme} ${path}`).toEqual([]);
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
