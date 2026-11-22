/**
 * Hand-drawn explainers (style sample 1): rough double-stroked boxes with a highlighter fill,
 * handwritten type (Kalam; Aref Ruqaa, the everyday Arabic hand, for Arabic), wobbly arrows, and a
 * cloud with "observability surrounds everything" written up its side. Strokes come from a seeded
 * generator, so every build draws the same sketch. Official icons stay crisp and unmodified.
 */
import type { diagramsEn } from '../../i18n/diagrams.en.ts';
import { r, symbol, useIcon } from './icons.ts';
import { bindPhrases, esc, hasArabic, textWidth } from './text.ts';

type Copy = typeof diagramsEn.sketch;

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

class Pen {
  private rand: () => number;
  constructor(seed: string) {
    this.rand = rng(seed);
  }
  j(n: number) {
    return (this.rand() * 2 - 1) * n;
  }
  /** one wobbly stroke from a to b */
  line(x1: number, y1: number, x2: number, y2: number, bow = 1): string {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / (len || 1);
    const ny = (x2 - x1) / (len || 1);
    const off = this.j(Math.min(4, len * 0.02)) * bow;
    const t = 0.45 + this.rand() * 0.1;
    const mx = x1 + (x2 - x1) * t + nx * off;
    const my = y1 + (y2 - y1) * t + ny * off;
    return `M${r(x1 + this.j(1.4))} ${r(y1 + this.j(1.4))} Q${r(mx)} ${r(my)} ${r(x2 + this.j(1.4))} ${r(y2 + this.j(1.4))}`;
  }
  /** a box drawn twice, corners overshooting a little, as a pen does */
  rect(x: number, y: number, w: number, h: number): string {
    const o = 3;
    const out: string[] = [];
    for (let k = 0; k < 2; k++)
      out.push(this.line(x - o * this.rand(), y, x + w + o * this.rand(), y), this.line(x + w, y - o * this.rand(), x + w, y + h + o * this.rand()), this.line(x + w + o * this.rand(), y + h, x - o * this.rand(), y + h), this.line(x, y + h + o * this.rand(), x, y - o * this.rand()));
    return out.join(' ');
  }
  /** a highlighter swipe behind a box */
  marker(x: number, y: number, w: number, h: number): string {
    const p: [number, number][] = [
      [x + 5 + this.j(3), y + 5 + this.j(3)],
      [x + w + 4 + this.j(3), y + 4 + this.j(3)],
      [x + w + 5 + this.j(3), y + h + 4 + this.j(3)],
      [x + 4 + this.j(3), y + h + 5 + this.j(3)],
    ];
    return `M${p.map(([a, b]) => `${r(a)} ${r(b)}`).join(' L')} Z`;
  }
  /** arrow along a gentle curve through an optional control point (two: a cubic); returns the shaft and the head */
  arrow(x1: number, y1: number, x2: number, y2: number, ctrl?: [number, number], ctrl2?: [number, number]): { shaft: string; head: string } {
    const c1 = ctrl ?? [(x1 + x2) / 2 + this.j(6), (y1 + y2) / 2 + this.j(6)];
    // the head points along the curve's last tangent: from the last control point
    const [cx, cy] = ctrl2 ?? c1;
    const shaft = ctrl2 ? `M${r(x1)} ${r(y1)} C${r(c1[0])} ${r(c1[1])} ${r(cx)} ${r(cy)} ${r(x2)} ${r(y2)}` : `M${r(x1)} ${r(y1)} Q${r(cx)} ${r(cy)} ${r(x2)} ${r(y2)}`;
    const a = Math.atan2(y2 - cy, x2 - cx);
    const L = 11;
    const head = [0.48, -0.48].map((d) => `M${r(x2)} ${r(y2)} L${r(x2 - Math.cos(a + d) * L + this.j(0.8))} ${r(y2 - Math.sin(a + d) * L + this.j(0.8))}`).join(' ');
    return { shaft, head };
  }
  /** a bumpy cloud around a rectangle */
  cloud(x: number, y: number, w: number, h: number): string {
    const pts: [number, number][] = [];
    const step = 74;
    const per = (n: number) => Math.max(2, Math.round(n / step));
    const nx = per(w);
    const ny = per(h);
    for (let i = 0; i < nx; i++) pts.push([x + (w * i) / nx, y]);
    for (let i = 0; i < ny; i++) pts.push([x + w, y + (h * i) / ny]);
    for (let i = 0; i < nx; i++) pts.push([x + w - (w * i) / nx, y + h]);
    for (let i = 0; i < ny; i++) pts.push([x, y + h - (h * i) / ny]);
    const cx = x + w / 2;
    const cy = y + h / 2;
    let d = `M${r(pts[0]![0])} ${r(pts[0]![1])}`;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const mx = (a[0]! + b[0]!) / 2;
      const my = (a[1]! + b[1]!) / 2;
      const vx = mx - cx;
      const vy = my - cy;
      const vl = Math.hypot(vx, vy) || 1;
      const bump = 20 + this.j(5);
      d += ` Q${r(mx + (vx / vl) * bump)} ${r(my + (vy / vl) * bump)} ${r(b[0]! + this.j(1.5))} ${r(b[1]! + this.j(1.5))}`;
    }
    return d;
  }
}

