/**
 * Static text pages (www CMS pages that are only text, such as Privacy, Terms and the Cookie policy, and
 * a scholar site's About) show their sections in frosted-glass boxes with the golden glow (owner,
 * 2026-11-15). This splits rendered prose (renderMarkdown / renderBody output: trusted HTML) at each
 * top-level <h2>: one box per section, the text before the first heading in a box of its own. The look
 * is the shared `pb-glass` card in page-blocks.generated.css (vendored from AlUmmahNow
 * packages/shared-types/src/page-blocks.css, also used by the videos site), never a copy of it;
 * `pb-glass-stack` spaces the boxes and `pb-glass-box` gives each its shape.
 *
 * `proseClass`: the site's own prose class, so text inside a box is styled as before.
 */
export function glassSectionsHtml(html: string, proseClass = 'prose'): string {
  const parts = glassSectionParts(html);
  if (!parts.length) return '';
  return `<div class="pb-glass-stack">${parts.map((p) => `<section class="pb-glass pb-glass-box ${proseClass}">${p}</section>`).join('')}</div>`;
}

/** The sections themselves (each a run of trusted HTML), for a host that adds boxes of its own to the stack. */
export function glassSectionParts(html: string): string[] {
  return html.split(/(?=<h2[\s>])/i).filter((p) => p.trim() !== '');
}
