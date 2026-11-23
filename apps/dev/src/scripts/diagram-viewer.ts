/**
 * In-page full-screen viewer for system design diagrams (src/components/ArchFigure.astro).
 * Opens from any figure's "Expand" button or by clicking the diagram itself. Supports fit-to-screen,
 * zoom (buttons, +/- keys, wheel/trackpad pinch, two-finger touch pinch, double-click), drag pan,
 * prev/next navigation, browser Fullscreen API with graceful fallback, focus trapping, RTL controls,
 * and prefers-reduced-motion.
 */
import { fill, formatPercent, pageLang } from '../../../../packages/render/src/format.ts';
import {
  computeFitScale,
  fitState,
  panBy,
  pinchMetrics,
  rewriteSvgIds,
  stepIndex,
  zoomAtPoint,
  type Point,
  type ViewerDims,
  type ViewState,
} from '../lib/diagram-viewer.ts';

interface ViewerLabels {
  expand: string;
  expandDiagram: string;
  viewerLabel: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  fitLabel: string;
  fullscreen: string;
  exitFullscreen: string;
  prev: string;
  next: string;
  close: string;
  closeLabel: string;
  position: string;
  zoomLevel: string;
}

interface DiagramEntry {
  figure: HTMLElement;
  expandBtn: HTMLButtonElement;
  title: string;
}

const DEFAULT_LABELS: ViewerLabels = {
  expand: 'Expand',
  expandDiagram: 'Expand diagram: {title}',
  viewerLabel: 'Diagram viewer',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Fit',
  fitLabel: 'Fit diagram to screen',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  prev: 'Previous diagram',
  next: 'Next diagram',
  close: 'Close',
  closeLabel: 'Close diagram viewer',
  position: '{current} / {total}',
  zoomLevel: 'Zoom: {percent}',
};

const ZOOM_STEP = 1.25;

function readLabels(): ViewerLabels {
  const el = document.querySelector<HTMLElement>('[data-viewer-i18n]');
  if (!el?.dataset.viewerI18n) return DEFAULT_LABELS;
  try {
    return { ...DEFAULT_LABELS, ...(JSON.parse(el.dataset.viewerI18n) as Partial<ViewerLabels>) };
  } catch {
    return DEFAULT_LABELS;
  }
}

function collectDiagrams(): DiagramEntry[] {
  const entries: DiagramEntry[] = [];
  for (const figure of document.querySelectorAll<HTMLElement>('.an-figure')) {
    const expandBtn = figure.querySelector<HTMLButtonElement>('[data-diagram-expand]');
    if (!expandBtn) continue;
    const heading = figure.querySelector('h2')?.textContent?.trim();
    const svgTitle = figure.querySelector('svg.an > title')?.textContent?.trim();
    const title = figure.dataset.diagramTitle?.trim() || heading || svgTitle || '';
    entries.push({ figure, expandBtn, title });
  }
  return entries;
}

function activeSvgIn(figure: HTMLElement): SVGSVGElement | null {
  const svgs = [...figure.querySelectorAll<SVGSVGElement>('svg.an')];
  return svgs.find((s) => getComputedStyle(s).display !== 'none' && s.getBoundingClientRect().width > 0) ?? svgs[0] ?? null;
}

function svgDimensions(svg: SVGSVGElement): { w: number; h: number } {
  const vb = svg.viewBox?.baseVal;
  const w = vb && vb.width > 0 ? vb.width : Number(svg.getAttribute('width')) || 800;
  const h = vb && vb.height > 0 ? vb.height : Number(svg.getAttribute('height')) || 500;
  return { w, h };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function iconMarkup(kind: 'prev' | 'next' | 'zoomIn' | 'zoomOut' | 'fit' | 'fullscreen' | 'exitFullscreen' | 'close'): string {
  const cls = kind === 'prev' || kind === 'next' ? 'an-btn-ic dir-icon' : 'an-btn-ic';
  const common = `class="${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  switch (kind) {
    case 'prev':
      return `<svg ${common}><polyline points="15 18 9 12 15 6"/></svg>`;
    case 'next':
      return `<svg ${common}><polyline points="9 18 15 12 9 6"/></svg>`;
    case 'zoomOut':
      return `<svg ${common}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
    case 'zoomIn':
      return `<svg ${common}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
    case 'fit':
      return `<svg ${common}><path d="M4 8V4h4"/><path d="M20 8V4h-4"/><path d="M4 16v4h4"/><path d="M20 16v4h-4"/></svg>`;
    case 'fullscreen':
      return `<svg ${common}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    case 'exitFullscreen':
      return `<svg ${common}><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    case 'close':
      return `<svg ${common}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  }
}

