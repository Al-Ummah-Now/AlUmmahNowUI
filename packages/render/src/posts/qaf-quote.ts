/** Videos Studio stores a Markdown blockquote and a Qaf passage link. Numeric
 * entities keep literal text safe for older renderers. Decode only those
 * entities here and render the result as text. */
const URL = String.raw`https://qaf\.ai/(?:(?:ar|en)/)?passages/[\da-fA-F-]{36}/?`;
const QUOTE = String.raw`> ([^\n]+)\n\n\[([^\n\]]+)\]\((${URL})\)`;
const exact = new RegExp(`^${QUOTE}$`);

export interface QafQuote { text: string; label: string; url: string }

function decode(value: string) {
  return value.replace(/&#(\d{1,3});/g, (entity, digits: string) => {
    const code = Number(digits);
    return code >= 9 && code <= 126 ? String.fromCharCode(code) : entity;
  });
}

export function parseQafQuote(source: string): QafQuote | null {
  const match = exact.exec(source);
  return match ? { text: decode(match[1]!), label: decode(match[2]!), url: match[3]! } : null;
}

export function splitQafQuotes(source: string): Array<string | QafQuote> {
  const parts: Array<string | QafQuote> = [];
  let offset = 0;
  for (const match of source.matchAll(new RegExp(`(^|\\n\\n)(${QUOTE})(?=\\n\\n|$)`, 'g'))) {
    const start = match.index + match[1]!.length;
    const block = match[2]!;
    const quote = parseQafQuote(block);
    if (!quote) continue;
    if (start > offset) parts.push(source.slice(offset, start));
    parts.push(quote);
    offset = start + block.length;
  }
  if (offset < source.length) parts.push(source.slice(offset));
  return parts;
}
