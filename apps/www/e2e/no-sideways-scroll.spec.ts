/**
 * No page ever scrolls sideways: on every www page, in English and Arabic, at phone, tablet and
 * desktop widths, the document is exactly as wide as the viewport
 * (`documentElement.scrollWidth <= clientWidth`). In RTL an element that sticks out on the left
 * still widens the page (the browser lets you scroll to it), so both edges are checked.
 *
 * A failure names the outermost elements that stick out, with their edges, so the cause is in the
 * report and not only in a screenshot. Local runs serve the CMS About page from blocks
 * (e2e/stub-about.ts: full-width hero + five-item feature list), the page-builder sample page and
 * the block pages, so every block type is measured.
 *
 * Each page is measured in the environment's own theme and, where previews work (not production),
 * in Fawanees: its lantern street adds frost layers that reach past their column (the 64px sideways
 * scroll of 2026-11-19 was one of them), and the local stub's default theme has no street.
 * One project (desktop) resizes through the widths; the phone projects would only repeat it.
 */
import { expect, test, type Page } from '@playwright/test';
import { LOCALES } from './env';
import { IS_PRODUCTION } from './site-theme';

const local = !process.env.WWW_URL;
const WIDTHS = [360, 412, 768, 1024, 1280, 1440] as const;
/** '' = the environment's theme; then the street theme as a ?theme= preview. */
const THEMES = IS_PRODUCTION ? [''] : ['', 'fawanees'];
const withTheme = (path: string, theme: string) => (theme ? `${path}${path.includes('?') ? '&' : '?'}theme=${theme}` : path);

interface Target { name: string; path: (l: 'en' | 'ar') => string; localOnly?: boolean }
const PAGES: Target[] = [
  { name: 'home', path: (l) => `/${l}/` },
  { name: 'about', path: (l) => `/${l}/about/` },
  { name: 'articles', path: (l) => `/${l}/articles/` },
  { name: 'videos', path: (l) => `/${l}/videos/` },
  { name: 'search', path: (l) => `/${l}/search?q=salah` },
  { name: 'newsletter', path: (l) => `/${l}/newsletter/` },
  { name: 'scholars', path: (l) => `/${l}/scholars/` },
  { name: '404', path: (l) => `/${l}/this/does/not/exist/` },
  // Stub CMS content (e2e/stub-blocks.ts, e2e/stub-scholar-sites.ts): local only.
  { name: 'card post', path: (l) => (l === 'en' ? '/en/articles/a-day-in-madinah/' : '/ar/articles/layali-ramadan/'), localOnly: true },
  { name: 'blocks page', path: (l) => (l === 'en' ? '/en/stories/' : '/ar/qisas/'), localOnly: true },
  { name: 'every block', path: (l) => (l === 'en' ? '/en/every-block/' : '/ar/kull-al-kutal/'), localOnly: true },
  { name: 'scholar', path: (l) => `/${l}/scholars/e2e-site-scholar/`, localOnly: true },
];

/** The page's width overflow, and the outermost elements past either edge of the viewport. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const vw = root.clientWidth;
    const out: string[] = [];
    const past = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.left < -0.5 || r.right > vw + 0.5);
    };
    // Clipped subtrees (overflow hidden/clip/auto/scroll, or position fixed off-canvas drawers) cannot widen the page.
    const clips = (el: Element) => {
      const s = getComputedStyle(el);
      return s.overflowX !== 'visible' || (s.position === 'fixed' && s.visibility === 'hidden') || s.display === 'none';
    };
    const walk = (el: Element) => {
      for (const c of Array.from(el.children)) {
        if (past(c)) {
          const r = c.getBoundingClientRect();
          const id = c.id ? `#${c.id}` : '';
          const cls = typeof c.className === 'string' && c.className.trim() ? `.${c.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
          out.push(`${c.tagName.toLowerCase()}${id}${cls} [${Math.round(r.left)}, ${Math.round(r.right)}]`);
          if (out.length >= 8) return;
        } else if (!clips(c)) walk(c);
      }
    };
    walk(document.body);
    return { scrollWidth: root.scrollWidth, clientWidth: vw, offenders: out };
  });
}

for (const l of LOCALES) {
  for (const p of PAGES) {
    test(`${l} ${p.name}: no sideways scroll at ${WIDTHS.join(', ')} px`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop resizes through every width');
      test.skip(!!p.localOnly && !local, 'stub CMS content');
      const failures: string[] = [];
      for (const theme of THEMES) for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(withTheme(p.path(l), theme));
        await page.evaluate(() => document.fonts.ready);
        // Let the header fit its menu to the width (menu-fit runs on load and on resize).
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const o = await overflow(page);
        if (o.scrollWidth > o.clientWidth) failures.push(`${theme || 'site theme'} ${w}px: scrollWidth ${o.scrollWidth} > clientWidth ${o.clientWidth}; past the edge: ${o.offenders.join(' | ') || '(no element: a ::before/::after layer)'}`);
      }
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
}
