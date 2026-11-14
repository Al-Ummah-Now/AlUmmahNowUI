/**
 * Slots in the shared page-builder renderer (page-blocks.generated.ts `renderPageBlocks`, `ctx.slot`):
 * a block the host renders with its own component (www's paged card grid, video shelves and post
 * lists; the scholar sites' embed player and channel lists). The renderer's HTML carries a marker
 * where it goes, inside the same frame (width, tone, alignment, spacing) the renderer gives its own
 * blocks; the host's Astro component splits the HTML on the markers and fills them in.
 */
import { ALIGNS, DEFAULT_STYLE, SPACES, TONES, WIDTHS, type BlockStyle, type PageBlockType } from './page-blocks.generated';

/** The marker for a slot. Block ids are [a-z0-9-] only (BLOCK_ID), so they need no escaping. */
export const SLOT_RE = /<!--pb-slot:([a-z0-9-]+)-->/;

/** [html, id, html, id, …, html]: the renderer's HTML around each slot marker. */
export const splitSlots = (html: string): string[] => html.split(new RegExp(SLOT_RE.source, 'g'));

/** The renderer's frame around a slot's marker. `labelled`: the slot shows an h2 with id `pb-{id}-h`. */
export function slotHtml(b: { id: string; type: PageBlockType; appearance?: BlockStyle | null }, opts: { labelled?: boolean; tag?: 'section' | 'div' } = {}): string {
  const st = b.appearance ?? DEFAULT_STYLE[b.type];
  const w = WIDTHS.includes(st.width) ? st.width : 'content';
  const tone = TONES.includes(st.tone) ? st.tone : 'none';
  const a = ALIGNS.includes(st.align) ? st.align : 'start';
  const sp = SPACES.includes(st.space) ? st.space : 'm';
  const tag = opts.tag ?? 'section';
  const label = opts.labelled ? ` aria-labelledby="pb-${b.id}-h"` : '';
  return `<${tag} class="pb-b pb-k-${b.type} pb-w-${w} pb-t-${tone} pb-a-${a} pb-s-${sp}" data-block="${b.id}" data-block-type="${b.type}"${label}><div class="pb-in"><!--pb-slot:${b.id}--></div></${tag}>`;
}