export type Tone = 'yellow' | 'blue' | 'orange' | 'green' | 'pink';
export interface SketchNode {
  id: string;
  icon: string;
  title: string;
  note?: string;
  tone: Tone;
  /** grid cell (column, row); fractions allowed */
  at: [number, number];
}
export interface SketchEdge {
  from: string;
  to: string;
  fromSide?: 'n' | 'e' | 's' | 'w';
  toSide?: 'n' | 'e' | 's' | 'w';
  /** sideways bow of the curve, px (positive bows to the right of travel) */
  bend?: number;
  dashed?: boolean;
  tag?: string;
  tone?: Tone;
  /** moves the tag along the curve (0–1, default 0.5) */
  tagAt?: number;
  /** the tag tilts along a slanted stretch even where a level spot is near: both languages draw it the same way */
  tagTilt?: boolean;
  /** a U through a lane this far out from the start side (a phone fan-out): out sideways, along the lane, and in;
   * wires sharing a start nest, the widest lane on the outermost port */
  lane?: number;
  /** a relation, not a flow ("neither grants the other"): no arrowhead */
  noHead?: boolean;
}
export interface SketchSpec {
  id: string;
  title: string;
  desc: string;
  /** the handwritten heading inside the drawing */
  heading: string;
  /** written up the cloud's side; omit for no cloud */
  around?: string;
  nodes: SketchNode[];
  edges: SketchEdge[];
  /** a row of icons along the bottom (metrics, logs…); edges may point at them by id */
  foot?: { id: string; icon: string; title: string }[];
}
export interface SketchLayout {
  colW: number;
  rowH: number;
  nodeW: number;
  cols: number;
  at?: Record<string, [number, number]>;
  /** extra room above the icon row along the bottom, for long curves */
  footGap?: number;
  /** extra room above the first row (an arc over the top row carries its tag there) */
  topGap?: number;
  /** wires for this width (a phone column needs different ones) */
  edges?: SketchEdge[];
  /** a phone sketch's tiles narrowed and moved off-centre by this much (drawn px), so its side lanes stay inside the cloud */
  shiftX?: number;
}

const NODE_H = 124;
const NAME_LH = 24;
const NOTE_LH = 19;

/** wrapped lines as tspans of one text (one block of words, not stacked texts) */
function lines(ls: string[], x: number, y: number, lh: number, style: (l: string) => string = () => ''): string {
  return ls.map((l, k) => `<tspan x="${Math.round(x * 10) / 10}" y="${Math.round((y + k * lh) * 10) / 10}"${style(l)}>${esc(l)}</tspan>`).join('');
}

/** greedy word wrap at a width (a single word wider than the width keeps its own line) */
function greedy(words: string[], size: number, bold: boolean, room: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && textWidth(next, size, bold) > room) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Word wrap to a width with balanced lines: as few lines as the greedy wrap needs, at the narrowest width that still
 * gives that many, so the last line is never one lone word. A value («١ من ٢٠», «٩٠ يومًا», "can(role, capability)")
 * never splits (bindPhrases).
 */
function wrapTo(text0: string, size: number, bold: boolean, room: number): string[] {
  const text = bindPhrases(text0);
  if (textWidth(text, size, bold) <= room) return [text];
  const words = text.split(' ');
  const first = greedy(words, size, bold, room);
  let lo = Math.max(...words.map((w) => textWidth(w, size, bold)));
  let hi = room;
  if (lo >= hi) return first;
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (greedy(words, size, bold, mid).length <= first.length) hi = mid;
    else lo = mid;
  }
  const lines = greedy(words, size, bold, hi);
  // never one lone word on the last line: the word before it comes down too, when that line still fits
  for (let k = lines.length - 1; k > 0; k--) {
    const prev = lines[k - 1]!.split(' ');
    if (lines[k]!.includes(' ') || prev.length < 2) break;
    const moved = `${prev[prev.length - 1]} ${lines[k]}`;
    if (textWidth(moved, size, bold) > room) break;
    lines[k - 1] = prev.slice(0, -1).join(' ');
    lines[k] = moved;
  }
  // a list that wraps stacks its items: no «·» left hanging at a line's end
  return lines.map((l, k) => (k < lines.length - 1 ? l.replace(/[\s\u00a0]+[·•]$/, '') : l));
}

/**
 * `extra` widens the margins (screen left and right) so every curve stays inside the cloud: the first pass
 * measures how far the curves bow out and, when one would run along the outline, draws again with the room.
 */
/** A tag with no room beside its curve: which drawn side its curve bows to (a margin), or none (a wire down the middle). */
class TagRoom extends Error {
  constructor(msg: string, readonly side: 'l' | 'r' | null) {
    super(msg);
  }
}

/**
 * A sketch whose tag finds no room beside its curve is drawn again with more room: taller rows (more gap between
 * the notes) first, then, for a curve bowing out through a margin, that margin widened.
 */
export function renderSketchSpec(spec0: SketchSpec, layout: SketchLayout, opts: { rtl: boolean; variant: string }, extra = { l: 0, r: 0 }): string {
  let grow = 0;
  const wide = { ...extra };
  for (let tries = 0; ; tries++) {
    try {
      return renderSketchSpecOnce(spec0, { ...layout, rowH: layout.rowH + grow }, opts, wide);
    } catch (err) {
      if (!(err instanceof TagRoom) || tries >= 14) throw err;
      // taller rows first (a tag then fits in a gap between notes, inside the column: the figure stays phone-width),
      // a wider margin only when that is not enough
      // (a phone sketch keeps its 380 px: it only grows taller, unless nothing else gives the tag room)
      if (grow < (opts.variant === 'narrow' ? 192 : 96) || !err.side) grow += 24;
      else wide[err.side] += 40;
    }
  }
}

/** a phone sketch fits the phone's figure box (the hero's 367 px fits it too): one column, narrow margins, the side note under the heading */
const PHONE_W = 366;

