import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LOCALES, PAGES, dir, pagePath } from '../src/lib/pages';

for (const locale of LOCALES) {
  for (const slug of PAGES) {
    const path = pagePath(locale, slug);
    for (const mode of ['dark', 'light'] as const) {
      test(`${path} ${mode}: renders, SEO links, axe clean`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: mode });
        const errors: string[] = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(e.message));
        const res = await page.goto(path);
        expect(res?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('html')).toHaveAttribute('dir', dir(locale));
        await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://alummahnow.dev${path}`);
        await expect(page.locator('link[rel=alternate][hreflang=x-default]')).toHaveAttribute('href', `https://alummahnow.dev${pagePath('en', slug)}`);
        await expect(page.locator('h1')).toHaveCount(1);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
        // No horizontal scroll, and nothing blocked by the CSP
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(errors).toEqual([]);
      });
    }
  }
}

test('/ redirects to /en/; unknown paths are a real 404 page in both languages', async ({ page, request }) => {
  const r = await request.get('/', { maxRedirects: 0 });
  expect(r.status()).toBe(302);
  expect(r.headers().location).toMatch(/\/en\/$/);
  const res = await page.goto('/en/nothing-here/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('section[lang=ar] h2')).toHaveText('الصفحة غير موجودة');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations).toEqual([]);
});

test('security headers, no cookies, noindex off production', async ({ request }) => {
  const r = await request.get('/en/');
  const h = r.headers();
  expect(h['content-security-policy']).toContain("default-src 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-robots-tag']).toBe('noindex, nofollow');
  expect(h['set-cookie']).toBeUndefined();
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const l of LOCALES) for (const s of PAGES) expect(sitemap).toContain(`<loc>https://alummahnow.dev${pagePath(l, s)}</loc>`);
});

test('Dark mode toggle: saved per device, applied before paint on the next page', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/en/');
  const toggle = page.locator('[data-mode-toggle]');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await page.goto('/ar/waqf/');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(page.locator('[data-mode-toggle]')).toHaveAttribute('aria-pressed', 'true');
});

test('language switch keeps the page', async ({ page }) => {
  await page.goto('/en/infrastructure/');
  await page.locator('.lang-link').click();
  await expect(page).toHaveURL(/\/ar\/infrastructure\/$/);
});

test('Contact links to the platform form with the right topic and language', async ({ page }) => {
  await page.goto('/ar/contact/');
  const hrefs = await page.locator('.contact-card a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs).toEqual(['https://videos.alummahnow.net/ar/contact?topic=partnership', 'https://videos.alummahnow.net/ar/contact?topic=general']);
});

test('phone menu opens, every link is inside the screen, Escape closes it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone only');
  for (const locale of LOCALES) {
    await page.goto(pagePath(locale, ''));
    const button = page.locator('[data-menu-toggle]');
    await button.click();
    const links = page.locator('#site-nav a');
    await expect(links).toHaveCount(PAGES.length - 1);
    const vw = page.viewportSize()!.width;
    for (const box of await links.evaluateAll((as) => as.map((a) => a.getBoundingClientRect().toJSON()))) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(vw);
    }
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  }
});

test('brand is the real logo and www’s wordmark, never a drawn mark', async ({ page }) => {
  for (const locale of LOCALES) {
    await page.goto(pagePath(locale, ''));
    await expect(page.locator('.brand img')).toHaveAttribute('src', '/brand/logo-192.webp');
    await expect(page.locator('.brand')).toHaveText(locale === 'ar' ? 'الأمة الآن' : 'Al Ummah Now');
    await expect(page.locator('.hero-logo source')).toHaveAttribute('srcset', '/brand/logo-512.webp');
    await expect(page.locator('.hero-logo img')).toHaveAttribute('src', '/brand/alummah-now-logo.png');
    await expect(page.locator('.hero-wordmark')).toHaveText('الأمة الآن');
    await expect(page.locator('.footer-mark')).toHaveText('الأمة الآن');
    // No hand-drawn lanterns anywhere
    await expect(page.locator('svg.lantern, svg.lantern-icon')).toHaveCount(0);
    const img = await page.locator('.hero-logo img').evaluate((el) => getComputedStyle(el).filter + '|' + getComputedStyle(el).boxShadow);
    expect(img).toBe('none|none');
  }
});
