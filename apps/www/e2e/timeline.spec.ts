/**
 * The home timeline (src/components/Timeline.astro). Locally the FEED KV is seeded by
 * e2e/seed-feed.ts (a pinned post, a video entry, a channel, a post with two body videos, a card post and 50
 * dated posts); the seeded-content tests skip against a deployed site (WWW_URL), where only the
 * shape is checked.
 */
import AxeBuilder from '@axe-core/playwright';
import { token, type ThemeId } from './site-theme';
import { dayKey, dayLabel } from '../src/lib/feed.ts';
import { expect, test, type Page } from '@playwright/test';

const local = !process.env.WWW_URL;
const SEEDED_DATED = 55; // 1 video entry + 1 Short + 1 channel + 2 posts + 50 dated posts (the pinned post is separate)

const items = (page: Page) => page.locator('[data-days] li.tl-item');

/**
 * The heading the newest seeded item should sit under, in the browser's zone. The seed dates its newest
 * item an hour back, so a run within an hour after midnight sees it under Yesterday, not Today.
 */
async function newestDayHeading(page: Page, locale: 'en' | 'ar') {
  const iso = await items(page).first().locator('time[datetime]').getAttribute('datetime');
  const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const words = locale === 'en' ? { today: 'Today', yesterday: 'Yesterday' } : { today: 'اليوم', yesterday: 'أمس' };
  const label = dayLabel(dayKey(iso!, zone), new Date(), locale, words, zone);
  expect([words.today, words.yesterday], 'the newest seeded item is from today or, just after midnight, yesterday').toContain(label);
  return label;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
}

