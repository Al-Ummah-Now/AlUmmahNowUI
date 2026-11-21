import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_CARD_STRINGS, errorCardHtml, errorCodeLabel } from '../../../packages/render/src/error-page';

const base = { buttonClass: { primary: 'button button-quiet', secondary: 'button button-outline' } } as const;

describe('the shared error card (wiki guides/error-pages.md)', () => {
  it('404: code line, one h1, search, Go back (hidden until there is history), home last', () => {
    const html = errorCardHtml({ ...base, locale: 'en', kind: 'notFound', primary: { label: 'Go to home', href: '/en/', icon: 'home' }, search: { action: '/en/search' }, back: true, contactHref: '/en/contact' });
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

  it('the vendored sheet has no animation (reduced motion by default)', () => {
    const css = readFileSync(new URL('../../../packages/render/src/styles/aun-error-page.css', import.meta.url), 'utf8');
    expect(css).not.toMatch(/@keyframes|animation\s*:/);
  });
});
