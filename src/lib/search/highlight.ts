/**
 * Normalisation-aware highlighting: which parts of a displayed title match the query, where the
 * match is decided on normalised text (src/lib/search/normalize.ts). Typing "احمد" marks the whole
 * of "أَحمد", harakat included; "cafe" marks "Café".
 */
import { normalizeSearchText, stripArabicArticle } from './normalize';

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** One character of `text` normalised alone: '' for marks and invisibles, ' ' for punctuation. */
function normChar(ch: string): string {
  const n = normalizeSearchText(ch);
  if (n) return n;
  return WORD_CHAR.test(ch) || /\p{M}/u.test(ch) || /[\u0640\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\u00ad\u0621]/.test(ch) ? '' : ' ';
}

/**
 * The normalised text plus, for each of its characters, the [start, end) of the code point of
 * `text` it came from (UTF-16 offsets). Equal to normalizeSearchText(text) for ordinary text.
 */
export function normalizeWithMap(text: string): { norm: string; spans: [number, number][] } {
  let norm = '';
  const spans: [number, number][] = [];
  let i = 0;
  for (const ch of text) {
    const start = i;
    i += ch.length;
    for (const c of normChar(ch)) {
      if (c === ' ' && (norm === '' || norm.endsWith(' '))) continue;
      norm += c;
      spans.push([start, i]);
    }
  }
  if (norm.endsWith(' ')) {
    norm = norm.slice(0, -1);
    spans.pop();
  }
  return { norm, spans };
}

/** The query's words and their article-stripped forms, longest first. */
export function queryTerms(query: string): string[] {
  const words = normalizeSearchText(query).split(' ').filter(Boolean);
  const terms = new Set<string>();
  for (const w of words) {
    terms.add(w);
    terms.add(stripArabicArticle(w));
  }
  return [...terms].sort((a, b) => b.length - a.length);
}

/** Ranges [start, end) of `text` to mark for `query`, sorted and merged. */
export function highlightRanges(text: string, query: string): [number, number][] {
  const terms = queryTerms(query);
  if (!text || terms.length === 0) return [];
  const { norm, spans } = normalizeWithMap(text);
  const hits: [number, number][] = [];
  for (const term of terms) {
    for (let at = norm.indexOf(term); at !== -1; at = norm.indexOf(term, at + 1)) {
      let end = spans[at + term.length - 1]![1];
      // Keep a letter's trailing harakat inside the mark.
      for (const ch of text.slice(end)) {
        if (normChar(ch) !== '' || /\s/.test(ch)) break;
        end += ch.length;
      }
      hits.push([spans[at]![0], end]);
    }
  }
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h[0] <= last[1]) last[1] = Math.max(last[1], h[1]);
    else merged.push([h[0], h[1]]);
  }
  return merged;
}

/** `text` cut into plain and marked parts, for rendering (no HTML). */
export function highlightParts(text: string, query: string): { text: string; mark: boolean }[] {
  const parts: { text: string; mark: boolean }[] = [];
  let pos = 0;
  for (const [s, e] of highlightRanges(text, query)) {
    if (s > pos) parts.push({ text: text.slice(pos, s), mark: false });
    parts.push({ text: text.slice(s, e), mark: true });
    pos = e;
  }
  if (pos < text.length || parts.length === 0) parts.push({ text: text.slice(pos), mark: false });
  return parts;
}
