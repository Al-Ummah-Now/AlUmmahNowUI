import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { LOCALES } from './env';

const PAGES = [
  { name: 'home', path: (l: string) => `/${l}/` },
  { name: 'news', path: (l: string) => `/${l}/news/` },
  { name: 'videos', path: (l: string) => `/${l}/videos/` },
  { name: 'about', path: (l: string) => `/${l}/about/` },
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