function renderSketchSpecOnce(spec0: SketchSpec, layout0: SketchLayout, opts: { rtl: boolean; variant: string }, extra = { l: 0, r: 0 }): string {
  const phone = opts.variant === 'narrow';
  // a phone column: 40 px margins (the cloud 20 px in), tiles 64 px narrower than the column so a side lane's U
  // (up to ~43 px out) stays inside the cloud
  // (two phone columns sit side by side with a 10 px gap)
  const pcol = (PHONE_W - 80) / layout0.cols;
  const layout = phone ? { ...layout0, colW: pcol, nodeW: Math.min(layout0.nodeW, pcol - (layout0.cols === 1 ? 64 : 10)) } : layout0;
  // a layout's own wires (a phone column re-routes them) keep each wire's words, colour and dash from the spec:
  // a phone figure says what the wide one says
  const inherit = (e: SketchEdge): SketchEdge => {
    const base = spec0.edges.find((s) => s.from === e.from && s.to === e.to);
    return base ? { tag: base.tag, tone: base.tone, dashed: base.dashed, noHead: base.noHead, ...e } : e;
  };
  const spec = layout.edges ? { ...spec0, edges: layout.edges.map(inherit) } : spec0;
  const prefix = `${spec.id}-${opts.variant}`;
  const pen = new Pen(prefix);
  const side = 22; // the margin the rotated side note lives in (on a phone it is a line under the heading instead)
  const mx = phone ? 40 : 64 + (spec.around ? side : 0);
  // margins in drawing order (before the Arabic mirror): A is the start side, B the end side
  const mxA = mx + (opts.rtl ? extra.r : extra.l);
  const mxB = mx + (opts.rtl ? extra.l : extra.r);
  // the cloud starts below the handwritten title, with its outward bumps 6 px clear of the title's letters
  // a heading wider than a phone wraps to two lines; a phone's side note is a line under it
  const headLines = (() => {
    const words = spec.heading.split(' ');
    if (!phone || textWidth(spec.heading, 30, true) <= PHONE_W - 40 || words.length < 2) return [spec.heading];
    let best = 1;
    for (let k = 1; k < words.length; k++) if (Math.abs(textWidth(words.slice(0, k).join(' '), 30, true) - textWidth(words.slice(k).join(' '), 30, true)) < Math.abs(textWidth(words.slice(0, best).join(' '), 30, true) - textWidth(words.slice(best).join(' '), 30, true))) best = k;
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  })();
  const sideLines = phone && spec.around ? wrapTo(spec.around, 17, false, PHONE_W - 48) : [];
  const CT = 92 + (headLines.length - 1) * 36 + sideLines.length * 26;
  // a tile's name or note wider than the tile wraps; the tile grows by the extra lines and every row grows by the
  // tallest tile's extra, so the gaps between rows keep their size
  const room = layout.nodeW - 16;
  const tileText = new Map(spec.nodes.map((n) => [n.id, { name: wrapTo(n.title, 19, true, room), note: n.note ? wrapTo(n.note, 15, false, room) : [] }]));
  const tileH = (id: string) => {
    const t = tileText.get(id)!;
    return NODE_H + (t.name.length - 1) * NAME_LH + Math.max(0, t.note.length - 1) * NOTE_LH;
  };
  const rowH = layout.rowH + Math.max(...spec.nodes.map((n) => tileH(n.id))) - NODE_H;
  const top = CT + 22 + (layout.topGap ?? 0);
  const rows = Math.max(...spec.nodes.map((n) => (layout.at?.[n.id] ?? n.at)[1])) + 1;
  const W = Math.round(layout.cols * layout.colW + mxA + mxB);
  const footY = top + rows * rowH + 10 + (layout.footGap ?? 0);
  const Hc = Math.round(footY + (spec.foot?.length ? 142 : 20) + 40);
  const mirror = (x: number) => (opts.rtl ? W - x : x);
  const ar = hasArabic(spec.heading);
  const fam = ar ? 'an-hand-ar' : 'an-hand';
  const box = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const n of spec.nodes) {
    const [c, r0] = layout.at?.[n.id] ?? n.at;
    const x = mxA + c * layout.colW + (layout.colW - layout.nodeW) / 2 + (opts.rtl ? -1 : 1) * (layout.shiftX ?? 0); // shiftX is drawn px; x is laid out before the mirror
    const h = tileH(n.id);
    const y = top + r0 * rowH + (rowH - h) / 2;
    box.set(n.id, { x: opts.rtl ? W - x - layout.nodeW : x, y, w: layout.nodeW, h });
  }
  const foot = spec.foot ?? [];
  const footW = (W - mxA - mxB) / Math.max(1, foot.length);
  // a title wider than its slot wraps to two lines (the hand-drawn face is wide)
  const footLines = new Map<string, string[]>();
  foot.forEach((f, i) => {
    const cx = mxA + footW * (i + 0.5);
    const room = footW - 16;
    const words = f.title.split(' ');
    let lines = [f.title];
    if (textWidth(f.title, 18, true) > room && words.length > 1) {
      const half = Math.ceil(words.length / 2);
      lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
    }
    footLines.set(f.id, lines);
    const tw = Math.max(64, ...lines.map((l) => textWidth(l, 16, true) + 12));
    box.set(f.id, { x: mirror(cx) - tw / 2, y: footY, w: tw, h: 92 + (lines.length - 1) * 30 });
  });
  const anchor = (id: string, sd: 'n' | 'e' | 's' | 'w' | undefined, other: { x: number; y: number; w: number; h: number }): [number, number] => {
    const b = box.get(id)!;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const ox = other.x + other.w / 2;
    const oy = other.y + other.h / 2;
    const s2 = sd ?? (Math.abs(oy - cy) < b.h * 0.6 ? (ox > cx ? 'e' : 'w') : oy > cy ? 's' : 'n');
    const real = opts.rtl && (s2 === 'e' || s2 === 'w') && sd ? (s2 === 'e' ? 'w' : 'e') : s2;
    if (real === 'e') return [b.x + b.w + 8, cy];
    if (real === 'w') return [b.x - 8, cy];
    if (real === 's') return [cx, b.y + b.h + 8];
    return [cx, b.y - 8];
  };

  const icons = [...new Set([...spec.nodes.map((n) => n.icon), ...foot.map((f) => f.icon)])];
  const o: string[] = [];
  o.push(
    `<svg class="an an-sketch" data-diagram="${spec.id}" data-variant="${opts.variant}" viewBox="0 0 ${W} ${Hc}" width="${W}" height="${Hc}" role="img" aria-labelledby="${prefix}-t ${prefix}-d">`,
    `<title id="${prefix}-t">${esc(spec.title)}</title><desc id="${prefix}-d">${esc(spec.desc)}</desc><defs>${icons.map((i) => symbol(prefix, i)).join('')}</defs>`,
    `<rect class="an-canvas an-paper" width="${W}" height="${Hc}" rx="18"/>`,
  );
  if (spec.around && sideLines.length) {
    const cloud0 = pen.cloud(mx - 20, CT, W - 2 * mx + 40, Hc - CT - 28);
    const cloud = opts.rtl ? cloud0.replace(/([MQL ])(-?[\d.]+) (-?[\d.]+)/g, (_m, p, x, y) => `${p}${r(W - Number(x))} ${y}`) : cloud0;
    o.push(`<g class="an-groups"><path class="an-sk-cloud" d="${cloud}"/></g>`);
    o.push(`<text class="an-sk-side ${fam}" text-anchor="middle"${ar ? ' direction="rtl"' : ''}>${lines(sideLines, W / 2, 52 + (headLines.length - 1) * 36 + 34, 22)}</text>`);
  } else if (spec.around) {
    let cloud = pen.cloud(mx - 20, CT, W - 2 * mx + 40, Hc - CT - 28);
    if (opts.rtl) cloud = cloud.replace(/([MQL ])(-?[\d.]+) (-?[\d.]+)/g, (_m, p, x, y) => `${p}${r(W - Number(x))} ${y}`);
    o.push(`<g class="an-groups"><path class="an-sk-cloud" d="${cloud}"/></g>`);
    // the side note sits 12 px or more inside the drawing's edge (a scroll box opens on it)
    const sx = opts.rtl ? W - side - 12 : side + 12;
    const sy = (CT + Hc - 28) / 2;
    o.push(`<text class="an-sk-side ${fam}" x="${sx}" y="${r(sy)}" text-anchor="middle" transform="rotate(${opts.rtl ? 90 : -90} ${sx} ${r(sy)})"${ar ? ' direction="rtl"' : ''}>${esc(spec.around)}</text>`);
  }
  o.push(`<g data-node-label="heading"><text class="an-sk-title ${fam}" text-anchor="middle"${ar ? ' direction="rtl"' : ''}>${lines(headLines, W / 2, 52, 36)}</text></g>`);

  // first every curve, so tags can be placed clear of all of them
  // a laned edge is a U (`u`: out to its lane, along it, back in, round corners) so a fan's wires keep one spacing
  // all the way; `uPath` is how it is drawn and `u` the same line sampled densely
  type Curve = { e: SketchEdge; i: number; a: [number, number]; ctrl: [number, number]; ctrl2?: [number, number]; b: [number, number]; u?: [number, number][]; uPath?: string; uIn?: [number, number] };
  const curves: Curve[] = spec.edges.map((e, i) => {
    const bf = box.get(e.from)!;
    const bt = box.get(e.to)!;
    const a = anchor(e.from, e.fromSide, bt);
    const b = anchor(e.to, e.toSide, bf);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const bend = (e.bend ?? 0) * (opts.rtl ? -1 : 1);
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    return { e, i, a, b, ctrl: [(a[0] + b[0]) / 2 + nx * bend, (a[1] + b[1]) / 2 + ny * bend] };
  });
  // a laned U: both control points on the lane line, level with each end (the curve's widest point is 3/4 of the way)
  const laneOf = (c: Curve) => {
    const bf = box.get(c.e.from)!;
    const dir = c.a[0] < bf.x + bf.w / 2 ? -1 : 1;
    return dir * (c.e.lane ?? 0) / 0.75;
  };
  // two curves meeting at one point of a tile's side read as one line: spread them 12 px apart along the side
  {
    const ends = curves.flatMap((c) => [
      { c, k: 'a' as const, id: c.e.from },
      { c, k: 'b' as const, id: c.e.to },
    ]);
    const seen = new Set<object>();
    for (const x of ends) {
      if (seen.has(x)) continue;
      const group = ends.filter((y) => !seen.has(y) && y.id === x.id && Math.hypot(y.c[y.k][0] - x.c[x.k][0], y.c[y.k][1] - x.c[x.k][1]) < 8);
      group.forEach((y) => seen.add(y));
      if (group.length < 2) continue;
      const bx = box.get(x.id)!;
      const p = x.c[x.k];
      // the side the point is on: along a vertical side spread in y, along a horizontal one in x
      const vertical = Math.abs(p[0] - bx.x) < 10 || Math.abs(p[0] - (bx.x + bx.w)) < 10;
      // laned wires meeting at one point nest without crossing: along the side, first those whose other end is
      // above (innermost lane first), then those whose other end is below (outermost lane first)
      if (vertical && group.every((y) => y.c.e.lane != null)) {
        const up = (y: (typeof group)[number]) => (y.k === 'a' ? y.c.b : y.c.a)[1] < p[1];
        const key = (y: (typeof group)[number]) => (up(y) ? -1e4 + y.c.e.lane! : 1e4 - y.c.e.lane!);
        group.sort((u, v) => key(u) - key(v));
      } else if (vertical && group.every((y) => y.c.e.fromSide === y.c.e.toSide)) {
        // bows out of this side and back into the same side elsewhere nest the same way: the one reaching farthest
        // starts farthest from where they head, so it bows round the others instead of leaving over the top of them
        const other = (y: (typeof group)[number]) => (y.k === 'a' ? y.c.b : y.c.a)[1];
        const key = (y: (typeof group)[number]) => (other(y) < p[1] ? -1e4 - other(y) : 1e4 - other(y));
        group.sort((u, v) => key(u) - key(v));
      } else {
        // the rest in the order their other ends lie along the side, so no two cross at the tile (the Arabic mirror
        // reverses where the sources sit, not the list order)
        const far = (y: (typeof group)[number]) => (y.k === 'a' ? y.c.b : y.c.a)[vertical ? 1 : 0];
        group.sort((u, v) => far(u) - far(v));
      }
      // (two arrowheads side by side sit 28 px apart: closer, their 11 px barbs, slanted in from a lane, read as one
      // pile; a head beside a plain start 18 px, two starts 12 px, two laned starts 16 px, as a fan stays 12 px apart
      // out to its lanes)
      const laned = group.every((y) => y.c.e.lane != null);
      // (two bows leaving one side head out at nearly the same angle: 24 px apart, or they run as one line for a while)
      const bows = !laned && vertical && group.every((y) => y.c.e.fromSide === y.c.e.toSide);
      const steps: number[] = group.map((y, j) => (j === 0 ? 0 : y.k === 'b' && group[j - 1]!.k === 'b' ? 28 : bows ? 24 : y.k === 'b' || group[j - 1]!.k === 'b' ? 18 : laned ? 16 : 12));
      const pos = steps.map((_, j) => steps.slice(0, j + 1).reduce((t, v) => t + v, 0));
      const mid = pos[pos.length - 1]! / 2;
      group.forEach((y, j) => {
        const off = pos[j]! - mid;
        const q = y.c[y.k];
        y.c[y.k] = vertical ? [q[0], q[1] + off] : [q[0] + off, q[1]];
      });
    }
  }
  // the lane's U, once the ends have been spread
  const r1 = r;
  for (const c of curves) {
    if (c.e.lane == null) continue;
    const d = laneOf(c);
    c.ctrl = [c.a[0] + d, c.a[1]];
    c.ctrl2 = [c.b[0] + d, c.b[1]];
    const dir = Math.sign(d) || 1;
    const lx = c.a[0] + d * 0.75;
    const vs = Math.sign(c.b[1] - c.a[1]) || 1;
    const r = Math.max(2, Math.min(14, Math.abs(d * 0.75) * 0.8, Math.abs(c.b[1] - c.a[1]) / 2));
    const p1: [number, number] = [lx - dir * r, c.a[1]];
    const k1: [number, number] = [lx, c.a[1]];
    const p2: [number, number] = [lx, c.a[1] + vs * r];
    const p3: [number, number] = [lx, c.b[1] - vs * r];
    const k2: [number, number] = [lx, c.b[1]];
    const p4: [number, number] = [c.b[0] + (lx - c.b[0]) - dir * r, c.b[1]];
    const line = (p: [number, number], q: [number, number]) => {
      const n = Math.max(2, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 4));
      return Array.from({ length: n }, (_, k) => [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n] as [number, number]);
    };
    const quad = (p: [number, number], k: [number, number], q: [number, number]) =>
      Array.from({ length: 8 }, (_, j) => {
        const t = j / 8;
        return [(1 - t) * (1 - t) * p[0] + 2 * (1 - t) * t * k[0] + t * t * q[0], (1 - t) * (1 - t) * p[1] + 2 * (1 - t) * t * k[1] + t * t * q[1]] as [number, number];
      });
    c.u = [...line(c.a, p1), ...quad(p1, k1, p2), ...line(p2, p3), ...quad(p3, k2, p4), ...line(p4, c.b), c.b];
    c.uPath = `M${r1(c.a[0])} ${r1(c.a[1])} L${r1(p1[0])} ${r1(p1[1])} Q${r1(k1[0])} ${r1(k1[1])} ${r1(p2[0])} ${r1(p2[1])} L${r1(p3[0])} ${r1(p3[1])} Q${r1(k2[0])} ${r1(k2[1])} ${r1(p4[0])} ${r1(p4[1])} L${r1(c.b[0])} ${r1(c.b[1])}`;
    c.uIn = p4;
  }
  const at = (c: Curve, t: number): [number, number] => {
    if (c.u) {
      const i = Math.min(c.u.length - 1, Math.max(0, t * (c.u.length - 1)));
      const k = Math.floor(i);
      const f = i - k;
      const p = c.u[k]!;
      const q = c.u[Math.min(c.u.length - 1, k + 1)]!;
      return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    }
    const u = 1 - t;
    if (c.ctrl2) return [0, 1].map((k) => u * u * u * c.a[k]! + 3 * u * u * t * c.ctrl[k]! + 3 * u * t * t * c.ctrl2![k]! + t * t * t * c.b[k]!) as [number, number];
    return [u * u * c.a[0] + 2 * u * t * c.ctrl[0] + t * t * c.b[0], u * u * c.a[1] + 2 * u * t * c.ctrl[1] + t * t * c.b[1]];
  };
  const samples = curves.flatMap((c) => Array.from({ length: 61 }, (_, k) => at(c, k / 60)));
  // the cloud keeps the base margin; extra room goes between it and the tiles
  const cloudBox = spec.around ? { x: mx - 20, y: CT, w: W - 2 * mx + 40, h: Hc - CT - 28 } : null;
  if (cloudBox && extra.l === 0 && extra.r === 0) {
    // the outline's bumps bow outward only, so 22 px inside its rectangle keeps a curve clear of it
    const CL = 22;
    const xs = samples.map((p) => p[0]);
    const needL = Math.ceil(Math.max(0, cloudBox.x + CL - Math.min(...xs)));
    const needR = Math.ceil(Math.max(0, Math.max(...xs) - (cloudBox.x + cloudBox.w - CL)));
    // a phone keeps its 380 px: the tiles narrow and step away from the lanes instead (down to 150 px wide)
    if ((needL || needR) && phone && layout.nodeW - needL - needR >= 150)
      return renderSketchSpec(spec0, { ...layout, nodeW: layout.nodeW - needL - needR, shiftX: (layout.shiftX ?? 0) + (needL - needR) / 2 }, opts);
    if (needL || needR) return renderSketchSpec(spec0, layout, opts, { l: needL, r: needR });
  }
  const BAND = 16;
  const cloudBand: { x: number; y: number; w: number; h: number }[] = cloudBox
    ? [
        { x: cloudBox.x - BAND, y: cloudBox.y - BAND, w: cloudBox.w + 2 * BAND, h: 2 * BAND },
        { x: cloudBox.x - BAND, y: cloudBox.y + cloudBox.h - BAND, w: cloudBox.w + 2 * BAND, h: 2 * BAND },
        { x: cloudBox.x - BAND, y: cloudBox.y - BAND, w: 2 * BAND, h: cloudBox.h + 2 * BAND },
        { x: cloudBox.x + cloudBox.w - BAND, y: cloudBox.y - BAND, w: 2 * BAND, h: cloudBox.h + 2 * BAND },
      ]
    : [];
  type Box = { x: number; y: number; w: number; h: number };
  const hits = (q: Box, p: [number, number], pad: number) => p[0] > q.x - pad && p[0] < q.x + q.w + pad && p[1] > q.y - pad && p[1] < q.y + q.h + pad;
  const overlaps = (q: Box, r2: Box, pad: number) => q.x < r2.x + r2.w + pad && r2.x < q.x + q.w + pad && q.y < r2.y + r2.h + pad && r2.y < q.y + q.h + pad;
  const placedTags: Box[] = [];
  const nodeBoxes = [...box.values()];

  const tags: string[] = [];
  // each curve's samples, once: the tag search checks them for every spot it tries
  const curvePts = new Map(curves.map((c) => [c, Array.from({ length: 61 }, (_, k) => at(c, k / 60))] as const));
  const otherPtsOf = new Map(curves.map((c) => [c, curves.filter((x) => x !== c).flatMap((x) => curvePts.get(x)!)] as const));
  const otherPts = (c: (typeof curves)[number]) => otherPtsOf.get(c)!;
  const ownPts = (c: (typeof curves)[number]) => curvePts.get(c)!;
  o.push('<g class="an-edges">');
  curves.forEach((c) => {
    const { e, i, a, b, ctrl, ctrl2 } = c;
    const drawn = pen.arrow(a[0], a[1], b[0], b[1], ctrl, c.uIn ?? ctrl2);
    const shaft = c.uPath ?? drawn.shaft;
    const head = drawn.head;
    o.push(`<path id="${prefix}-e${i}" data-edge="${prefix}-e${i}" data-from="${e.from}" data-to="${e.to}" class="an-edge an-sk-arrow${e.dashed ? ' an-sk-dashed' : ''}"${e.noHead ? ' data-nohead' : ''} d="${shaft}"/>${e.noHead ? '' : `<path class="an-sk-head" d="${head}"/>`}`);
    if (!e.tag) return;
    // a tag sits beside its curve, never on it: try both sides at a few points along it
    const tw = textWidth(e.tag, 15, true) + 18;
    const th = 26;
    let best: Box | null = null;
    // a tag along a slanted stretch is drawn tilted to it, by this many radians (0: level)
    let bestRot = 0;
    // the box's true distance to a set of points (the drawn curve, sampled): a bow curves away from its tangent, so
    // the offset along the normal alone can leave a tag touching the curve or far from it
    const dist = (q: Box, pts: [number, number][]) => Math.min(...pts.map(([x, y]) => Math.hypot(Math.max(q.x - x, 0, x - q.x - q.w), Math.max(q.y - y, 0, y - q.y - q.h))));
    // first 17 to 24 px from its own curve (the pen's outline overshoots the box by about 3) and 12 px from every other
    // one; where a fan leaves no such room, 13 to 24 px from its own and still 12 from the rest, then 8, and only
    // then just clear of them
    // (a tag set to tilt looks along the whole curve for a tilted spot before it settles for a level one)
    for (const tiltOnly of e.tagTilt ? [true, false] : [false])
    for (const [ownMin, otherMin] of [[17, 12], [13, 12], [13, 8], [13, 0]] as const) {
    if (best) break;
    for (const t of [e.tagAt ?? 0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8, 0.15, 0.85, 0.1, 0.9]) {
      const p = at(c, t);
      const q2 = at(c, Math.min(1, t + 0.01));
      const dl = Math.hypot(q2[0] - p[0], q2[1] - p[1]) || 1;
      const n: [number, number] = [-(q2[1] - p[1]) / dl, (q2[0] - p[0]) / dl];
      // along the normal, and straight above or below or to either side: beside a slanted curve a wide tag pushed out
      // along the normal touches the curve only at a corner and reads as detached; of the spots that fit, the one whose
      // middle sits nearest the curve
      const dirs: [number, number][] = [n, [0, Math.sign(n[1]) || 1], [Math.sign(n[0]) || 1, 0]];
      // the mirror turns the curve's normal over: the Arabic figure tries the sides the other way round, so a tag
      // lands on the same side of its curve in both languages
      const side = opts.rtl ? -1 : 1;
      let pick: { q: Box; d: number; rot: number } | null = null;
      for (const dir of dirs)
      for (const [s, gap] of [15, 18, 21, 12, 24, 9, 27, 30, 6, 34].flatMap((g) => [[side, g], [-side, g]]) as [number, number][]) {
        const half = Math.abs(dir[0]) * (tw / 2) + Math.abs(dir[1]) * (th / 2);
        const cx = p[0] + dir[0] * (half + gap) * s;
        const cy = p[1] + dir[1] * (half + gap) * s;
        const q = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
        if (q.x < 8 || q.y < 60 || q.x + q.w > W - 8 || q.y + q.h > Hc - 8) continue;
        const own = dist(q, ownPts(c));
        if (own < ownMin || own > 24) continue;
        if (otherMin && dist(q, otherPts(c)) < otherMin) continue;
        if (samples.some((pt) => hits(q, pt, 5))) continue;
        // never on the cloud's bumpy outline: keep clear of a band around its edges
        if (cloudBand.some((e) => overlaps(q, e, 0))) continue;
        if (nodeBoxes.some((nb) => overlaps(q, { x: nb.x - 4, y: nb.y - 4, w: nb.w + 12, h: nb.h + 12 }, 6)) || placedTags.some((pb) => overlaps(q, pb, 12))) continue;
        const d = Math.min(...ownPts(c).map(([x, y]) => Math.hypot(x - cx, y - cy)));
        if (!tiltOnly && (!pick || d < pick.d - 0.5)) pick = { q, d, rot: 0 };
      }
      // beside a slanted stretch no level spot keeps the tag's middle near the line (it meets the line only at a
      // corner and reads as detached): the tag tilts to the line, as a hand-drawn label would, 16 to 24 px off it
      let rot = Math.atan2(q2[1] - p[1], q2[0] - p[0]);
      if (rot > Math.PI / 2) rot -= Math.PI;
      if (rot < -Math.PI / 2) rot += Math.PI;
      if (Math.abs(rot) > 0.1 && Math.abs(rot) < 1.05 && (!pick || pick.d > th / 2 + 34 || tiltOnly)) {
        const cs = Math.cos(rot);
        const sn = Math.sin(rot);
        for (const [s, gap] of [18, 20, 22, 24].flatMap((g) => [[side, g], [-side, g]]) as [number, number][]) {
          const cx = p[0] + n[0] * (th / 2 + gap) * s;
          const cy = p[1] + n[1] * (th / 2 + gap) * s;
          // distance from a point to the tilted box, in the box's own frame
          const local = (pts: [number, number][]) =>
            Math.min(...pts.map(([x, y]) => Math.hypot(Math.max(Math.abs((x - cx) * cs + (y - cy) * sn) - tw / 2, 0), Math.max(Math.abs(-(x - cx) * sn + (y - cy) * cs) - th / 2, 0))));
          const w2 = tw * Math.abs(cs) + th * Math.abs(sn);
          const h2 = tw * Math.abs(sn) + th * Math.abs(cs);
          const q = { x: cx - w2 / 2, y: cy - h2 / 2, w: w2, h: h2 };
          if (q.x < 8 || q.y < 60 || q.x + q.w > W - 8 || q.y + q.h > Hc - 8) continue;
          const own = local(ownPts(c));
          // (the pen's outline overshoots the box by about 3: 16 keeps the drawn tag 12 or more off its line)
          if (own < 16 || own > 24) continue;
          if (otherMin && local(otherPts(c)) < otherMin) continue;
          if (local(samples) < 5) continue;
          if (cloudBand.some((e) => overlaps(q, e, 0))) continue;
          if (nodeBoxes.some((nb) => overlaps(q, { x: nb.x - 4, y: nb.y - 4, w: nb.w + 12, h: nb.h + 12 }, 6)) || placedTags.some((pb) => overlaps(q, pb, 12))) continue;
          const d = Math.min(...ownPts(c).map(([x, y]) => Math.hypot(x - cx, y - cy)));
          if (!pick || d < pick.d - 0.5) pick = { q, d, rot };
          break;
        }
      }
      if (pick) {
        best = pick.q;
        bestRot = pick.rot;
      }
      if (best) break;
    }
    }
    // no room beside it: on it, an opaque tag over its own curve's middle stretch (as the flat diagrams label a
    // crowded wire), still clear of every other curve, tile, tag and the cloud's outline
    let covers = false;
    if (!best) {
      const others = curves.filter((x) => x !== c).flatMap((x) => Array.from({ length: 61 }, (_, k) => at(x, k / 60)));
      for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.28, 0.72]) {
        const p = at(c, t);
        const q = { x: p[0] - tw / 2, y: p[1] - th / 2, w: tw, h: th };
        if (q.x < 8 || q.y < 60 || q.x + q.w > W - 8 || q.y + q.h > Hc - 8) continue;
        if (others.some((pt) => hits(q, pt, 5)) || cloudBand.some((e) => overlaps(q, e, 0))) continue;
        if (nodeBoxes.some((nb) => overlaps(q, { x: nb.x - 4, y: nb.y - 4, w: nb.w + 12, h: nb.h + 12 }, 6)) || placedTags.some((pb) => overlaps(q, pb, 12))) continue;
        best = q;
        covers = true;
        break;
      }
    }
    if (!best) {
      // a bow through a margin: widen that margin (curves are in drawn coordinates; extra.l widens the drawn left in
      // both languages, as the mirror swaps the margins too)
      const side = Math.abs(c.ctrl[0] - W / 2) < 40 ? null : c.ctrl[0] < W / 2 ? 'l' : 'r';
      throw new TagRoom(`${spec.id}/${opts.variant}: no room beside its curve for the tag "${e.tag}"`, side);
    }
    placedTags.push(best);
    // the box's middle (a tilted tag's box is the bounds of the turned tag)
    const px = best.x + best.w / 2;
    const py = best.y + best.h / 2;
    const tilt = bestRot ? ` transform="rotate(${r((bestRot * 180) / Math.PI)} ${r(px)} ${r(py)})"` : '';
    tags.push(`<g class="an-sk-tag an-sk-${e.tone ?? 'blue'}" data-for="${prefix}-e${i}"${covers ? ' data-covers' : ''}${tilt}>${covers ? `<rect class="an-sk-tag-bg" x="${r(px - tw / 2)}" y="${r(py - 14)}" width="${r(tw)}" height="26"/>` : ''}<path class="an-sk-mark" d="${pen.marker(px - tw / 2 - 4, py - 15, tw, 26)}"/><path class="an-sk-line" d="${pen.rect(px - tw / 2, py - 14, tw, 26)}"/><text class="${fam}" x="${r(px)}" y="${r(py + 4)}" text-anchor="middle"${hasArabic(e.tag) ? ' direction="rtl"' : ''}>${esc(e.tag)}</text></g>`);
  });
  o.push('</g><g class="an-motion" aria-hidden="true">');
  spec.edges.forEach((e, i) => {
    if (e.dashed) return;
    o.push(`<circle class="an-pulse an-sk-dot" r="4"><animateMotion dur="2.4s" begin="-${r(i * 0.4)}s" repeatCount="indefinite"><mpath href="#${prefix}-e${i}"/></animateMotion></circle>`);
  });
  o.push('</g><g class="an-nodes">');
  for (const n of spec.nodes) {
    const b = box.get(n.id)!;
    o.push(`<g class="an-node an-sk-node an-sk-${n.tone}" data-node="${n.id}">`);
    o.push(`<rect data-box class="an-sk-hit" x="${r(b.x - 4)}" y="${r(b.y - 4)}" width="${r(b.w + 12)}" height="${b.h + 12}"/>`);
    o.push(`<path class="an-sk-mark" d="${pen.marker(b.x, b.y, b.w, b.h)}"/><path class="an-sk-line" d="${pen.rect(b.x, b.y, b.w, b.h)}"/>`);
    o.push(useIcon(prefix, n.icon, b.x + b.w / 2 - 20, b.y + 12, 40));
    const t = tileText.get(n.id)!;
    // a single word wider than the tile (no space to wrap at) is squeezed to fit
    const fit = (l: string, size: number) => {
      const w = textWidth(l, size, size === 19);
      // (squeezed to the tile's width: the page's CSP blocks inline styles, and a font-size attribute loses to the CSS)
      return w > b.w - 16 ? ` textLength="${Math.round(b.w - 16)}" lengthAdjust="spacingAndGlyphs"` : '';
    };
    o.push(`<text class="an-sk-name ${fam}" text-anchor="middle"${hasArabic(n.title) ? ' direction="rtl"' : ''}>${lines(t.name, b.x + b.w / 2, b.y + 78, NAME_LH, (l) => fit(l, 19))}</text>`);
    if (t.note.length) o.push(`<text class="an-sk-note ${fam}" text-anchor="middle"${hasArabic(n.note!) ? ' direction="rtl"' : ''}>${lines(t.note, b.x + b.w / 2, b.y + 108 + (t.name.length - 1) * NAME_LH, NOTE_LH, (l) => fit(l, 15))}</text>`);
    o.push('</g>');
  }
  for (const f of foot) {
    const b = box.get(f.id)!;
    o.push(`<g class="an-node an-sk-obs" data-node="${f.id}"><rect data-box class="an-sk-hit" x="${r(b.x)}" y="${r(b.y - 4)}" width="${r(b.w)}" height="${b.h}"/>`);
    o.push(useIcon(prefix, f.icon, b.x + b.w / 2 - 20, b.y, 40));
    (footLines.get(f.id) ?? [f.title]).forEach((l, k) => o.push(`<text class="an-sk-name ${fam}" x="${r(b.x + b.w / 2)}" y="${r(b.y + 62 + k * 30)}" text-anchor="middle"${hasArabic(l) ? ' direction="rtl"' : ''}>${esc(l)}</text>`));
    o.push('</g>');
  }
  o.push(`</g><g class="an-labels">${tags.join('')}</g></svg>`);
  return o.join('');
}

