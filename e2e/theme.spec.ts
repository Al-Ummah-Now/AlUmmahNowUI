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

test.describe('light / dark / system', () => {
  test('follows the system setting by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/en/');
    await expect(page.locator('html')).not.toHaveAttribute('data-mode', /./);
    expect(await pageBg(page)).toBe(await DARK_BG(page));
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await pageBg(page)).toBe(await LIGHT_BG(page));
  });

  test('the header control picks a mode, remembers it, and the head script passes CSP', async ({ page }) => {
    const cspErrors = collectCspErrors(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en/');
    const button = page.getByRole('button', { name: 'Theme: System' });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'System', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeFocused();
    expect(await pageBg(page)).toBe(await DARK_BG(page));

    await page.goto('/en/articles/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    expect(await pageBg(page)).toBe(await DARK_BG(page));

    // back to System: the saved choice is cleared and the system setting applies again
    await page.getByRole('button', { name: 'Theme: Dark' }).click();
    await page.getByRole('button', { name: 'System', exact: true }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-mode', /./);
    expect(await page.evaluate(() => localStorage.getItem('aun_mode'))).toBeNull();
    expect(await pageBg(page)).toBe(await LIGHT_BG(page));
    expect(cspErrors).toEqual([]);
  });

  test('a saved choice is on <html> before the body paints (no flash)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('aun_mode', 'dark');
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
    });
    await page.goto('/ar/');
    expect(await page.evaluate(() => (window as unknown as { __modeAtBody: (string | null)[] }).__modeAtBody)).toEqual(['dark']);
    expect(await pageBg(page)).toBe(await DARK_BG(page));
  });

  test('keyboard and Arabic: arrows move, Escape closes and returns focus', async ({ page }) => {
    await page.goto('/ar/');
    const button = page.getByRole('button', { name: 'المظهر: حسب الجهاز' });
    await button.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'حسب الجهاز', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'فاتح', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('list', { name: 'المظهر' })).toBeHidden();
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
    await page.getByRole('button', { name: 'Theme: System' }).click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  });
});
