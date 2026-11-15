/**
 * The scholar site header is the Al Ummah Now header contract (AlUmmahNow docs/design/NAV.md
 * "Header"): the shared pieces come from the vendored builders (packages/render/src/nav/header.js,
 * check:fanous), the lockup is brandHtml's with the site's own art and name, and the order is the
 * contract's. e2e/sites.spec.ts checks the rendered page against the builders' output.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brandHtml } from '../../../packages/render/src/nav/header.js';
import { siteBrandHtml } from '../../../packages/render/src/site-brand';

const HEADER = readFileSync('src/components/SiteHeader.astro', 'utf8');
const markup = HEADER.slice(HEADER.indexOf('<header'));
const CSS = readFileSync('src/styles/sites.css', 'utf8');

describe('site header = the header contract', () => {
  it('the lockup is brandHtml\'s, with the site\'s logo and name (white-label: no second line)', () => {
    const ours = siteBrandHtml({ lang: 'en', href: '/en/', name: 'Sh. Mustafa <Elbadry>', logoSrc: 'https://img.example/logo.png' });
    const contract = brandHtml({ lang: 'en', href: '/en/', logoSrc: 'https://img.example/logo.png' });
    expect(ours).toBe(contract.replace('>Al Ummah Now<', '>Sh. Mustafa &lt;Elbadry&gt;<'));
    expect(ours).not.toContain('aun-brand-app');
    // Arabic: the Arabic platform wordmark is replaced the same way
    expect(siteBrandHtml({ lang: 'ar', href: '/ar/', name: 'الشيخ', logoSrc: '/l.png' })).toBe(brandHtml({ lang: 'ar', href: '/ar/', logoSrc: '/l.png' }).replace('>الأمة الآن<', '>الشيخ<'));
  });

  it('a site with no art keeps the round slot, with its first letter', () => {
    const html = siteBrandHtml({ lang: 'en', href: '/en/', name: 'mustafa', logoSrc: null });
    expect(html).toContain('<span class="aun-brand-mark aun-brand-letter" aria-hidden="true">M</span>');
    expect(html).not.toContain('<img');
  });

  it('takes every shared piece from the builders, in the contract order', () => {
    for (const call of ['siteBrandHtml(', 'envBadgeHtml(cfg.appEnv', 'appLinksHtml(', 'langButtonHtml(', 'signInHtml(']) expect(markup, call).toContain(call);
    for (const cls of ['aun-brand', 'aun-env', 'aun-apps', 'aun-lang', 'aun-signin']) expect(markup, cls).not.toContain(`class="${cls}"`);
    const order = ['menuButtonHtml(', 'siteBrandHtml(', 'envBadgeHtml(', 'class="aun-header-primary aun-collapse"', 'appLinksHtml(', 'langButtonHtml(', 'class="aun-icon-btn aun-mode"', 'signInHtml(', 'class="aun-acct-btn"'].map((s) => markup.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('one line on every screen: the links collapse into the menu panel below 1024px (no rows of their own)', () => {
    expect(markup).toContain("menuButtonHtml({ lang: locale, panel: 'site-menu' })");
    expect(markup).toContain('class="aun-header-primary aun-collapse"');
    expect(markup).toMatch(/<div id="site-menu" class="aun-header-panel" popover>/);
    // the panel sits inside the <header> (it reads --aun-header-height there) and keeps aria-current
    expect(markup.indexOf('id="site-menu"')).toBeLessThan(markup.indexOf('</header>'));
    expect(markup.slice(markup.indexOf('id="site-menu"'))).toContain("aria-current={active === i.kind ? 'page' : undefined}");
  });

  it('full width and the contract\'s typeface: no centring, no row moves, no font of its own on the header', () => {
    for (const gone of ['--aun-header-max', 'min-height: var(--aun-header-height)', 'order: 3', '.aun-brand-name:lang(ar)']) expect(CSS, gone).not.toContain(gone);
  });

  it('imports the vendored nav stylesheet', () => {
    expect(CSS).toContain("@import '../../../www/src/styles/aun-nav.generated.css';");
  });
});
