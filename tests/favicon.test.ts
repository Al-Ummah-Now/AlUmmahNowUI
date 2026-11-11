import { describe, expect, it } from 'vitest';
import { faviconSvgPath, tabIconLinks } from '../src/lib/favicon';

describe('faviconSvgPath', () => {
  it('marks every non-production environment; production has no SVG', () => {
    expect(faviconSvgPath('production')).toBeNull();
    expect(faviconSvgPath('stage')).toBe('/icons/favicon-stage.svg');
    expect(faviconSvgPath('qa')).toBe('/icons/favicon-qa.svg');
    expect(faviconSvgPath('local')).toBe('/icons/favicon-qa.svg');
  });
});

describe('tabIconLinks', () => {
  it('production links the ICO and exact-size PNGs, never an SVG', () => {
    expect(tabIconLinks('production').map((l) => [l.href, l.sizes])).toEqual([
      ['/favicon.ico', '16x16 32x32 48x48'],
      ['/icons/favicon-16x16.png', '16x16'],
      ['/icons/favicon-32x32.png', '32x32'],
      ['/icons/favicon-48x48.png', '48x48'],
      ['/icons/favicon-96x96.png', '96x96'],
    ]);
  });

  it('QA and stage link the ICO and the dot SVG', () => {
    expect(tabIconLinks('qa').map((l) => l.href)).toEqual(['/favicon.ico', '/icons/favicon-qa.svg']);
    expect(tabIconLinks('stage')[1]).toEqual({ href: '/icons/favicon-stage.svg', type: 'image/svg+xml' });
  });
});
