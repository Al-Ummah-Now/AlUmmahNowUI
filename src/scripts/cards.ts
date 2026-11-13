/**
 * Card post viewer (src/components/CardViewer.astro). The server already rendered the right slide
 * and working links; this makes them instant and adds:
 *  - arrow keys in the reading direction (Arabic: ← next, → back), Home / End, swipe on touch;
 *  - `#N` deep links (the server reads `?slide=N`), kept in the address bar as the reader moves;
 *  - neighbour preloading (the next two and the previous slide load before they are reached);
 *  - Enlarge: a modal <dialog> (focus stays inside, Esc closes) where the same navigation works;
 *    closing lands on the slide the reader got to, with focus back on its Enlarge button;
 *  - a live region that says "Card 3 of 8" on every move; no animation under reduced motion.
 */
import { clampSlide, keyStep, neighbours, slideFromLink, stripIndex, stripOffset, swipeStep } from '../lib/cards';

const fill = (s: string, v: Record<string, number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function viewerDir(el: Element): 'ltr' | 'rtl' {
  return getComputedStyle(el).direction === 'rtl' ? 'rtl' : 'ltr';
}

function eager(slide: Element | undefined) {
  slide?.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
}

/** Follows a touch from down to up; reports a horizontal swipe (vertical moves scroll the page). */
function onSwipe(el: HTMLElement, dir: () => 'ltr' | 'rtl', go: (step: number) => void) {
  let start: { x: number; y: number; id: number } | null = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  el.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const step = swipeStep(e.clientX - start.x, e.clientY - start.y, dir());
    start = null;
    if (step) go(step);
  });
  el.addEventListener('pointercancel', () => (start = null));
}

function initViewer(root: HTMLElement) {
  const slides = [...root.querySelectorAll<HTMLElement>('.cv-slide')];
  const count = slides.length;
  if (!count) return;
  const t = root.dataset;
  const pos = root.querySelector<HTMLElement>('[data-pos]');
  const live = root.querySelector<HTMLElement>('[data-live]');
  const back = root.querySelector<HTMLAnchorElement>('.cv-back');
  const next = root.querySelector<HTMLAnchorElement>('.cv-next');
  const dots = [...root.querySelectorAll<HTMLAnchorElement>('[data-go]')];
  let current = Number(root.dataset.initial) || 0;
  let lightbox: ReturnType<typeof buildLightbox> | null = null;

  const linkFor = (i: number) => (i <= 0 ? location.pathname : `${location.pathname}?slide=${i + 1}`);
  const setStep = (a: HTMLAnchorElement | null, target: number, disabled: boolean) => {
    if (!a) return;
    a.href = linkFor(target);
    if (disabled) {
      a.setAttribute('aria-disabled', 'true');
      a.tabIndex = -1;
    } else {
      a.removeAttribute('aria-disabled');
      a.removeAttribute('tabindex');
    }
  };

  function show(i: number, opts: { announce?: boolean; focus?: 'keep' | 'none' } = {}) {
    const target = clampSlide(i, count);
    const from = current;
    if (target !== from) {
      slides[from]!.hidden = true;
      const el = slides[target]!;
      el.hidden = false;
      if (!reduced()) {
        el.classList.remove('cv-in-fwd', 'cv-in-back');
        void el.offsetWidth; // restart the entrance animation
        el.classList.add(target > from ? 'cv-in-fwd' : 'cv-in-back');
      }
    }
    current = target;
    for (const n of neighbours(target, count)) eager(slides[n]);
    const vars = { n: target + 1, total: count };
    if (pos) pos.textContent = fill(t.tPosition ?? '{n} / {total}', vars);
    if (live && opts.announce !== false) live.textContent = fill(t.tPositionLong ?? '{n} / {total}', vars);
    setStep(back, target - 1, target === 0);
    setStep(next, target + 1, target === count - 1);
    dots.forEach((d, k) => (k === target ? d.setAttribute('aria-current', 'step') : d.removeAttribute('aria-current')));
    // The address bar follows (shareable, and Back in the browser leaves the post, not each slide).
    if (target !== from) history.replaceState(history.state, '', `${linkFor(target)}${location.hash && /^#\d+$/.test(location.hash) ? '' : location.hash}`);
    lightbox?.sync(target);
  }
  const go = (step: number) => show(current + step);

  // Links become instant (still real links: open in a new tab, copy, no-JS all work).
  root.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-step], a[data-go]');
    if (!a) return;
    e.preventDefault();
    if (a.getAttribute('aria-disabled') === 'true') return;
    if (a.dataset.go !== undefined) show(Number(a.dataset.go));
    else go(Number(a.dataset.step));
  });
  // Arrow keys: when focus is in the viewer, or nowhere in particular (after a click on the card)
  // and this is the page's only viewer. Never while typing or in the dialog.
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || lightbox?.isOpen()) return;
    const active = document.activeElement;
    const inside = !!active && root.contains(active);
    // "Nowhere in particular": <body>, or a container around the viewer (<main> takes focus on click:
    // it is the skip link's target), never a link, button or field elsewhere.
    const idle = (!active || active === document.body || active.contains(root)) && document.querySelectorAll('[data-cards]').length === 1;
    if (!inside && !idle) return;
    if (!inside && (e.key === 'Home' || e.key === 'End')) return; // those scroll the page
    const s = keyStep(e.key, viewerDir(root));
    if (s === null) return;
    e.preventDefault();
    show(s === 'first' ? 0 : s === 'last' ? count - 1 : current + s);
  };
  document.addEventListener('keydown', onKey);
  onSwipe(root.querySelector<HTMLElement>('.cv-stage')!, () => viewerDir(root), go);

  // Enlarge: one button per slide (the server hides them until this script runs).
  const enlargeButtons = slides.map((s) => s.querySelector<HTMLButtonElement>('[data-enlarge]'));
  enlargeButtons.forEach((b) => {
    if (!b) return;
    b.hidden = false;
    b.addEventListener('click', () => {
      lightbox ??= buildLightbox(root, slides, (i) => show(i), () => enlargeButtons[current]?.focus());
      lightbox.open(current);
    });
  });

  // `#3` (fragment links never reach the server) or `?slide=3` on a cached page.
  const linked = slideFromLink(location.search, location.hash, count);
  if (linked !== current) show(linked, { announce: false });
  else for (const n of neighbours(current, count)) eager(slides[n]);
  root.dataset.ready = '';
}

