/**
 * Hand-drawn explainers (style sample 1): rough double-stroked boxes with a highlighter fill,
 * handwritten type (Kalam; Aref Ruqaa, the everyday Arabic hand, for Arabic), wobbly arrows, and a
 * cloud with "observability surrounds everything" written up its side. Strokes come from a seeded
 * generator, so every build draws the same sketch. Official icons stay crisp and unmodified.
 */
import type { diagramsEn } from '../../i18n/diagrams.en.ts';
import { r, symbol, useIcon } from './icons.ts';
import { esc, hasArabic, textWidth } from './text.ts';

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
  /** arrow along a gentle curve through an optional control point; returns the shaft and the head */
  arrow(x1: number, y1: number, x2: number, y2: number, ctrl?: [number, number]): { shaft: string; head: string } {
    const [cx, cy] = ctrl ?? [(x1 + x2) / 2 + this.j(6), (y1 + y2) / 2 + this.j(6)];
    const shaft = `M${r(x1)} ${r(y1)} Q${r(cx)} ${r(cy)} ${r(x2)} ${r(y2)}`;
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
  /** wires for this width (a phone column needs different ones) */
  edges?: SketchEdge[];
}

const NODE_H = 124;

export function renderSketchSpec(spec0: SketchSpec, layout: SketchLayout, opts: { rtl: boolean; variant: string }): string {
  const spec = layout.edges ? { ...spec0, edges: layout.edges } : spec0;
  const prefix = `${spec.id}-${opts.variant}`;
  const pen = new Pen(prefix);
  const side = 22; // the margin the rotated side note lives in
  const mx = 64 + (spec.around ? side : 0);
  const top = 96;
  const rows = Math.max(...spec.nodes.map((n) => (layout.at?.[n.id] ?? n.at)[1])) + 1;
  const W = Math.round(layout.cols * layout.colW + 2 * mx);
  const footY = top + rows * layout.rowH + 10 + (layout.footGap ?? 0);
  const Hc = Math.round(footY + (spec.foot?.length ? 142 : 20) + 40);
  const mirror = (x: number) => (opts.rtl ? W - x : x);
  const ar = hasArabic(spec.heading);
  const fam = ar ? 'an-hand-ar' : 'an-hand';
  const box = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const n of spec.nodes) {
    const [c, r0] = layout.at?.[n.id] ?? n.at;
    const x = mx + c * layout.colW + (layout.colW - layout.nodeW) / 2;
    const y = top + r0 * layout.rowH + (layout.rowH - NODE_H) / 2;
    box.set(n.id, { x: opts.rtl ? W - x - layout.nodeW : x, y, w: layout.nodeW, h: NODE_H });
  }
  const foot = spec.foot ?? [];
  const footW = (W - 2 * mx) / Math.max(1, foot.length);
  // a title wider than its slot wraps to two lines (the hand-drawn face is wide)
  const footLines = new Map<string, string[]>();
  foot.forEach((f, i) => {
    const cx = mx + footW * (i + 0.5);
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
  if (spec.around) {
    let cloud = pen.cloud(mx - 20, 74, W - 2 * mx + 40, Hc - 74 - 28);
    if (opts.rtl) cloud = cloud.replace(/([MQL ])(-?[\d.]+) (-?[\d.]+)/g, (_m, p, x, y) => `${p}${r(W - Number(x))} ${y}`);
    o.push(`<g class="an-groups"><path class="an-sk-cloud" d="${cloud}"/></g>`);
    const sx = opts.rtl ? W - side - 6 : side + 6;
    const sy = (74 + Hc - 28) / 2;
    o.push(`<text class="an-sk-side ${fam}" x="${sx}" y="${r(sy)}" text-anchor="middle" transform="rotate(${opts.rtl ? 90 : -90} ${sx} ${r(sy)})"${ar ? ' direction="rtl"' : ''}>${esc(spec.around)}</text>`);
  }
  o.push(`<g data-node-label="heading"><text class="an-sk-title ${fam}" x="${r(W / 2)}" y="52" text-anchor="middle"${ar ? ' direction="rtl"' : ''}>${esc(spec.heading)}</text></g>`);

  // first every curve, so tags can be placed clear of all of them
  type Curve = { e: SketchEdge; i: number; a: [number, number]; ctrl: [number, number]; b: [number, number] };
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
  const at = (c: Curve, t: number): [number, number] => [
    (1 - t) * (1 - t) * c.a[0] + 2 * (1 - t) * t * c.ctrl[0] + t * t * c.b[0],
    (1 - t) * (1 - t) * c.a[1] + 2 * (1 - t) * t * c.ctrl[1] + t * t * c.b[1],
  ];
  const samples = curves.flatMap((c) => Array.from({ length: 61 }, (_, k) => at(c, k / 60)));
  type Box = { x: number; y: number; w: number; h: number };
  const hits = (q: Box, p: [number, number], pad: number) => p[0] > q.x - pad && p[0] < q.x + q.w + pad && p[1] > q.y - pad && p[1] < q.y + q.h + pad;
  const overlaps = (q: Box, r2: Box, pad: number) => q.x < r2.x + r2.w + pad && r2.x < q.x + q.w + pad && q.y < r2.y + r2.h + pad && r2.y < q.y + q.h + pad;
  const placedTags: Box[] = [];
  const nodeBoxes = [...box.values()];

  const tags: string[] = [];
  o.push('<g class="an-edges">');
  curves.forEach((c) => {
    const { e, i, a, b, ctrl } = c;
    const { shaft, head } = pen.arrow(a[0], a[1], b[0], b[1], ctrl);
    o.push(`<path id="${prefix}-e${i}" data-edge="${prefix}-e${i}" data-from="${e.from}" data-to="${e.to}" class="an-edge an-sk-arrow${e.dashed ? ' an-sk-dashed' : ''}" d="${shaft}"/><path class="an-sk-head" d="${head}"/>`);
    if (!e.tag) return;
    // a tag sits beside its curve, never on it: try both sides at a few points along it
    const tw = textWidth(e.tag, 15, true) + 18;
    const th = 26;
    let best: Box | null = null;
    for (const t of [e.tagAt ?? 0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]) {
      const p = at(c, t);
      const q2 = at(c, Math.min(1, t + 0.01));
      const dl = Math.hypot(q2[0] - p[0], q2[1] - p[1]) || 1;
      const n: [number, number] = [-(q2[1] - p[1]) / dl, (q2[0] - p[0]) / dl];
      const off = Math.abs(n[0]) * (tw / 2) + Math.abs(n[1]) * (th / 2) + 8;
      for (const [s, k] of [[1, 1], [-1, 1], [1, 1.7], [-1, 1.7], [1, 2.5], [-1, 2.5]] as const) {
        const cx = p[0] + n[0] * off * k * s;
        const cy = p[1] + n[1] * off * k * s;
        const q = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
        if (q.x < 8 || q.y < 60 || q.x + q.w > W - 8 || q.y + q.h > Hc - 8) continue;
        if (samples.some((pt) => hits(q, pt, 4))) continue;
        if (nodeBoxes.some((nb) => overlaps(q, nb, 6)) || placedTags.some((pb) => overlaps(q, pb, 6))) continue;
        best = q;
        break;
      }
      if (best) break;
    }
    if (!best) throw new Error(`${spec.id}/${opts.variant}: no room beside its curve for the tag "${e.tag}"`);
    placedTags.push(best);
    const px = best.x + tw / 2;
    const py = best.y + th / 2;
    tags.push(`<g class="an-sk-tag an-sk-${e.tone ?? 'blue'}" data-for="${prefix}-e${i}"><path class="an-sk-mark" d="${pen.marker(px - tw / 2 - 4, py - 15, tw, 26)}"/><path class="an-sk-line" d="${pen.rect(px - tw / 2, py - 14, tw, 26)}"/><text class="${fam}" x="${r(px)}" y="${r(py + 4)}" text-anchor="middle"${hasArabic(e.tag) ? ' direction="rtl"' : ''}>${esc(e.tag)}</text></g>`);
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
    o.push(`<text class="an-sk-name ${fam}" x="${r(b.x + b.w / 2)}" y="${r(b.y + 78)}" text-anchor="middle"${hasArabic(n.title) ? ' direction="rtl"' : ''}>${esc(n.title)}</text>`);
    if (n.note) o.push(`<text class="an-sk-note ${fam}" x="${r(b.x + b.w / 2)}" y="${r(b.y + 108)}" text-anchor="middle"${hasArabic(n.note) ? ' direction="rtl"' : ''}>${esc(n.note)}</text>`);
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
        { from: 'plays', to: 'api', fromSide: 'e', toSide: 'e', bend: 290, dashed: true, tag: c.tag.optional, tone: 'pink', tagAt: 0.85 },
        { from: 'plays', to: 'vitals', fromSide: 's', toSide: 'n', dashed: true, tag: c.tag.async, tone: 'blue', tagAt: 0.62 },
      ],
    },
    { colW: 175, rowH: 180, nodeW: 165, cols: 2, footGap: 40, at: { viewer: [0.5, 0], player: [0.5, 1], api: [0.5, 2], r2: [0, 3], bunny: [1, 3], plays: [0.5, 4] } },
    opts,
  );
}