export function initDiagramViewer() {
  const entries = collectDiagrams();
  if (!entries.length) return;

  const lang = pageLang();
  const labels = readLabels();

  let viewerEl: HTMLElement | null = null;
  let titleEl: HTMLElement;
  let countEl: HTMLElement;
  let stageEl: HTMLElement;
  let canvasEl: HTMLElement;
  let zoomOutBtn: HTMLButtonElement;
  let zoomPctEl: HTMLElement;
  let zoomInBtn: HTMLButtonElement;
  let fitBtn: HTMLButtonElement;
  let prevBtn: HTMLButtonElement;
  let nextBtn: HTMLButtonElement;
  let fsBtn: HTMLButtonElement;
  let closeBtn: HTMLButtonElement;

  let currentIndex = 0;
  let svgW = 800;
  let svgH = 500;
  let state: ViewState = { scale: 1, tx: 0, ty: 0 };
  let isFitted = true;
  let activeVariant = '';
  let hiddenSiblings: { el: Element; hadInert: boolean; prevAriaHidden: string | null }[] = [];

  const pointers = new Map<number, Point>();
  let lastPinchDist = 0;
  let lastPinchMid: Point | null = null;
  let lastSingle: Point | null = null;

  function stageDims(): ViewerDims {
    const rect = stageEl.getBoundingClientRect();
    return {
      svgW,
      svgH,
      stageW: Math.max(1, rect.width),
      stageH: Math.max(1, rect.height),
    };
  }

  function applyTransform() {
    canvasEl.style.transform = `translate3d(calc(-50% + ${state.tx}px), calc(-50% + ${state.ty}px), 0) scale(${state.scale})`;
    const pct = formatPercent(state.scale, lang, { maximumFractionDigits: 0 });
    zoomPctEl.textContent = pct;
    zoomPctEl.setAttribute('aria-label', fill(labels.zoomLevel, { percent: pct }, lang));
  }

  function syncNavButtons() {
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= entries.length - 1;
    countEl.textContent = fill(labels.position, { current: currentIndex + 1, total: entries.length }, lang);
  }

  function syncFullscreenBtn() {
    if (!fsBtn) return;
    const inFs = document.fullscreenElement === viewerEl;
    fsBtn.setAttribute('aria-pressed', inFs ? 'true' : 'false');
    const lbl = inFs ? labels.exitFullscreen : labels.fullscreen;
    fsBtn.setAttribute('aria-label', lbl);
    fsBtn.setAttribute('title', lbl);
    fsBtn.innerHTML = iconMarkup(inFs ? 'exitFullscreen' : 'fullscreen');
  }

  function loadDiagram(index: number) {
    currentIndex = Math.min(entries.length - 1, Math.max(0, index));
    const entry = entries[currentIndex];
    if (!entry) return;
    const svg = activeSvgIn(entry.figure);
    if (!svg) return;

    activeVariant = svg.dataset.variant ?? '';
    const dims0 = svgDimensions(svg);
    svgW = dims0.w;
    svgH = dims0.h;

    titleEl.textContent = entry.title || svg.querySelector(':scope > title')?.textContent?.trim() || labels.viewerLabel;
    canvasEl.innerHTML = rewriteSvgIds(svg.outerHTML, 'an-viewer-');

    const cloned = canvasEl.querySelector<SVGSVGElement>('svg.an');
    if (cloned) {
      // Keep reduced-motion & SMIL animations synced cleanly
      cloned.setAttribute('data-viewer-svg', 'true');
    }

    syncNavButtons();
    const dims = stageDims();
    state = fitState(dims);
    isFitted = true;
    canvasEl.dataset.instant = 'true';
    applyTransform();
    void canvasEl.offsetWidth;
    delete canvasEl.dataset.instant;
  }

  function fitToScreen() {
    state = fitState(stageDims());
    isFitted = true;
    applyTransform();
  }

  function zoomByFactor(factor: number, focalX?: number, focalY?: number) {
    const dims = stageDims();
    const fx = focalX ?? dims.stageW / 2;
    const fy = focalY ?? dims.stageH / 2;
    state = zoomAtPoint(state, state.scale * factor, fx, fy, dims);
    isFitted = false;
    applyTransform();
  }

  function ensureViewer(): HTMLElement {
    if (viewerEl) return viewerEl;

    const root = document.createElement('div');
    root.className = 'an-viewer';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'an-viewer-title');
    root.dataset.diagramViewer = 'true';
    root.hidden = true;

    const canFs = typeof root.requestFullscreen === 'function' && document.fullscreenEnabled !== false;

    root.innerHTML = `
      <div class="an-viewer-bar">
        <div class="an-viewer-meta">
          <h2 id="an-viewer-title" class="an-viewer-title"></h2>
          <span class="an-viewer-count" aria-live="polite"></span>
        </div>
        <div class="an-viewer-controls" role="toolbar" aria-label="${escHtml(labels.viewerLabel)}">
          <div class="an-viewer-group">
            <button type="button" class="an-viewer-btn" data-viewer-prev aria-label="${escHtml(labels.prev)}" title="${escHtml(labels.prev)}">${iconMarkup('prev')}</button>
            <button type="button" class="an-viewer-btn" data-viewer-next aria-label="${escHtml(labels.next)}" title="${escHtml(labels.next)}">${iconMarkup('next')}</button>
          </div>
          <div class="an-viewer-group">
            <button type="button" class="an-viewer-btn" data-viewer-zoom-out aria-label="${escHtml(labels.zoomOut)}" title="${escHtml(labels.zoomOut)}">${iconMarkup('zoomOut')}</button>
            <span class="an-viewer-zoom" data-viewer-zoom-pct aria-live="polite"></span>
            <button type="button" class="an-viewer-btn" data-viewer-zoom-in aria-label="${escHtml(labels.zoomIn)}" title="${escHtml(labels.zoomIn)}">${iconMarkup('zoomIn')}</button>
            <button type="button" class="an-viewer-btn an-viewer-btn-text" data-viewer-fit aria-label="${escHtml(labels.fitLabel)}" title="${escHtml(labels.fitLabel)}">${iconMarkup('fit')}<span>${escHtml(labels.fit)}</span></button>
          </div>
          <div class="an-viewer-group">
            <button type="button" class="an-viewer-btn" data-viewer-fs aria-label="${escHtml(labels.fullscreen)}" title="${escHtml(labels.fullscreen)}" aria-pressed="false"${canFs ? '' : ' hidden'}>${iconMarkup('fullscreen')}</button>
            <button type="button" class="an-viewer-btn an-viewer-close" data-viewer-close aria-label="${escHtml(labels.closeLabel)}" title="${escHtml(labels.closeLabel)}">${iconMarkup('close')}<span>${escHtml(labels.close)}</span></button>
          </div>
        </div>
      </div>
      <div class="an-viewer-stage" data-viewer-stage tabindex="-1">
        <div class="an-viewer-canvas" data-viewer-canvas></div>
      </div>
    `;

    document.body.append(root);
    viewerEl = root;
    titleEl = root.querySelector('#an-viewer-title')!;
    countEl = root.querySelector('.an-viewer-count')!;
    stageEl = root.querySelector('[data-viewer-stage]')!;
    canvasEl = root.querySelector('[data-viewer-canvas]')!;
    prevBtn = root.querySelector('[data-viewer-prev]')!;
    nextBtn = root.querySelector('[data-viewer-next]')!;
    zoomOutBtn = root.querySelector('[data-viewer-zoom-out]')!;
    zoomPctEl = root.querySelector('[data-viewer-zoom-pct]')!;
    zoomInBtn = root.querySelector('[data-viewer-zoom-in]')!;
    fitBtn = root.querySelector('[data-viewer-fit]')!;
    fsBtn = root.querySelector('[data-viewer-fs]')!;
    closeBtn = root.querySelector('[data-viewer-close]')!;

    prevBtn.addEventListener('click', () => loadDiagram(stepIndex(currentIndex, entries.length, -1)));
    nextBtn.addEventListener('click', () => loadDiagram(stepIndex(currentIndex, entries.length, 1)));
    zoomInBtn.addEventListener('click', () => zoomByFactor(ZOOM_STEP));
    zoomOutBtn.addEventListener('click', () => zoomByFactor(1 / ZOOM_STEP));
    fitBtn.addEventListener('click', fitToScreen);
    closeBtn.addEventListener('click', closeViewer);

    fsBtn.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === root) await document.exitFullscreen();
        else if (typeof root.requestFullscreen === 'function') await root.requestFullscreen();
      } catch {
        // Fallback: remain in the in-page full-screen viewer
      }
      syncFullscreenBtn();
    });

    stageEl.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = stageEl.getBoundingClientRect();
        const fx = e.clientX - rect.left;
        const fy = e.clientY - rect.top;
        const sensitivity = e.ctrlKey ? 0.01 : 0.0025;
        const factor = Math.exp(-e.deltaY * sensitivity);
        zoomByFactor(factor, fx, fy);
      },
      { passive: false },
    );

    stageEl.addEventListener('dblclick', (e) => {
      const rect = stageEl.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      const dims = stageDims();
      const fit = computeFitScale(dims.svgW, dims.svgH, dims.stageW, dims.stageH);
      if (Math.abs(state.scale - fit) < 0.03) {
        const target = Math.max(fit * 2, 1.25);
        state = zoomAtPoint(state, target, fx, fy, dims);
        isFitted = false;
        applyTransform();
      } else {
        fitToScreen();
      }
    });

    stageEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stageEl.setPointerCapture?.(e.pointerId);
      if (pointers.size === 1) {
        lastSingle = { x: e.clientX, y: e.clientY };
        lastPinchDist = 0;
        lastPinchMid = null;
        stageEl.dataset.dragging = 'true';
      } else if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()] as [Point, Point];
        const m = pinchMetrics(p1, p2);
        lastPinchDist = m.dist;
        lastPinchMid = { x: m.cx, y: m.cy };
        lastSingle = null;
        delete stageEl.dataset.dragging;
      }
    });

    stageEl.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dims = stageDims();
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()] as [Point, Point];
        const m = pinchMetrics(p1, p2);
        const rect = stageEl.getBoundingClientRect();
        if (lastPinchMid) {
          state = panBy(state, m.cx - lastPinchMid.x, m.cy - lastPinchMid.y, dims);
        }
        if (lastPinchDist > 0 && m.dist > 0) {
          state = zoomAtPoint(state, state.scale * (m.dist / lastPinchDist), m.cx - rect.left, m.cy - rect.top, dims);
          isFitted = false;
        }
        lastPinchDist = m.dist;
        lastPinchMid = { x: m.cx, y: m.cy };
        applyTransform();
      } else if (pointers.size === 1 && lastSingle) {
        const dx = e.clientX - lastSingle.x;
        const dy = e.clientY - lastSingle.y;
        lastSingle = { x: e.clientX, y: e.clientY };
        state = panBy(state, dx, dy, dims);
        isFitted = false;
        applyTransform();
      }
    });

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (stageEl.hasPointerCapture?.(e.pointerId)) {
        try {
          stageEl.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      if (pointers.size === 1) {
        const [only] = [...pointers.values()] as [Point];
        lastSingle = only;
        lastPinchDist = 0;
        lastPinchMid = null;
      } else {
        lastSingle = null;
        lastPinchDist = 0;
        lastPinchMid = null;
        delete stageEl.dataset.dragging;
      }
    };
    stageEl.addEventListener('pointerup', endPointer);
    stageEl.addEventListener('pointercancel', endPointer);

    return root;
  }

  function focusablesInViewer(): HTMLElement[] {
    if (!viewerEl) return [];
    return [
      ...viewerEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([hidden]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el instanceof HTMLElement && !el.hidden && el.offsetParent !== null && el.tabIndex >= 0);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!viewerEl || viewerEl.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeViewer();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = focusablesInViewer();
      if (!focusables.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (!active || active === first || !viewerEl.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !viewerEl.contains(active)) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomByFactor(ZOOM_STEP);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomByFactor(1 / ZOOM_STEP);
    } else if (e.key === '0') {
      e.preventDefault();
      fitToScreen();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const rtl = document.documentElement.dir === 'rtl' || getComputedStyle(viewerEl).direction === 'rtl';
      const delta = (e.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1) as -1 | 1;
      const next = stepIndex(currentIndex, entries.length, delta);
      if (next !== currentIndex) {
        e.preventDefault();
        loadDiagram(next);
      }
    }
  }

  function handleResize() {
    if (!viewerEl || viewerEl.hidden) return;
    const entry = entries[currentIndex];
    if (entry) {
      const svg = activeSvgIn(entry.figure);
      if (svg && (svg.dataset.variant ?? '') !== activeVariant) {
        loadDiagram(currentIndex);
        return;
      }
    }
    if (isFitted) fitToScreen();
    else {
      const dims = stageDims();
      const { tx, ty } = panBy(state, 0, 0, dims);
      state = { ...state, tx, ty };
      applyTransform();
    }
  }

  function handleFullscreenChange() {
    if (!viewerEl || viewerEl.hidden) return;
    syncFullscreenBtn();
    requestAnimationFrame(() => handleResize());
  }

  function openViewer(index: number) {
    const root = ensureViewer();
    hiddenSiblings = [];
    for (const child of document.body.children) {
      if (child === root) continue;
      hiddenSiblings.push({
        el: child,
        hadInert: child.hasAttribute('inert'),
        prevAriaHidden: child.getAttribute('aria-hidden'),
      });
      child.setAttribute('inert', '');
      child.setAttribute('aria-hidden', 'true');
    }

    root.hidden = false;
    document.documentElement.classList.add('an-viewer-open');
    loadDiagram(index);
    syncFullscreenBtn();
    requestAnimationFrame(() => {
      if (!viewerEl || viewerEl.hidden) return;
      if (isFitted) fitToScreen();
      closeBtn.focus();
    });
  }

  function closeViewer() {
    if (!viewerEl || viewerEl.hidden) return;
    if (document.fullscreenElement === viewerEl) {
      document.exitFullscreen().catch(() => {});
    }
    viewerEl.hidden = true;
    document.documentElement.classList.remove('an-viewer-open');
    for (const item of hiddenSiblings) {
      if (!item.hadInert) item.el.removeAttribute('inert');
      if (item.prevAriaHidden === null) item.el.removeAttribute('aria-hidden');
      else item.el.setAttribute('aria-hidden', item.prevAriaHidden);
    }
    hiddenSiblings = [];

    const entry = entries[currentIndex];
    if (entry) {
      entry.expandBtn.scrollIntoView({ block: 'nearest' });
      entry.expandBtn.focus();
    }
  }

  entries.forEach((entry, index) => {
    entry.expandBtn.addEventListener('click', () => openViewer(index));
    for (const surface of entry.figure.querySelectorAll<HTMLElement>('.an-diagram-surface')) {
      surface.addEventListener('click', (e) => {
        if ((e.target as Element | null)?.closest('a, button, input, label')) return;
        openViewer(index);
      });
    }
  });

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  window.addEventListener('resize', handleResize);
}

initDiagramViewer();
