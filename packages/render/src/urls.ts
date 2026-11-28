/**
 * Shared defensive URL, JSON-LD, and structured-log sanitizers for www, sites, and packages/render
 * (injection audit UI-1..UI-9).
 */

// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u001f\u007f]/;
// eslint-disable-next-line no-control-regex
const LOG_CTRL = /[\r\n\u0000-\u001f\u007f]+/g;

/** True when `raw` is a clean same-origin relative path (`/foo`, never `//`, never `\`, no control chars). */
export function isSafeRelativePath(raw: string): boolean {
  if (!raw || raw.length > 2048 || CTRL.test(raw) || /\s/.test(raw)) return false;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /^\/%5c/i.test(raw)) return false;
  try {
    const base = 'https://relative.invalid';
    const u = new URL(raw, base);
    if (u.origin !== base) return false;
    const out = `${u.pathname}${u.search}${u.hash}`;
    return out.startsWith('/') && !out.startsWith('//') && !out.includes('\\') && !/^\/%5c/i.test(out);
  } catch {
    return false;
  }
}

/** Valid `https://` URL with no control characters, else null. Preserves valid input string. */
export function safeHttpsUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || CTRL.test(raw)) return null;
  const v = raw.trim();
  if (!v || v.length > 2048 || /\s/.test(v)) return null;
  try {
    return new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

/** Valid `http(s)://` URL with no control characters, else null. Preserves valid input string. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || CTRL.test(raw)) return null;
  const v = raw.trim();
  if (!v || v.length > 2048 || /\s/.test(v)) return null;
  try {
    const proto = new URL(v).protocol;
    return proto === 'https:' || proto === 'http:' ? v : null;
  } catch {
    return null;
  }
}

/** Safe relative path (`/...`) or `https://` URL, else null. */
export function safeRelativeOrHttpsUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || CTRL.test(raw)) return null;
  const v = raw.trim();
  if (!v || v.length > 2048 || /\s/.test(v)) return null;
  if (v.startsWith('/')) return isSafeRelativePath(v) ? v : null;
  return safeHttpsUrl(v);
}

/** Safe relative path (`/...`) or `http(s)://` URL, else null. */
export function safeRelativeOrHttpUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || CTRL.test(raw)) return null;
  const v = raw.trim();
  if (!v || v.length > 2048 || /\s/.test(v)) return null;
  if (v.startsWith('/')) return isSafeRelativePath(v) ? v : null;
  return safeHttpUrl(v);
}

/**
 * Strict Markdown link allowlist (UI-1): `http:`, `https:`, `mailto:`, safe relative path `/...`,
 * or fragment `#...` only. Drops `javascript:`, `vbscript:`, `data:`, `file:`, `ftp:`, `tel:`,
 * `blob:`, `//evil.example`, `/\evil.example`, and control chars.
 */
export function safeMarkdownHref(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string' || CTRL.test(raw)) return false;
  const v = raw.trim();
  if (!v || v.length > 2048) return false;
  if (v.startsWith('#')) return !/\s/.test(v);
  if (v.startsWith('/')) return isSafeRelativePath(v);
  if (/^mailto:/i.test(v)) {
    // mailto: with no whitespace/control chars and a non-empty address/query
    return v.length > 7 && !/\s/.test(v);
  }
  if (/^https?:/i.test(v)) {
    try {
      const proto = new URL(v).protocol;
      return proto === 'https:' || proto === 'http:';
    } catch {
      return false;
    }
  }
  // Reject any other explicit scheme or bare protocol-relative / backslash path
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//') || v.includes('\\')) return false;
  // Plain relative segment without scheme (e.g. `about` or `./about`)
  return !/\s/.test(v) && !v.includes(':');
}

/** Strict Markdown image `src` allowlist (UI-1): `http:`, `https:`, or safe relative path `/...` only (no `data:`, `mailto:`, `javascript:`). */
export function safeMarkdownImgSrc(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string' || CTRL.test(raw)) return false;
  const v = raw.trim();
  if (!v || v.length > 2048 || /\s/.test(v)) return false;
  if (v.startsWith('/')) return isSafeRelativePath(v);
  return safeHttpUrl(v) !== null;
}

/**
 * JSON serialization safe for inline `<script type="application/ld+json">` blocks (UI-5):
 * escapes `<`, `>`, `&`, U+2028, and U+2029 so content can never close `</script>`, break HTML
 * comments (`-->`), or split JavaScript/JSON line terminators.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Strips CR/LF and ASCII control characters from error strings before structured logging (UI-8). */
export function sanitizeLogText(text: string, max = 500): string {
  return text.replace(LOG_CTRL, ' ').trim().slice(0, max);
}

export function sanitizeLogError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return sanitizeLogText(raw, 500);
}
