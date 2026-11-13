/**
 * Scholar sites on the local stack (wiki AUN-SCHOLAR-SITES phase 2): a site renders in English and
 * Arabic with its own theme and branding, canonical tags follow SS7, unknown hosts 404, an old
 * subdomain redirects, and sign-in is a one-click redirect round trip with a host-only session.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { HOSTS, SITES_PORT } from './stub-data.ts';

const at = (host: string, path = '/') => `http://${host}:${SITES_PORT}${path}`;

test('a site renders in English with its own theme, name, logo and menu', async ({ page }) => {
  const res = await page.goto(at(HOSTS.both, '/en/'));
  expect(res?.status()).toBe(200);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'nahas');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('dir', 'ltr');
  await expect(page.getByTestId('site-name')).toHaveText('Sh. Mustafa Elbadry');
  await expect(page.getByTestId('site-logo')).toHaveAttribute('src', 'https://images.alummahnow.net/e2e/logo.png');
  await expect(page.getByTestId('site-nav-books')).toHaveAttribute('href', 'https://example.com/books');
  await expect(page.getByTestId('site-video-card')).toHaveCount(2);
  await expect(page.getByTestId('site-post')).toHaveCount(2);
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
  await expect(page.getByTestId('site-lang-switch')).toHaveAttribute('href', '/en/');
});

test('a single-language Arabic site: its own theme, / and /en/ go to Arabic, footer band', async ({ page }) => {
  await page.goto(at(HOSTS.arOnly, '/'));
  await expect(page).toHaveURL(at(HOSTS.arOnly, '/ar/'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'zujaj');
  await expect(page.getByTestId('site-lang-switch')).toHaveCount(0);
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

test('robots and sitemap are per host; own-domain sitemaps list watch pages', async ({ request }) => {
  expect(await (await request.get(at(HOSTS.both, '/robots.txt'))).text()).toContain('Disallow: /');
  const sub = await (await request.get(at(HOSTS.both, '/sitemap.xml'))).text();
  expect(sub).toContain(`http://${HOSTS.both}:${SITES_PORT}/ar/posts/post-e2e-1/`);
  expect(sub).not.toContain('/watch/');
  const own = await (await request.get(at(HOSTS.custom, '/sitemap.xml'))).text();
  expect(own).toContain('/en/watch/vid-e2e-1/');
});

test('sign-in: one click, back on the same page, host-only session; sign-out ends it', async ({ page, context }) => {
  await page.goto(at(HOSTS.both, '/ar/posts/'));
  await expect(page.getByTestId('site-sign-in')).toBeVisible();
  await page.getByTestId('site-sign-in').click();
  // auth sends a signed-in browser straight back (no password) to this host's callback, then here
  await expect(page).toHaveURL(at(HOSTS.both, '/ar/posts/'));
  await expect(page.getByTestId('site-account')).toBeVisible();
  await expect(page.getByTestId('site-account')).toContainText('Test Viewer');
  const cookies = await context.cookies(at(HOSTS.both, '/'));
  const session = cookies.find((c) => c.name === '__Host-aun_site');
  expect(session?.httpOnly).toBe(true);
  expect(session?.domain).toBe(HOSTS.both); // host-only, never .sites.localhost / .alummahnow.org
  // another site on the same zone does not see it
  expect((await context.cookies(at(HOSTS.arOnly, '/'))).some((c) => c.name === '__Host-aun_site')).toBe(false);
  await page.getByTestId('site-sign-out').click();
  await expect(page).toHaveURL(at(HOSTS.both, '/ar/'));
  await expect(page.getByTestId('site-sign-in')).toBeVisible();
});

test('a11y: home and About in both languages have no axe violations', async ({ page }) => {
  for (const path of ['/en/', '/ar/', '/en/about/', '/ar/about/']) {
    await page.goto(at(HOSTS.both, path));
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, path).toEqual([]);
  }
});