/** "One play, sketched" (video pipeline page), on the generic engine. */
export function renderSketch(c: Copy, opts: { rtl: boolean; variant: string }): string {
  const s = c.step;
  const spec: SketchSpec = {
    id: 'sketch-play',
    title: c.title,
    desc: c.desc,
    heading: c.title2,
    around: c.around,
    nodes: [
      { id: 'viewer', icon: 'lucide/user', title: s.viewer, note: s.viewerNote, tone: 'yellow', at: [0, 0.5] },
      { id: 'player', icon: 'lucide/play', title: s.player, note: s.playerNote, tone: 'blue', at: [1, 0.5] },
      { id: 'api', icon: 'cloudflare/workers', title: s.api, note: s.apiNote, tone: 'orange', at: [2, 0.5] },
      { id: 'r2', icon: 'cloudflare/r2', title: `${s.edge} · ${s.r2}`, note: s.edgeNote, tone: 'green', at: [3, 0] },
      { id: 'bunny', icon: 'brand/bunny-cdn', title: `${s.edge} · ${s.bunny}`, note: s.edgeNote, tone: 'green', at: [3, 1] },
      { id: 'plays', icon: 'lucide/monitor', title: s.play, note: s.playNote, tone: 'pink', at: [4, 0.5] },
    ],
    edges: [
      { from: 'viewer', to: 'player' },
      { from: 'player', to: 'api' },
      { from: 'api', to: 'r2', fromSide: 'e', toSide: 'w', bend: -10 },
      { from: 'api', to: 'bunny', fromSide: 'e', toSide: 'w', bend: 10 },
      { from: 'r2', to: 'plays', fromSide: 'e', toSide: 'w', bend: -10 },
      { from: 'bunny', to: 'plays', fromSide: 'e', toSide: 'w', bend: 10 },
      { from: 'plays', to: 'api', fromSide: 's', toSide: 's', bend: -310, dashed: true, tag: c.tag.optional, tone: 'pink' },
      { from: 'plays', to: 'vitals', fromSide: 's', toSide: 'e', bend: 70, dashed: true, tag: c.tag.async, tone: 'blue', tagAt: 0.55 },
    ],
    foot: [
      { id: 'logs', icon: 'cloudflare/logs', title: c.obs.logs },
      { id: 'errors', icon: 'lucide/activity', title: c.obs.errors },
      { id: 'vitals', icon: 'lucide/gauge', title: c.obs.vitals },
    ],
  };
  if (opts.variant === 'wide') return renderSketchSpec(spec, { colW: 252, rowH: 170, nodeW: 220, cols: 5, footGap: 120 }, opts);
  return renderSketchSpec(
    {
      ...spec,
      edges: [
        { from: 'viewer', to: 'player' },
        { from: 'player', to: 'api' },
        { from: 'api', to: 'r2', fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'bunny', fromSide: 's', toSide: 'n' },
        { from: 'r2', to: 'plays', fromSide: 's', toSide: 'n' },
        { from: 'bunny', to: 'plays', fromSide: 's', toSide: 'n' },
        { from: 'plays', to: 'api', fromSide: 'e', toSide: 'e', lane: 40, dashed: true, tag: c.tag.optional, tone: 'pink', tagAt: 0.85 },
        { from: 'plays', to: 'vitals', fromSide: 's', toSide: 'n', dashed: true, tag: c.tag.async, tone: 'blue', tagAt: 0.62 },
      ],
    },
    { colW: 175, rowH: 180, nodeW: 165, cols: 2, footGap: 40, at: { viewer: [0.5, 0], player: [0.5, 1], api: [0.5, 2], r2: [0, 3], bunny: [1, 3], plays: [0.5, 4] } },
    opts,
  );
}
