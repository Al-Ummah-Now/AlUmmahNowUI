/**
 * Keeps an open popup (account menu, search suggestions) inside the viewport, whatever the header's
 * layout: the header wraps on phones, landscape phones and tablets, so a menu anchored to its
 * button's edge can start or end past the screen (owner bug 2026-11-13: the theme menu opened
 * off-screen on mobile). AlUmmahNow docs/design/NAV.md: no menu ever renders outside the viewport.
 *
 * After the popup is shown: shift it sideways (CSS `translate`) so both edges keep an 8px gutter,
 * narrow it if it is wider than the screen, and cap its height to the room below its top (it
 * scrolls inside). Re-fits on resize and orientation change while open.
 */
const GUTTER = 8;
const fitted = new Set<HTMLElement>();
let listening = false;

export function fitToViewport(el: HTMLElement): void {
  el.style.removeProperty('translate');
  el.style.removeProperty('max-inline-size');
  el.style.removeProperty('max-block-size');
  if (el.hidden) return;
  fitted.add(el);
  if (!listening) {
    listening = true;
    window.addEventListener('resize', () => fitted.forEach((f) => (f.isConnected && !f.hidden ? fitToViewport(f) : fitted.delete(f))));
  }
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  let r = el.getBoundingClientRect();
  if (r.width > vw - 2 * GUTTER) {
    el.style.maxInlineSize = `${vw - 2 * GUTTER}px`;
    r = el.getBoundingClientRect();
  }
  const dx = r.left < GUTTER ? GUTTER - r.left : r.right > vw - GUTTER ? vw - GUTTER - r.right : 0;
  if (dx) el.style.translate = `${Math.round(dx)}px 0`;
  const room = Math.floor(vh - Math.max(r.top, 0) - GUTTER);
  const cssMax = parseFloat(getComputedStyle(el).maxBlockSize);
  if (!(cssMax <= room)) el.style.maxBlockSize = `${Math.max(room, 96)}px`;
}
