import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIAGRAMS, diagram } from '../src/lib/arch/all';
import { stripComments } from '../src/lib/arch/icons';

/** Build-time checks on every diagram; the measured checks run in a browser (e2e/diagram-gate.spec.ts). */
describe('system design diagrams', () => {
  it('icon comments are stripped completely, nested or unterminated', () => {
    expect(stripComments('a<!-- x -->b<!--<!-- y -->-->c')).toBe('ab-->c');
    expect(stripComments('<svg><!-- licence -->')).toBe('<svg>');
    expect(stripComments('<svg><!-- open')).toBe('<svg>');
    expect(stripComments('x<!---->y')).toBe('xy');
  });

  for (const id of DIAGRAMS)
    for (const locale of ['en', 'ar'] as const)
      it(`${id} renders in ${locale}`, () => {
        const d = diagram(id, locale);
        for (const svg of [d.wide, d.narrow]) {
          expect(svg).toMatch(/^<svg class="an/);
          expect(svg).toMatch(/role="img"/);
          expect(svg).toMatch(/<title id=/);
          expect(svg).toMatch(/<desc id=/);
          // every <use> points at a symbol in the same svg
          for (const m of svg.matchAll(/<use [^>]*href="#([^"]+)"/g)) expect(svg).toContain(`<symbol id="${m[1]}"`);
          // no nested raw <svg> icons (the cause of the giant-icon bug)
          expect(svg.slice(5)).not.toMatch(/<svg[\s>]/);
        }
      });

  // ARCH_PREVIEW=<dir> writes a standalone page per diagram for quick visual iteration
  it.runIf(!!process.env.ARCH_PREVIEW)('writes previews', () => {
    const dir = process.env.ARCH_PREVIEW!;
    mkdirSync(dir, { recursive: true });
    const css = readFileSync(join(__dirname, '../src/styles/arch.css'), 'utf8');
    for (const id of DIAGRAMS)
      for (const locale of ['en', 'ar'] as const) {
        let d;
        try {
          d = diagram(id, locale);
        } catch (e) {
          console.error(id, locale, (e as Error).message);
          continue;
        }
        const html = `<!doctype html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-sans:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}body{margin:0;padding:16px;background:#e9edf1}html[data-mode=dark] body{background:#020b11}svg{display:block}${css.replace(/url\('\/fonts\//g, `url('file://${join(__dirname, '../public/fonts/')}`)}</style></head><body><div class="an-wide">${d.wide}</div><div class="an-narrow">${d.narrow}</div></body></html>`;
        writeFileSync(join(dir, `${id}-${locale}.html`), html);
      }
  });

  it('Arabic sub-step badges draw the letter left of the digit as two placed glyphs, never one bidi run', () => {
    let seen = 0;
    for (const id of DIAGRAMS) {
      const d = diagram(id, 'ar');
      for (const svg of [d.wide, d.narrow])
        for (const m of svg.matchAll(/<g class="an-badge[^"]*an-badge-sub[^"]*"[^>]*>(.*?)<\/g>/g)) {
          const texts = [...m[1]!.matchAll(/<text x="([\d.-]+)"[^>]*>([^<]*)<\/text>/g)];
          expect(texts).toHaveLength(2);
          const [letter, digit] = texts as [RegExpMatchArray, RegExpMatchArray];
          expect(letter[2]).toMatch(/^[أبجد]$/);
          expect(digit[2]).toMatch(/^[٠-٩]+$/);
          expect(Number(letter[1])).toBeLessThan(Number(digit[1]));
          seen++;
        }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
