/**
 * Timeline videos and Shorts (owner design pick 2026-11-12, direction A): hover plays a muted
 * preview with play / sound / progress controls; the controls act on the preview and never open the
 * post or the Shorts viewer (owner bug: "why does it open the Short if I unmute it"). A click on a
 * Short's surface opens the Shorts viewer: one Short per screen, ↑ ↓ for the next, Esc returns focus.
 *
 * The videos platform's public play API (src/scripts/timeline-media.ts) is routed to fixtures here:
 * GET {api}/videos/{id}/play and GET {api}/shorts?after=…; the files are e2e/fixtures/*.webm served
 * (WebM) from a media host the CSP allows (src/lib/images.ts VIDEO_MEDIA_HOSTS).
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { IS_PRODUCTION } from './site-theme';

test.skip(!!process.env.WWW_URL || IS_PRODUCTION, 'needs the seeded local FEED KV');

const MEDIA = 'https://e2e.b-cdn.net';
// WebM inside (Playwright's Chromium has no H.264); the browser sniffs the file, the URL is the API's
const clip = (name: string) => readFileSync(new URL(`./fixtures/${name}.webm`, import.meta.url));
const play = (id: string, format: 'short' | 'video', title: string) => ({
  id,
  format,
  title,
  channelName: 'Knowledge channel',
  channelHandle: 'knowledge',
  width: format === 'short' ? 720 : 1280,
  height: format === 'short' ? 1280 : 720,
  durationSeconds: format === 'short' ? 48 : 760,
  poster: null,
  mp4: { url: `${MEDIA}/${id}/${format}.mp4`, width: null, height: null },
  hls: null,
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  watchUrl: `https://videos.qa.alummahnow.net/en/watch/${id}`,
});

async function routeApi(page: Page, opts: { down?: boolean; noFile?: boolean } = {}) {
  const calls: string[] = [];
  await page.route('**/api/v1/videos/*/play', (r) => {
    calls.push(r.request().url());
    if (opts.down) return r.fulfill({ status: 503, body: '' });
    const id = decodeURIComponent(r.request().url().split('/videos/')[1]!.split('/')[0]!);
    const short = id.includes('short');
    return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(play(id, short ? 'short' : 'video', short ? 'A minute with an ayah' : 'Lesson of the week')) });
  });
  await page.route('**/api/v1/shorts?*', (r) => {
    calls.push(r.request().url());
    const after = new URL(r.request().url()).searchParams.get('after');
    const items = after === 'feed-short-1' ? [play('next-short-2', 'short', 'Three words before sleep'), play('next-short-3', 'short', 'Why we begin with Bismillah')] : [];
    return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ items, next: null }) });
  });
  await page.route(`${MEDIA}/**`, (r) => opts.noFile ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ contentType: 'video/webm', body: clip(r.request().url().endsWith('short.mp4') ? 'short' : 'video') }));
  return calls;
}

const shortPost = (page: Page) => page.locator('li.tl-item', { has: page.locator('.tl-mwrap[data-short]') }).first();
const videoPost = (page: Page) => page.locator('li.tl-item', { has: page.locator('.tl-mwrap[data-video-id]:not([data-short])') }).first();
const viewer = (page: Page) => page.locator('dialog.sv');

