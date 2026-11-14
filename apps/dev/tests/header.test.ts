/**
 * The dev site's header is www's (owner: "UNIFY"; AlUmmahNow docs/design/NAV.md). It imports www's
 * header.css, aun-nav.generated.css and toggle script, and the shared Light / Dark control
 * (packages/render/src/mode-toggle.ts, pinned by apps/www/tests/mode-toggle.test.ts), so the only
 * things that could drift are what apps/dev itself holds: the markup, the page tokens header.css
 * reads, and the language label. Those are checked against www here, on every CI run.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en as wwwEn } from '../../www/src/i18n/en';
import { ar as wwwAr } from '../../www/src/i18n/ar';
import { strings } from '../src/i18n';

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

/** Attribute values blanked (`{…}`, template literals too) and links' targets dropped, for comparing markup. */
const shape = (t: string) => t.replace(/ href=\{(`[^`]*`|[^}]*)\}/g, '').replace(/\{[^}]*\}/g, '{}');

/** The opening tag of the first element with `cls` among its classes, attributes in source order. */
function tag(src: string, cls: string): string {
  const m = src.match(new RegExp(`<[a-z]+ [^>]*class="${cls}"[^>]*>`));
  expect(m, `.${cls} in markup`).not.toBeNull();
  return m![0];
}

describe('dev header = www header', () => {
  it('imports www’s header stylesheet, the shared controls and www’s toggle script', () => {
    expect(DEV_BASE).toContain("import '../../../www/src/styles/aun-nav.generated.css';");
    expect(DEV_BASE).toContain("import '../../../www/src/styles/header.css';");
    expect(WWW_CSS).toContain("@import './header.css';");
    expect(DEV_HEADER).toContain("import { initTheme } from '../../../www/src/scripts/theme';");
    expect(DEV_HEADER).toContain("from '../../../../packages/render/src/mode-toggle'");
    // no header rules of its own: every header selector lives in www's header.css
    expect(DEV_CSS).not.toMatch(/^\.(brand|primary-nav|header-tools|theme-button|lang-switch)\b/m);
    expect(DEV_CSS).not.toMatch(/^\.site-header \{/m);
  });

  it('uses www’s markup for the brand, the links, the Light / Dark button and the language button', () => {
    for (const cls of ['site-header', 'brand', 'primary-nav', 'header-tools', 'theme', 'theme-button aun-icon-btn', 'lang-switch aun-lang']) {
      expect(shape(tag(DEV_HEADER, cls))).toBe(shape(tag(WWW_HEADER, cls)).replace(' data-set-locale={}', ''));
    }
    const brand = (src: string) => src.slice(src.indexOf('<a class="brand"'), src.indexOf('</a>', src.indexOf('<a class="brand"')));
    expect(shape(brand(DEV_HEADER))).toBe(shape(brand(WWW_HEADER)));
    const icons = (src: string) => [...src.matchAll(/modeIconSvg\('(sun|moon)', '([^']+)'\)/g)].map((m) => m.slice(1).join(' '));
    expect(icons(DEV_HEADER)).toEqual(icons(WWW_HEADER));
    // the same order: brand, links, then the tools (Light / Dark, then the language)
    const order = (src: string) => ['class="brand"', 'class="primary-nav"', 'class="theme"', 'class="lang-switch'].map((s) => src.indexOf(s));
    for (const src of [DEV_HEADER, WWW_HEADER]) expect(order(src)).toEqual([...order(src)].sort((a, b) => a - b));
  });

  it('defines the page tokens header.css reads with www’s values, in both modes', () => {
    const names = ['--header-bg', '--header-line', '--header-shadow', '--color-lantern', '--gutter', '--font-arabic'];
    // www spreads them over @theme (fonts), :root (layout) and html[data-theme] (colour roles)
    const wwwRoot = { ...tokens(WWW_CSS, '@theme'), ...tokens(WWW_CSS, ':root'), ...tokens(WWW_CSS, 'html[data-theme]') };
    const devRoot = tokens(DEV_CSS, ':root');
    for (const n of names) expect(devRoot[n], n).toBe(wwwRoot[n]);
    const wwwDark = tokens(WWW_CSS, "html[data-theme][data-mode='dark']")['--header-shadow'];
    expect(tokens(DEV_CSS, "html[data-mode='dark']")['--header-shadow']).toBe(wwwDark);
    expect(tokens(DEV_CSS.replace(/\n {2}/g, '\n'), "html:not([data-mode='light'])")['--header-shadow']).toBe(wwwDark);
  });

  it('names the language button as www does', () => {
    expect(strings('en').nav.language).toBe(wwwEn.lang.switchTo);
    expect(strings('ar').nav.language).toBe(wwwAr.lang.switchTo);
  });
});
