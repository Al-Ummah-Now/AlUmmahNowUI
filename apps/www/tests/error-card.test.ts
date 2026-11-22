import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_CARD_STRINGS, errorCardHtml, errorCodeLabel, errorPageTitle } from '../../../packages/render/src/error-page';

const base = {} as const;

describe('the shared error card (wiki guides/error-pages.md)', () => {
  it('404: code line, one h1, search, Go back (hidden until there is history), home last', () => {
    const html = errorCardHtml({ ...base, locale: 'en', kind: 'notFound', primary: { label: 'Home page', href: '/en/', icon: 'home' }, search: { action: '/en/search' }, back: true, contactHref: '/en/contact' });
    expect(html).toContain('data-error-status="404"');
    expect(html).toContain('<p class="ep-code">Error 404</p>');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('role="search" action="/en/search" method="get"');
    expect(html).toMatch(/data-ep-back hidden>/);
    expect(html.indexOf('data-ep-back')).toBeLessThan(html.indexOf('href="/en/"'));
    expect(html).not.toContain('role="alert"');
  });

  it('Arabic: right to left, ٠–٩ in the code line, the shared words', () => {
    const html = errorCardHtml({ ...base, locale: 'ar', kind: 'server', primary: { label: 'x', href: '/ar/' } });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('خطأ ٥٠٠');
    expect(html).toContain(ERROR_CARD_STRINGS.ar.kinds.server.title);
    expect(html).toContain('role="alert"');
    expect(errorCodeLabel('ar', 410)).toBe('خطأ ٤١٠');
  });

  it('escapes every value', () => {
    const html = errorCardHtml({ ...base, locale: 'en', kind: 'notFound', primary: { label: '<b>', href: '/"x' } });
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('href="/&quot;x"');
  });

  it('a second card on the page uses h2 and its own ids', () => {
    const html = errorCardHtml({ ...base, locale: 'ar', kind: 'notFound', headingLevel: 2, primary: { label: 'x', href: '/ar/' } });
    expect(html).toContain('<h2 class="ep-title" id="ep-title-ar">');
  });

  it('the family buttons, never the app classes; Go back on every card', () => {
    const html = errorCardHtml({ ...base, locale: 'ar', kind: 'notFound', primary: { label: 'x', href: '/ar/' }, secondary: [{ label: 'y', href: '/' }], back: true, search: { action: '/ar/search' } });
    expect(html).toContain('<a class="ep-btn ep-btn-primary" href="/ar/">');
    expect(html).toContain('<a class="ep-btn ep-btn-secondary" href="/">');
    expect(html).toContain('<button type="button" class="ep-btn ep-btn-secondary" data-ep-back hidden>');
    expect(html).toContain('class="ep-btn ep-btn-secondary ep-search-btn"');
    expect(html).not.toMatch(/class="button/);
  });

  it('the shared words: curly apostrophes, "Home page", one title format', () => {
    for (const locale of ['en', 'ar'] as const) {
      const t = ERROR_CARD_STRINGS[locale];
      for (const c of Object.values(t.kinds)) expect(`${c.title} ${c.body}`).not.toContain("'");
    }
    expect(ERROR_CARD_STRINGS.en.goHome).toBe('Home page');
    expect(ERROR_CARD_STRINGS.ar.goHome).toBe('الصفحة الرئيسية');
    expect(errorPageTitle('en', 'Page not found')).toBe('Page not found | Al Ummah Now');
    expect(errorPageTitle('ar', 'الصفحة غير موجودة')).toBe('الصفحة غير موجودة | الأمة الآن');
  });

  it('every app serves the same Go back script, and it shows every card\'s button', () => {
    const scripts = ['www', 'sites', 'dev'].map((app) => readFileSync(new URL(`../../${app}/public/ep-back.js`, import.meta.url), 'utf8'));
    expect(new Set(scripts).size).toBe(1);
    expect(scripts[0]).toContain("querySelectorAll('[data-ep-back]')");
  });

  it('the vendored sheet has no animation (reduced motion by default)', () => {
    const css = readFileSync(new URL('../../../packages/render/src/styles/aun-error-page.css', import.meta.url), 'utf8');
    expect(css).not.toMatch(/@keyframes|animation\s*:/);
  });
});
