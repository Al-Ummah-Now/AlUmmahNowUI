/**
 * Reference-architecture diagrams (style samples 5 and 8): official icons with NAME + role labels
 * on a grid, grouping boundaries, orthogonal routed wires, and animated data flow.
 *
 * A spec places nodes on a grid; groups are sized around their members; edges are routed by
 * route.ts around every node box; labels and step badges are placed where they touch nothing.
 * The output is one SVG string. Every node, icon and edge carries data-* hooks for the browser
 * gate (e2e/diagram-gate.spec.ts).
 */
import { esc, hasArabic, textWidth } from './text.ts';
import { accentClass, r, symbol, symId, useIcon, type IconId } from './icons.ts';
import { formatUsd } from './cost.ts';
import { formatNumber } from '../../../../../packages/render/src/format.ts';
import { G, Router, intersects, polyLength, roundedPath, sideDir, simplify, type Endpoint, type Pt, type Rect, type Side } from './route.ts';

export type Flow = 'request' | 'media' | 'delivery' | 'async' | 'control';
export const FLOWS: Flow[] = ['request', 'media', 'delivery', 'async', 'control'];

export interface ArchNode {
  id: string;
  icon: IconId;
  name: string;
  role?: string | string[];
  /** grid position (column, row) — fractions allowed */
  at: [number, number];
  /** field rows (a table's columns, a message's fields): code type, aligned to the start edge under a rule */
  list?: string[];
  /** price lines (sourced rates), under the role */
  rate?: string[];
  /** a cost meter: final USD per scenario (null = unknown); it ticks while the flow reaches this node */
  meter?: { lane: string; usd: Record<string, number | null> };
  /** a lane total: the sum of the lane's meters as they tick */
  total?: { lane: string; usd: Record<string, number | null> };
}
export interface ArchGroup {
  id: string;
  label: string;
  caption?: string;
  /** node or group ids */
  members: string[];
  kind?: 'group' | 'boundary' | 'platform' | 'lane';
  /** a brand mark on the corner tag (boundary/platform) */
  tag?: IconId;
  /** a vendor wordmark that already says the name (drawn on a white chip, no text) */
  tagLogo?: { id: IconId; w: number; h: number };
  /** put the corner tag at the far end of the top edge (keeps the near corner free for wires) */
  tagEnd?: boolean;
  /** CSS colour for a platform outline (a brand colour) */
  accent?: string;
  pad?: number;
}
export interface ArchEdge {
  from: string;
  to: string;
  flow: Flow;
  label?: string;
  step?: number;
  fromSide?: Side | Side[];
  toSide?: Side | Side[];
  /** marching-light stream on top of the wire */
  stream?: boolean;
}
export interface ArchLayout {
  colW: number;
  rowH: number;
  /** positions override per node for this layout */
  at?: Record<string, [number, number]>;
  iconSize?: number;
  nameSize?: number;
  roleSize?: number;
  /** group ids to leave out in this layout */
  hideGroups?: string[];
  /** canvas margin (default 28); more when wires arc around the outside */
  pad?: number;
  /** edges replaced in this layout (e.g. fewer wires on a phone) */
  edges?: ArchEdge[];
}
export interface ArchSpec {
  id: string;
  title: string;
  desc: string;
  nodes: ArchNode[];
  groups: ArchGroup[];
  edges: ArchEdge[];
  /** 'pulses': ambient flow on every wire; 'steps': numbered hops fire in order */
  motion: 'pulses' | 'steps';
  /** seconds per numbered hop */
  hop?: number;
  /** false: no numbered badges (parallel lanes that share step timing) */
  badges?: boolean;
}

interface NodeBox {
  n: ArchNode;
  cx: number;
  cy: number;
  box: Rect;
  icon: { x: number; y: number; s: number };
  lines: { text: string; y: number; size: number; bold: boolean; kind?: 'rate' | 'meter' | 'total' | 'field' }[];
  /** y of the rule above the field rows */
  rule?: number;
}
interface GroupBox {
  g: ArchGroup;
  box: Rect;
  depth: number;
  label: Rect;
  caption?: Rect;
}
interface Routed {
  e: ArchEdge;
  id: string;
  pts: Pt[];
  len: number;
}

const M = 10; // keep-out around node boxes for wires

export interface RenderOpts {
  rtl: boolean;
  variant: string;
  /** for cost meters: the page's language, the scenario shown without script, and the word for unknown */
  locale?: 'en' | 'ar';
  scenario?: string;
  unknown?: string;
}

const MS = 15; // meter font size
/** The text a meter or total shows for one scenario. */
function money(o: RenderOpts, v: number | null | undefined): string {
  if (v === null || v === undefined) return o.unknown ?? 'unknown';
  return formatUsd(o.locale ?? 'en', v);
}
const moneyWidest = (o: RenderOpts, usd: Record<string, number | null>) => Math.max(...Object.values(usd).map((v) => textWidth(money(o, v), MS, true)), ...(['en', 'ar'] as const).flatMap((l) => Object.values(usd).map((v) => textWidth(money({ ...o, locale: l }, v), MS, true))));

