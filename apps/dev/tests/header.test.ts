/**
 * The dev site's header is www's (owner: "UNIFY"; AlUmmahNow docs/design/NAV.md "Header"). Both
 * render the vendored builders (packages/render/src/nav/header.js, check:fanous) and import www's
 * header.css, aun-nav.generated.css and toggle script, so the only things that could drift are what
 * apps/dev itself holds: the markup around the builders, its order and the page tokens header.css
 * reads. Those are checked against www here, on every CI run.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const WWW_HEADER = read('../../www/src/components/Header.astro');
const WWW_CSS = read('../../www/src/styles/global.css');
const DEV_HEADER = read('../src/components/Header.astro');
const DEV_BASE = read('../src/layouts/Base.astro');
const DEV_CSS = read('../src/styles/site.css');

/** `--name: value;` declarations of every block whose line is exactly `selector {` (later ones win). */
function tokens(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const head = `\n${selector} {\n`;
  for (let at = css.indexOf(head); at >= 0; at = css.indexOf(head, at + 1)) {
    const body = css.slice(at, css.indexOf('\n}', at + 1));
    for (const m of body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) out[m[1]!] = m[2]!.trim();
  }
  expect(Object.keys(out).length, `${selector} block`).toBeGreaterThan(0);
  return out;
}

/** The opening tag of the first element with exactly `cls` as its class, attributes in source order, values blanked. */
function tag(src: string, cls: string): string {
  const m = src.match(new RegExp(`<[a-z]+ [^>]*class="${cls}"[^>]*>`));
  expect(m, `.${cls} in markup`).not.toBeNull();
  return m![0].replace(/\{[^}]*\}/g, '{}');
}

const at = (src: string, s: string) => {
  const i = src.indexOf(s);
  expect(i, s).toBeGreaterThanOrEqual(0);
  return i;
};

describe('dev header = www header', () => {
  it('imports www’s header stylesheet, the shared controls and www’s toggle script', () => {
    expect(DEV_BASE).toContain("import '../../../www/src/styles/aun-nav.generated.css';");
    expect(DEV_BASE).toContain("import '../../../www/src/styles/header.css';");
    expect(WWW_CSS).toContain("@import './header.css';");
    expect(DEV_HEADER).toContain("import { initTheme } from '../../../www/src/scripts/theme';");
    expect(DEV_HEADER).toContain("from '../../../../packages/render/src/nav/header.js'");
    // no header rules of its own: every header selector lives in www's header.css / aun-nav.css
    expect(DEV_CSS).not.toMatch(/^\.(aun-[\w-]+|primary-nav|site-header)\b/m);
  });

  it('uses www’s frame, builders and Light / Dark button', () => {
    // the same full-width bar as www (the contract has no centring and no wide variant)
    expect(DEV_HEADER).toContain('<header class="site-header aun-header" data-env-badges={badges}>');
    // the primary area: www's holds the search too (its own icon below 1024px), this site's only links, which
    // leave the bar with it (aun-collapse)
    expect(DEV_HEADER).toContain('<div class="aun-header-primary aun-collapse">');
    expect(WWW_HEADER).toContain('<div class="aun-header-primary">');
    for (const cls of ['aun-header-row', 'primary-nav', 'aun-header-tools', 'aun-icon-btn aun-mode', 'aun-header-panel', 'panel-nav']) {
      expect(tag(DEV_HEADER, cls), cls).toBe(tag(WWW_HEADER, cls));
    }
    for (const call of ['brandHtml(', 'langButtonHtml(', 'envBadgeHtml(']) expect(DEV_HEADER, call).toContain(call);
    // the menu button and its panel, as www's: below 1024px the links leave the bar for the panel
    const menu = "menuButtonHtml({ lang: locale, panel: 'site-menu' })";
    expect(DEV_HEADER).toContain(menu);
    expect(WWW_HEADER).toContain(menu);
    for (const src of [DEV_HEADER, WWW_HEADER]) {
      const panel = src.indexOf('<div id="site-menu" class="aun-header-panel" popover>');
      expect(panel).toBeGreaterThan(0);
      expect(panel).toBeLessThan(src.indexOf('</header>'));
    }
    const icons = (src: string) => [...src.matchAll(/modeIconSvg\('(sun|moon)', '([^']+)'\)/g)].map((m) => m.slice(1).join(' '));
    expect(icons(DEV_HEADER)).toEqual(icons(WWW_HEADER));
  });

  it('keeps the contract order: menu, brand, env, links, language, then light/dark', () => {
    // www renders the badge in place; this static site inserts the same markup from the host, right after the brand
    for (const src of [DEV_HEADER.slice(DEV_HEADER.indexOf('<header')).replace('data-env-badges={badges}>', '>').replace('<div class="aun-header-primary aun-collapse"', 'envBadgeHtml(<div class="aun-header-primary aun-collapse"'), WWW_HEADER.slice(WWW_HEADER.indexOf('<header'))]) {
      const order = ['menuButtonHtml(', 'brandHtml(', 'envBadgeHtml(', 'class="aun-header-primary', 'langButtonHtml(', 'class="aun-icon-btn aun-mode"'].map((s) => at(src, s));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it('defines the page tokens header.css reads with www’s values', () => {
    // the band, edge and control font are the shared contract's (aun-nav theme header block), not page tokens
    const names = ['--color-lantern'];
    // www spreads them over @theme (fonts), :root (layout) and html[data-theme] (colour roles)
    const wwwRoot = { ...tokens(WWW_CSS, '@theme'), ...tokens(WWW_CSS, ':root'), ...tokens(WWW_CSS, 'html[data-theme]') };
    const devRoot = tokens(DEV_CSS, ':root');
    for (const n of names) expect(devRoot[n], n).toBe(wwwRoot[n]);
  });
});
