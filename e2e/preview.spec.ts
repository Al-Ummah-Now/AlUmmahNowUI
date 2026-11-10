/**
 * Draft preview (src/lib/preview.ts, src/pages/preview/). Local: against the stub CMS preview API
 * (e2e/stub-cms.ts). Against a deployed www only the token-free states run (no CMS token here; the
 * CMS repo's e2e/preview.spec.ts covers the editor → www flow end to end on QA).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const LOCAL = !process.env.WWW_URL;
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = () => Math.floor(Date.now() / 1000) + 30 * 60;
const WEBKIT_HTTP = 'WebKit keeps no Secure cookie on http://localhost (fine on https: QA, and the CMS E2E)';
const token = (k: string, id: number, sig = 'good', e = exp()) => `v1.${b64({ k, id, iat: e - 1800, exp: e })}.${sig}`;

async function axeAndShot(page: Page, name: string, project: string) {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const dir = `e2e-artifacts/${project}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test.describe('draft preview', () => {
  test('en draft page: banner, no token anywhere, noindex, never cached', async ({ page, browserName }, info) => {
    test.skip(!LOCAL, 'needs the stub CMS');
    test.skip(browserName === 'webkit', WEBKIT_HTTP);
    const t = token('pages', 1);
    const res = await page.goto(`/preview?token=${t}`);
    await expect(page).toHaveURL(/\/preview\/pages\/1$/);
    expect(res?.status()).toBe(200);
    const h = res!.headers();
    expect(h['cache-control']).toBe('private, no-store, no-transform');
    expect(h['x-robots-tag']).toContain('noindex');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['content-security-policy']).not.toContain('cloudflareinsights');
    expect(h['x-edge-cache']).toBeUndefined();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('region', { name: 'Preview — not published' })).toBeVisible();
    await expect(page.getByText(/stops working in \d+ min/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the editor' })).toHaveAttribute('href', 'http://localhost:8585/pages/1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Draft page for preview');
    await expect(page.getByRole('heading', { name: 'Draft heading' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(await page.content()).not.toContain(t.split('.')[1]);
    // Reload works from the cookie alone (the URL never carries the token again).
    const again = await page.reload();
    expect(again?.status()).toBe(200);
    await axeAndShot(page, 'en-preview', info.project.name);
  });

  test('ar draft post renders right-to-left with the Arabic banner', async ({ page, browserName }, info) => {
    test.skip(!LOCAL, 'needs the stub CMS');
    test.skip(browserName === 'webkit', WEBKIT_HTTP);
    await page.goto(`/preview?token=${token('posts', 2)}`);
    await expect(page).toHaveURL(/\/preview\/posts\/2$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('region', { name: 'معاينة — غير منشور' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('خبر لم يُنشر بعد');
    await expect(page.getByText('بقلم فريق التحرير')).toBeVisible();
    await axeAndShot(page, 'ar-preview', info.project.name);
  });

  test('the CMS says expired, deleted or invalid: friendly pages', async ({ page, browserName }, info) => {
    test.skip(!LOCAL, 'needs the stub CMS');
    test.skip(browserName === 'webkit', WEBKIT_HTTP);
    let res = await page.goto(`/preview?token=${token('pages', 1, 'expired')}`);
    expect(res?.status()).toBe(410);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This preview link has expired');
    await expect(page.getByRole('link', { name: 'Open the CMS' })).toHaveAttribute('href', 'http://localhost:8585/pages/1');
    res = await page.goto(`/preview?token=${token('pages', 404)}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This draft no longer exists');
    res = await page.goto(`/preview?token=${token('pages', 1, 'forged')}`);
    expect(res?.status()).toBe(400);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("This preview link doesn't work");
    await axeAndShot(page, 'en-preview-invalid', info.project.name);
  });

  for (const l of ['en', 'ar'] as const) {
    test(`${l}: a broken or old link lands on a friendly, token-free page`, async ({ page, context }, info) => {
      await context.addCookies([{ name: 'aun_locale', value: l, url: test.info().project.use.baseURL! }]);
      let res = await page.goto('/preview?token=v1.e2e.broken');
      await expect(page).toHaveURL(/\/preview\/invalid$/);
      expect(res?.status()).toBe(400);
      expect(res?.headers()['cache-control']).toBe('private, no-store, no-transform');
      await expect(page.locator('html')).toHaveAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(l === 'en' ? "This preview link doesn't work" : 'رابط المعاينة هذا لا يعمل');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
      await expect(page.locator('a.signin-link')).not.toHaveAttribute('href', /token/);
      await axeAndShot(page, `${l}-preview-broken`, info.project.name);
      res = await page.goto(`/preview?token=${token('pages', 1, 'good', Math.floor(Date.now() / 1000) - 60)}`);
      await expect(page).toHaveURL(/\/preview\/expired$/);
      expect(res?.status()).toBe(410);
      // No cookie for this row (another browser, or the 30 minutes ran out).
      res = await page.goto('/preview/posts/99');
      expect(res?.status()).toBe(410);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(l === 'en' ? 'This preview link has expired' : 'انتهت صلاحية رابط المعاينة');
    });
  }

  test('unknown preview paths are the site 404', async ({ request }) => {
    expect((await request.get('/preview/media/1')).status()).toBe(404);
    expect((await request.get('/preview/nothing')).status()).toBe(404);
  });
});
