/**
 * Spell out abbreviations where a page first uses them (src/lib/glossary.ts), on the built HTML of
 * the page's <main>, in reading order:
 *  - prose: the first use gets its meaning in parentheses, unless the meaning is already close by;
 *  - a figure (.an-frame) that uses unexplained terms in its drawing gets an "In this figure" line
 *    just above it.
 * Headings, navigation, lists marked data-no-expand, scripts and a drawing's <title>/<desc> are left alone.
 */
import { GLOSSARY, NEAR, termPattern, type Term } from './glossary.ts';
import { bindPhrases, splitLatin } from './arch/text.ts';

const SKIP = new Set(['script', 'style', 'title', 'desc', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'label', 'legend', 'code']);
const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'path', 'rect', 'circle', 'use', 'line', 'polygon', 'polyline', 'stop', 'ellipse']);
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export function expandAbbreviations(html: string, locale: 'en' | 'ar', label: string): string {
  const start = html.search(/<main[\s>]/);
  const end = html.lastIndexOf('</main>');
  if (start < 0 || end < 0) return html;
  const head = html.slice(0, start);
  const body = html.slice(start, end);
  const tail = html.slice(end);
  const tokens = body.split(/(<[^>]+>)/);
  const seen = new Set<string>();
  let recent = '';
  const meaning = (t: Term) => (locale === 'ar' ? t.ar : t.en);
  const html_ = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // an Arabic meaning's Latin words («… لدى Cloudflare») are isolated as the page's prose is: a parenthesis beside
  // them otherwise wraps to a line start as «)Cloudflare»
  const meaningHtml = (t: Term) => splitLatin(meaning(t)).map((q) => (q.latin ? `<bdi dir="ltr" class="lr">${html_(q.t)}</bdi>` : html_(q.t))).join('');
  const said = (t: Term, around: string) => around.toLowerCase().includes(meaning(t).toLowerCase());

  const stack: string[] = [];
  const skipping = () => stack.some((t) => SKIP.has(t));
  const out: string[] = [];
  // a term inside a Latin isolate (<bdi class="lr">, kept on one line): its meaning, often Arabic, follows the isolate
  let afterBdi = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (tok.startsWith('<')) {
      const m = /^<\/?([a-zA-Z0-9-]+)/.exec(tok);
      const name = m?.[1]?.toLowerCase() ?? '';
      if (tok.startsWith('</')) {
        const k = stack.lastIndexOf(name);
        if (k >= 0) stack.length = k;
        if (name === 'bdi' && afterBdi) {
          out.push(tok, afterBdi);
          recent = (recent + afterBdi).slice(-NEAR);
          afterBdi = '';
          continue;
        }
      } else if (name && !tok.endsWith('/>') && !VOID.has(name) && !tok.startsWith('<!')) {
        // a list of names (the feature registry) is marked data-no-expand: left exactly as written
        if (/\sdata-no-expand[\s>=]/.test(tok)) {
          stack.push(name, 'nav');
          out.push(tok);
          continue;
        }
        // a figure: name, above it, the terms its drawing uses that nothing before has explained
        if (name === 'div' && /class="[^"]*\ban-frame\b/.test(tok)) {
          const used: Term[] = [];
          let depth = 0;
          let inSvgText = false;
          for (let j = i; j < tokens.length; j++) {
            const t2 = tokens[j]!;
            if (/^<div[\s>]/.test(t2)) depth++;
            else if (t2 === '</div>') {
              depth--;
              if (depth === 0) break;
            } else if (/^<text[\s>]/.test(t2)) inSvgText = true;
            else if (t2 === '</text>') inSvgText = false;
            else if (inSvgText && !t2.startsWith('<')) {
              const text = decode(t2);
              for (const term of GLOSSARY)
                if (!seen.has(term.abbr) && !used.some((u) => u === term || u.abbr === term.same || u.same === term.abbr) && termPattern(term.abbr).test(text)) used.push(term);
            }
          }
          if (used.length) {
            const list = used.map((t) => `${t.abbr}: ${meaning(t)}`).join(locale === 'ar' ? '؛ ' : '; ');
            const line = `${label} ${list}.`;
            const lineHtml = `${html_(label)} ${used.map((t) => `<bdi dir="ltr" class="lr">${html_(t.abbr)}</bdi>: ${meaningHtml(t)}`).join(locale === 'ar' ? '؛ ' : '; ')}.`;
            out.push(`<p class="an-terms">${locale === 'ar' ? lineHtml : html_(line)}</p>`);
            for (const t of used) {
              seen.add(t.abbr);
              if (t.same) seen.add(t.same);
              for (const t2 of GLOSSARY) if (t2.same === t.abbr) seen.add(t2.abbr);
            }
            recent = (recent + ' ' + line).slice(-NEAR);
          }
        }
        stack.push(name);
      }
      out.push(tok);
      continue;
    }
    if (skipping() || stack.includes('svg') || !tok.trim()) {
      out.push(tok);
      continue;
    }
    // prose: the first use of each term gets its meaning, unless it's already close by
    let text = tok;
    const plain = decode(tok);
    const upcoming = decode(tokens.slice(i, i + 6).filter((x) => !x.startsWith('<')).join(' ')).slice(0, NEAR);
    for (const term of GLOSSARY) {
      if (seen.has(term.abbr)) continue;
      const re = termPattern(term.abbr);
      const m = re.exec(text);
      if (!m) continue;
      // inside someone else's parentheses ("(lists capped in SQL)"): a meaning there would nest a bracket in a bracket,
      // so the term waits for its next use
      // (a term that is the whole parenthesis, "content delivery network (CDN)", is explained right there: it counts)
      const own = /\(\s*$/.test(text.slice(0, m.index)) && /^\s*\)/.test(text.slice(m.index + term.abbr.length));
      const open = (recent + ' ' + plain.slice(0, plain.indexOf(term.abbr))).split('').reduce((d, ch) => (ch === '(' ? d + 1 : ch === ')' ? Math.max(0, d - 1) : d), 0);
      if (open > 0 && !own) continue;
      seen.add(term.abbr);
      if (term.same) seen.add(term.same);
      for (const t2 of GLOSSARY) if (t2.same === term.abbr) seen.add(t2.abbr);
      // already in parentheses after its own explanation ("… dead-letter queue (DLQ)"): never a second bracket
      if (/\(\s*$/.test(text.slice(0, m.index))) continue;
      const before = recent + plain.slice(0, plain.indexOf(term.abbr));
      if (said(term, before.slice(-NEAR)) || said(term, upcoming)) continue;
      // already followed by its own parenthesis (e.g. "TUS (resumable uploads)"): leave it
      if (/^\s*\(/.test(text.slice(m.index + term.abbr.length))) continue;
      if (stack[stack.length - 1] === 'bdi') {
        // the isolate already followed by its own parenthesis («تحدّي PKCE (إثبات …)»): leave it
        const after = tokens.slice(i + 1).find((x) => !x.startsWith('<') && x.trim()) ?? '';
        if (!/^\s*\(/.test(decode(after))) afterBdi += ` (${meaningHtml(term)})`;
        continue;
      }
      let at = m.index + term.abbr.length;
      // "R2 storage" → "R2 storage (…)", not "R2 (… object storage) storage": a word the meaning already says goes first
      const next = /^ ([A-Za-z\u0600-\u06ff]+)/.exec(text.slice(at));
      if (next && meaning(term).toLowerCase().includes(next[1]!.toLowerCase())) at += next[0].length;
      text = `${text.slice(0, at)} (${meaningHtml(term)})${text.slice(at)}`;
    }
    out.push(text);
    recent = (recent + ' ' + decode(text)).slice(-NEAR);
  }
  return head + out.join('') + tail;
}

const ISO_SKIP = new Set(['script', 'style', 'svg', 'title', 'bdi', 'code', 'pre', 'textarea', 'kbd', 'samp']);

/** Rewrites each text run of a page's <main> (not drawings, code or existing isolates); `fix` gets and returns decoded text, or null to leave it. */
function mapProse(html: string, fix: (plain: string) => string | null): string {
  const start = html.search(/<main[\s>]/);
  const end = html.lastIndexOf('</main>');
  if (start < 0 || end < 0) return html;
  const tokens = html.slice(start, end).split(/(<[^>]+>)/);
  const stack: string[] = [];
  const out = tokens.map((tok) => {
    if (tok.startsWith('<')) {
      const name = /^<\/?([a-zA-Z0-9-]+)/.exec(tok)?.[1]?.toLowerCase() ?? '';
      if (tok.startsWith('</')) {
        const k = stack.lastIndexOf(name);
        if (k >= 0) stack.length = k;
      } else if (name && !tok.endsWith('/>') && !VOID.has(name) && !tok.startsWith('<!')) stack.push(name);
      return tok;
    }
    if (!tok.trim() || stack.some((t) => ISO_SKIP.has(t))) return tok;
    return fix(decode(tok)) ?? tok;
  });
  return html.slice(0, start) + out.join('') + html.slice(end);
}

const enc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Every page's prose: a value never splits across lines («١ من ٢٠», "1 in 20", «٩٠ يومًا», «كل ساعة»,
 * "can(role, capability)") and a dash keeps to the word before it, so a line never starts with «—».
 */
export function bindProse(html: string): string {
  return mapProse(html, (plain) => {
    const fixed = bindPhrases(plain).replace(/ —/g, '\u00a0—');
    return fixed === plain ? null : enc(fixed);
  });
}

/**
 * An Arabic page's prose, after the glossary: every Latin run (a name, a path, ".NET") inside <main> is isolated in a
 * <bdi> kept on one line, whichever component wrote it, so the bidi algorithm never moves its punctuation («NET.»)
 * and a word that follows a paren never lands on the wrong side. Runs already isolated, drawings and code are left alone.
 */
export function isolateLatinProse(html: string): string {
  return mapProse(bindProse(html), (plain) => {
    const parts = splitLatin(plain);
    if (!parts.some((q) => q.latin)) return null;
    return parts.map((q) => (q.latin ? `<bdi dir="ltr" class="lr">${enc(q.t)}</bdi>` : enc(q.t))).join('');
  });
}
