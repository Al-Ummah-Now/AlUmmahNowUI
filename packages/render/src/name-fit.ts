/**
 * The account button's name, cut to fit by us instead of by `text-overflow: ellipsis`, so it sits
 * the same distance from the avatar in every theme (AUDIT-2 #143).
 *
 * Why not CSS alone: an ellipsized line keeps its full box (the contract's 9rem) and drops whole
 * glyph clusters, so the space the last dropped cluster leaves lands beside the ellipsis. With an
 * Arabic name on an English page (dir=auto) that is the avatar side, and its size depends on the
 * theme font: about 3px in the system font, about 13px in Nahas's Amiri. `text-align` doesn't
 * move an overflowing line, so neither `match-parent` nor left/right helps.
 *
 * Here the name is cut by graphemes to the longest "text…" that fits, the box shrinks to it, and
 * the gap is the button's own 8px in every theme. The full name stays the button's accessible
 * name (a visually hidden copy; the cut text is aria-hidden). Re-cut when the box changes size
 * (a theme switch changes the font, the name is hidden below 768px) and once the fonts are in.
 */
const ELLIPSIS = '…';

/** Code points with combining marks (harakat, shadda) and ZWJ sequences kept on their base, so a cut
 * never leaves a mark on the ellipsis. (Not the grapheme segmenter: every Intl call lives in format.ts.) */
function graphemes(text: string): string[] {
  const out: string[] = [];
  let joinNext = false;
  for (const ch of text) {
    if (out.length && (joinNext || /[\p{M}\u200d\ufe0f]/u.test(ch))) out[out.length - 1] += ch;
    else out.push(ch);
    joinNext = ch === '\u200d';
  }
  return out;
}

const fits = (el: HTMLElement) => el.scrollWidth <= el.clientWidth + 1;

/** Show `name` in `el` whole if it fits, else the longest grapheme-cut "name…" that does. */
export function cutToFit(el: HTMLElement, name: string): void {
  el.textContent = name;
  if (!name || el.clientWidth === 0 || fits(el)) return;
  const parts = graphemes(name);
  const shown = (n: number) => parts.slice(0, n).join('').trimEnd() + ELLIPSIS;
  // largest n with shown(n) fitting; n = 0 (the ellipsis alone) is the floor
  let lo = 0;
  let hi = parts.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    el.textContent = shown(mid);
    if (fits(el)) lo = mid;
    else hi = mid - 1;
  }
  const visible = document.createElement('span');
  visible.setAttribute('aria-hidden', 'true');
  visible.textContent = shown(lo);
  const full = document.createElement('span');
  full.className = 'aun-visually-hidden';
  full.textContent = name;
  el.replaceChildren(visible, full);
}

const watching = new WeakMap<HTMLElement, ResizeObserver>();

/** Keep `el` showing `name` cut to fit, re-cutting when its box changes size or the fonts load.
 * A later call for the same element replaces the earlier one (a new name after an account switch). */
export function fitName(el: HTMLElement, name: string): void {
  watching.get(el)?.disconnect();
  const check = () => {
    if (!el.isConnected) return ro?.disconnect();
    if (ro && watching.get(el) !== ro) return;
    cutToFit(el, name);
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
  if (ro) watching.set(el, ro);
  check();
  ro?.observe(el);
  void document.fonts?.ready.then(check);
}
