/**
 * Hand-authored inline SVG diagrams (wiki AUN-DEV-SITE: no external images, no Mermaid runtime).
 *
 * A diagram is a list of shapes in logical (LTR) coordinates; the renderer mirrors every x for
 * Arabic (RTL) so the composition flips while text keeps its direction. Boxes are declared by
 * their top-left corner and size; points by their coordinates. All labels are real component
 * names (Latin in both languages) or translated words passed in from i18n — nothing is baked
 * into paths, and colours come from the site's theme tokens through classes in site.css.
 */

export type Tone = 'plain' | 'client' | 'external' | 'store' | 'queue' | 'accent' | 'ai';
/** Small icon drawn at the inline start of a node (see Diagram.astro; strokes take theme tokens). */
export type IconKind =
  | 'person' | 'browser' | 'device' | 'cloud' | 'shield' | 'worker' | 'film' | 'gear' | 'chart' | 'pulse'
  | 'db' | 'kv' | 'bucket' | 'queue' | 'do' | 'globe' | 'book' | 'ai' | 'mail' | 'bell' | 'play' | 'upload' | 'link' | 'lock' | 'container' | 'search';
/** A node's silhouette: box (default), cylinder (databases), pipe (queues). */
export type NodeShape = 'box' | 'cylinder' | 'pipe';
/** Zone tint family: each gets its own header-band tint from the tokens (site.css). */
export type ZoneTone = 'apps' | 'edge' | 'clients' | 'async' | 'data' | 'providers' | 'obs' | 'ai' | 'default';

export interface DiagramNode {
  kind: 'node';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Bold first line (component name; stays Latin in Arabic too). */
  title: string;
  /** Smaller lines under the title. */
  sub?: string[];
  tone?: Tone;
  icon?: IconKind;
  shape?: NodeShape;
}

export interface DiagramZone {
  kind: 'zone';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  tone?: ZoneTone;
}

export interface DiagramEdge {
  kind: 'edge';
  id: string;
  /** Start point (logical LTR). For elbows, `via` holds the intermediate corners, start excluded. */
  from: [number, number];
  to: [number, number];
  /** Corner points between from and to; empty for a straight line. Orthogonal only, please. */
  via?: [number, number][];
  label?: string;
  /** Where the label chip sits; defaults to the middle of the longest segment. */
  labelAt?: [number, number];
  dashed?: boolean;
}

export type DiagramShape = DiagramNode | DiagramZone | DiagramEdge;

export interface DiagramSpec {
  id: string;
  width: number;
  height: number;
  title: string;
  desc: string;
  shapes: DiagramShape[];
}

/** A box's left edge, mirrored in RTL so the box lands symmetrically. */
export const boxX = (spec: { width: number }, rtl: boolean, x: number, w: number): number =>
  rtl ? spec.width - x - w : x;

/** A point's x, mirrored in RTL. */
export const pointX = (spec: { width: number }, rtl: boolean, x: number): number => (rtl ? spec.width - x : x);

/** The path d for an edge: from → via… → to, points mirrored for RTL (order kept, so the head is still at `to`). */
export function edgePath(spec: { width: number }, rtl: boolean, edge: DiagramEdge): string {
  const mx = (x: number) => pointX(spec, rtl, x);
  const points: [number, number][] = [edge.from, ...(edge.via ?? []), edge.to];
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${mx(x)} ${y}`).join(' ');
}

/** Every orthogonal segment of an edge, as pairs of points. */
export function edgeSegments(edge: DiagramEdge): [number, number, number, number][] {
  const points: [number, number][] = [edge.from, ...(edge.via ?? []), edge.to];
  const out: [number, number, number, number][] = [];
  for (let i = 1; i < points.length; i++) out.push([...points[i - 1]!, ...points[i]!]);
  return out;
}

/** Where an edge's label sits by default: the middle of its longest segment. */
export function edgeLabelAt(edge: DiagramEdge): { x: number; y: number } {
  let best: [number, number, number, number] | undefined;
  let len = -1;
  for (const seg of edgeSegments(edge)) {
    const l = Math.abs(seg[2] - seg[0]) + Math.abs(seg[3] - seg[1]);
    if (l > len) {
      len = l;
      best = seg;
    }
  }
  const [x1, y1, x2, y2] = best!;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

/** The chip a label occupies, for collision checks: centred on its anchor. */
export function labelRect(text: string, at: { x: number; y: number }): { x: number; y: number; w: number; h: number } {
  const lines = wrap(text, 22);
  const w = Math.min(190, Math.max(...lines.map((l) => l.length)) * 6.2 + 16);
  const h = lines.length * 13 + 4;
  return { x: at.x - w / 2, y: at.y - h / 2 - 1, w, h };
}

/** Wrap a label into lines of at most `max` characters, on word boundaries. */
export function wrap(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line && `${line} ${w}`.length > max) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}
