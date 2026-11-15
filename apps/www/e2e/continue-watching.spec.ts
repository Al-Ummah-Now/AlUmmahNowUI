/**
 * Continue watching on the home (src/components/ContinueWatching.astro, UI#4). www's /auth/me,
 * /auth/continue-watching and auth's account list are stubbed in the browser, so this runs against
 * local wrangler dev and any deployed env alike. The endpoint itself (session tokens, refresh,
 * paused history) is unit-tested in tests/continue-watching.test.ts.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AUTH_URL, WWW_URL } from './env';

const WWW_ORIGIN = new URL(WWW_URL).origin;
const cors = { 'Access-Control-Allow-Origin': WWW_ORIGIN, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const VIDEOS = 'https://videos.example.test';
const item = (n: number, l: string) => ({
  id: `cw-${n}`,
  title: l === 'ar' ? `المرئي رقم ${n}` : `Video number ${n}`,
  href: `${VIDEOS}/${l}/video/cw-${n}`,
  thumbnailUrl: `https://images.alummahnow.net/cw-${n}.png`,
  channelName: l === 'ar' ? 'قناة العلم' : 'Knowledge channel',
  durationSeconds: 600 + n * 61,
  percent: n * 15,
});

async function stub(page: Page, opts: { signedIn: boolean; items?: (l: string) => unknown[]; status?: number }) {
  const seen: string[] = [];
  if (opts.signedIn) await page.context().addCookies([{ name: 'aun_www_si', value: '1', url: WWW_ORIGIN }]);
  await page.route((u) => u.origin === WWW_ORIGIN && u.pathname === '/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.signedIn ? { signedIn: true, sub: 'u1', name: 'Amina', email: 'a@example.com', roles: [], canEditContent: false, profile: null } : { signedIn: false }) }),
  );
  await page.route(`${AUTH_URL}/session/accounts`, (r) =>
    r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ accounts: opts.signedIn ? [{ userId: 'u1', isActive: true, email: 'a@example.com', name: 'Amina' }] : [] }) }),
  );
  await page.route((u) => u.origin === WWW_ORIGIN && u.pathname === '/auth/continue-watching', (r) => {
    const l = new URL(r.request().url()).searchParams.get('locale') ?? 'en';
    seen.push(l);
    return r.fulfill({ status: opts.status ?? 200, contentType: 'application/json', body: JSON.stringify({ signedIn: opts.signedIn, items: opts.items?.(l) ?? [] }) });
  });
  await page.route('https://images.alummahnow.net/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  return seen;
}

const row = (page: Page) => page.locator('section[data-continue]');

test.describe('Continue watching row', () => {
  for (const l of ['en', 'ar'] as const) {
    test(`${l}: signed in, the row lists the videos with progress, linking to their watch pages`, async ({ page }) => {
      const seen = await stub(page, { signedIn: true, items: (loc) => [1, 2, 3, 4, 5].map((n) => item(n, loc)) });
      await page.goto(`/${l}/`);
      await expect(row(page)).toBeVisible();
      expect(seen).toEqual([l]);
      await expect(row(page).getByRole('heading', { level: 2 })).toHaveText(l === 'ar' ? 'تابع المشاهدة' : 'Continue watching');
      const links = row(page).locator('a.cw-link');
      await expect(links).toHaveCount(5);
      await expect(links.first()).toHaveAttribute('href', `${VIDEOS}/${l}/video/cw-1`);
      // The title, then how far they got (the duration badge is not part of the name)
      await expect(links.first()).toHaveAccessibleName(l === 'ar' ? /^المرئي رقم 1 ?، شوهد 15٪$/ : /^Video number 1 ?, 15% watched$/);
      await expect(links.first().locator('.cw-badge')).toHaveText('11:01');
      expect(await links.nth(1).locator('.cw-progress > span').evaluate((e) => (e as HTMLElement).style.inlineSize)).toBe('30%');
      await expect(row(page).locator('.cw-all')).toHaveAttribute('href', new RegExp(`/${l}/history$`));
      // The row sits between the hero and the timeline, and never makes the page scroll sideways
      const order = await page.evaluate(() => ['.hero', 'section[data-continue]', '.tl-section'].map((s) => document.querySelector(s)!.getBoundingClientRect().top));
      expect(order[0]! < order[1]! && order[1]! < order[2]!).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
      const axe = await new AxeBuilder({ page }).include('section[data-continue]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }

  test('signed out: no request, no row', async ({ page }) => {
    const seen = await stub(page, { signedIn: false, items: (l) => [item(1, l)] });
    await page.goto('/en/');
    await page.waitForLoadState('networkidle');
    expect(seen).toEqual([]);
    await expect(row(page)).toBeHidden();
  });

  test('nothing to continue, or the endpoint failing: no row, no error', async ({ page }) => {
    await stub(page, { signedIn: true, items: () => [] });
    await page.goto('/en/');
    await page.waitForLoadState('networkidle');
    await expect(row(page)).toBeHidden();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stub(page, { signedIn: true, status: 502 });
    await page.goto('/en/');
    await page.waitForLoadState('networkidle');
    await expect(row(page)).toBeHidden();
  });

  test('the cached HTML is the same for everyone: the row ships hidden and empty', async ({ request }) => {
    const html = await (await request.get('/en/')).text();
    expect(html).toMatch(/<section[^>]*data-continue[^>]*hidden/);
    expect(html).not.toContain('cw-link');
  });
});