test.describe('timeline: video preview controls never open the post', () => {
  test.skip(({ isMobile }) => isMobile, 'hover preview is for a mouse');

  test('video: hover plays a muted preview; sound and play act in place, by mouse and keyboard', async ({ page }) => {
    await routeApi(page);
    await page.goto('/en/');
    const post = videoPost(page);
    const wrap = post.locator('.tl-mwrap');
    await wrap.scrollIntoViewIfNeeded();
    await wrap.hover();
    await expect(wrap).toHaveAttribute('data-previewing', '');
    const preview = wrap.locator('video.tl-preview');
    expect(await preview.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);

    const sound = post.getByRole('button', { name: 'Turn the sound on' });
    await sound.click();
    await expect(post.getByRole('button', { name: 'Turn the sound off' })).toHaveAttribute('aria-pressed', 'true');
    expect(await preview.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
    await post.getByRole('button', { name: 'Pause the preview' }).click();
    await expect(post.getByRole('button', { name: 'Play the preview' })).toBeVisible();
    expect(await preview.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);

    // keyboard: Enter and Space on the controls act on the preview only
    await post.getByRole('button', { name: 'Turn the sound off' }).focus();
    await page.keyboard.press('Enter');
    await expect(post.getByRole('button', { name: 'Turn the sound on' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(post.getByRole('button', { name: 'Turn the sound off' })).toBeVisible();

    // nothing opened: no player iframe, no viewer, same page
    await expect(post.locator('.facade-iframe')).toHaveCount(0);
    await expect(viewer(page)).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/en/');
  });

  test('Short: the preview controls do not open the Shorts viewer', async ({ page }) => {
    await routeApi(page);
    await page.goto('/ar/');
    const post = shortPost(page);
    const wrap = post.locator('.tl-mwrap');
    await wrap.scrollIntoViewIfNeeded();
    await wrap.hover();
    await expect(wrap).toHaveAttribute('data-previewing', '');
    await post.getByRole('button', { name: 'شغّل الصوت' }).click();
    await post.getByRole('button', { name: 'أوقف المعاينة' }).click();
    await post.getByRole('button', { name: 'أغلق الصوت' }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(viewer(page)).toHaveCount(0);
    await expect(post.locator('.facade-iframe')).toHaveCount(0);
  });
});

test.describe('timeline: preview fallbacks', () => {
  test.skip(({ isMobile }) => isMobile, 'hover preview is for a mouse');
  test('a file the CDN does not have keeps the poster and shows no controls', async ({ page }) => {
    await routeApi(page, { noFile: true });
    await page.goto('/en/');
    const wrap = videoPost(page).locator('.tl-mwrap');
    await wrap.scrollIntoViewIfNeeded();
    await wrap.hover();
    await expect(wrap.locator('video.tl-preview')).toHaveCount(0);
    await expect(wrap).not.toHaveAttribute('data-previewing', '');
    await expect(wrap.locator('[data-vctl]')).toBeHidden();
  });
});

test.describe('timeline: the Shorts viewer', () => {
  test('a click on a Short opens it; ↓ goes to the next Short; Esc closes and returns focus', async ({ page, isMobile }) => {
    const calls = await routeApi(page);
    await page.goto('/en/');
    const surface = shortPost(page).locator('.facade-play');
    await surface.scrollIntoViewIfNeeded();
    if (isMobile) await surface.tap();
    else await surface.click();
    const dlg = viewer(page);
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Close Shorts' })).toBeFocused();
    await expect(dlg.locator('.sv-item')).toHaveCount(3);
    expect(calls.some((u) => u.includes('/shorts?after=feed-short-1'))).toBe(true);
    await expect(dlg.locator('[aria-live]')).toHaveText('Short 1: A minute with an ayah');

    // the viewer's own sound button acts and keeps the viewer open
    const sound = dlg.locator('.sv-item').first().locator('button[aria-pressed]');
    const before = await sound.getAttribute('aria-pressed');
    await sound.click();
    await expect(sound).not.toHaveAttribute('aria-pressed', before!);
    await expect(dlg).toBeVisible();

    await dlg.getByRole('button', { name: 'Close Shorts' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(dlg.locator('[aria-live]')).toHaveText('Short 2: Three words before sleep');
    await page.keyboard.press('ArrowUp');
    await expect(dlg.locator('[aria-live]')).toHaveText('Short 1: A minute with an ayah');

    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(surface).toBeFocused();
    // a Short never plays in place
    await expect(shortPost(page).locator('.facade-iframe')).toHaveCount(0);
  });

  test('ar: the viewer speaks Arabic and links to the Arabic watch page', async ({ page }) => {
    await routeApi(page);
    await page.goto('/ar/');
    const surface = shortPost(page).locator('.facade-play');
    await surface.scrollIntoViewIfNeeded();
    await surface.click();
    const dlg = viewer(page);
    await expect(dlg.getByRole('button', { name: 'أغلق المقاطع القصيرة' })).toBeFocused();
    await expect(dlg.locator('.sv-watch').first()).toHaveAttribute('href', /\/ar\/watch\//);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
  });

  test('when the videos platform does not answer, the Short plays in place as before', async ({ page }) => {
    await routeApi(page, { down: true });
    await page.route('**/embed/v/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>embed</title>' }));
    await page.goto('/en/');
    const surface = shortPost(page).locator('.facade-play');
    await surface.scrollIntoViewIfNeeded();
    await surface.click();
    await expect(shortPost(page).locator('.facade-iframe')).toHaveCount(1);
    await expect(viewer(page)).toHaveCount(0);
  });
});
