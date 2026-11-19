/**
 * Build-time text width estimate (no DOM at build). Deliberately generous so boxes are sized to
 * fit; the browser gate (e2e/diagram-gate.spec.ts) measures the real glyphs and fails on overlap.
 */
const THIN = new Set([...`iIjlt.,:;|!'\`·()[]/ `]);
const WIDE = new Set([...'mwMW@%']);

export function textWidth(s: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0x0600 && c <= 0x06ff) || (c >= 0xfb50 && c <= 0xfeff)) w += 0.5;
    else if (THIN.has(ch)) w += 0.3;
    else if (WIDE.has(ch)) w += 0.88;
    else if (ch >= 'A' && ch <= 'Z') w += 0.68;
    else if (ch >= '0' && ch <= '9') w += 0.58;
    else if (ch === '×' || ch === '→' || ch === '+') w += 0.62;
    else w += 0.56;
  }
  return w * size * (bold ? 1.07 : 1);
}

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
