import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { LOCALES } from './env';
import { IS_PRODUCTION, THEME_IDS } from './site-theme';

const PAGES = [
  { name: 'home', path: (l: string) => `/${l}/` },
  { name: 'articles', path: (l: string) => `/${l}/articles/` },
  { name: 'videos', path: (l: string) => `/${l}/videos/` },
  { name: 'about', path: (l: string) => `/${l}/about/` },
  { name: 'search', path: (l: string) => `/${l}/search?q=salah` },
  { name: '404', path: (l: string) => `/${l}/this/does/not/exist/` },
];

const SCHEMES = ['light', 'dark'] as const;

for (const scheme of SCHEMES) {
for (const l of LOCALES) {
  for (const p of PAGES) {
    test(`a11y + screenshot: ${l} ${p.name} (${scheme})`, async ({ page }, info) => {
      // the system setting: www follows it unless the viewer picked Light or Dark
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(p.path(l));
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      const dir = `e2e-artifacts/${info.project.name}`;
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/${l}-${p.name}${scheme === 'dark' ? '-dark' : ''}.png`, fullPage: true });
      expect(
        blocking.map((v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`),
      ).toEqual([]);
    });
  }
}
}

// Every site theme, not only the one this environment runs: the admin can switch at any time.
// Non-production ?theme= previews; desktop only (the layout does not change with the theme).
for (const theme of THEME_IDS) {
  for (const scheme of SCHEMES) {
    for (const l of LOCALES) {
      test(`a11y: ${theme} ${scheme} ${l}`, async ({ page }, info) => {
        test.skip(IS_PRODUCTION, 'production ignores ?theme=');
        test.skip(info.project.name !== 'desktop', 'desktop covers the colours');
        test.setTimeout(120_000);
        await page.emulateMedia({ colorScheme: scheme });
        const failures: string[] = [];
        for (const p of PAGES) {
          const path = p.path(l);
          await page.goto(`${path}${path.includes('?') ? '&' : '?'}theme=${theme}`);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await page.evaluate(() => document.fonts.ready);
          const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          for (const v of results.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
            failures.push(`${p.name}: ${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
          }
        }
        expect(failures).toEqual([]);
      });
    }
  }
}