/** The enlarged view: a modal dialog showing the current slide whole, with the same navigation. */
function buildLightbox(root: HTMLElement, slides: HTMLElement[], onMove: (i: number) => void, onClose: () => void) {
  const t = root.dataset;
  const count = slides.length;
  const stageDir = root.querySelector('.cv-stage')?.getAttribute('dir') ?? 'ltr';
  const stageLang = root.querySelector('.cv-stage')?.getAttribute('lang') ?? '';
  const dlg = document.createElement('dialog');
  dlg.className = 'cv-lightbox';
  dlg.setAttribute('aria-label', t.tLightbox ?? '');
  const icon = (d: string) => `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  dlg.innerHTML = [
    `<div class="lb-top"><p class="lb-pos" aria-hidden="true"></p>`,
    `<button type="button" class="lb-btn lb-close">${icon('m3.5 3.5 9 9m0-9-9 9')}</button></div>`,
    `<div class="lb-stage"></div>`,
    `<div class="lb-nav"><button type="button" class="lb-btn lb-back">${icon('M10 3.5 5.5 8l4.5 4.5')}</button>`,
    `<p class="visually-hidden lb-live" aria-live="polite"></p>`,
    `<button type="button" class="lb-btn lb-next">${icon('M6 3.5 10.5 8 6 12.5')}</button></div>`,
  ].join('');
  const close = dlg.querySelector<HTMLButtonElement>('.lb-close')!;
  const back = dlg.querySelector<HTMLButtonElement>('.lb-back')!;
  const next = dlg.querySelector<HTMLButtonElement>('.lb-next')!;
  const stage = dlg.querySelector<HTMLElement>('.lb-stage')!;
  const posEl = dlg.querySelector<HTMLElement>('.lb-pos')!;
  const live = dlg.querySelector<HTMLElement>('.lb-live')!;
  close.setAttribute('aria-label', t.tClose ?? '');
  back.setAttribute('aria-label', t.tBack ?? '');
  next.setAttribute('aria-label', t.tNext ?? '');
  stage.setAttribute('dir', stageDir);
  if (stageLang) stage.setAttribute('lang', stageLang);
  document.body.append(dlg);
  let at = 0;
  let announce = false;

  function render(i: number) {
    at = i;
    const card = slides[i]!.querySelector('.cv-frame')!;
    const fig = document.createElement('figure');
    fig.className = 'lb-card';
    // The same picture, chosen for the whole screen; the same text, still real text.
    const picture = card.querySelector('picture, img')!.cloneNode(true) as HTMLElement;
    picture.querySelectorAll('source, img').forEach((n) => n.setAttribute('sizes', '100vw'));
    picture.querySelectorAll('img').forEach((img) => {
      img.loading = 'eager';
      img.className = 'lb-img';
    });
    if (picture instanceof HTMLImageElement) picture.className = 'lb-img';
    fig.append(picture);
    const text = card.querySelector('.cv-text');
    if (text) fig.append(text.cloneNode(true));
    stage.replaceChildren(fig);
    const vars = { n: i + 1, total: count };
    posEl.textContent = fill(t.tPosition ?? '', vars);
    if (announce) live.textContent = fill(t.tPositionLong ?? '', vars);
    const focused = document.activeElement;
    back.disabled = i === 0;
    next.disabled = i === count - 1;
    // A button that just became disabled drops focus: hand it to the other arrow.
    if ((focused === back && back.disabled) || (focused === next && next.disabled)) (back.disabled ? next : back).focus();
    // Neighbours at full size too, so moving in the enlarged view doesn't wait.
    for (const n of neighbours(i, count)) {
      const src = slides[n]!.querySelector('img');
      if (src?.currentSrc || src?.src) {
        const pre = new Image();
        pre.sizes = '100vw';
        if (src.srcset) pre.srcset = src.srcset;
        pre.src = src.src;
      }
    }
  }
  const move = (step: number) => {
    const i = clampSlide(at + step, count);
    if (i === at) return;
    announce = true;
    onMove(i); // moves the page viewer too; it calls sync(i) back
  };
  back.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  close.addEventListener('click', () => dlg.close());
  dlg.addEventListener('keydown', (e) => {
    // Keep Tab inside (some browsers let a modal's focus reach their own toolbar).
    if (e.key === 'Tab') {
      const stops = [close, back, next].filter((b) => !b.disabled);
      const i = stops.indexOf(document.activeElement as HTMLButtonElement);
      const to = e.shiftKey ? (i <= 0 ? stops.length - 1 : i - 1) : i === stops.length - 1 ? 0 : i + 1;
      e.preventDefault();
      stops[to]?.focus();
      return;
    }
    const s = keyStep(e.key, viewerDir(root));
    if (s === null) return;
    e.preventDefault();
    const target = s === 'first' ? 0 : s === 'last' ? count - 1 : at + s;
    move(target - at);
  });
  // A click on the dark backdrop (outside the card and the buttons) closes, like Esc.
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target === stage) dlg.close();
  });
  onSwipe(stage, () => viewerDir(root), move);
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('lb-open');
    onClose();
  });

  return {
    open(i: number) {
      announce = false;
      render(i);
      document.documentElement.classList.add('lb-open');
      dlg.showModal();
      close.focus();
    },
    sync(i: number) {
      if (dlg.open && i !== at) render(i);
    },
    isOpen: () => dlg.open,
  };
}

/**
 * A card post inside a list (CardViewer `inline`): a scroll-snap strip that already swipes and
 * scrolls without JS. This adds Next/Back buttons, arrow keys in the reading direction and Home/End
 * while focus is in the viewer, the "3 / 8" counter with a polite "Card 3 of 8" announcement, and
 * eager loading of the cards next to the one shown (the rest stay lazy).
 */
/**
 * The home timeline's card deck (CardViewer inline, size timeline: .ci-deck). The server sends the
 * scroll strip; this stacks it: the top card, the next two behind it (data-o 0/1/2), cards already
 * read thrown off (gone), the rest out of the way (hide). Next/Back buttons, arrow keys in the reading
 * direction, Home/End, and a swipe or drag (finger or mouse) move it; the position chip, the segments
 * and the polite "Card 2 of 5" follow. Only the top card is in the accessibility tree and tab order.
 * Reduced motion: the CSS cross-fades instead of throwing.
 */
function initDeck(root: HTMLElement) {
  const track = root.querySelector<HTMLElement>('[data-track]');
  const cards = [...root.querySelectorAll<HTMLElement>('.ci-slide')];
  const count = cards.length;
  if (!track || !count) return;
  const t = root.dataset;
  const total = Number(t.total) || count;
  const pos = root.querySelector<HTMLElement>('[data-ci-pos]');
  const live = root.querySelector<HTMLElement>('[data-ci-live]');
  const back = root.querySelector<HTMLButtonElement>('.ci-back');
  const next = root.querySelector<HTMLButtonElement>('.ci-next');
  const segs = [...root.querySelectorAll<HTMLElement>('[data-ci-seg]')];
  const dirOf = () => viewerDir(track);
  let current = 0;

  function place(announce: boolean) {
    root.style.setProperty('--deck-dir', dirOf() === 'rtl' ? '-1' : '1');
    cards.forEach((card, k) => {
      const o = k - current;
      card.dataset.o = o < 0 ? 'gone' : o > 2 ? 'hide' : String(o);
      const top = o === 0;
      card.toggleAttribute('inert', !top);
      if (top) card.removeAttribute('aria-hidden');
      else card.setAttribute('aria-hidden', 'true');
    });
    const more = current === count - 1 && t.tMore;
    const vars = { n: current + 1, total };
    if (pos) pos.textContent = more ? t.tMore! : fill(t.tPosition ?? '{n} / {total}', vars);
    if (live && announce) live.textContent = more ? t.tMore! : fill(t.tPositionLong ?? '{n} / {total}', vars);
    segs.forEach((seg, n) => seg.classList.toggle('is-on', n === current));
    const focused = document.activeElement;
    if (back) back.disabled = current === 0;
    if (next) next.disabled = current === count - 1;
    if ((focused === back && back?.disabled) || (focused === next && next?.disabled)) (back?.disabled ? next : back)?.focus();
  }
  function go(i: number) {
    const target = clampSlide(i, count);
    if (target === current) return;
    current = target;
    place(true);
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button[data-step]');
    if (b && !b.disabled) go(current + Number(b.dataset.step));
  });
  root.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as Element;
    if (target !== track && !target.closest('.ci-nav')) return;
    const s = keyStep(e.key, dirOf());
    if (s === null) return;
    e.preventDefault();
    go(s === 'first' ? 0 : s === 'last' ? count - 1 : current + s);
  });

  // Drag or swipe the top card: it follows the pointer; let go past a third of its width (or a quick
  // flick) and it is thrown (Next when moved toward the start of the line, Back the other way).
  // A tap (no movement) is left to the overlay toggle below; links on a card (See all) still work.
  let drag: { x: number; y: number; id: number; at: number; card: HTMLElement; dx: number; on: boolean } | null = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as Element).closest('a, button')) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, at: e.timeStamp, card: cards[current]!, dx: 0, on: false };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) {
        if (Math.abs(dy) > 12) drag = null; // a vertical scroll
        return;
      }
      drag.on = true;
      track.setPointerCapture(e.pointerId);
      track.classList.add('is-dragging');
      drag.card.classList.add('is-held');
    }
    drag.dx = dx;
    drag.card.style.transform = reduced() ? '' : `translateX(${dx}px) rotate(${dx / 24}deg)`;
  });
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { card, dx, on, at } = drag;
    drag = null;
    if (!on) return;
    track.classList.remove('is-dragging');
    card.classList.remove('is-held');
    card.style.transform = '';
    const fast = Math.abs(dx) / Math.max(1, e.timeStamp - at) > 0.5;
    if (Math.abs(dx) > track.clientWidth / 3 || (fast && Math.abs(dx) > 30)) {
      const forward = dirOf() === 'rtl' ? dx > 0 : dx < 0;
      go(current + (forward ? 1 : -1));
    }
    draggedAt = performance.now();
  };
  // the click that ends a drag must not follow a link (See all) or toggle the overlay
  let draggedAt = -1e9;
  const justDragged = () => performance.now() - draggedAt < 400;
  track.addEventListener('click', (c) => { if (justDragged()) { c.preventDefault(); c.stopPropagation(); } }, true);
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);

  // On touch, a tap shows or hides the title and pager (as on every bare timeline post).
  let tap: { x: number; y: number } | null = null;
  track.addEventListener('pointerdown', (e) => {
    tap = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
  });
  track.addEventListener('pointerup', (e) => {
    if (!tap || justDragged() || Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) return;
    tap = null;
    root.toggleAttribute('data-open');
  });
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget as Node | null)) root.removeAttribute('data-open');
  });

  place(false);
  root.dataset.ready = '';
}

function initInline(root: HTMLElement) {
  if (root.classList.contains('ci-deck')) return initDeck(root);
  const found = root.querySelector<HTMLElement>('[data-track]');
  const frames = [...root.querySelectorAll<HTMLElement>('.ci-slide')];
  const count = frames.length;
  if (!found || !count) return;
  const track: HTMLElement = found;
  const t = root.dataset;
  const total = Number(t.total) || count;
  // Own hook names: the timeline around this viewer has its own [data-live] (src/scripts/timeline.ts).
  const pos = root.querySelector<HTMLElement>('[data-ci-pos]');
  const live = root.querySelector<HTMLElement>('[data-ci-live]');
  const back = root.querySelector<HTMLButtonElement>('.ci-back');
  const next = root.querySelector<HTMLButtonElement>('.ci-next');
  const segs = [...root.querySelectorAll<HTMLElement>('[data-ci-seg]')];
  let current = -1;
  let announce = false;

  const dirOf = () => viewerDir(track);
  function update(i: number) {
    if (i === current) return;
    current = i;
    // Until the reader moves, only the browser's own lazy loading runs (a list of card posts must not
    // fetch every card up front); the observer below readies the second card once the strip shows.
    if (announce) for (const n of [i, ...neighbours(i, count)]) eager(frames[n]);
    const more = i === count - 1 && t.tMore;
    const vars = { n: i + 1, total };
    if (pos) pos.textContent = more ? t.tMore! : fill(t.tPosition ?? '{n} / {total}', vars);
    if (live && announce) live.textContent = more ? t.tMore! : fill(t.tPositionLong ?? '{n} / {total}', vars);
    const focused = document.activeElement;
    segs.forEach((seg, n) => seg.classList.toggle('is-on', n === i));
    if (back) back.disabled = i === 0;
    if (next) next.disabled = i === count - 1;
    // A button that just became disabled drops focus: keep it in the viewer.
    if ((focused === back && back?.disabled) || (focused === next && next?.disabled)) (back?.disabled ? next : back)?.focus();
  }
  // While a button or key scrolls the strip, the cards passed on the way are not "shown".
  let aim: number | null = null;
  const read = () => {
    const i = stripIndex(track.scrollLeft, track.clientWidth, count);
    if (aim !== null && i !== aim) return;
    aim = null;
    update(i);
  };
  const release = () => {
    aim = null;
    read();
  };
  track.addEventListener('scrollend', release);
  for (const type of ['pointerdown', 'wheel', 'touchstart'] as const) track.addEventListener(type, () => (aim = null), { passive: true });
  function go(i: number) {
    const target = clampSlide(i, count);
    if (target === current) return;
    announce = true;
    aim = target;
    track.scrollTo({ left: stripOffset(target, track.clientWidth, dirOf()), behavior: reduced() ? 'auto' : 'smooth' });
    update(target); // at once (the scroll events follow and agree)
  }

  let frame = 0;
  track.addEventListener(
    'scroll',
    () => {
      announce = true; // a swipe or scroll by the reader
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(read);
    },
    { passive: true },
  );
  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button[data-step]');
    if (b && !b.disabled) go(current + Number(b.dataset.step));
  });
  root.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as Element;
    if (target !== track && !target.closest('.ci-nav')) return;
    const s = keyStep(e.key, dirOf());
    if (s === null) return;
    e.preventDefault();
    go(s === 'first' ? 0 : s === 'last' ? count - 1 : current + s);
  });
  // The width changes on rotation and resize: stay on the same card.
  new ResizeObserver(() => {
    if (current > 0) track.scrollTo({ left: stripOffset(current, track.clientWidth, dirOf()) });
  }).observe(track);
  update(stripIndex(track.scrollLeft, track.clientWidth, count));
  // On screen: the next card loads, so a swipe never lands on a blank frame.
  const seen = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    eager(frames[current + 1]);
    seen.disconnect();
  });
  seen.observe(track);
  root.dataset.ready = '';
}

export function initCards(doc: ParentNode = document) {
  doc.querySelectorAll<HTMLElement>('[data-cards]:not([data-ready])').forEach(initViewer);
  doc.querySelectorAll<HTMLElement>('[data-cards-inline]:not([data-ready])').forEach(initInline);
}
