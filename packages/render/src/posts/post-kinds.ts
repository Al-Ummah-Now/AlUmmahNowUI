/**
 * Helpers for scholar posts of community kinds (AlUmmahNowCMS docs/SCHOLARS.md §7): www renders their
 * text as text (never HTML) and opens outside links safely.
 */

/** A text post's content (the videos platform keeps a little sanitised HTML) as plain paragraphs. */
export function plainLines(content: string): string[] {
  let text = '';
  let inTag = false;
  for (const ch of content.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')) {
    if (ch === '<') inTag = true;
    else if (ch === '>' && inTag) inTag = false;
    else if (!inTag) text += ch;
  }
  const decoded = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  return decoded
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

/** An outside link's URL when it is http(s), else null (javascript:, data: and the like are dropped). */
export function safeOutsideUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Kinds PostArticle renders (markdown body or cards); the rest render with PostKindBody. */
export const isArticleKind = (kind: string | undefined) => !kind || kind === 'article' || kind === 'cards';