export function renderArch(spec: ArchSpec, layout: ArchLayout, opts: RenderOpts): string {
  const S = layout.iconSize ?? 40;
  const NS = layout.nameSize ?? 13;
  const RS = layout.roleSize ?? 11.5;
  const prefix = `${spec.id}-${opts.variant}`;
  const edgesSpec = layout.edges ?? spec.edges;

  const ids = [...spec.nodes.map((n) => n.id), ...spec.groups.map((g) => g.id)];
  const dup = ids.find((x, i) => ids.indexOf(x) !== i);
  if (dup) throw new Error(`${spec.id}: id used twice: ${dup}`);

  // 1. nodes on the grid
  const nodes = new Map<string, NodeBox>();
  const rolesOf = (n: ArchNode) => (n.role ? (Array.isArray(n.role) ? n.role : [n.role]) : []);
  const RT = RS - 0.5;
  // the gap between a tile's lines: Arabic is set in Noto Naskh, whose line box is taller than Latin's
  // (and taller still on Linux), so Arabic tiles get more room between lines
  const lgOf = (_n: ArchNode) => (opts.locale === 'ar' ? 6 : 3);
  const FS = RS - 0.5;
  /** code type: every glyph about 0.6 em */
  const codeW = (x: string) => [...x].length * FS * 0.62;
  const nodeW = (n: ArchNode) =>
    Math.max(S + 20, ...(n.list ?? []).map((x) => codeW(x) + 26), textWidth(n.name, NS, true) + 16, ...rolesOf(n).map((x) => textWidth(x, RS) + 16), ...(n.rate ?? []).map((x) => textWidth(x, RT) + 16), n.meter ? moneyWidest(opts, n.meter.usd) + 18 : 0, n.total ? moneyWidest(opts, n.total.usd) + 18 : 0);
  const widest = Math.max(...spec.nodes.map(nodeW));
  // a column always leaves a wire channel between neighbouring tiles
  layout = { ...layout, colW: Math.max(layout.colW, Math.ceil(widest + 46)) };
  const tileW = Math.min(widest, layout.colW - 46);
  // one tile height per diagram, so icons, names and wires line up along a row
  const nodeH = (n: ArchNode) => {
    const roles = n.role ? (Array.isArray(n.role) ? n.role : [n.role]) : [];
    const LG = lgOf(n);
    return 8 + S + 7 + NS + LG + roles.length * (RS + LG) + (n.rate ?? []).length * (RT + LG + 2) + (n.meter || n.total ? MS + 3 + LG : 0) + (n.list?.length ? 9 + n.list.length * (FS + LG + 2) : 0) + 6;
  };
  // per row (same grid y): tiles side by side share a height
  const rowOf = (n: ArchNode) => (layout.at?.[n.id] ?? n.at)[1];
  const tileH = (n: ArchNode) => Math.max(...spec.nodes.filter((m) => rowOf(m) === rowOf(n)).map(nodeH));
  for (const n of spec.nodes) {
    const at = layout.at?.[n.id] ?? n.at;
    const cx = (at[0] + 0.5) * layout.colW;
    const cy = (at[1] + 0.5) * layout.rowH;
    const roles = n.role ? (Array.isArray(n.role) ? n.role : [n.role]) : [];
    const w = Math.max(tileW, nodeW(n));
    const rates = n.rate ?? [];
    const money0 = n.meter ?? n.total;
    const h = tileH(n);
    const box = { x: cx - w / 2, y: cy - h / 2, w, h };
    const lines: NodeBox['lines'] = [{ text: n.name, y: box.y + 8 + S + 7 + NS - 2, size: NS, bold: true }];
    const LG = lgOf(n);
    roles.forEach((x, i) => lines.push({ text: x, y: box.y + 8 + S + 7 + NS + LG + (i + 1) * (RS + LG) - LG, size: RS, bold: false }));
    let ly = box.y + 8 + S + 7 + NS + LG + roles.length * (RS + LG);
    rates.forEach((x) => {
      ly += RT + LG + 2;
      lines.push({ text: x, y: ly - 3, size: RT, bold: false, kind: 'rate' });
    });
    if (money0) lines.push({ text: money(opts, money0.usd[opts.scenario ?? 'one']), y: ly + MS + LG, size: MS, bold: true, kind: n.meter ? 'meter' : 'total' });
    let rule: number | undefined;
    if (n.list?.length) {
      rule = ly + 5;
      n.list.forEach((x, i) => lines.push({ text: x, y: ly + 9 + (i + 1) * (FS + LG + 2) - LG - 1, size: FS, bold: false, kind: 'field' }));
    }
    nodes.set(n.id, { n, cx, cy, box, icon: { x: cx - S / 2, y: box.y + 8, s: S }, lines, rule });
  }

  // 2. groups around their members (inner first)
  const groupSpecs = spec.groups.filter((g) => !layout.hideGroups?.includes(g.id));
  const groups = new Map<string, GroupBox>();
  const depthOf = (g: ArchGroup): number => 1 + Math.max(0, ...g.members.map((m) => groupSpecs.find((x) => x.id === m)).filter(Boolean).map((x) => depthOf(x!)));
  const ordered = [...groupSpecs].sort((a, b) => depthOf(a) - depthOf(b));
  for (const g of ordered) {
    const rects = g.members.map((m) => nodes.get(m)?.box ?? groups.get(m)?.box).filter(Boolean) as Rect[];
    if (!rects.length) continue;
    const big = g.kind === 'boundary' || g.kind === 'platform';
    const pad = g.pad ?? (big ? 18 : 12);
    const top = big ? 44 : 30;
    const bottom = g.caption ? 26 : pad;
    const x0 = Math.min(...rects.map((q) => q.x)) - pad;
    const y0 = Math.min(...rects.map((q) => q.y)) - top;
    const x1 = Math.max(...rects.map((q) => q.x + q.w)) + pad;
    const y1 = Math.max(...rects.map((q) => q.y + q.h)) + bottom;
    const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const lw = g.tagLogo ? g.tagLogo.w + 24 : big ? textWidth(g.label, 12.5, true) + (g.tag ? 30 : 0) + 20 : textWidth(g.label, 12.5, true) + 4;
    const label = big ? { x: box.x + 14, y: box.y - 13, w: lw, h: 26 } : { x: box.x + 10, y: box.y + 7, w: lw, h: 17 };
    const caption = g.caption ? { x: box.x + 10, y: box.y + box.h - 21, w: textWidth(g.caption, 11) + 4, h: 15 } : undefined;
    groups.set(g.id, { g, box, depth: depthOf(g), label, caption });
  }

  // 3. canvas: the bbox of everything plus a margin, then mirror for RTL
  const all: Rect[] = [...[...nodes.values()].map((n) => n.box), ...[...groups.values()].flatMap((g) => [g.box, g.label])];
  const pad = layout.pad ?? 28;
  const minX = Math.min(...all.map((q) => q.x)) - pad;
  const minY = Math.min(...all.map((q) => q.y)) - pad;
  const maxX = Math.max(...all.map((q) => q.x + q.w)) + pad;
  const maxY = Math.max(...all.map((q) => q.y + q.h)) + pad;
  // shift so the canvas starts at a lattice point
  const ox = -Math.floor(minX / G) * G;
  const oy = -Math.floor(minY / G) * G;
  const W = Math.ceil((maxX + ox) / G) * G;
  const H = Math.ceil((maxY + oy) / G) * G;
  const mx = (x: number, w = 0) => (opts.rtl ? W - (x + ox) - w : x + ox);
  for (const nb of nodes.values()) {
    nb.box = { ...nb.box, x: mx(nb.box.x, nb.box.w), y: nb.box.y + oy };
    nb.cx = mx(nb.cx);
    nb.cy += oy;
    nb.icon = { ...nb.icon, x: nb.cx - nb.icon.s / 2, y: nb.icon.y + oy };
    nb.lines = nb.lines.map((l) => ({ ...l, y: l.y + oy }));
    if (nb.rule !== undefined) nb.rule += oy;
  }
  for (const gb of groups.values()) {
    gb.box = { ...gb.box, x: mx(gb.box.x, gb.box.w), y: gb.box.y + oy };
    const big = gb.g.kind === 'boundary' || gb.g.kind === 'platform';
    const atEnd = big && gb.g.tagEnd ? !opts.rtl : opts.rtl;
    const lx = atEnd ? gb.box.x + gb.box.w - (big ? 14 : 10) - gb.label.w : gb.box.x + (big ? 14 : 10);
    gb.label = { ...gb.label, x: lx, y: gb.label.y + oy };
    if (gb.caption) {
      const cx = opts.rtl ? gb.box.x + gb.box.w - 10 - gb.caption.w : gb.box.x + 10;
      gb.caption = { ...gb.caption, x: cx, y: gb.caption.y + oy };
    }
  }

  // 4. route
  const router = new Router(W, H);
  for (const nb of nodes.values()) router.block(nb.box, M);
  for (const gb of groups.values()) {
    router.block(gb.label, 6);
    if (gb.caption) router.block(gb.caption, 4);
  }
  // discourage wires from hugging group borders
  for (const gb of groups.values()) {
    const b = gb.box;
    for (const rc of [
      { x: b.x, y: b.y, w: b.w, h: 0 },
      { x: b.x, y: b.y + b.h, w: b.w, h: 0 },
      { x: b.x, y: b.y, w: 0, h: b.h },
      { x: b.x + b.w, y: b.y, w: 0, h: b.h },
    ])
      router.penalise(rc, 6, 6);
  }

  const rectOf = (id: string): { rect: Rect; isNode: boolean; anchorY: number; icon?: Rect } => {
    const nb = nodes.get(id);
    if (nb) return { rect: nb.box, isNode: true, anchorY: nb.icon.y + nb.icon.s / 2, icon: { x: nb.icon.x, y: nb.icon.y, w: nb.icon.s, h: nb.icon.s } };
    const gb = groups.get(id);
    if (!gb) throw new Error(`${spec.id}: unknown endpoint ${id}`);
    return { rect: gb.box, isNode: false, anchorY: gb.box.y + gb.box.h / 2 };
  };
  const snap = (v: number) => Math.round(v / G) * G;
  const endpoint = (id: string, side: Side, along?: number): Endpoint => {
    const { rect, isNode, anchorY, icon } = rectOf(id);
    const m = isNode ? M + 2 : 6;
    if (side === 'e' || side === 'w') {
      const y = snap(along ?? anchorY);
      // wires reach the icon itself (as in the reference style), not the invisible label box
      const near = icon && y >= icon.y - 4 && y <= icon.y + icon.h + 4;
      const px = near ? (side === 'e' ? icon.x + icon.w + 6 : icon.x - 6) : side === 'e' ? rect.x + rect.w : rect.x;
      const bx = side === 'e' ? rect.x + rect.w : rect.x;
      const sx = side === 'e' ? Math.ceil((bx + m) / G) * G : Math.floor((bx - m) / G) * G;
      return { port: { x: px, y }, side, stub: { x: sx, y } };
    }
    const x = snap(along ?? rect.x + rect.w / 2);
    const py = side === 's' ? rect.y + rect.h : icon ? icon.y - 5 : rect.y;
    const sy = side === 's' ? Math.ceil((py + m) / G) * G : Math.floor((rect.y - m) / G) * G;
    return { port: { x, y: py }, side, stub: { x, y: sy } };
  };
  const sidesOf = (s: Side | Side[] | undefined): Side[] => {
    const list = s ? (Array.isArray(s) ? s : [s]) : (['n', 'e', 's', 'w'] as Side[]);
    if (!opts.rtl) return list;
    return list.map((x) => (x === 'e' ? 'w' : x === 'w' ? 'e' : x));
  };

  const centreOf = (id: string): Pt => {
    const q = rectOf(id).rect;
    return { x: q.x + q.w / 2, y: q.y + q.h / 2 };
  };
  /** Where on a group's side a wire lands: facing the other end, clear of the corners. */
  const facing = (id: string, side: Side, other: Pt): number | undefined => {
    if (nodes.has(id)) return undefined;
    const q = rectOf(id).rect;
    const v = side === 'e' || side === 'w';
    const lo = (v ? q.y : q.x) + 40;
    const hi = (v ? q.y + q.h : q.x + q.w) - 40;
    let at = Math.max(lo, Math.min(hi, v ? other.y : other.x));
    // never land on the group's own header (top) or caption (bottom): step past it
    const gb = groups.get(id);
    const block = side === 'n' ? gb?.label : side === 's' ? gb?.caption : undefined;
    if (block && !v && at > block.x - 14 && at < block.x + block.w + 14) {
      const after = block.x + block.w + 22;
      const before = block.x - 22;
      at = after <= q.x + q.w - 20 && (!opts.rtl || before < q.x + 20) ? after : before;
    }
    return at;
  };
  // pass 1: pick a side for each end
  const chosen = edgesSpec.map((e) => {
    const res = router.route(
      sidesOf(e.fromSide).map((s) => endpoint(e.from, s, facing(e.from, s, centreOf(e.to)))),
      sidesOf(e.toSide).map((s) => endpoint(e.to, s, facing(e.to, s, centreOf(e.from)))),
      10,
    );
    if (!res) {
      const ss = sidesOf(e.fromSide).map((s) => endpoint(e.from, s));
      const gg = sidesOf(e.toSide).map((s) => endpoint(e.to, s));
      throw new Error(`${spec.id}: no route ${e.from} → ${e.to} ${JSON.stringify(ss.map((x) => [x.stub, router.isBlocked(x.stub)]))} ${JSON.stringify(gg.map((x) => [x.stub, router.isBlocked(x.stub)]))} W${W} H${H}`);
    }
    return { fromSide: res.start.side, toSide: res.goal.side };
  });

  // spread several wires on one side; order them by where the other end is to avoid crossings
  const slots = new Map<string, { edge: number; end: 'from' | 'to'; other: Pt }[]>();
  edgesSpec.forEach((e, i) => {
    const a = rectOf(e.from).rect;
    const b = rectOf(e.to).rect;
    const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    for (const [end, id, side, other] of [
      ['from', e.from, chosen[i]!.fromSide, cb],
      ['to', e.to, chosen[i]!.toSide, ca],
    ] as const) {
      const k = `${id}|${side}`;
      slots.set(k, [...(slots.get(k) ?? []), { edge: i, end, other }]);
    }
  });
  const along = new Map<string, number>();
  for (const [k, list] of slots) {
    const [id, side] = k.split('|') as [string, Side];
    const { rect, anchorY, isNode } = rectOf(id);
    const vertical = side === 'e' || side === 'w';
    list.sort((p, q) => (vertical ? p.other.y - q.other.y : p.other.x - q.other.x));
    if (!isNode) {
      // each wire faces its other end; keep 2 lattice steps apart
      let prev = -Infinity;
      for (const s2 of list) {
        const v = Math.max(facing(id, side, s2.other)!, prev + 2 * G);
        along.set(`${s2.edge}|${s2.end}`, v);
        prev = v;
      }
      continue;
    }
    const centre = vertical ? anchorY : rect.x + rect.w / 2;
    const span = vertical ? rect.h : rect.w;
    const step = Math.min(2 * G, Math.max(G, Math.floor((span - 2 * G) / Math.max(1, list.length) / G) * G));
    list.forEach((s2, j) => along.set(`${s2.edge}|${s2.end}`, centre + (j - (list.length - 1) / 2) * step));
  }

  // pass 2: fixed ports, committed in order so wires keep apart
  const routed: Routed[] = edgesSpec.map((e, i) => {
    const a = endpoint(e.from, chosen[i]!.fromSide, along.get(`${i}|from`));
    const b = endpoint(e.to, chosen[i]!.toSide, along.get(`${i}|to`));
    const res = router.route([a], [b], 8) ?? router.route(sidesOf(e.fromSide).map((s) => endpoint(e.from, s)), sidesOf(e.toSide).map((s) => endpoint(e.to, s)), 8);
    if (!res) throw new Error(`${spec.id}: no route ${e.from} → ${e.to}`);
    const pts = simplify([res.start.port, ...res.pts, res.goal.port]);
    router.commit(pts.slice(1, -1));
    return { e, id: `${prefix}-e${i}`, pts, len: polyLength(pts) };
  });

  // 5. labels and step badges, placed where they touch nothing
  const obstacles: Rect[] = [...[...nodes.values()].map((n) => n.box), ...[...groups.values()].flatMap((g) => (g.caption ? [g.label, g.caption] : [g.label]))];
  const placed: Rect[] = [];
  const segRects = (rt: Routed, skip?: number) =>
    rt.pts.slice(1).flatMap((p, i) => {
      if (i === skip) return [];
      const q = rt.pts[i]!;
      return [{ x: Math.min(p.x, q.x) - 1, y: Math.min(p.y, q.y) - 1, w: Math.abs(p.x - q.x) + 2, h: Math.abs(p.y - q.y) + 2 }];
    });
  const inCanvas = (q: Rect) => q.x >= 4 && q.y >= 4 && q.x + q.w <= W - 4 && q.y + q.h <= H - 4;
  const free = (q: Rect, wires: Rect[]) => inCanvas(q) && !obstacles.some((o) => intersects(q, o, 3)) && !placed.some((o) => intersects(q, o, 3)) && !wires.some((o) => intersects(q, o, 1));

  const badges: { rt: Routed; c: Pt; n: number; at: number }[] = [];
  const BR = 11;
  for (const rt of routed) {
    if (rt.e.step == null || spec.badges === false) continue;
    let best: { c: Pt; at: number } | null = null;
    const others = routed.filter((x) => x !== rt).flatMap((x) => segRects(x));
    for (let d = 22; d < rt.len - 22; d += 4) {
      const c = pointAt(rt.pts, d);
      const q = { x: c.x - BR, y: c.y - BR, w: 2 * BR, h: 2 * BR };
      if (free(q, others)) {
        best = { c, at: d };
        break;
      }
    }
    const fb = best ?? { c: pointAt(rt.pts, rt.len / 2), at: rt.len / 2 };
    placed.push({ x: fb.c.x - BR, y: fb.c.y - BR, w: 2 * BR, h: 2 * BR });
    badges.push({ rt, c: fb.c, n: rt.e.step, at: fb.at });
  }

  const labels: { rt: Routed; rect: Rect; text: string }[] = [];
  const LS = 11;
  for (const rt of routed) {
    if (!rt.e.label) continue;
    const lw = textWidth(rt.e.label, LS) + 10;
    const lh = 17;
    const segs = rt.pts.slice(1).map((p, i) => ({ a: rt.pts[i]!, b: p, i, len: Math.abs(p.x - rt.pts[i]!.x) + Math.abs(p.y - rt.pts[i]!.y) }));
    const order = [...segs].sort((p, q) => q.len - p.len);
    const others = routed.filter((x) => x !== rt).flatMap((x) => segRects(x));
    const cands: { q: Rect; wires: Rect[] }[] = [];
    for (const s of order) {
      const horiz = s.a.y === s.b.y;
      for (const t of [0.5, 0.38, 0.62, 0.26, 0.74, 0.14, 0.86]) {
        const p = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
        if (horiz && s.len < lw + 16) continue;
        if (!horiz && s.len < 14) continue;
        const own = segRects(rt);
        if (horiz) {
          cands.push({ q: { x: p.x - lw / 2, y: p.y - 4 - lh, w: lw, h: lh }, wires: [...others, ...own] });
          cands.push({ q: { x: p.x - lw / 2, y: p.y + 4, w: lw, h: lh }, wires: [...others, ...own] });
        } else {
          const right = { x: p.x + 5, y: p.y - lh / 2, w: lw, h: lh };
          const left = { x: p.x - 5 - lw, y: p.y - lh / 2, w: lw, h: lh };
          for (const q of opts.rtl ? [left, right] : [right, left]) cands.push({ q, wires: [...others, ...own] });
        }
      }
    }
    // on the wire, as a pill (the wire passes behind it)
    for (const s of order) {
      const horiz = s.a.y === s.b.y;
      if ((horiz && s.len < lw + 20) || (!horiz && s.len < lh + 20)) continue;
      for (const t of [0.5, 0.35, 0.65]) {
        const p = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
        cands.push({ q: { x: p.x - lw / 2, y: p.y - lh / 2, w: lw, h: lh }, wires: [...others, ...segRects(rt, s.i)] });
      }
    }
    let hit = cands.find((c) => free(c.q, c.wires));
    if (!hit) {
      // last resort: the nearest free spot around the wire's middle, still clear of every node and label
      const mid = pointAt(rt.pts, rt.len / 2);
      const own = segRects(rt);
      for (let rad = 8; rad < 90 && !hit; rad += 6)
        for (let k = 0; k < 16 && !hit; k++) {
          const a = (k / 16) * Math.PI * 2;
          const q = { x: mid.x + Math.cos(a) * rad - lw / 2, y: mid.y + Math.sin(a) * rad - lh / 2, w: lw, h: lh };
          if (free(q, [...others, ...own])) hit = { q, wires: [] };
        }
    }
    if (!hit) {
      // on a phone a margin wire may have no room for its words: the step badge and the page text carry them
      if (opts.variant === 'narrow') continue;
      throw new Error(`${spec.id}/${opts.variant}: no room for the label "${rt.e.label}" (${rt.e.from} → ${rt.e.to})`);
    }
    const q = hit.q;
    placed.push(q);
    labels.push({ rt, rect: q, text: rt.e.label });
  }

  // 6. render
  const icons = [...new Set([...nodes.values()].map((n) => n.n.icon).concat([...groups.values()].flatMap((g) => [g.g.tag, g.g.tagLogo?.id]).filter(Boolean) as string[]))];
  const flows = [...new Set(routed.map((x) => x.e.flow))];
  const stepsN = Math.max(0, ...routed.map((x) => x.e.step ?? 0));
  const HOP = spec.hop ?? 1.2;
  const T = spec.motion === 'steps' ? stepsN * HOP + 1.6 : 8;
  /** a meter ticks while the flow travels into its node: the window of its incoming step, as fractions of the cycle */
  const meterWin = (id: string): [number, number] => {
    if (spec.motion !== 'steps') return [0.05, 0.85];
    const k = Math.max(0, ...routed.filter((x) => x.e.to === id && x.e.step != null).map((x) => x.e.step!));
    if (!k) return [0, HOP / T];
    return [((k - 1) * HOP) / T, (k * HOP) / T];
  };
  const out: string[] = [];
  out.push(
    `<svg class="an an-arch" data-diagram="${spec.id}" data-variant="${opts.variant}" data-cycle="${f4(T)}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${prefix}-t ${prefix}-d">`,
    `<title id="${prefix}-t">${esc(spec.title)}</title><desc id="${prefix}-d">${esc(spec.desc)}</desc>`,
    '<defs>',
    ...icons.map((i) => symbol(prefix, i)),
    ...flows.map((f) => `<marker id="${prefix}-mk-${f}" class="an-mk an-f-${f}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker>`),
    '</defs>',
    `<rect class="an-canvas" x="0" y="0" width="${W}" height="${H}" rx="18"/>`,
  );

  // groups, outer first
  out.push('<g class="an-groups">');
  for (const gb of [...groups.values()].sort((a, b) => b.depth - a.depth)) {
    const { g, box, label } = gb;
    const kind = g.kind ?? 'group';
    const deep = (id: string): string[] => {
      const gg = groups.get(id)?.g;
      return gg ? gg.members.flatMap(deep) : [id];
    };
    out.push(`<g class="an-group an-group-${kind}${g.accent ? ` ${accentClass(g.accent)}` : ''}" data-group="${g.id}" data-members="${deep(g.id).join(' ')}">`);
    out.push(`<rect class="an-group-box" x="${r(box.x)}" y="${r(box.y)}" width="${r(box.w)}" height="${r(box.h)}" rx="${kind === 'group' ? 10 : 16}"/>`);
    if (kind === 'boundary' || kind === 'platform') {
      if (g.tagLogo) {
        const t = g.tagLogo;
        out.push(`<g data-tag="${g.id}"><rect class="an-tag an-tag-logo" x="${r(label.x)}" y="${r(label.y)}" width="${r(label.w)}" height="${label.h}" rx="${label.h / 2}"/>`);
        out.push(`<use data-icon="${t.id}" href="#${symId(prefix, t.id)}" x="${r(label.x + 12)}" y="${r(label.y + (label.h - t.h) / 2)}" width="${t.w}" height="${t.h}"><title>${esc(g.label)}</title></use></g>`);
      } else {
      out.push(`<g data-tag="${g.id}"><rect class="an-tag" x="${r(label.x)}" y="${r(label.y)}" width="${r(label.w)}" height="${label.h}" rx="${label.h / 2}"/>`);
      let tx = label.x + 12;
      if (g.tag) {
        out.push(useIcon(prefix, g.tag, opts.rtl ? label.x + label.w - 12 - 18 : label.x + 10, label.y + 4, 18));
        tx = opts.rtl ? label.x + 10 : label.x + 34;
      }
      out.push(`<text class="an-tag-text" x="${r(tx)}" y="${r(label.y + 17.5)}">${esc(g.label)}</text></g>`);
      }
    } else {
      const x = opts.rtl ? label.x + label.w : label.x;
      out.push(`<text class="an-group-label" x="${r(x)}" y="${r(label.y + 13)}" text-anchor="${opts.rtl ? 'end' : 'start'}">${esc(g.label)}</text>`);
    }
    if (g.caption && gb.caption) {
      const x = opts.rtl ? gb.caption.x + gb.caption.w : gb.caption.x;
      out.push(`<text class="an-group-caption" x="${r(x)}" y="${r(gb.caption.y + 11.5)}" text-anchor="${opts.rtl ? 'end' : 'start'}">${esc(g.caption)}</text>`);
    }
    out.push('</g>');
  }
  out.push('</g>');

  // wires
  out.push('<g class="an-edges">');
  for (const rt of routed) {
    const d = roundedPath(rt.pts);
    const a0 = rt.pts[0]!;
    const a1 = rt.pts[rt.pts.length - 1]!;
    const direct = Math.abs(a1.x - a0.x) + Math.abs(a1.y - a0.y);
    out.push(`<path id="${rt.id}" data-edge="${rt.id}" data-direct="${r(direct)}" data-from="${rt.e.from}" data-to="${rt.e.to}" class="an-edge an-f-${rt.e.flow}" d="${d}" marker-end="url(#${prefix}-mk-${rt.e.flow})"/>`);
  }
  out.push('</g>');

  // motion: hidden entirely under prefers-reduced-motion (arch.css)
  out.push('<g class="an-motion" aria-hidden="true">');
  for (const rt of routed) {
    const d = roundedPath(rt.pts);
    if (rt.e.stream || rt.e.flow === 'delivery') out.push(`<path class="an-march an-f-${rt.e.flow}" d="${d}"/>`);
    if (spec.motion === 'steps' && rt.e.step != null) {
      const a = ((rt.e.step - 1) * HOP) / T;
      const b = (rt.e.step * HOP) / T;
      const kt = `0;${f4(a)};${f4(b)};1`;
      out.push(
        `<path class="an-lit an-f-${rt.e.flow}" d="${d}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" values="1;1;0;0" keyTimes="${kt}" dur="${T}s" repeatCount="indefinite"/></path>`,
        `<circle class="an-comet an-f-${rt.e.flow}" r="5" opacity="0"><animateMotion dur="${T}s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="${kt}" calcMode="linear"><mpath href="#${rt.id}"/></animateMotion><animate attributeName="opacity" values="0;1;0" keyTimes="0;${f4(a)};${f4(Math.min(b + 0.01, 0.999))}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></circle>`,
      );
    } else {
      const dur = Math.max(1.8, rt.len / 95);
      for (const k of [0, 0.5]) {
        out.push(`<circle class="an-pulse an-f-${rt.e.flow}" r="3.6"><animateMotion dur="${f4(dur)}s" begin="-${f4(dur * k)}s" repeatCount="indefinite"><mpath href="#${rt.id}"/></animateMotion></circle>`);
      }
    }
  }
  if (spec.motion === 'steps') {
    for (const b of badges) {
      const a = ((b.n - 1) * HOP) / T;
      const e2 = Math.min((b.n * HOP) / T, 0.999);
      out.push(
        `<circle class="an-ring an-f-${b.rt.e.flow}" cx="${r(b.c.x)}" cy="${r(b.c.y)}" r="${BR}" opacity="0"><animate attributeName="r" values="${BR};${BR};${BR + 9};${BR + 9}" keyTimes="0;${f4(a)};${f4(e2)};1" dur="${T}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.9;0;0" keyTimes="0;${f4(a)};${f4(e2)};1" dur="${T}s" repeatCount="indefinite"/></circle>`,
      );
    }
  }
  out.push('</g>');

  // nodes
  out.push('<g class="an-nodes">');
  for (const nb of nodes.values()) {
    const { box } = nb;
    out.push(`<g class="an-node" data-node="${nb.n.id}">`);
    out.push(`<rect class="an-node-box" x="${r(box.x)}" y="${r(box.y)}" width="${r(box.w)}" height="${r(box.h)}" rx="10"/>`);
    out.push(useIcon(prefix, nb.n.icon, nb.icon.x, nb.icon.y, nb.icon.s));
    if (nb.rule !== undefined) out.push(`<path class="an-field-rule" d="M${r(box.x + 10)} ${r(nb.rule)} H${r(box.x + box.w - 10)}"/>`);
    for (const l of nb.lines) {
      if (l.kind === 'field') {
        // identifiers read left to right in both languages; on an Arabic page the column hugs the right edge
        out.push(`<text class="an-field" x="${r(opts.rtl ? box.x + box.w - 13 : box.x + 13)}" y="${r(l.y)}" text-anchor="${opts.rtl ? 'end' : 'start'}" direction="ltr" font-size="${l.size}">${esc(l.text)}</text>`);
        continue;
      }
      const cls = l.kind === 'rate' ? 'an-rate' : l.kind === 'meter' ? 'an-meter' : l.kind === 'total' ? 'an-total' : l.bold ? 'an-name' : 'an-role';
      let data = '';
      if (l.kind === 'meter' && nb.n.meter) data = ` data-meter data-lane="${nb.n.meter.lane}" data-win="${meterWin(nb.n.id).map(f4).join(',')}" data-usd="${esc(JSON.stringify(nb.n.meter.usd))}"`;
      if (l.kind === 'total' && nb.n.total) data = ` data-total="${nb.n.total.lane}" data-usd="${esc(JSON.stringify(nb.n.total.usd))}"`;
      out.push(`<text class="${cls}" x="${r(nb.cx)}" y="${r(l.y)}" text-anchor="middle" font-size="${l.size}"${hasArabic(l.text) ? ' direction="rtl"' : ''}${data}>${esc(l.text)}</text>`);
    }
    out.push('</g>');
  }
  out.push('</g>');

  // labels and badges on top
  out.push('<g class="an-labels">');
  for (const l of labels) {
    out.push(`<g class="an-elabel an-f-${l.rt.e.flow}" data-for="${l.rt.id}" data-covers><rect class="an-elabel-bg" x="${r(l.rect.x)}" y="${r(l.rect.y)}" width="${r(l.rect.w)}" height="${l.rect.h}" rx="${l.rect.h / 2}"/><text x="${r(l.rect.x + l.rect.w / 2)}" y="${r(l.rect.y + 12.5)}" text-anchor="middle" font-size="${LS}"${hasArabic(l.text) ? ' direction="rtl"' : ''}>${esc(l.text)}</text></g>`);
  }
  for (const b of badges) {
    out.push(`<g class="an-badge an-f-${b.rt.e.flow}" data-for="${b.rt.id}" data-covers><circle cx="${r(b.c.x)}" cy="${r(b.c.y)}" r="${BR}"/><text x="${r(b.c.x)}" y="${r(b.c.y + 4)}" text-anchor="middle">${formatNumber(b.n, opts.locale ?? 'en')}</text></g>`);
  }
  out.push('</g>');
  out.push('</svg>');
  return out.join('');
}

const f4 = (n: number) => String(Math.round(n * 10000) / 10000);

export function pointAt(pts: Pt[], d: number): Pt {
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const l = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (left <= l) {
      const t = l ? left / l : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= l;
  }
  return pts[pts.length - 1]!;
}

export const flowsOf = (spec: ArchSpec) => [...new Set(spec.edges.map((e) => e.flow))];
export { sideDir };

/**
 * Phone layouts: rows of one or two nodes stacked top to bottom. `gap` is the distance from the
 * previous row in rows (1.05 inside a group, ~1.8 to a new group, more when a tag sits between).
 */
export function stack(rows: [ids: string[], gap: number][], cols = 2): Record<string, [number, number]> {
  const at: Record<string, [number, number]> = {};
  let y = 0;
  rows.forEach(([ids, gap], i) => {
    if (i) y += gap;
    ids.forEach((id, k) => (at[id] = [ids.length === 1 ? (cols - 1) / 2 : k * ((cols - 1) / (ids.length - 1)), y]));
  });
  return at;
}
