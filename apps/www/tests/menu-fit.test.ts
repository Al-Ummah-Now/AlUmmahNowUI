/**
 * packages/render/src/menu-fit.ts (www and the scholar sites), the same functions as AlUmmahNow
 * packages/fanous-tokens/nav/menu-fit.js: a phone account sheet hangs 4px under its `.aun-header` wherever the
 * bar is, and the header search's sheet covers its bar (coverBar), so a banner above the bar is never covered
 * and never pushes a sheet over the bar (AUDIT-2, CMS #154).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { coverBar, fitToViewport } from '../../../packages/render/src/menu-fit';

type Box = { left: number; top: number; width: number; height: number };
const rect = (b: Box) => ({ ...b, right: b.left + b.width, bottom: b.top + b.height, x: b.left, y: b.top });

/** An element at `box` inside a 56px header at `bar.top`; window listeners recorded. */
function stub(box: Box, bar: { top: number }) {
  const style: Record<string, string> = {};
  const listeners: Record<string, Set<() => void>> = {};
  const el = {
    hidden: false,
    isConnected: true,
    getClientRects: () => [box],
    getBoundingClientRect: () => rect(box),
    offsetParent: null,
    closest: (sel: string) => (sel === '.aun-header' ? { getBoundingClientRect: () => rect({ left: 0, top: bar.top, width: 375, height: 56 }) } : null),
    style: {
      removeProperty: (k: string) => delete style[k],
      set translate(v: string) { style.translate = v; },
      set maxInlineSize(v: string) { style['max-inline-size'] = v; },
      set maxBlockSize(v: string) { style['max-block-size'] = v; },
    },
  };
  Object.assign(globalThis, {
    document: { documentElement: { clientWidth: 375 }, body: {} },
    window: {
      innerHeight: 667,
      addEventListener: (type: string, fn: () => void) => (listeners[type] ??= new Set()).add(fn),
      removeEventListener: (type: string, fn: () => void) => listeners[type]?.delete(fn),
    },
    getComputedStyle: () => ({ position: 'fixed' }),
  });
  const fire = (type: string) => listeners[type]?.forEach((fn) => fn());
  return { el: el as unknown as HTMLElement, style, fire, listeners };
}

afterEach(() => {
  for (const k of ['document', 'window', 'getComputedStyle']) delete (globalThis as Record<string, unknown>)[k];
});

describe('a phone account sheet hangs under its header', () => {
  it('moves below a header a banner pushed down, and caps its height from there', () => {
    const { el, style } = stub({ left: 8, top: 60, width: 359, height: 300 }, { top: 40 });
    fitToViewport(el);
    expect(style.translate).toBe('0px 40px');
    const tall = stub({ left: 8, top: 60, width: 359, height: 900 }, { top: 40 });
    fitToViewport(tall.el);
    expect(tall.style['max-block-size']).toBe(`${667 - 8 - 100}px`);
  });

  it('stays where its CSS put it under a header at the top', () => {
    const { el, style } = stub({ left: 8, top: 60, width: 359, height: 300 }, { top: 0 });
    fitToViewport(el);
    expect(style.translate).toBeUndefined();
  });
});

describe('the header search sheet covers its header (coverBar)', () => {
  it('starts where a header under a banner starts, follows it on scroll, and lets go on close', () => {
    const bar = { top: 66 };
    const { el, style, fire, listeners } = stub({ left: 0, top: 0, width: 375, height: 56 }, bar);
    const release = coverBar(el);
    expect(style.translate).toBe('0px 66px');
    bar.top = -10;
    fire('scroll');
    expect(style.translate, 'never above the viewport').toBeUndefined();
    release();
    expect((listeners.scroll?.size ?? 0) + (listeners.resize?.size ?? 0)).toBe(0);
  });
});
