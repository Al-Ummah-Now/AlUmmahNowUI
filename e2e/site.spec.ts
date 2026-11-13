import { expect, test } from '@playwright/test';
import { AUTH_URL, CLIENT_ID, LOCALES, REDIRECT_URI } from './env';

const HEADINGS = {
  en: { articles: 'Articles', videos: 'Videos', notFound: 'We could not find that page' },
  ar: { articles: 'المقالات', videos: 'المرئيات', notFound: 'لم نعثر على هذه الصفحة' },
};

test.describe('rendering', () => {
  for (const l of LOCALES) {
    test(`${l}: home has lang/dir, one h1, landmarks and the wordmark`, async ({ page }) => {
      const res = await page.goto(`/${l}/`);
      expect(res?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', l);
      await expect(page.locator('html')).toHaveAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByText('الأمة الآن').first()).toBeVisible();
      await expect(page.locator('header nav[aria-label]')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('footer')).toHaveCount(1);
      expect(['cms', 'cache', 'snapshot', 'builtin']).toContain(res?.headers()['x-content-source']);
    });

    test(`${l}: articles and videos pages`, async ({ page }) => {
      await page.goto(`/${l}/articles/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(HEADINGS[l].articles);
      await page.goto(`/${l}/videos/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(HEADINGS[l].videos);
    });

    test(`${l}: unknown routes get the localized 404`, async ({ page }) => {
      const res = await page.goto(`/${l}/this/does/not/exist/`);
      expect(res?.status()).toBe(404);
      await expect(page.locator('html')).toHaveAttribute('lang', l);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(HEADINGS[l].notFound);
      await expect(page.getByRole('link', { name: l === 'en' ? 'Go to the home page' : 'الذهاب إلى الصفحة الرئيسية' })).toHaveAttribute('href', `/${l}/`);
    });
  }

  test('skip link moves focus to main', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not Tab to links by default');
    await page.goto('/en/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});

test.describe('routing', () => {
  test('/ redirects by Accept-Language and cookie', async ({ request }) => {
    const ar = await request.get('/', { headers: { 'Accept-Language': 'ar-EG,ar;q=0.9' }, maxRedirects: 0 });
    expect(ar.status()).toBe(302);
    expect(ar.headers().location).toBe('/ar/');
    const cookie = await request.get('/', { headers: { 'Accept-Language': 'ar', Cookie: 'aun_locale=en' }, maxRedirects: 0 });
    expect(cookie.headers().location).toBe('/en/');
  });

  test('old /news/ urls 301 to /articles/, query kept', async ({ request }) => {
    const cases: [string, string][] = [
      ['/en/news/', '/en/articles/'],
      ['/ar/news', '/ar/articles/'],
      ['/ar/news/?page=2', '/ar/articles/?page=2'],
      ['/en/news/some-post/', '/en/articles/some-post/'],
      ['/ar/news/%D9%85%D9%82%D8%A7%D9%84/?utm_source=x&a=%20b', '/ar/articles/%D9%85%D9%82%D8%A7%D9%84/?utm_source=x&a=%20b'],
    ];
    for (const [from, to] of cases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), from).toBe(301);
      expect(res.headers().location, from).toBe(to);
    }
    // /newsletter and other locales are not part of the old section
    expect((await request.get('/en/newsletter/', { maxRedirects: 0 })).status()).not.toBe(301);
    expect((await request.get('/fr/news/', { maxRedirects: 0 })).status()).toBe(404);
  });

  test('following an old /news/ link lands on the Articles page', async ({ page }) => {
    await page.goto('/ar/news/?page=1');
    await expect(page).toHaveURL(/\/ar\/articles\/\?page=1$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(HEADINGS.ar.articles);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('invalid locale is a 404', async ({ request }) => {
    expect((await request.get('/fr/')).status()).toBe(404);
  });

  test('healthz, robots, sitemap and rss respond', async ({ request }) => {
    const health = await request.get('/healthz');
    expect(health.ok()).toBe(true);
    const body = await health.json();
    expect(body.ok).toBe(true);
    expect(['ok', 'degraded']).toContain(body.cms);
    expect((await request.get('/robots.txt')).ok()).toBe(true);
    expect(await (await request.get('/sitemap.xml')).text()).toContain('/ar/articles/');
    expect(await (await request.get('/en/rss.xml')).text()).toContain('<rss');
  });

  test('/{en,ar}/contact sends visitors to the videos site Contact us page', async ({ request }) => {
    for (const locale of ['en', 'ar']) {
      const res = await request.get(`/${locale}/contact`, { maxRedirects: 0 });
      expect(res.status()).toBe(302);
      expect(res.headers().location).toMatch(new RegExp(`^https://videos\\.[a-z.]*alummahnow\\.net/${locale}/contact$`));
    }
  });

  test('HTML carries the CSP and security headers', async ({ request }) => {
    const res = await request.get('/en/');
    const h = res.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).toContain("script-src 'self'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

test.describe('language switch', () => {
  test('en → ar keeps the page and remembers the choice', async ({ page, context }) => {
    await page.goto('/en/articles/');
    // exact: a page can also link "Articles in العربية" (stage's articles page does)
    await page.getByRole('link', { name: 'العربية', exact: true }).click();
    await expect(page).toHaveURL(/\/ar\/articles\/$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'aun_locale')?.value).toBe('ar');
    await page.getByRole('link', { name: 'English', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/articles\/$/);
  });
});

test.describe('sign-in', () => {
  test('the Sign in link goes to auth /authorize with the exact client_id, redirect_uri and a PKCE challenge', async ({ page }) => {
    // Never actually load auth: capture the request and stop it
    await page.route(`${AUTH_URL}/**`, (route) => route.fulfill({ status: 200, body: 'auth stub' }));
    await page.goto('/en/articles/');
    const [req] = await Promise.all([page.waitForRequest((r) => r.url().startsWith(`${AUTH_URL}/authorize`)), page.getByRole('link', { name: 'Sign in' }).first().click()]);
    const url = new URL(req.url());
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  test('/auth/me is signed out and never cached', async ({ request }) => {
    const res = await request.get('/auth/me');
    expect(await res.json()).toEqual({ signedIn: false });
    expect(res.headers()['cache-control']).toBe('private, no-store');
  });

  test('sign-out rejects a cross-site POST', async ({ request }) => {
    const res = await request.post('/auth/logout', { headers: { Origin: 'https://evil.example' }, maxRedirects: 0 });
    expect(res.status()).toBe(403);
  });
});

test.describe('CMS content', () => {
  const title = process.env.E2E_EXPECT_TITLE;
  test.skip(!title, 'set E2E_EXPECT_TITLE to check that an item published in the CMS appears');
  test('a published item appears on www (polled up to 90 s)', async ({ request }) => {
    test.setTimeout(120_000);
    await expect
      .poll(
        async () => {
          for (const path of ['/en/', '/en/articles/', '/en/videos/', '/ar/', '/ar/articles/']) {
            const html = await (await request.get(`${path}?e2e=${Date.now()}`)).text();
            if (html.includes(title!)) return true;
          }
          return false;
        },
        { timeout: 90_000, intervals: [5_000] },
      )
      .toBe(true);
  });
});
