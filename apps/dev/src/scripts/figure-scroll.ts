/**
 * Diagrams render at their natural size and never shrink (labels stay readable). When the visible
 * layout is wider than its column it scrolls sideways; this shows the hint over it only then, and opens
 * the box on the drawing's start: the start-most piece of the drawing (a wire, boundary, platform, tag,
 * tile, label or sketch note) sits 24 px inside the box's start edge (left in English, right in Arabic). A
 * figure that fits, or whose drawing already starts that far in, stays where it opens; the isometric
 * hero's empty floor margin is skipped, and nothing of the drawing is ever hidden past the start edge.
 */
const opened = new WeakSet<HTMLElement>();
const CONTENT = '.an-edge, [data-group] > rect, [data-group] polygon, [data-tag] rect, .an-iso-tag rect, [data-node] [data-box], [data-node] .an-node-box, [data-for], .an-sk-cloud, .an-sk-side, .an-sk-title, .an-lifeline, .an-seq-note-box';
const INSET = 24;

function openOnContent(box: HTMLElement) {
  if (opened.has(box) || box.scrollWidth <= box.clientWidth + 1) return;
  opened.add(box);
  const parts = [...box.querySelectorAll<SVGGraphicsElement>(CONTENT)].filter((el) => !el.closest('.an-motion')).map((el) => el.getBoundingClientRect()).filter((r) => r.width || r.height);
  if (!parts.length) return;
  const view = box.getBoundingClientRect();
  const rtl = getComputedStyle(box).direction === 'rtl';
  // scrollBy with a measured delta works the same under every browser's RTL scrollLeft convention
  if (rtl) {
    const start = Math.max(...parts.map((r) => r.right));
    const delta = start + INSET - view.right;
    if (delta < 0) box.scrollBy({ left: delta, behavior: 'instant' as ScrollBehavior });
  } else {
    const start = Math.min(...parts.map((r) => r.left));
    const delta = start - INSET - view.left;
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