test.describe('home timeline', () => {
  test('renders the timeline (feed or fallback) on both locales', async ({ page }) => {
    for (const l of ['en', 'ar'] as const) {
      const res = await page.goto(`/${l}/`);
      expect(res?.status()).toBe(200);
      expect(['feed', 'fallback']).toContain(res?.headers()['x-feed-source']);
      await expect(page.locator('#timeline-title')).toHaveText(l === 'en' ? 'Latest' : 'الجديد');
    }
  });

  test.describe('seeded feed', () => {
    test.skip(!local, 'needs the seeded local FEED KV');

    test('pinned first, then items under day headings, first page from the feed', async ({ page }) => {
      const res = await page.goto('/en/');
      expect(res?.headers()['x-feed-source']).toBe('feed');
      const pinned = page.locator('.tl-pinned');
      await expect(pinned.getByRole('heading', { level: 3 })).toHaveText('Pinned');
      await expect(pinned.locator('.tl-card-pinned')).toHaveCount(1);
      await expect(items(page)).toHaveCount(20);
      await expect(page.locator('[data-days] .tl-date').first()).toHaveText(await newestDayHeading(page, 'en'));
      // Every item has a machine-readable time and a visible relative + absolute time.
      const first = items(page).first();
      await expect(first.locator('time[datetime]')).toHaveText(/ago|now/);
      await expect(first.locator('[data-abs]')).not.toBeEmpty();
      // Images reserve their box (no layout shift); only one image may load eagerly.
      const imgs = await page.locator('.tl img').evaluateAll((els) => els.map((e) => [e.getAttribute('width'), e.getAttribute('height'), e.getAttribute('loading')]));
      expect(imgs.every(([w, h]) => w && h)).toBe(true);
      expect(imgs.filter(([, , loading]) => loading === 'eager').length).toBeLessThanOrEqual(1);
    });

    test('inline video: poster first, the player loads only on a click', async ({ page }) => {
      await page.goto('/en/');
      const card = page.locator('li.tl-item', { hasText: 'Two new lectures' });
      await expect(card.locator('.facade')).toHaveCount(3);
      await expect(page.locator('iframe')).toHaveCount(0);
      await card.getByRole('button', { name: 'Play: First lecture' }).click();
      const frame = card.locator('iframe.facade-iframe');
      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveAttribute('src', /\/embed\/v\/body-video-1\?lang=en&autoplay=1&gesture=1$/);
      await expect(frame).toHaveAttribute('allow', /\bautoplay\b/);
      await expect(page.locator('iframe')).toHaveCount(1);
      // A video entry is a player too.
      const entry = page.locator('li.tl-item', { hasText: 'Lesson of the week' });
      await entry.getByRole('button', { name: 'Play: Lesson of the week' }).click();
      await expect(entry.locator('iframe')).toHaveAttribute('src', /\/embed\/v\/feed-video-1/);
    });

    test('card post: every card inline, the title linking to the post', async ({ page }) => {
      await page.goto('/en/');
      const card = page.locator('li.tl-item', { hasText: 'Five lessons from Surat al-Kahf' });
      await expect(card.getByRole('heading', { name: 'Five lessons from Surat al-Kahf' }).getByRole('link')).toHaveAttribute('href', '/en/articles/post-30/');
      const viewer = card.getByRole('region', { name: 'Cards: Five lessons from Surat al-Kahf' });
      await expect(viewer.locator('.ci-count')).toHaveText('5 cards');
      await expect(viewer.locator('.ci-slide')).toHaveCount(5);
      await expect(viewer.locator('.ci-slide').first()).toContainText('Lesson one');
    });

    test('load more (JS): appends in place, announces, moves focus, and reaches the end', async ({ page }) => {
      await page.goto('/en/');
      const more = page.getByRole('link', { name: 'Load more' });
      await more.click();
      await expect(items(page)).toHaveCount(40);
      await expect(page).toHaveURL(/\/en\/$/);
      await expect(page.locator('.tl-foot [data-live]')).toHaveText('20 more items added');
      await expect(page.locator(':focus')).toHaveText('News item 16');
      // Day headings stay unique after the merge.
      const days = await page.locator('[data-days] .tl-day').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.day));
      expect(new Set(days).size).toBe(days.length);
      await more.click();
      await expect(items(page)).toHaveCount(SEEDED_DATED);
      await expect(page.locator('.tl-end')).toHaveText('You have reached the end.');
      const keys = await items(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key));
      expect(new Set(keys).size).toBe(SEEDED_DATED);
      expect(await axe(page)).toEqual([]);
    });

    test.describe('without JavaScript', () => {
      test.use({ javaScriptEnabled: false });
      test('"Load more" is a link to the next page (?before=<cursor>)', async ({ page }) => {
        await page.goto('/en/');
        await expect(items(page)).toHaveCount(20);
        await page.getByRole('link', { name: 'Load more' }).click();
        await expect(page).toHaveURL(/\/en\/\?before=\d+-[pv]\d+(\.\d{4}-W\d{2}\.[a-z0-9]+)?$/);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Earlier posts');
        await expect(items(page)).toHaveCount(20);
        await expect(page.locator('.tl-pinned')).toHaveCount(0);
        await expect(page.locator('li.tl-item', { hasText: 'News item 17' })).toHaveCount(1);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      });
    });

    test('Arabic: right to left, Arabic day headings and card count', async ({ page }) => {
      await page.goto('/ar/');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('[data-days] .tl-date').first()).toHaveText(await newestDayHeading(page, 'ar'));
      await expect(page.locator('.tl-card .ci-count')).toHaveText('5 بطاقات');
      // pinned posts sit under their own "Pinned" heading (posts have no boxes or edges)
      await expect(page.locator('.tl-pinned .tl-date')).toHaveText('مثبّت');
      await expect(page.locator('.tl-pinned .tl-card-pinned')).toHaveCount(1);
      await page.getByRole('link', { name: 'عرض المزيد' }).click();
      await expect(items(page)).toHaveCount(40);
      expect(await axe(page)).toEqual([]);
    });

    test('posts have no box in light or dark: no fill, border or shadow; a hairline between them', async ({ page }) => {
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto('/en/');
        const look = await page.locator('.tl-card').evaluateAll((els) => els.map((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.backgroundImage, c.borderTopWidth, c.boxShadow].join('|'); }));
        expect(new Set(look)).toEqual(new Set(['rgba(0, 0, 0, 0)|none|0px|none']));
        const theme = (await page.locator('html').getAttribute('data-theme')) as ThemeId;
        const rule = await items(page).nth(1).evaluate((e) => getComputedStyle(e).borderTopColor);
        expect(rule).toBe(token(theme, scheme, '--fanous-color-divider'));
        expect(await axe(page)).toEqual([]);
      }
    });

    test('a missing feed falls back to the posts list, never an error page', async ({ request }) => {
      // An unknown cursor past the end is still a 200 page (empty end), and junk cursors 404.
      expect((await request.get('/en/?before=1-p1')).status()).toBe(200);
      expect((await request.get('/en/?before=junk')).status()).toBe(404);
    });
  });
});
