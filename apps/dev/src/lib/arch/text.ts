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
// a path's leading «/» (or a name's leading «.», «.NET») and a run's trailing «-», «/», «*» or «…» belong to it: left outside the isolate, the bidi
// algorithm moves them to the other end («/priv/*» shows as «priv/*/», «al-ummah-now-…» as «…-al-ummah-now»)
const WORD = String.raw`(?:[A-Za-z0-9<{*$]|[(\[/.](?=[A-Za-z0-9<{*]))(?:[\w.\-/:<>{}()[\]|*?=+@#&$',…]*[A-Za-z0-9>})\]*?$'_…/\-#+])?`;
// names joined by spaces are one run, so «Workers KV» keeps its order in Arabic
const LATIN_RUN = new RegExp(`${WORD}(?: ${WORD})*`, 'g');

/**
 * A run's bracket that its partner doesn't close inside the run («(Next.js على Workers)»: "(Next.js" … "Workers)")
 * stays outside the isolate, with the Arabic, so the pair resolves right to left around the words; a bracket the run
 * closes itself («(api-videos)») stays in.
 */
function trimBrackets(run: string): [string, string, string] {
  let pre = '';
  let post = '';
  let core = run;
  const open = (c: string) => (c === '(' ? ')' : c === '[' ? ']' : '');
  if (open(core[0] ?? '') && !core.includes(open(core[0]!))) {
    pre = core[0]!;
    core = core.slice(1);
  }
  const last = core[core.length - 1] ?? '';
  const opener = last === ')' ? '(' : last === ']' ? '[' : '';
  if (opener && !core.includes(opener)) {
    post = last;
    core = core.slice(0, -1);
  }
  return [pre, core, post];
}

/** Wrap every Latin run of an Arabic string in an isolate (LRI … PDI), so the bidi algorithm never reorders it. */
export function isolateLatin(s: string, always = false): string {
  if (!always && !hasArabic(s)) return s;
  return s.replace(LATIN_RUN, (run) => {
    const [pre, core, post] = trimBrackets(run);
    return `${pre}${LRI}${core}${PDI}${post}`;
  });
}

/** An Arabic string split into its Latin runs and the Arabic between them (for HTML: each run goes in a <bdi>). */
export function splitLatin(s: string): { t: string; latin: boolean }[] {
  if (!hasArabic(s)) return [{ t: s, latin: false }];
  const out: { t: string; latin: boolean }[] = [];
  let last = 0;
  for (const m of s.matchAll(LATIN_RUN)) {
    const [pre, core, post] = trimBrackets(m[0]);
    const before = s.slice(last, m.index) + pre;
    if (before) {
      const prev = out[out.length - 1];
      if (prev && !prev.latin) prev.t += before;
      else out.push({ t: before, latin: false });
    }
    out.push({ t: core, latin: true });
    if (post) out.push({ t: post, latin: false });
    last = m.index! + m[0].length;
  }
  if (last < s.length) {
    const prev = out[out.length - 1];
    if (prev && !prev.latin) prev.t += s.slice(last);
    else out.push({ t: s.slice(last), latin: false });
  }
  return out;
}

const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/**
 * Last pass over a rendered diagram: every <text> holding Arabic is set right to left (its anchor
 * flipped, so it stays where it was placed) and its Latin runs are isolated. The browser gate
 * (e2e/diagram-gate.ts) fails on Arabic text whose Latin runs aren't isolated.
 */
export function finishBidi(svg: string): string {
  // a text wrapped into tspans (a sketch tile's lines): when its words hold Arabic, every line's Latin runs are isolated
  // (the text itself carries direction="rtl" from the renderer), a line all in Latin too («IP» wrapped off «لكل»)
  const wrapped = svg.replace(/<text([^>]*)>((?:<tspan[^>]*>[^<]*<\/tspan>)+)<\/text>/g, (m, attrs: string, body: string) => {
    if (!hasArabic([...body.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((x) => unesc(x[1]!)).join(' '))) return m;
    return `<text${attrs}>${body.replace(/(<tspan[^>]*>)([^<]*)(<\/tspan>)/g, (_t, o: string, line: string, c: string) => `${o}${esc(isolateLatin(unesc(line), true))}${c}`)}</text>`;
  });
  return wrapped.replace(/<text([^>]*)>([^<]*)<\/text>/g, (m, attrs: string, body: string) => {
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

const NBSP = ' ';
const NUM = '[0-9\u0660-\u0669](?:[0-9\u0660-\u0669.,\u066b%]*[0-9\u0660-\u0669%])?';
/**
 * Words that read as one value never split across lines: a ratio («١ من ٢٠», "1 in 20"), a number and its unit
 * («٩٠ يومًا», "30 s"), «كل» or "every" and the word after it («كل ساعة»), and a code call's arguments
 * ("can(role, capability)"). The spaces inside become no-break spaces.
 */
export function bindPhrases(s: string): string {
  return s
    .replace(new RegExp(`(${NUM}) (in|of|من|/) (${NUM})`, 'g'), `$1${NBSP}$2${NBSP}$3`)
    .replace(new RegExp(`(^|[\\s(])(${NUM}) (?=[^\\s\\d٠-٩·•،,;:]{1,9}(?:[\\s.,،؛:)]|$))`, 'g'), `$1$2${NBSP}`)
    .replace(/(^|\s)(كل|every) (?=\S)/g, `$1$2${NBSP}`)
    // a list separator stays on the line of the word before it, so no line starts with «·»
    .replace(/ ([·•]) /g, `${NBSP}$1 `)
    .replace(/\(([^()]{1,40})\)/g, (m: string, inner: string) => (/[A-Za-z_]\w*,/.test(inner) ? `(${inner.replace(/ /g, NBSP)})` : m));
}
