/**
 * The header lockup of a scholar site (apps/sites): nav/header.js brandHtml, the contract's markup
 * and sizes exactly (round 36px mark, 10px gap, 16px/700 wordmark, 18px in Arabic), with the site's
 * own art and name in place of the platform's. A scholar site is white-label: its logo (else its
 * channel avatar) sits in the round mark slot, its name is the wordmark, and it has no second line.
 * Built from brandHtml's own output, so a change to the contract's lockup reaches the sites too;
 * apps/sites/tests/header.test.ts pins the result against brandHtml.
 */
import { HEADER_LABELS, brandHtml, escapeHtml } from './nav/header.js';

export function siteBrandHtml(opts: { lang: string; href: string; name: string; logoSrc?: string | null }): string {
  const platform = HEADER_LABELS[opts.lang === 'ar' ? 'ar' : 'en'].siteName;
  const html = brandHtml({ lang: opts.lang, href: opts.href, logoSrc: opts.logoSrc || '' }).replace(
    `<span class="aun-brand-name">${platform}</span>`,
    `<span class="aun-brand-name">${escapeHtml(opts.name)}</span>`,
  );
  if (opts.logoSrc) return html;
  // No art at all: the name's first letter in the same round slot (the account avatar's fallback)
  const letter = escapeHtml((Array.from(opts.name.trim())[0] ?? '?').toUpperCase());
  return html.replace(/<img class="aun-brand-mark"[^>]*>/, `<span class="aun-brand-mark aun-brand-letter" aria-hidden="true">${letter}</span>`);
}
