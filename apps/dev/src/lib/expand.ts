/**
 * Spell out abbreviations where a page first uses them (src/lib/glossary.ts), on the built HTML of
 * the page's <main>, in reading order:
 *  - prose: the first use gets its meaning in parentheses, unless the meaning is already close by;
 *  - a figure (.an-frame) that uses unexplained terms in its drawing gets an "In this figure" line
 *    just above it.
 * Headings, navigation, lists marked data-no-expand, scripts and a drawing's <title>/<desc> are left alone.
 */
import { GLOSSARY, NEAR, termPattern, type Term } from './glossary.ts';

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
            out.push(`<p class="an-terms">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`);
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
        afterBdi += ` (${meaning(term)})`;
        continue;
      }
      let at = m.index + term.abbr.length;
      // "R2 storage" → "R2 storage (…)", not "R2 (… object storage) storage": a word the meaning already says goes first
      const next = /^ ([A-Za-z\u0600-\u06ff]+)/.exec(text.slice(at));
      if (next && meaning(term).toLowerCase().includes(next[1]!.toLowerCase())) at += next[0].length;
      text = `${text.slice(0, at)} (${meaning(term)})${text.slice(at)}`;
    }
    out.push(text);
    recent = (recent + ' ' + decode(text)).slice(-NEAR);
  }
  return head + out.join('') + tail;
}
