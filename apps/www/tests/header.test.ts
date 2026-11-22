/**
 * www's header renders the shared contract (AlUmmahNow docs/design/NAV.md "Header"): the brand,
 * environment badge, language button and Sign in come from the vendored builders
 * (packages/render/src/nav/header.js, check:fanous), never hand-written copies, in the contract's
 * order; the Light / Dark button is modeButtonHtml's button with both icons. e2e/header.spec.ts
 * checks the rendered page against the builders' output.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEADER_ORDER, modeButtonHtml } from '../../../packages/render/src/nav/header.js';

const HEADER = readFileSync('src/components/Header.astro', 'utf8');
const markup = HEADER.slice(HEADER.indexOf('<header'));

describe('www header = the header contract', () => {
  it('takes every shared piece from the builders, none written by hand', () => {
    expect(HEADER).toContain("from '../../../../packages/render/src/nav/header.js'");
    for (const call of ['menuButtonHtml(', 'brandHtml(', 'envBadgeHtml(cfg.appEnv', 'langButtonHtml(', 'signInHtml(']) expect(markup, call).toContain(call);
    for (const cls of ['aun-brand', 'aun-env', 'aun-apps', 'aun-app', 'aun-lang', 'aun-signin']) expect(markup, cls).not.toContain(`class="${cls}`);
  });

  it('keeps the contract order: menu, brand, env, links + search, language, light/dark, account', () => {
    expect(HEADER_ORDER).toEqual(['menu', 'brand', 'env', 'primary', 'actions', 'lang', 'mode', 'account']);
    const at = (s: string) => {
      const i = markup.indexOf(s);
      expect(i, s).toBeGreaterThanOrEqual(0);
      return i;
    };
    const order = ['menuButtonHtml(', 'brandHtml(', 'envBadgeHtml(', 'class="aun-header-primary"', 'langButtonHtml(', 'class="aun-icon-btn aun-mode"', 'id="account"', 'signInHtml('].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('one line on every screen: below 1024px the links collapse into the menu panel and the search into its icon', () => {
    expect(markup).toContain("menuButtonHtml({ lang: locale, panel: 'site-menu' })");
    expect(markup).toContain('class="aun-header-primary"');
    expect(markup).toContain('class="aun-icon-btn aun-search-open" popovertarget="site-search-sheet"');
    const panel = markup.slice(markup.indexOf('<div id="site-menu" class="aun-header-panel" popover>'));
    expect(panel.length).toBeLessThan(markup.length);
    expect(markup.indexOf('id="site-menu"')).toBeLessThan(markup.indexOf('</header>'));
    expect(panel).toContain('aria-current={current(i.href)}');
    expect(panel).not.toContain('<SearchBox');
  });

  it('full width and the contract\'s typeface: header.css has no centring, row moves or header font', () => {
    const css = readFileSync('src/styles/header.css', 'utf8');
    for (const gone of ['--aun-header-max', 'min-height: var(--aun-header-height)', 'order: 3', 'site-header--wide', '.aun-brand-name:lang(ar)']) expect(css, gone).not.toContain(gone);
  });

  it('the Light / Dark button is modeButtonHtml\'s (same element, class, id, test id, name and title)', () => {
    const contract = /^<button ([^>]*)>/.exec(modeButtonHtml({ lang: 'en', dark: false }))![1]!;
    const ours = /<button ([^>]*class="aun-icon-btn aun-mode"[^>]*)>/.exec(markup)![1]!;
    for (const attr of ['type="button"', 'class="aun-icon-btn aun-mode"', 'id="mode-toggle"', 'data-testid="theme-toggle"']) {
      expect(contract).toContain(attr);
      expect(ours).toContain(attr);
    }
    expect(ours).toContain('aria-label={toDark} title={toDark}');
  });
});
