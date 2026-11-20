/**
 * Diagrams render at their natural size and never shrink (labels stay readable). When the visible
 * layout is wider than its column it scrolls sideways; this shows the hint over it only then, and opens
 * the box on the drawing itself: the first tile in reading order (leftmost in English, rightmost in
 * Arabic) comes into view, never a stretch of empty canvas (the isometric hero has wide margins).
 */
const opened = new WeakSet<HTMLElement>();

function openOnContent(box: HTMLElement) {
  if (opened.has(box) || box.scrollWidth <= box.clientWidth + 1) return;
  opened.add(box);
  const tiles = [...box.querySelectorAll<SVGGraphicsElement>('[data-node]')].map((g) => (g.querySelector('[data-box]') ?? g).getBoundingClientRect());
  if (!tiles.length) return;
  const view = box.getBoundingClientRect();
  const rtl = getComputedStyle(box).direction === 'rtl';
  const PAD = 16;
  // scrollBy with a measured delta works the same under every browser's RTL scrollLeft convention
  if (rtl) {
    const right = Math.max(...tiles.map((t) => t.right));
    const delta = right + PAD - view.right;
    if (delta < 0) box.scrollBy({ left: delta, behavior: 'instant' as ScrollBehavior });
  } else {
    const left = Math.min(...tiles.map((t) => t.left));
    const delta = left - PAD - view.left;
    if (delta > 0) box.scrollBy({ left: delta, behavior: 'instant' as ScrollBehavior });
  }
}

function update() {
  for (const frame of document.querySelectorAll<HTMLElement>('.an-frame')) {
    const shown = [...frame.querySelectorAll<HTMLElement>('.an-scroll')].find((el) => el.offsetParent !== null);
    const hint = frame.querySelector<HTMLElement>('.an-scroll-hint');
    if (hint) hint.hidden = !shown || shown.scrollWidth <= shown.clientWidth + 1;
    if (shown) openOnContent(shown);
  }
}
update();
addEventListener('resize', update);
