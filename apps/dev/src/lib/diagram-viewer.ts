/**
 * Pure math and SVG cloning helpers for the in-page system design diagram viewer.
 * Kept DOM-free so unit tests can exercise fit, zoom-at-point, pan clamping, pinch,
 * gallery navigation and SVG id rewriting directly.
 */

export interface ViewerDims {
  svgW: number;
  svgH: number;
  stageW: number;
  stageH: number;
  pad?: number;
}

export interface ViewState {
  scale: number;
  tx: number;
  ty: number;
}

export interface Point {
  x: number;
  y: number;
}

const DEFAULT_PAD = 20;
const MAX_FIT_SCALE = 2.5;
const MIN_SCALE_FLOOR = 0.05;
const MAX_SCALE_CEIL = 8;
const PAN_OVERSCROLL = 32;

/** Scale that fits the full diagram inside the stage with comfortable padding. */
export function computeFitScale(
  svgW: number,
  svgH: number,
  stageW: number,
  stageH: number,
  pad = DEFAULT_PAD,
  maxFit = MAX_FIT_SCALE,
): number {
  const safeSvgW = Math.max(1, svgW);
  const safeSvgH = Math.max(1, svgH);
  const availW = Math.max(1, stageW - pad * 2);
  const availH = Math.max(1, stageH - pad * 2);
  return Math.max(MIN_SCALE_FLOOR, Math.min(availW / safeSvgW, availH / safeSvgH, maxFit));
}

/** Allowed [min, max] zoom bounds for a given fit scale. */
export function scaleBounds(fitScale: number): { min: number; max: number } {
  const min = Math.max(MIN_SCALE_FLOOR, Math.min(fitScale * 0.5, 0.25));
  const max = Math.max(fitScale * 6, MAX_SCALE_CEIL);
  return { min, max };
}

/** Clamp a scale factor within the viewer's allowed bounds. */
export function clampScale(scale: number, fitScale: number): number {
  const { min, max } = scaleBounds(fitScale);
  if (!Number.isFinite(scale)) return fitScale;
  return Math.min(max, Math.max(min, scale));
}

/** Clamp pan offsets so the diagram stays centered when smaller than the stage and never leaves view. */
export function clampPan(
  tx: number,
  ty: number,
  scale: number,
  dims: ViewerDims,
): { tx: number; ty: number } {
  const pad = dims.pad ?? DEFAULT_PAD;
  const availW = Math.max(1, dims.stageW - pad * 2);
  const availH = Math.max(1, dims.stageH - pad * 2);
  const renderedW = dims.svgW * scale;
  const renderedH = dims.svgH * scale;
  const maxX = renderedW <= availW ? 0 : (renderedW - availW) / 2 + PAN_OVERSCROLL;
  const maxY = renderedH <= availH ? 0 : (renderedH - availH) / 2 + PAN_OVERSCROLL;
  const clampedX = Math.min(maxX, Math.max(-maxX, Number.isFinite(tx) ? tx : 0));
  const clampedY = Math.min(maxY, Math.max(-maxY, Number.isFinite(ty) ? ty : 0));
  return { tx: clampedX === 0 ? 0 : clampedX, ty: clampedY === 0 ? 0 : clampedY };
}

/** Initial state fitting the diagram centered inside the stage. */
export function fitState(dims: ViewerDims): ViewState {
  const scale = computeFitScale(dims.svgW, dims.svgH, dims.stageW, dims.stageH, dims.pad);
  return { scale, tx: 0, ty: 0 };
}

/** Zoom to `targetScale` while keeping the point `(focalX, focalY)` stationary in stage coordinates. */
export function zoomAtPoint(
  state: ViewState,
  targetScale: number,
  focalX: number,
  focalY: number,
  dims: ViewerDims,
): ViewState {
  const fit = computeFitScale(dims.svgW, dims.svgH, dims.stageW, dims.stageH, dims.pad);
  const nextScale = clampScale(targetScale, fit);
  const safeCur = Math.max(MIN_SCALE_FLOOR, state.scale);
  const ratio = nextScale / safeCur;
  const dx = focalX - dims.stageW / 2;
  const dy = focalY - dims.stageH / 2;
  const rawTx = dx - (dx - state.tx) * ratio;
  const rawTy = dy - (dy - state.ty) * ratio;
  const { tx, ty } = clampPan(rawTx, rawTy, nextScale, dims);
  return { scale: nextScale, tx, ty };
}

/** Pan by a screen delta in pixels, clamped to stage bounds. */
export function panBy(state: ViewState, deltaX: number, deltaY: number, dims: ViewerDims): ViewState {
  const { tx, ty } = clampPan(state.tx + deltaX, state.ty + deltaY, state.scale, dims);
  return { scale: state.scale, tx, ty };
}

/** Distance and midpoint between two touch/pointer coordinates. */
export function pinchMetrics(p1: Point, p2: Point): { dist: number; cx: number; cy: number } {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return {
    dist,
    cx: (p1.x + p2.x) / 2,
    cy: (p1.y + p2.y) / 2,
  };
}

/** Clamped next/previous index in a diagram gallery (never out of [0, total - 1]). */
export function stepIndex(current: number, total: number, delta: -1 | 1): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, current + delta));
}

/**
 * Rewrite internal SVG ids (`id`, `url(#...)`, `href="#..."`, `aria-labelledby`) so a cloned
 * diagram in the viewer never collides with the inline SVG on the page.
 */
export function rewriteSvgIds(svgMarkup: string, prefix = 'an-viewer-'): string {
  return svgMarkup
    .replace(/\bid="([^"]+)"/g, (_m, id: string) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_m, id: string) => `url(#${prefix}${id})`)
    .replace(/\b((?:xlink:)?href)="#([^"]+)"/g, (_m, attr: string, id: string) => `${attr}="#${prefix}${id}"`)
    .replace(/\baria-labelledby="([^"]*)"/g, (_m, ids: string) => {
      const next = ids
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => `${prefix}${id}`)
        .join(' ');
      return `aria-labelledby="${next}"`;
    });
}
