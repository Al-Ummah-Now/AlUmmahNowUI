import { expect, test, type Page } from '@playwright/test';
import { token, type ThemeId } from './site-theme';

/** The page background of the site theme this page renders (e2e/site-theme.spec.ts checks which one). */
const themeOf = async (page: Page) => (await page.locator('html').getAttribute('data-theme')) as ThemeId;
const DARK_BG = async (page: Page) => token(await themeOf(page), 'dark', '--fanous-color-background');
const LIGHT_BG = async (page: Page) => token(await themeOf(page), 'light', '--fanous-color-background');

const pageBg = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

function collectCspErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to execute/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/** Records data-mode at the moment <body> first exists (before any paint of the page's content). */
async function recordModeAtBody(page: Page, saved: string | null) {
  await page.addInitScript((value) => {
    try {
      if (value !== null && !sessionStorage.getItem('seeded')) {
        localStorage.setItem('aun_mode', value);
        sessionStorage.setItem('seeded', '1');
      }
    } catch {
      // ignore
    }
    const seen: (string | null)[] = [];
    (window as unknown as { __modeAtBody: (string | null)[] }).__modeAtBody = seen;
    new MutationObserver((_, obs) => {
      if (document.body) {
        seen.push(document.documentElement.getAttribute('data-mode'));
        obs.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  }, saved);
}
const modeAtBody = (page: Page) => page.evaluate(() => (window as unknown as { __modeAtBody: (string | null)[] }).__modeAtBody);

// Owner decision 2026-11-13: a Light / Dark toggle, no "System" option. First visit follows the
// device; from the first click on, the choice is saved for this browser.
test.describe('light / dark toggle', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`first visit follows the device (${scheme}), with no "System" option`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/en/');
      await expect(page.locator('html')).not.toHaveAttribute('data-mode', /./);
      expect(await pageBg(page)).toBe(await (scheme === 'dark' ? DARK_BG : LIGHT_BG)(page));
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
      await expect(toggle).toHaveAttribute('aria-pressed', String(scheme === 'dark'));
      await expect(page.getByText(/^System$/)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /system/i })).toHaveCount(0);
      await expect(page.locator('#theme-menu')).toHaveCount(0);
    });
  }

  test('the toggle switches, persists across reloads and pages, and the head script passes CSP', async ({ page }) => {
    const cspErrors = collectCspErrors(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en/');
    const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toBeFocused();
    expect(await pageBg(page)).toBe(await DARK_BG(page));
    expect(await page.evaluate(() => localStorage.getItem('aun_mode'))).toBe('dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.goto('/en/articles/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    expect(await pageBg(page)).toBe(await DARK_BG(page));

    // back to light: saved as an explicit choice, even though the device is light too
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    expect(await page.evaluate(() => localStorage.getItem('aun_mode'))).toBe('light');
    // the device turning dark no longer changes a saved choice
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    expect(await pageBg(page)).toBe(await LIGHT_BG(page));
    expect(cspErrors).toEqual([]);
  });

  test('a saved choice is on <html> before the body paints (no flash)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await recordModeAtBody(page, 'dark');
    await page.goto('/ar/');
    expect(await modeAtBody(page)).toEqual(['dark']);
    expect(await pageBg(page)).toBe(await DARK_BG(page));
  });

  test('a "system" saved by an older release becomes the device mode, once', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await recordModeAtBody(page, 'system');
    await page.goto('/en/');
    expect(await modeAtBody(page)).toEqual(['dark']);
    expect(await page.evaluate(() => localStorage.getItem('aun_mode'))).toBe('dark');
    // from now on it is a saved choice: the device turning light does not change it
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  });

  test('keyboard and Arabic: Enter and Space toggle, the name is Arabic', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/ar/');
    const toggle = page.getByRole('button', { name: 'الوضع الداكن', exact: true });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    await expect(toggle).toBeFocused();
  });

  test('blocked storage still works for the page', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en/');
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  });
});
