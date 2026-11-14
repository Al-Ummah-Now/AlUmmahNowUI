/**
 * About is a CMS page (CMS migration 0021, slug `about`, en + ar), rendered by [slug].astro like any
 * other content page, with the built-in copy only as the last fallback.
 *
 * Local (stub CMS): the stub serves the page with a marker SEO description, so the description proves
 * the page came from the CMS and not from the built-in text. Deployed (QA, stage): the page's
 * X-Content-Source is never `builtin`, which is also what lets the edge HTML cache store it.
 */
import { expect, test } from '@playwright/test';
import { LOCALES, WWW_URL } from './env';

const local = !process.env.WWW_URL;
const STUB_DESCRIPTION = 'About page served by the stub CMS';
const H1 = { en: 'About Al Ummah Now', ar: 'عن الأمة الآن' };

for (const l of LOCALES) {
  test(`${l}: About renders the CMS About page, with canonical, hreflang and description`, async ({ page }) => {
    const res = await page.goto(`/${l}/about/`);
    expect(res?.status()).toBe(200);
    const source = res?.headers()['x-content-source'];
    // Locally the site chrome is built-in (the stub answers 503 for /site); the page itself is the stub's.
    if (!local) expect(['cms', 'cache', 'snapshot']).toContain(source);

    await expect(page.locator('html')).toHaveAttribute('lang', l);
    await expect(page.locator('html')).toHaveAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    // Editors may change the copy on QA and stage: the owner's title is checked locally only.
    if (local) await expect(h1).toHaveText(H1[l]);
    else await expect(h1).not.toHaveText('');
    await expect(page.locator('main .prose :is(h2, h3)').first()).toBeVisible();

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    if (local) expect(description).toBe(STUB_DESCRIPTION);
    else expect(description?.trim()).not.toBe('');

    const base = WWW_URL.replace(/\/+$/, '');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(new URL(canonical!).pathname).toBe(`/${l}/about/`);
    const hreflang = Object.fromEntries(
      await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) => els.map((e) => [e.getAttribute('hreflang'), e.getAttribute('href')])),
    );
    for (const k of ['en', 'ar']) expect(new URL(hreflang[k]).pathname, k).toBe(`/${k}/about/`);
    expect(hreflang['x-default'], 'x-default').toBeTruthy();
    if (local) expect(new URL(canonical!).origin).toBe(new URL(base).origin);
  });

  test(`${l}: the header and footer link to About`, async ({ page }) => {
    await page.goto(`/${l}/`);
    for (const region of ['header', 'footer']) {
      await expect(page.locator(`${region} a[href="/${l}/about/"]`).first(), region).toBeAttached();
    }
  });
}
