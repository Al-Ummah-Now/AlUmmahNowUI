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

const LRI = '⁦';
const PDI = '⁩';
/** A run of Latin script (identifiers, product names, paths) inside Arabic text: kept left to right as one unit. */
// a bracket starts a run only when Latin follows it: «(اختبار)» stays Arabic, «(api-videos)» stays whole
const WORD = String.raw`(?:[A-Za-z0-9<{*$]|[(\[](?=[A-Za-z0-9<{]))(?:[\w.\-/:<>{}()[\]|*?=+@#&$',]*[A-Za-z0-9>})\]*?$'_])?`;
const LATIN_RUN = new RegExp(`${WORD}(?: ${WORD})*`, 'g');

/** Wrap every Latin run of an Arabic string in an isolate (LRI … PDI), so the bidi algorithm never reorders it. */
export function isolateLatin(s: string): string {
  if (!hasArabic(s)) return s;
  return s.replace(LATIN_RUN, (run) => `${LRI}${run}${PDI}`);
}

const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/**
 * Last pass over a rendered diagram: every <text> holding Arabic is set right to left (its anchor
 * flipped, so it stays where it was placed) and its Latin runs are isolated. The browser gate
 * (e2e/diagram-gate.ts) fails on Arabic text whose Latin runs aren't isolated.
 */
export function finishBidi(svg: string): string {
  return svg.replace(/<text([^>]*)>([^<]*)<\/text>/g, (m, attrs: string, body: string) => {
    const raw = unesc(body);
    if (!hasArabic(raw)) return m;
    let a = attrs;
    if (!/\sdirection=/.test(a)) {
      // flip the anchor so the text keeps its place (no anchor means start: it grew rightwards from x)
      if (/text-anchor=/.test(a)) a = a.replace(/text-anchor="(start|end)"/, (_x, v: string) => `text-anchor="${v === 'start' ? 'end' : 'start'}"`);
      else a += ' text-anchor="end"';
      a += ' direction="rtl"';
    }
    return `<text${a}>${esc(isolateLatin(raw))}</text>`;
  });
}
