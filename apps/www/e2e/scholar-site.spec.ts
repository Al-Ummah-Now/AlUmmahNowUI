/**
 * Scholar sites on www (AUN-SCHOLAR-SITES SS6/SS7, AlUmmahNow#1215): "the canonical follows the brand
 * host", in the head only. The scholar page and the post page render exactly as without a site; only
 * canonical, og:url and hreflang move to the site. Local only: the stub CMS serves the scholars, their
 * post references and the sitemap, and stands in for api-videos' /api/sites/by-channel
 * (e2e/stub-scholar-sites.ts).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { SITE_HOST, SITE_REF_POST } from './stub-scholar-sites.ts';

const LOCAL = !process.env.WWW_URL || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(process.env.WWW_URL);
test.skip(!LOCAL, 'needs the stub CMS (local E2E)');

const SITE = `https://${SITE_HOST}`;

/** The page's structure: every landmark section, the tabs, the scholar links and buttons. */
async function outline(page: Page) {
  return page.locator('main').evaluate((main) => ({
    sections: [...main.querySelectorAll('section, nav')].map((e) => `${e.tagName}#${e.id}.${e.className}`),
    links: [...main.querySelectorAll('.scholar-head a, .scholar-links a')].map((a) => a.className),
    headings: [...main.querySelectorAll('h1, h2')].map((h) => h.tagName),
  }));
}

test.describe('a scholar with a live site', () => {
  for (const locale of ['en', 'ar'] as const) {
    test(`${locale}: the full scholar page as without a site; canonical, og:url and hreflang on the site home`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      const res = await page.goto(`/${locale}/scholars/e2e-site-scholar/`);
      expect(res?.status()).toBe(200);
      // the site's home page in its default language (Arabic here), whatever the page's language
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}/ar/`);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${SITE}/ar/`);
      await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute('href', `${SITE}/ar/`);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', `${SITE}/en/`);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', `${SITE}/ar/`);
      // the normal page: profile, articles, videos, the channel link; nothing about the site in the body
      await expect(page.locator('#articles')).toHaveCount(1);
      await expect(page.locator('#videos')).toHaveCount(1);
      await expect(page.locator('main')).not.toContainText(SITE_HOST);
      await expect(page.locator(`main a[href^="${SITE}"]`)).toHaveCount(0);
      const withSite = await outline(page);
      await page.goto(`/${locale}/scholars/e2e-plain-scholar/`);
      expect(withSite).toEqual(await outline(page));
      await page.goto(`/${locale}/scholars/e2e-site-scholar/`);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const dir = `e2e-artifacts/${info.project.name}`;
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/${locale}-scholar-site-dark.png`, fullPage: true });
      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }

  test('its post reference renders here (no redirect), canonical and og:url on the site post page', async ({ page, request }) => {
    const res = await request.get('/en/articles/e2e-site-post/', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    await page.goto('/en/articles/e2e-site-post/');
    await expect(page.locator('h1')).toContainText('Scholar post e2e-site-post');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}/en/posts/${SITE_REF_POST}/`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${SITE}/en/posts/${SITE_REF_POST}/`);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', `${SITE}/ar/posts/${SITE_REF_POST}/`);
  });
});

test.describe('www stays canonical', () => {
  test('no site: the full scholar page and the post, canonical on www', async ({ page, request, baseURL }) => {
    await page.goto('/en/scholars/e2e-plain-scholar/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/scholars\/e2e-plain-scholar\/$/);
    await expect(page.locator('#articles')).toHaveCount(1);
    const post = await request.get('/en/articles/e2e-plain-post/', { maxRedirects: 0 });
    expect(post.status()).toBe(200);
    expect(await post.text()).toContain(`<link rel="canonical" href="${baseURL}/en/articles/e2e-plain-post/"`);
  });

  test('the site lookup fails: a 200 with www canonical, never an error page', async ({ page, request, baseURL }) => {
    const res = await page.goto('/ar/scholars/e2e-down-scholar/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ar\/scholars\/e2e-down-scholar\/$/);
    const post = await request.get('/en/articles/e2e-down-post/', { maxRedirects: 0 });
    expect(post.status()).toBe(200);
    expect(await post.text()).toContain(`<link rel="canonical" href="${baseURL}/en/articles/e2e-down-post/"`);
  });
});

test('the www sitemap leaves out what is canonical on a scholar site', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).not.toContain('/scholars/e2e-site-scholar/');
  expect(xml).not.toContain('/articles/e2e-site-post/');
  expect(xml).toContain('/en/scholars/e2e-plain-scholar/');
  expect(xml).toContain('/en/articles/e2e-plain-post/');
  // a failed lookup keeps the URLs
  expect(xml).toContain('/ar/scholars/e2e-down-scholar/');
  expect(xml).toContain('/en/articles/e2e-down-post/');
});
