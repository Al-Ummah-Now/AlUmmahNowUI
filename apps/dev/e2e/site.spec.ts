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

test('Light / Dark: www’s icon button, saved per device, applied before paint on the next page', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/en/');
  const toggle = page.getByTestId('theme-toggle');
  await expect(toggle).toHaveAccessibleName('Switch to dark mode');
  await expect(toggle).toHaveAttribute('title', 'Switch to dark mode');
  await expect(toggle).not.toHaveAttribute('aria-pressed', /./);
  await expect(toggle.locator('svg.lucide-moon')).toBeVisible();
  await expect(toggle.locator('svg.lucide-sun')).toBeHidden();
  await expect(toggle).not.toContainText(/\S/);
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(toggle).toHaveAccessibleName('Switch to light mode');
  await expect(toggle.locator('svg.lucide-sun')).toBeVisible();
  await expect(toggle).toBeFocused();
  await page.goto('/ar/waqf/');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('التبديل إلى الوضع الفاتح');
});

test('language switch keeps the page', async ({ page }) => {
  await page.goto('/en/infrastructure/');
  await page.locator('.lang-switch').click();
  await expect(page).toHaveURL(/\/ar\/infrastructure\/$/);
});

test('Contact links to the platform form with the right topic and language', async ({ page }) => {
  await page.goto('/ar/contact/');
  const hrefs = await page.locator('.contact-card a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs).toEqual(['https://videos.alummahnow.net/ar/contact?topic=partnership', 'https://videos.alummahnow.net/ar/contact?topic=general']);
});

test('phone: www’s collapse, the links on their own row that scrolls, tools beside the brand', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone only');
  for (const locale of LOCALES) {
    await page.goto(pagePath(locale, ''));
    const brand = await page.locator('.brand').boundingBox();
    const tools = await page.locator('.header-tools').boundingBox();
    const nav = await page.locator('.primary-nav').boundingBox();
    expect(Math.abs(brand!.y + brand!.height / 2 - (tools!.y + tools!.height / 2))).toBeLessThan(4);
    expect(nav!.y).toBeGreaterThanOrEqual(brand!.y + brand!.height);
    await expect(page.locator('.primary-nav a')).toHaveCount(PAGES.length - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('.primary-nav').evaluate((n) => getComputedStyle(n).overflowX)).toBe('auto');
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

test('every status comes from the wiki’s feature registry the site was built from', async ({ page, request }) => {
  const reg = (await (await request.get('/feature-registry.json')).json()) as { source: { sha: string }; features: { id: string; status: string; name: { en: string; ar: string } }[] };
  expect(reg.features.length).toBeGreaterThan(0);
  for (const locale of LOCALES) {
    await page.goto(pagePath(locale, 'technology'));
    for (const f of reg.features) {
      const row = page.locator(`#feature-${f.id}`);
      await expect(row).toHaveCount(1);
      await expect(row.locator('.registry-name')).toHaveText(f.name[locale]);
      // the row sits in its status's group
      await expect(page.locator(`section[aria-labelledby="registry-${f.status}"] #feature-${f.id}`)).toHaveCount(1);
    }
    const sha = reg.source.sha === 'local' ? 'local' : reg.source.sha.slice(0, 7);
    await expect(page.locator('.registry-source')).toContainText(sha);
  }
  // the chips on the other pages show the same status as the registry
  const label = { en: { live: 'Live', rolling: 'Built, rolling out', building: 'In development', planned: 'Planned' } };
  await page.goto(pagePath('en', 'community'));
  const chips = await page.locator('.tile .chip').allTextContents();
  expect(chips.length).toBeGreaterThan(0);
  for (const c of chips) expect(Object.values(label.en)).toContain(c.trim());
});
