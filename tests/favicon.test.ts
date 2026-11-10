import { describe, expect, it } from 'vitest';
import { faviconSvgPath } from '../src/lib/favicon';

describe('faviconSvgPath', () => {
  it('marks every non-production environment', () => {
    expect(faviconSvgPath('production')).toBe('/icons/favicon.svg');
    expect(faviconSvgPath('stage')).toBe('/icons/favicon-stage.svg');
    expect(faviconSvgPath('qa')).toBe('/icons/favicon-qa.svg');
    expect(faviconSvgPath('local')).toBe('/icons/favicon-qa.svg');
  });
});
