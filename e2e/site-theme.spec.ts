import { expect, test, type Page } from '@playwright/test';
import { LOCALES } from './env';
import { IS_PRODUCTION, SCHEMES, THEME_IDS, configuredTheme, renderedTheme, token, type ThemeId } from './site-theme';

/**
 * www follows the site theme the admin chose (videos admin → Site theme, `/public/site-theme`), the
 * same one the videos app renders, in Light and Dark. The theme is in the first HTML (no flash).
 * Never changes the theme: it is the owner's choice (AlUmmahNow's release spec switches it on stage).
 */

// The admin API caches 30 s and www another 30 s per isolate: allow for a change still arriving
const PROPAGATION_MS = 120_000;

const css = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

async function expectThemeColours(page: Page, theme: ThemeId, scheme: (typeof SCHEMES)[number]) {
  await expect.poll(() => css(page, 'html', 'background-color')).toBe(token(theme, scheme, '--fanous-color-background'));
  // The header is dark in every theme and mode, in the theme's own colour
  expect(await css(page, '.site-header', 'background-color')).toBe(token(theme, scheme, '--fanous-c-nav-bg'));
  expect(await css(page, '.site-header .brand', 'color')).toBe(token(theme, scheme, '--fanous-c-nav-text'));
  // The footer's text is readable on the footer
  expect(await css(page, '.site-footer a', 'color')).toBe(token(theme, scheme, '--fanous-c-nav-text'));
  // The hero is page content: the theme's light surface and text in Light, the night in Dark
  if (await page.locator('.hero').count()) {
    const light = scheme === 'light';
    expect(await css(page, '.hero', 'background-color')).toBe(token(theme, scheme, light ? '--fanous-color-surface' : '--fanous-c-nav-bg'));
    expect(await css(page, '.hero h1', 'color')).toBe(token(theme, scheme, light ? '--fanous-color-text-primary' : '--fanous-c-nav-text'));
  }
}

test.describe('site theme', () => {
  for (const l of LOCALES) {
    test(`html data-theme is the configured site theme (${l})`, async ({ page }) => {
      const theme = await configuredTheme();
      // A theme package made in the admin's theme builder is not vendored in www: the default renders
      const expected = (THEME_IDS as readonly string[]).includes(theme) ? (theme as ThemeId) : 'fawanees';
      await expect.poll(() => renderedTheme(`/${l}/`), { timeout: PROPAGATION_MS, intervals: [5_000] }).toBe(expected);
      for (const scheme of SCHEMES) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`/${l}/`);
        await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
        await expect(page.locator('html')).toHaveAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
        await expectThemeColours(page, expected, scheme);
      }
    });
  }

  test('the theme is on <html> before the body paints, and a forced mode keeps it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('aun_mode', 'dark');
      } catch {
        // ignore
      }
      const seen: (string | null)[] = [];
      (window as unknown as { __themeAtBody: (string | null)[] }).__themeAtBody = seen;
      new MutationObserver((_, obs) => {
        if (document.body) {
          const d = document.documentElement;
          seen.push(`${d.getAttribute('data-theme')}/${d.getAttribute('data-mode')}`);
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/en/articles/');
    const theme = (await page.locator('html').getAttribute('data-theme')) as ThemeId;
    expect(THEME_IDS).toContain(theme);
    expect(await page.evaluate(() => (window as unknown as { __themeAtBody: string[] }).__themeAtBody)).toEqual([`${theme}/dark`]);
    await expectThemeColours(page, theme, 'dark');
    // Browser chrome: the header colour of this theme
    await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')).toHaveAttribute(
      'content',
      new RegExp(`^#[0-9a-f]{6}$`),
    );
  });

  test('every theme in light and dark (non-production ?theme= preview), en and ar', async ({ page }) => {
    test.skip(IS_PRODUCTION, 'production ignores ?theme=');
    test.setTimeout(240_000);
    for (const theme of THEME_IDS) {
      for (const l of LOCALES) {
        for (const scheme of SCHEMES) {
          await page.emulateMedia({ colorScheme: scheme });
          await page.goto(`/${l}/?theme=${theme}`);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expectThemeColours(page, theme, scheme);
          // Menus opened from the dark header are surfaces of their own, not the header's light text
          await page.getByRole('button', { name: l === 'ar' ? /^المظهر/ : /^Theme/ }).click();
          const menu = page.locator('#theme-menu');
          await expect(menu).toBeVisible();
          expect(await css(page, '#theme-menu', 'background-color')).toBe(token(theme, scheme, '--fanous-c-menu-bg'));
          expect(await css(page, '#theme-menu button', 'color')).toBe(token(theme, scheme, '--fanous-c-menu-text'));
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('an unknown ?theme= is ignored', async ({ page }) => {
    await page.goto('/en/?theme=not-a-theme');
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(THEME_IDS).toContain(theme as ThemeId);
    expect(theme).toBe(await renderedTheme('/en/'));
  });
});
