/**
 * Reference-style diagram specs (style sample 5, the Azure reference architecture conventions):
 * services as icon + label below (no boxes), a dashed platform boundary, thin solid groups with
 * a title and a small caption, solid arrows for traffic, dashed for control, headings for data
 * stores and providers, a cross-cutting bottom row and CI/CD at bottom-left. Logical LTR
 * coordinates; renderers mirror x for Arabic.
 */
import type { IconId } from './icons.ts';

export interface RefService {
  kind: 'service';
  id: string;
  icon: IconId;
  x: number;
  y: number;
  /** up to two lines under the icon */
  name: string[];
}
export interface RefGroup {
  kind: 'group';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  caption?: string;
}
export interface RefBoundary {
  kind: 'boundary';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** the corner the small label+icon sits in */
  corner?: 'br' | 'tr';
}
export interface RefHeading {
  kind: 'heading';
  id: string;
  x: number;
  y: number;
  text: string;
}
export interface RefEdge {
  kind: 'edge';
  id: string;
  from: [number, number];
  to: [number, number];
  via?: [number, number][];
  label?: string;
  /** control/ops arrows are dashed; traffic is solid */
  dashed?: boolean;
  /** flow family drives the pulse colour: cyan requests, gold upload/processing, green responses */
  flow?: 'request' | 'upload' | 'response';
  /** steady stream: marching-light overlay instead of travelling dots */
  stream?: boolean;
  /** numbered hop in a step sequence: the pulse fires in badge order */
  step?: number;
  /** animation duration in ms (default 3200, 900 for steps) */
  durMs?: number;
  labelAt?: [number, number];
  /** put the label beside the line instead of across it */
  beside?: 'above' | 'below' | 'start' | 'end';
}
export type RefShape = RefService | RefGroup | RefBoundary | RefHeading | RefEdge;

export interface RefSpec {
  id: string;
  width: number;
  height: number;
  title: string;
  desc: string;
  shapes: RefShape[];
}

export const refBoxX = (spec: { width: number }, rtl: boolean, x: number, w: number) => (rtl ? spec.width - x - w : x);
export const refPointX = (spec: { width: number }, rtl: boolean, x: number) => (rtl ? spec.width - x : x);

export function refEdgePath(spec: { width: number }, rtl: boolean, e: RefEdge): string {
  const mx = (x: number) => refPointX(spec, rtl, x);
  const pts: [number, number][] = [e.from, ...(e.via ?? []), e.to];
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${mx(x)} ${y}`).join(' ');
}

export function refEdgeLabelAt(e: RefEdge): { x: number; y: number } {
  if (e.labelAt) return { x: e.labelAt[0], y: e.labelAt[1] };
  let best: [number, number, number, number] | undefined;
  let len = -1;
  const pts: [number, number][] = [e.from, ...(e.via ?? []), e.to];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.abs(pts[i]![0] - pts[i - 1]![0]) + Math.abs(pts[i]![1] - pts[i - 1]![1]);
    if (l > len) {
      len = l;
      best = [...pts[i - 1]!, ...pts[i]!];
    }
  }
  const [x1, y1, x2, y2] = best!;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}
