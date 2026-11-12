/**
 * Timeline videos (owner screenshot 2026-11-12, Arabic, dark): the player frame takes the video's
 * shape (landscape, vertical Short, square) and stays the dark media surface in every theme and
 * mode; the embed fills the frame exactly (no band from the frame, no double bars); the channel is
 * named in the page's language.
 *
 * The seeded feed (e2e/seed-feed.ts) carries the CMS FEED_FORMAT 3 snapshot fields: width/height
 * and channel_names. The embed itself is the videos site's; here it is a black stand-in page, so the
 * check is www's frame and iframe geometry (the embed's own fill: AlUmmahNow embed.player.spec.ts).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { LOCALES } from './env';
import { IS_PRODUCTION, SCHEMES, THEME_IDS, token } from './site-theme';

const ratio = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return b.width / b.height;
};

async function stubEmbed(page: Page) {
  await page.route('**/embed/v/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><html style="background:#000"><body style="margin:0;background:#000"></body></html>' }),
  );
}

const CASES = [
  { name: 'landscape video entry (1280x720)', item: { en: 'Lesson of the week', ar: 'درس الأسبوع' }, title: { en: 'Lesson of the week', ar: 'درس الأسبوع' }, cls: 'ar-16x9', ratio: 16 / 9 },
  { name: 'vertical Short (720x1256)', item: { en: 'Two new lectures', ar: 'محاضرتان جديدتان' }, title: { en: 'First lecture', ar: 'المحاضرة الأولى' }, cls: 'ar-9x16', ratio: 9 / 16 },
  { name: 'square (1080x1080)', item: { en: 'Two new lectures', ar: 'محاضرتان جديدتان' }, title: { en: 'Square clip', ar: 'مقطع مربع' }, cls: 'ar-1x1', ratio: 1 },
] as const;

test.describe('timeline videos: shape, dark media surface, embed fit, channel name', () => {
  // The seeded local FEED KV (e2e/seed-feed.ts): a deployed site (WWW_URL: stage, QA, production) has other content
  test.skip(!!process.env.WWW_URL || IS_PRODUCTION, 'needs the seeded local FEED KV and the non-production ?theme= preview');

  for (const l of LOCALES) {
    test(`every theme, light and dark (${l})`, async ({ page }) => {
      test.setTimeout(180_000);
      await stubEmbed(page);
      for (const theme of THEME_IDS) {
        for (const scheme of SCHEMES) {
          await page.emulateMedia({ colorScheme: scheme });
          await page.goto(`/${l}/?theme=${theme}`);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          const at = `${theme} ${scheme} ${l}`;

          // The channel in the page's language (the video's plain channel name is English)
          const entry = page.locator('li.tl-item', { hasText: CASES[0].item[l] });
          await expect(entry.locator('.tl-excerpt').first(), at).toHaveText(l === 'ar' ? 'قناة العلم' : 'Knowledge channel');

          for (const c of CASES) {
            const fig = page.locator('li.tl-item', { hasText: c.item[l] }).locator('figure.facade', { has: page.getByRole('button', { name: new RegExp(c.title[l]) }) });
            const frame = fig.locator('.facade-frame');
            await expect(frame, `${c.name} ${at}`).toHaveClass(new RegExp(c.cls));
            expect(Math.abs((await ratio(frame)) - c.ratio) / c.ratio, `${c.name} frame ratio ${at}`).toBeLessThan(0.02);
            // The frame is the dark media surface in every mode (the header's night colour)
            expect(await frame.evaluate((e) => getComputedStyle(e).backgroundColor), `${c.name} frame colour ${at}`).toBe(token(theme, scheme, '--fanous-c-nav-bg'));
            // No frame taller than the screen
            expect((await frame.boundingBox())!.height, `${c.name} height ${at}`).toBeLessThanOrEqual(page.viewportSize()!.height);
          }
          // The body video with no snapshot (second of three): 16:9
          const plain = page.locator('li.tl-item', { hasText: CASES[1].item[l] }).locator('.facade-frame').nth(1);
          await expect(plain).toHaveClass(/ar-16x9/);
        }
      }

      // Playing: the embed fills the frame exactly, for each shape
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(`/${l}/`);
      for (const c of CASES) {
        // by its title attribute: the play button is gone once the player is in
        const fig = page.locator(`figure.facade[data-embed-title="${c.title[l]}"]`);
        const frame = fig.locator('.facade-frame');
        const before = (await frame.boundingBox())!;
        await fig.getByRole('button').click();
        const iframe = fig.locator('iframe.facade-iframe');
        await expect(iframe).toBeVisible();
        const box = (await iframe.boundingBox())!;
        expect(Math.abs(box.width - before.width), `${c.name} iframe width`).toBeLessThanOrEqual(1);
        expect(Math.abs(box.height - before.height), `${c.name} iframe height`).toBeLessThanOrEqual(1);
      }
    });
  }
});
