/**
 * Diagrams render at their natural size and never shrink (labels stay readable). When the visible
 * layout is wider than its column it scrolls sideways; this shows the hint under it only then.
 */
function update() {
  for (const frame of document.querySelectorAll<HTMLElement>('.an-frame')) {
    const shown = [...frame.querySelectorAll<HTMLElement>('.an-scroll')].find((el) => el.offsetParent !== null);
    const hint = frame.querySelector<HTMLElement>('.an-scroll-hint');
    if (hint) hint.hidden = !shown || shown.scrollWidth <= shown.clientWidth + 1;
  }
}
update();
addEventListener('resize', update);
