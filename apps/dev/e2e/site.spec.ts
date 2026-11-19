import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LOCALES, NAV, PAGES, dir, pagePath } from '../src/lib/pages';

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
  await page.locator('.site-header .aun-lang').click();
  await expect(page).toHaveURL(/\/ar\/infrastructure\/$/);
});

test('Contact links to the platform form with the right topic and language', async ({ page }) => {
  await page.goto('/ar/contact/');
  const hrefs = await page.locator('.contact-card a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs).toEqual(['https://videos.alummahnow.net/ar/contact?topic=partnership', 'https://videos.alummahnow.net/ar/contact?topic=general']);
});

test('one line on every screen, as www: below 1024px the links leave the bar for the menu panel', async ({ page }) => {
  for (const locale of LOCALES) {
    const rtl = locale === 'ar';
    for (const [w, bar] of [[1440, 64], [1280, 64], [1024, 64], [1023, 64], [800, 64], [640, 64], [639, 56], [480, 56], [430, 56], [412, 56], [390, 56], [360, 56], [320, 56]] as const) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto(pagePath(locale, 'infrastructure'));
      expect((await page.locator('.site-header').boundingBox())!.height, `${locale} ${w}`).toBe(bar);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${locale} ${w} no sideways scroll`).toBe(true);
      const menu = page.getByRole('button', { name: rtl ? 'القائمة' : 'Menu' });
      if (w >= 1024) {
        // full width: the brand 16px from the edge, mirrored in Arabic
        const mark = (await page.locator('.aun-brand-mark').boundingBox())!;
        expect(rtl ? w - (mark.x + mark.width) : mark.x).toBe(16);
        await expect(menu).toBeHidden();
        await expect(page.locator('.primary-nav')).toBeVisible();
        continue;
      }
      await expect(page.locator('.primary-nav')).toBeHidden();
      await menu.click();
      const panel = page.locator('#site-menu');
      await expect(panel).toBeVisible();
      expect((await panel.boundingBox())!.y).toBe(bar);
      await expect(panel.getByRole('link')).toHaveCount(NAV.length - 1);
      await expect(panel.locator('a[aria-current="page"]')).toHaveAttribute('href', pagePath(locale, 'infrastructure'));
      const axe = await new AxeBuilder({ page }).include('.site-header').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(axe.violations.map((v) => v.id), `${locale} menu panel`).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }
  }
});

test('brand is the real logo and www’s wordmark, never a drawn mark', async ({ page }) => {
  for (const locale of LOCALES) {
    await page.goto(pagePath(locale, ''));
    await expect(page.locator('.aun-brand img')).toHaveAttribute('src', '/brand/logo-192.webp');
    await expect(page.locator('.aun-brand .aun-brand-name')).toHaveText(locale === 'ar' ? 'الأمة الآن' : 'Al Ummah Now');
    await expect(page.locator('.aun-brand .aun-brand-app')).toHaveText(locale === 'ar' ? 'المطوّرون' : 'Developers');
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
  const label = { en: { live: 'Live', ready: 'Ready, not in use yet', rolling: 'Built, rolling out', building: 'In development', planned: 'Planned' } };
  await page.goto(pagePath('en', 'community'));
  const chips = await page.locator('.tile .chip').allTextContents();
  expect(chips.length).toBeGreaterThan(0);
  for (const c of chips) expect(Object.values(label.en)).toContain(c.trim());
});

test('the home page lists as live today only what the registry says is live; ready features sit apart', async ({ page, request }) => {
  const reg = (await (await request.get('/feature-registry.json')).json()) as { features: { id: string; status: string }[] };
  const status = (id: string) => reg.features.find((f) => f.id === id)?.status;
  for (const locale of LOCALES) {
    await page.goto(pagePath(locale, ''));
    const live = await page.locator('ul[aria-labelledby="live"] [data-feature]').evaluateAll((els) => els.map((e) => e.getAttribute('data-feature')!));
    expect(live.length).toBeGreaterThan(0);
    for (const id of live) expect(status(id), id).toBe('live');
    const ready = await page.locator('ul[aria-labelledby="ready"] [data-feature]').evaluateAll((els) => els.map((e) => e.getAttribute('data-feature')!));
    for (const id of ready) expect(status(id), id).toBe('ready');
  }
});

test.describe('light and dark: the hero, page heads, waqf panel and footer change with the mode', () => {
  const bg = (page: import('@playwright/test').Page, sel: string) =>
    page.locator(sel).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.backgroundImage} | ${s.color}`;
    });
  const DARK_BLUE = /rgb\(11, 29, 42\)|rgb\(9, 21, 30\)/; // --night-1 / --night-0 in the band gradient

  test('the system setting decides on first paint, in both modes', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/en/');
      await expect(page.locator('html')).not.toHaveAttribute('data-mode', /./);
      for (const sel of ['.hero', '.waqf-teaser', '.site-footer']) {
        const v = await bg(page, sel);
        if (scheme === 'dark') expect(v, sel).toMatch(DARK_BLUE);
        else expect(v, sel).not.toMatch(DARK_BLUE);
      }
      await page.goto('/ar/technology/');
      const head = await bg(page, '.page-hero');
      if (scheme === 'dark') expect(head).toMatch(DARK_BLUE);
      else expect(head).not.toMatch(DARK_BLUE);
    }
  });

  test('a click changes the hero at once, and the choice survives a reload and other pages', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/en/');
    const before = await bg(page, '.hero');
    expect(before).toMatch(DARK_BLUE);
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    const after = await bg(page, '.hero');
    expect(after).not.toBe(before);
    expect(after).not.toMatch(DARK_BLUE);
    expect(await bg(page, '.site-footer')).not.toMatch(DARK_BLUE);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    expect(await bg(page, '.hero')).toBe(after);
    // the saved choice wins over the device on another page, from the first paint
    await page.goto('/ar/waqf/');
    expect(await bg(page, '.page-hero')).not.toMatch(DARK_BLUE);
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    expect(await bg(page, '.page-hero')).toMatch(DARK_BLUE);
  });

  test('no flash: the saved mode is on <html> before the stylesheet paints', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en/');
    await page.evaluate(() => localStorage.setItem('aun_mode', 'dark'));
    const seen: string[] = [];
    await page.exposeFunction('reportMode', (m: string) => seen.push(m));
    await page.addInitScript(() => {
      // runs before any page script: record the mode the first time <body> exists
      new MutationObserver((_, obs) => {
        if (document.body) {
          (window as unknown as { reportMode: (m: string) => void }).reportMode(document.documentElement.getAttribute('data-mode') ?? 'none');
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/en/community/');
    await expect.poll(() => seen[0]).toBe('dark');
  });
});

test('the system design diagrams: titled, described, one visible variant per viewport, no sideways scroll', async ({ page }) => {
  for (const locale of LOCALES) {
    for (const slug of ['system-design', 'system-design/video-pipeline'] as const) {
      await page.goto(pagePath(locale, slug));
      const figures = page.locator('.an-figure');
      const count = await figures.count();
      expect(count, `${locale} ${slug} diagrams`).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < count; i++) {
        const fig = figures.nth(i);
        // every figure has a desktop and a phone drawing, each a titled, described image
        const svgs = fig.locator('svg.an');
        await expect(svgs).toHaveCount(2);
        for (let k = 0; k < 2; k++) {
          await expect(svgs.nth(k)).toHaveAttribute('role', 'img');
          await expect(svgs.nth(k).locator(':scope > title')).toHaveText(/\S/);
          await expect(svgs.nth(k).locator(':scope > desc')).toHaveText(/\S/);
        }
      }
      // text is text, never baked into paths
      expect(await page.locator('svg.an text').count()).toBeGreaterThan(30);
      for (const [width, variant] of [[1280, 'wide'], [390, 'narrow']] as const) {
        await page.setViewportSize({ width, height: 900 });
        for (let i = 0; i < count; i++) {
          const visible = await figures.nth(i).locator('svg.an').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e as SVGSVGElement).dataset.variant));
          expect(visible, `${locale} ${slug} figure ${i} at ${width}px`).toEqual([variant]);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${locale} ${slug} no sideways scroll at ${width}px`).toBe(true);
      }
      const axe = await new AxeBuilder({ page }).include('.an-figure').withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(axe.violations.map((v) => v.id)).toEqual([]);
    }
  }
});

test('the system design hub indexes every subpage, in both languages', async ({ page }) => {
  for (const locale of LOCALES) {
    await page.goto(pagePath(locale, 'system-design'));
    const hrefs = await page.locator('.sd-index a').evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    expect(hrefs.length).toBeGreaterThan(10);
    expect(hrefs[0]).toBe(pagePath(locale, 'system-design/video-pipeline'));
    expect(hrefs).toContain(pagePath(locale, 'system-design/release'));
    for (const locale2 of LOCALES) for (const h of hrefs) expect(h).toContain(`/${locale2}/`.replace(`/${locale2}/`, `/${locale}/`));
  }
});
