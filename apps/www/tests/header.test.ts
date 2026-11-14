/**
 * www's header renders the shared contract (AlUmmahNow docs/design/NAV.md "Header"): the brand,
 * environment badge, app links, language button and Sign in come from the vendored builders
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
    for (const call of ['brandHtml(', 'envBadgeHtml(cfg.appEnv', 'appLinksHtml(', 'langButtonHtml(', 'signInHtml(']) expect(markup, call).toContain(call);
    for (const cls of ['aun-brand', 'aun-env', 'aun-apps', 'aun-app', 'aun-lang', 'aun-signin']) expect(markup, cls).not.toContain(`class="${cls}`);
  });

  it('keeps the contract order: brand, env, links + search, app links, language, light/dark, account', () => {
    expect(HEADER_ORDER).toEqual(['menu', 'brand', 'env', 'primary', 'actions', 'apps', 'lang', 'mode', 'account']);
    const at = (s: string) => {
      const i = markup.indexOf(s);
      expect(i, s).toBeGreaterThanOrEqual(0);
      return i;
    };
    const order = ['brandHtml(', 'envBadgeHtml(', 'class="aun-header-primary"', 'appLinksHtml(', 'langButtonHtml(', 'class="aun-icon-btn aun-mode"', 'id="account"', 'signInHtml('].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
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
