/**
 * Arabic pages show Eastern Arabic (Hindi) numerals ٠–٩ in every formatted value, and the Worker
 * and the browser agree (owner, 2026-11-15). Runs in every project, so the iPhone project checks
 * WebKit: plain `ar` there gives ٠–٩ while Node gives 0–9, which is the mismatch this prevents.
 * The client script (src/scripts/timeline.ts) re-renders the times and day headings in the
 * reader's zone; the test reads them after it has run and fails on any page error.
 */
import { expect, test, type Page } from '@playwright/test';

const local = !process.env.WWW_URL;
const ASCII = /[0-9]/;
const EASTERN = /[٠-٩]/;

async function texts(page: Page, selector: string) {
  return (await page.locator(selector).allTextContents()).map((s) => s.trim()).filter(Boolean);
}

test.describe('Arabic numerals', () => {
  test('home timeline in Arabic: times, days, durations, counts and the footer use ٠–٩', async ({ page }) => {
    test.skip(!local, 'needs the seeded local FEED KV');
    const errors: string[] = [];
    // Network refusals from the stub services (CORS, failed loads) are not script errors; WebKit
    // reports some of them as page errors
    const network = /Failed to load resource|CORS policy|access control checks|Access-Control-Allow-Origin|net::/;
    page.on('pageerror', (e) => {
      if (!network.test(String(e))) errors.push(String(e));
    });
    page.on('console', (m) => {
      if (m.type() === 'error' && !network.test(m.text())) errors.push(m.text());
    });
    await page.goto('/ar/');
    // The script has run once the absolute times carry the reader's zone (it rewrites every [data-abs]).
    await page.waitForLoadState('networkidle');
    const rel = await texts(page, '[data-days] time[data-rel]');
    const abs = await texts(page, '[data-days] [data-abs]');
    const days = await texts(page, '[data-days] .tl-date');
    expect(rel.length, 'relative times').toBeGreaterThan(0);
    expect(abs.length, 'absolute times').toBeGreaterThan(0);
    expect(days.length, 'day headings').toBeGreaterThan(0);
    const values = [
      ...rel,
      ...abs,
      ...days,
      ...(await texts(page, '.tl-channel-dur')),
      ...(await texts(page, '.facade-badge[dir="ltr"]')),
      ...(await texts(page, '.cv-count')),
      ...(await texts(page, '.cv-pos [aria-hidden="true"]')),
      ...(await texts(page, '.site-footer p:has-text("©")')),
    ];
    const latin = values.filter((v) => ASCII.test(v));
    expect(latin, 'formatted values with Arabic numerals 0–9').toEqual([]);
    expect(abs.every((v) => EASTERN.test(v)), 'absolute times in ٠–٩').toBe(true);
    expect(await texts(page, '.site-footer p:has-text("©")')).toEqual([expect.stringMatching(/^© [٠-٩]{4} /)]);
    expect(errors).toEqual([]);
  });

  test('English keeps Arabic numerals 0–9', async ({ page }) => {
    await page.goto('/en/');
    const footer = await texts(page, '.site-footer p:has-text("©")');
    expect(footer).toEqual([expect.stringMatching(/^© \d{4} /)]);
  });
});
