import { describe, expect, it } from 'vitest';
import { finishBidi, isolateLatin } from '../src/lib/arch/text.ts';

describe('bidi in diagrams', () => {
  it('isolates each Latin run in Arabic text, leaves English alone', () => {
    expect(isolateLatin('حساب Cloudflare')).toBe('حساب ⁦Cloudflare⁩');
    expect(isolateLatin('يربطها videos (api-videos)')).toBe('يربطها ⁦videos (api-videos)⁩');
    expect(isolateLatin('Cloudflare account')).toBe('Cloudflare account');
  });
  it('sets Arabic text right to left, flipping the anchor so it stays in place', () => {
    const out = finishBidi('<text x="10" text-anchor="end">مسار R2 والحاويات</text><text x="5" text-anchor="start">plain</text>');
    expect(out).toContain('text-anchor="start" direction="rtl">مسار ⁦R2⁩ والحاويات</text>');
    expect(out).toContain('text-anchor="start">plain</text>');
  });
});
