import { describe, expect, it } from 'vitest';
import {
  clampPan,
  clampScale,
  computeFitScale,
  fitState,
  panBy,
  pinchMetrics,
  rewriteSvgIds,
  scaleBounds,
  stepIndex,
  zoomAtPoint,
} from '../src/lib/diagram-viewer';

describe('diagram viewer math and helpers', () => {
  it('computes fit scale within stage padding and maxFit cap', () => {
    expect(computeFitScale(1000, 500, 540, 540, 20)).toBeCloseTo(0.5);
    expect(computeFitScale(500, 1000, 540, 540, 20)).toBeCloseTo(0.5);
    expect(computeFitScale(200, 100, 1400, 900, 20, 2.5)).toBe(2.5);
    expect(computeFitScale(0, 0, 100, 100)).toBeGreaterThanOrEqual(0.05);
  });

  it('clamps scale within computed bounds', () => {
    const fit = 0.5;
    const { min, max } = scaleBounds(fit);
    expect(clampScale(0.01, fit)).toBe(min);
    expect(clampScale(50, fit)).toBe(max);
    expect(clampScale(Number.NaN, fit)).toBe(fit);
    expect(clampScale(1.5, fit)).toBe(1.5);
  });

  it('keeps diagram centered at fit and clamps pan when zoomed', () => {
    const dims = { svgW: 1000, svgH: 600, stageW: 800, stageH: 600, pad: 20 };
    const fit = fitState(dims);
    expect(fit.tx).toBe(0);
    expect(fit.ty).toBe(0);
    // At fit, diagram fits inside stage, so pan stays centered at 0
    expect(panBy(fit, 100, -100, dims)).toEqual({ scale: fit.scale, tx: 0, ty: 0 });

    // Zoomed in 2x: rendered is 2000x1200 in 760x560 usable area
    const zoomed = { scale: 2, tx: 0, ty: 0 };
    const panned = panBy(zoomed, 5000, -5000, dims);
    expect(panned.tx).toBe((2000 - 760) / 2 + 32);
    expect(panned.ty).toBe(-((1200 - 560) / 2 + 32));
    expect(clampPan(10, -10, 2, dims)).toEqual({ tx: 10, ty: -10 });
  });

  it('zooms around a focal point keeping the underlying coordinate stationary', () => {
    const dims = { svgW: 1000, svgH: 600, stageW: 1040, stageH: 640, pad: 20 };
    const start = fitState(dims); // scale = 1, tx = 0, ty = 0
    expect(start.scale).toBeCloseTo(1);
    const focalX = dims.stageW / 2 + 100;
    const focalY = dims.stageH / 2 - 50;
    const next = zoomAtPoint(start, 2, focalX, focalY, dims);
    expect(next.scale).toBe(2);
    // With focal offset (+100, -50) from center and 1x -> 2x, pan shifts by (-100, +50)
    expect(next.tx).toBeCloseTo(-100);
    expect(next.ty).toBeCloseTo(50);
  });

  it('computes pinch distance and midpoint', () => {
    const m = pinchMetrics({ x: 10, y: 20 }, { x: 40, y: 60 });
    expect(m.dist).toBeCloseTo(50);
    expect(m.cx).toBe(25);
    expect(m.cy).toBe(40);
  });

  it('steps gallery index within bounds', () => {
    expect(stepIndex(0, 5, -1)).toBe(0);
    expect(stepIndex(0, 5, 1)).toBe(1);
    expect(stepIndex(4, 5, 1)).toBe(4);
    expect(stepIndex(2, 5, -1)).toBe(1);
    expect(stepIndex(0, 0, 1)).toBe(0);
  });

  it('rewrites internal SVG ids and references to avoid DOM collisions', () => {
    const raw =
      '<svg aria-labelledby="g-t g-d"><title id="g-t">T</title><desc id="g-d">D</desc><defs><marker id="mk-1"/></defs><path id="e1" marker-end="url(#mk-1)"/><use href="#ic-1"/><mpath xlink:href="#e1"/></svg>';
    const out = rewriteSvgIds(raw, 'v-');
    expect(out).toContain('aria-labelledby="v-g-t v-g-d"');
    expect(out).toContain('<title id="v-g-t">');
    expect(out).toContain('<marker id="v-mk-1"/>');
    expect(out).toContain('marker-end="url(#v-mk-1)"');
    expect(out).toContain('<use href="#v-ic-1"/>');
    expect(out).toContain('<mpath xlink:href="#v-e1"/>');
  });
});
