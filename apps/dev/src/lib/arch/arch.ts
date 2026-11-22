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
  /** narrowest tile: room beside two labelled wires that run down a tile's middle */
  tileMin?: number;
  nameSize?: number;
  roleSize?: number;
  /** group ids to leave out in this layout */
  hideGroups?: string[];
  /** canvas margin (default 28); more when wires arc around the outside */
  pad?: number;
  /** edges replaced in this layout (e.g. fewer wires on a phone) */
  edges?: ArchEdge[];
  /** extra room inside a boundary's side (pre-mirror left/right), added when a margin wire's label needs it */
  growPad?: Record<string, { l?: number; r?: number }>;
  /** boundaries whose corner tag sits on the bottom edge here: wires come in across a bare top edge */
  tagBottom?: string[];
  /** groups whose title sits at the far end of the top edge here: a wire drops in across the near corner */
  titleEnd?: string[];
  /** widest spacing between wires leaving one side of a tile (default 2 lattice steps): more where a middle
   * wire's words sit on its own line between two neighbours */
  portStep?: number;
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

/** A margin wire's label had no room: the boundary it runs inside needs this much more on one side. */
class GrowPad extends Error {
  constructor(
    readonly group: string,
    readonly side: 'l' | 'r',
    readonly px: number,
  ) {
    super(`grow ${group} ${side} ${px}`);
  }
}

/**
 * Render, and when a label on a wire down a boundary's margin lane has no room, widen that boundary on that side
 * by the label's width and render again (a phone column has no spare margin until it is asked for).
 */
export function renderArch(spec: ArchSpec, layout: ArchLayout, opts: RenderOpts): string {
  let lay = layout;
  for (let tries = 0; ; tries++) {
    try {
      return renderArchOnce(spec, lay, opts);
    } catch (e) {
      if (!(e instanceof GrowPad) || tries > 6) throw e;
      const cur = lay.growPad?.[e.group] ?? {};
      lay = { ...lay, growPad: { ...lay.growPad, [e.group]: { ...cur, [e.side]: (cur[e.side] ?? 0) + e.px } } };
    }
  }
}

function renderArchOnce(spec: ArchSpec, layout: ArchLayout, opts: RenderOpts): string {
  const S = layout.iconSize ?? 40;
  const NS = layout.nameSize ?? 13;
  const RS = layout.roleSize ?? 11.5;
  const prefix = `${spec.id}-${opts.variant}`;
  // a layout's own wires (a phone column re-routes them) keep each wire's words from the spec: a phone figure says
  // what the wide one says
  const edgesSpec = layout.edges ? layout.edges.map((e) => (e.label ? e : { ...e, label: spec.edges.find((s) => s.from === e.from && s.to === e.to)?.label })) : spec.edges;

  const ids = [...spec.nodes.map((n) => n.id), ...spec.groups.map((g) => g.id)];
  const dup = ids.find((x, i) => ids.indexOf(x) !== i);
  if (dup) throw new Error(`${spec.id}: id used twice: ${dup}`);

  // 1. nodes on the grid
  const nodes = new Map<string, NodeBox>();
  const rolesOf = (n: ArchNode) => (n.role ? (Array.isArray(n.role) ? n.role : [n.role]) : []);
  // never under 11 px: diagrams are drawn at natural size
  const RT = Math.max(11, RS - 0.5);
  // the gap between a tile's lines: Arabic is set in Noto Naskh, whose line box is taller than Latin's
  // (and taller still on Linux), so Arabic tiles get more room between lines
  const lgOf = (_n: ArchNode) => (opts.locale === 'ar' ? 6 : 3);
  const FS = Math.max(11, RS - 0.5);
  /** code type: every glyph about 0.6 em */
  const codeW = (x: string) => [...x].length * FS * 0.62;
  const nodeW = (n: ArchNode) =>
    Math.max(S + 20, ...(n.list ?? []).map((x) => codeW(x) + 26), textWidth(n.name, NS, true) + 16, ...rolesOf(n).map((x) => textWidth(x, RS) + 16), ...(n.rate ?? []).map((x) => textWidth(x, RT) + 16), n.meter ? moneyWidest(opts, n.meter.usd) + 18 : 0, n.total ? moneyWidest(opts, n.total.usd) + 18 : 0);
  const widest = Math.max(layout.tileMin ?? 0, ...spec.nodes.map(nodeW));
  // a column always leaves a wire channel between neighbouring tiles
  layout = { ...layout, colW: Math.max(layout.colW, Math.ceil(widest + 46)) };
  // and a labelled wire between two tiles side by side in a row gets room for its words between them (a label sits
  // beside its wire, 6 px clear of both tiles): the column pitch grows to fit the widest such label
  {
    // a group of one tile stands where its tile does
    const tileOf = (id: string) => {
      const g = spec.groups?.find((x) => x.id === id);
      return g && g.members.length === 1 ? g.members[0]! : id;
    };
    const atOf = (id0: string) => {
      const id = tileOf(id0);
      return layout.at?.[id] ?? spec.nodes.find((m) => m.id === id)?.at;
    };
    let need = 0;
    for (const e of edgesSpec) {
      if (!e.label) continue;
      const a = atOf(e.from);
      const b = atOf(e.to);
      if (!a || !b || !spec.nodes.some((m) => m.id === tileOf(e.from)) || !spec.nodes.some((m) => m.id === tileOf(e.to))) continue;
      const dx = Math.abs(a[0] - b[0]);
      if (a[1] !== b[1] || dx === 0 || dx > 1.01) continue;
      const lw = (hasArabic(e.label) ? textWidth(e.label, 11) * 1.15 : textWidth(e.label, 11)) + 10;
      need = Math.max(need, (widest + lw + 20) / dx);
    }
    if (need) layout = { ...layout, colW: Math.max(layout.colW, Math.ceil(need)) };
  }
  const tileW = Math.max(layout.tileMin ?? 0, Math.min(widest, layout.colW - 46));
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
    const low = big && !!layout.tagBottom?.includes(g.id);
    // room for the title above the members, clear of the border (Arabic line boxes are taller)
    const top = low ? pad + 10 : big ? 58 : opts.locale === 'ar' ? 42 : 34;
    // a caption sits along the bottom, clear of the border (Arabic line boxes are taller)
    const bottom = low ? 58 : g.caption ? (opts.locale === 'ar' ? 34 : 28) : pad;
    const x0 = Math.min(...rects.map((q) => q.x)) - pad - (layout.growPad?.[g.id]?.l ?? 0);
    const y0 = Math.min(...rects.map((q) => q.y)) - top;
    let x1 = Math.max(...rects.map((q) => q.x + q.w)) + pad + (layout.growPad?.[g.id]?.r ?? 0);
    const y1 = Math.max(...rects.map((q) => q.y + q.h)) + bottom;
    const lw = g.tagLogo ? g.tagLogo.w + 24 : big ? textWidth(g.label, 12.5, true) + (g.tag ? 30 : 0) + 20 : textWidth(g.label, 12.5, true) + 4;
    // a boundary's tag sits inside its box, clear of the border (never on it)
    // a group is at least as wide as its title, with 6 px clear of each border
    const need = Math.max(lw + (big ? 28 : 20) + 12, g.caption ? textWidth(g.caption, 11) + 4 + 32 : 0);
    if (x1 - x0 < need) x1 = x0 + need;
    const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const label = big ? { x: box.x + 14, y: low ? box.y + box.h - 8 - 26 : box.y + 8, w: lw, h: 26 } : { x: box.x + 10, y: box.y + (opts.locale === 'ar' ? 15 : 10), w: lw, h: 17 };
    const caption = g.caption ? { x: box.x + 10, y: box.y + box.h - (opts.locale === 'ar' ? 27 : 23), w: textWidth(g.caption, 11) + 4, h: 15 } : undefined;
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
    const atEnd = (big && gb.g.tagEnd) || layout.titleEnd?.includes(gb.g.id) ? !opts.rtl : opts.rtl;
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
      // an account boundary is a long dashed line: a wire running beside it reads as part of it, so keep well off
      if (gb.g.kind === 'boundary') router.penalise(rc, 11, 40);
      else router.penalise(rc, 9, 12);
  }
  // nothing runs along the drawing's own edges: a scroll box opens on a cut wire otherwise
  router.penalise({ x: 0, y: 0, w: W, h: 0 }, 10, 200);
  router.penalise({ x: 0, y: H, w: W, h: 0 }, 10, 200);
  router.penalise({ x: 0, y: 0, w: 0, h: H }, 10, 200);
  router.penalise({ x: W, y: 0, w: 0, h: H }, 10, 200);

  const rectOf = (id: string): { rect: Rect; isNode: boolean; anchorY: number; icon?: Rect } => {
    const nb = nodes.get(id);
    if (nb) return { rect: nb.box, isNode: true, anchorY: nb.icon.y + nb.icon.s / 2, icon: { x: nb.icon.x, y: nb.icon.y, w: nb.icon.s, h: nb.icon.s } };
    const gb = groups.get(id);
    if (!gb) throw new Error(`${spec.id}: unknown endpoint ${id}`);
    return { rect: gb.box, isNode: false, anchorY: gb.box.y + gb.box.h / 2 };
  };
  const snap = (v: number) => Math.round(v / G) * G;
  /** head: the arrowhead end, whose stub stands farther out so the wire arrives straight (12 px past its last corner) */
  // an arrowhead end ('far') stands 20+ px out, or in a tight gap ('mid') 14 px: either leaves 12 px of straight
  // wire before the arrowhead (a corner there reads as a hook)
  const endpoint = (id: string, side: Side, along?: number, head: boolean | 'mid' = false): Endpoint => {
    const { rect, isNode, anchorY } = rectOf(id);
    const m = head === 'mid' ? 14 : head ? (isNode ? 22 : 20) : isNode ? M + 2 : 6;
    if (side === 'e' || side === 'w') {
      const y = snap(along ?? anchorY);
      // the wire ends at the tile's edge (wires are drawn over tiles, so reaching in to the icon would cross the tile)
      const px = side === 'e' ? rect.x + rect.w : rect.x;
      const bx = side === 'e' ? rect.x + rect.w : rect.x;
      const sx = side === 'e' ? Math.ceil((bx + m) / G) * G : Math.floor((bx - m) / G) * G;
      return { port: { x: px, y }, side, stub: { x: sx, y } };
    }
    const x = snap(along ?? rect.x + rect.w / 2);
    const py = side === 's' ? rect.y + rect.h : rect.y;
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
    const gb = groups.get(id);
    const lo = (v ? q.y : q.x) + 40;
    // a side port on a boundary tagged along its bottom stays above the tag's row
    const hi = v && gb && layout.tagBottom?.includes(id) ? gb.label.y - 24 : (v ? q.y + q.h : q.x + q.w) - 40;
    let at = Math.max(lo, Math.min(hi, v ? other.y : other.x));
    // never land on the group's own header (top) or caption (bottom): step past it
    const block = side === 'n' ? gb?.label : side === 's' ? gb?.caption : undefined;
    if (block && !v && at > block.x - 14 && at < block.x + block.w + 14) {
      const after = block.x + block.w + 22;
      const before = block.x - 22;
      at = after <= q.x + q.w - 20 && (!opts.rtl || before < q.x + 20) ? after : before;
    }
    return at;
  };
  // a wire between two things inside an account boundary stays inside it: the innermost boundary holding both
  // ends, 12 px in from its border
  const holdsBoth = (e: ArchEdge): Rect | undefined => {
    const a = rectOf(e.from).rect;
    const b = rectOf(e.to).rect;
    const inR = (r2: Rect, o: Rect) => r2.x >= o.x && r2.y >= o.y && r2.x + r2.w <= o.x + o.w && r2.y + r2.h <= o.y + o.h;
    const hold = [...groups.values()].filter((gb) => gb.g.kind === 'boundary' && gb.box !== a && gb.box !== b && inR(a, gb.box) && inR(b, gb.box)).sort((p, q) => p.box.w * p.box.h - q.box.w * q.box.h)[0];
    return hold ? { x: hold.box.x + 12, y: hold.box.y + 12, w: hold.box.w - 24, h: hold.box.h - 24 } : undefined;
  };
  /**
   * Try each candidate route inside the holding boundary first; only when none fits there, the same candidates
   * anywhere. (Falling back per candidate let a far stub outside the boundary win over a near one inside it.)
   */
  const inThenOut = <T,>(e: ArchEdge, attempt: (within?: Rect) => T | null | undefined): T | null => {
    const w = holdsBoth(e);
    return (w && attempt(w)) || attempt() || null;
  };
  // pass 1: pick a side for each end
  const chosen = edgesSpec.map((e) => {
    const starts = sidesOf(e.fromSide).map((s) => endpoint(e.from, s, facing(e.from, s, centreOf(e.to))));
    // the arrowhead end prefers a stub far enough out to arrive straight; a tight gap takes the near one
    const goalsAt = (head: boolean | 'mid') => sidesOf(e.toSide).map((s) => endpoint(e.to, s, facing(e.to, s, centreOf(e.from)), head));
    const res = inThenOut(e, (w) => router.route(starts, goalsAt(true), 10, w) ?? router.route(starts, goalsAt('mid'), 10, w) ?? router.route(starts, goalsAt(false), 10, w));
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
    // a straight fan-out keeps its ends in the same order; a U-wire (out and back in on the same side) is nested: the
    // one going farthest takes the port farthest from where they all go, so its lane runs outside the others; and the
    // U-wires take the ports on the side they head to, past the straight wires, so their lanes never cut across them
    const { rect: own } = rectOf(id);
    const mid = vertical ? own.y + own.h / 2 : own.x + own.w / 2;
    const key = (x: { edge: number; other: Pt }) => {
      const v = vertical ? x.other.y : x.other.x;
      if (chosen[x.edge]!.fromSide !== chosen[x.edge]!.toSide) return v;
      return (v >= mid ? 1e6 : -1e6) - v;
    };
    // wires bound for the same place keep their order left to right, so the Arabic figure (laid out mirrored) runs
    // them right to left: the same wires sit side by side in the same order in both languages
    list.sort((p, q) => key(p) - key(q) || (opts.rtl && !vertical ? q.edge - p.edge : 0));
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
    const step = Math.min(layout.portStep ?? 2 * G, Math.max(G, Math.floor((span - 2 * G) / Math.max(1, list.length) / G) * G));
    list.forEach((s2, j) => along.set(`${s2.edge}|${s2.end}`, centre + (j - (list.length - 1) / 2) * step));
  }
  // two ends that face each other across a gap and overlap along it share one line: a straight wire, never an
  // S-step from two centres that don't quite line up (only when each is the only wire on its side)
  edgesSpec.forEach((e, i) => {
    const fs = chosen[i]!.fromSide;
    const ts = chosen[i]!.toSide;
    const opp = (fs === 'n' && ts === 's') || (fs === 's' && ts === 'n') || (fs === 'e' && ts === 'w') || (fs === 'w' && ts === 'e');
    if (!opp) return;
    if ((slots.get(`${e.from}|${fs}`)?.length ?? 0) !== 1 || (slots.get(`${e.to}|${ts}`)?.length ?? 0) !== 1) return;
    const vertical = fs === 'e' || fs === 'w';
    const span = (id: string) => {
      const { rect, isNode } = rectOf(id);
      // a tile's port stays a lattice step in from its corners; a group's 40 px (clear of its rounded corners)
      const inset = isNode ? G : 40;
      return vertical ? [rect.y + inset, rect.y + rect.h - inset] : [rect.x + inset, rect.x + rect.w - inset];
    };
    const [a0, a1] = span(e.from);
    const [b0, b1] = span(e.to);
    const lo = Math.max(a0!, b0!);
    const hi = Math.min(a1!, b1!);
    if (hi - lo < G) return;
    // the shared line closest to where the start already is
    const cur = along.get(`${i}|from`) ?? (vertical ? rectOf(e.from).anchorY : (a0! + a1!) / 2);
    // snapped to the lattice, inward: a snap past either end of the shared range is a step back inside it
    let v = snap(Math.max(lo, Math.min(hi, cur)));
    if (v < lo) v += G;
    if (v > hi) v -= G;
    if (v < lo || v > hi) return;
    along.set(`${i}|from`, v);
    along.set(`${i}|to`, v);
  });
  // a lone wire on a side lines up with its other end's spread port when that fits on its tile: a straight wire, no jog
  // (a phone column's tight lanes can turn a far move into a detour: there, only a nudge of up to two lattice steps)
  // When the other end's port is off this tile (a taller tile beside it, as Arabic's longer lines make), the other
  // side's whole spread moves to meet this port instead, if every port in it stays on its tile. Twice: a move
  // re-aims the other wires of that spread, whose own lone ends line up on the second pass.
  const range = (id: string, vertical: boolean) => {
    const { rect, isNode } = rectOf(id);
    const inset = isNode ? G : 40;
    return [(vertical ? rect.y : rect.x) + inset, (vertical ? rect.y + rect.h : rect.x + rect.w) - inset] as const;
  };
  for (let pass = 0; pass < 2; pass++)
    edgesSpec.forEach((e, i) => {
      for (const [end, other] of [['from', 'to'], ['to', 'from']] as const) {
        const id = end === 'from' ? e.from : e.to;
        const side = end === 'from' ? chosen[i]!.fromSide : chosen[i]!.toSide;
        const otherSide = other === 'from' ? chosen[i]!.fromSide : chosen[i]!.toSide;
        const otherId = other === 'from' ? e.from : e.to;
        // (a group's lone port too: its wire lines up with the tile port it leaves from)
        const spread = slots.get(`${otherId}|${otherSide}`) ?? [];
        if ((slots.get(`${id}|${side}`)?.length ?? 0) !== 1 || spread.length < 2) continue;
        const vertical = side === 'e' || side === 'w';
        if (vertical !== (otherSide === 'e' || otherSide === 'w')) continue;
        const v = along.get(`${i}|${other}`);
        if (v == null) continue;
        const [lo, hi] = range(id, vertical);
        const cur = along.get(`${i}|${end}`);
        if (opts.variant !== 'wide' && (cur == null || Math.abs(v - cur) > 2 * G)) continue;
        if (v >= lo && v <= hi) {
          along.set(`${i}|${end}`, v);
          continue;
        }
        if (opts.variant !== 'wide' || cur == null) continue;
        // the nearest lattice line on this tile, and the spread moved by the same amount
        let t = snap(Math.max(lo, Math.min(hi, v)));
        if (t < lo) t += G;
        if (t > hi) t -= G;
        const d = t - v;
        const [olo, ohi] = range(otherId, vertical);
        const moved = spread.map((s2) => (along.get(`${s2.edge}|${s2.end}`) ?? NaN) + d);
        if (t < lo || t > hi || moved.some((m) => !(m >= olo && m <= ohi))) continue;
        spread.forEach((s2, j) => along.set(`${s2.edge}|${s2.end}`, moved[j]!));
        along.set(`${i}|${end}`, t);
      }
    });

  /**
   * Straighten a short S-step mid-wire (two runs in the same direction offset by under 16 px, joined by a tiny
   * cross run): move the run before it, or the one after, onto the other's line, whichever costs no more and stays
   * clear. Ports never move. A zig-zag that small reads as a glitch, not a route.
   */
  const dejog = (input: Pt[]): Pt[] => {
    let pts = input.map((p) => ({ ...p }));
    // the first and last runs start at a port inside a tile's blocked margin and only stretch along their own line:
    // the comparison is over the runs between
    const lenOf = (poly: Pt[]) => poly.slice(2, -1).reduce((t, p, i) => t + router.costAlong(poly[i + 1]!, p), 0);
    for (let guard = 0; guard < 8; guard++) {
      let changed = false;
      for (let i = 1; i + 2 < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const c = pts[i + 1]!;
        const d = pts[i + 2]!;
        const vAB = a.x === b.x;
        const vCD = c.x === d.x;
        const short = Math.abs(c.x - b.x) + Math.abs(c.y - b.y);
        if (vAB !== vCD || short >= 16 || short === 0) continue;
        // same direction on both sides of the step (an S), not a U
        const dirAB = vAB ? Math.sign(b.y - a.y) : Math.sign(b.x - a.x);
        const dirCD = vCD ? Math.sign(d.y - c.y) : Math.sign(d.x - c.x);
        if (dirAB !== dirCD) continue;
        const opts2: Pt[][] = [];
        // run c→d onto a→b's line (d moves, so d must not be the end port)
        if (i + 2 < pts.length - 1) {
          const q = pts.map((p) => ({ ...p }));
          if (vAB) {
            q[i + 2]!.x = a.x;
          } else {
            q[i + 2]!.y = a.y;
          }
          q.splice(i, 2);
          opts2.push(q);
        }
        // run a→b onto c→d's line (a moves, so a must not be the start port)
        if (i - 1 > 0) {
          const q = pts.map((p) => ({ ...p }));
          if (vAB) {
            q[i - 1]!.x = c.x;
          } else {
            q[i - 1]!.y = c.y;
          }
          q.splice(i, 2);
          opts2.push(q);
        }
        const before = lenOf(pts);
        // a step against a wire's first or last run reads as a misaligned port: straighten it even at a little more
        // soft cost (a lane nearer a border), as long as the path stays clear
        const atEnd = i - 1 <= 1 || i + 2 >= pts.length - 2;
        // the arrowhead keeps a straight run in front of it (the near stub's 14 px), so it never ends in a hook
        const lastRun = (q: Pt[]) => Math.abs(q[q.length - 1]!.x - q[q.length - 2]!.x) + Math.abs(q[q.length - 1]!.y - q[q.length - 2]!.y);
        const best = opts2
          .map((q) => ({ q: simplify(q), cost: lenOf(simplify(q)) }))
          .filter((o) => Number.isFinite(o.cost) && (atEnd || o.cost <= before + 4) && lastRun(o.q) >= Math.min(14, lastRun(pts)))
          .sort((x, y) => x.cost - y.cost)[0];
        if (best) {
          pts = best.q;
          changed = true;
          break;
        }
      }
      if (!changed) break;
    }
    return pts;
  };
  // pass 2: fixed ports, committed in order so wires keep apart
  const routed: Routed[] = edgesSpec.map((e, i) => {
    const a = endpoint(e.from, chosen[i]!.fromSide, along.get(`${i}|from`));
    const b = endpoint(e.to, chosen[i]!.toSide, along.get(`${i}|to`), true);
    const near = endpoint(e.to, chosen[i]!.toSide, along.get(`${i}|to`), 'mid');
    // the far stub gives a straight arrival, unless it makes the wire loop back in a tight gap: then the near one
    // a loop: the far stub sits past where a tight gap lets the wire arrive, so it overshoots and comes back with
    // extra corners. A wire round a margin has the same corners either way (an outer lane is only longer).
    // two ports facing each other on one line across a tight gap (too tight for the router's stubs): one straight run
    {
      const fs = chosen[i]!.fromSide;
      const ts = chosen[i]!.toSide;
      const pa = a.port;
      const pb = b.port;
      const facing = (fs === 'e' && ts === 'w' && pa.x < pb.x) || (fs === 'w' && ts === 'e' && pa.x > pb.x) ? pa.y === pb.y : (fs === 's' && ts === 'n' && pa.y < pb.y) || (fs === 'n' && ts === 's' && pa.y > pb.y) ? pa.x === pb.x : false;
      if (facing && Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y) < 6 * G) {
        // (nothing to commit: like every wire, only the runs between its two port stubs claim lattice cells)
        const pts = [pa, pb];
        return { e, id: `${prefix}-e${i}`, pts, len: polyLength(pts) };
      }
      // facing ports on one line with nothing in between: the straight run, never a search that may jog
      if (facing && Number.isFinite(router.costAlong(a.stub, b.stub))) {
        router.commit([a.stub, b.stub]);
        const pts = [pa, pb];
        return { e, id: `${prefix}-e${i}`, pts, len: polyLength(pts) };
      }
    }
    type R = NonNullable<ReturnType<Router['route']>>;
    // corners once straightened: a near stub whose small end step straightens beats a far one that keeps its jog
    const turnsOf = (r: R) => dejog(simplify([r.start.port, ...r.pts, r.goal.port])).length;
    const res = inThenOut(e, (w) => {
      const far = router.route([a], [b], 8, w);
      const close = router.route([a], [near], 8, w);
      return (
        (far && close ? (turnsOf(far) > turnsOf(close) + 1 ? close : far) : (far ?? close)) ??
        router.route(sidesOf(e.fromSide).map((s) => endpoint(e.from, s)), sidesOf(e.toSide).map((s) => endpoint(e.to, s, undefined, true)), 8, w) ??
        router.route(sidesOf(e.fromSide).map((s) => endpoint(e.from, s)), sidesOf(e.toSide).map((s) => endpoint(e.to, s)), 8, w)
      );
    });
    if (!res) throw new Error(`${spec.id}: no route ${e.from} → ${e.to}`);
    const pts = dejog(simplify([res.start.port, ...res.pts, res.goal.port]));
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
  // labels and badges keep 12 px from the drawing's sides: a scroll box opens with nothing touching its edge
  // `wideOK`: a margin wire's label may stand past the drawing's side (the canvas then grows to hold it, below)
  let wideOK = false;
  const inCanvas = (q: Rect) => (wideOK ? q.x >= -160 && q.x + q.w <= W + 160 : q.x >= 12 && q.x + q.w <= W - 12) && q.y >= 4 && q.y + q.h <= H - 4;
  // labels and badges keep 6 px from every line and group border
  const CLEAR = 6;
  const free = (q: Rect, wires: Rect[]) => inCanvas(q) && !obstacles.some((o) => intersects(q, o, CLEAR)) && !placed.some((o) => intersects(q, o, 4)) && !wires.some((o) => intersects(q, o, CLEAR));

  // each group's outline as four thin strips: a label may sit inside or outside a group, never on its edge
  const borders: Rect[] = [...groups.values()].flatMap(({ box: b }) => [
    { x: b.x - 1, y: b.y - 1, w: b.w + 2, h: 2 },
    { x: b.x - 1, y: b.y + b.h - 1, w: b.w + 2, h: 2 },
    { x: b.x - 1, y: b.y - 1, w: 2, h: b.h + 2 },
    { x: b.x + b.w - 1, y: b.y - 1, w: 2, h: b.h + 2 },
  ]);
  // step badges first, at their natural spot near each wire's start; labels then fit around them
  const badges: { rt: Routed; c: Pt; n: number; at: number }[] = [];
  // radius 9: a badge on one of two wires spread 16 px apart still keeps 6 px from the other
  const BR = 9;
  for (const rt of routed) {
    if (rt.e.step == null || spec.badges === false) continue;
    let best: { c: Pt; at: number } | null = null;
    const others = [...routed.filter((x) => x !== rt).flatMap((x) => segRects(x)), ...borders];
    // the circle's own distance to every other wire (a square test lets a round badge sit 5 px from a line)
    const segs = routed.filter((x) => x !== rt).flatMap((x) => x.pts.slice(1).map((p, i) => [x.pts[i]!, p] as const));
    const wireDist = (c: Pt) =>
      Math.min(
        999,
        ...segs.map(([a, b]) => {
          const vx = b.x - a.x;
          const vy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((c.x - a.x) * vx + (c.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
          return Math.hypot(c.x - a.x - t * vx, c.y - a.y - t * vy);
        }),
      );
    const WIRE = BR + 7;
    for (let d = 22; d < rt.len - 22; d += 4) {
      const c = pointAt(rt.pts, d);
      const q = { x: c.x - BR, y: c.y - BR, w: 2 * BR, h: 2 * BR };
      // 5 px from every label and badge already placed, 6 px (and a bit) from every other wire
      if (free(q, others) && !placed.some((o) => intersects(q, o, 5)) && wireDist(c) >= WIRE) {
        best = { c, at: d };
        break;
      }
    }
    // no spot clear of everything: the point of the wire farthest from any group border
    const clearance = (c: Pt) => Math.min(999, ...borders.map((o) => Math.hypot(Math.max(o.x - c.x, 0, c.x - (o.x + o.w)), Math.max(o.y - c.y, 0, c.y - (o.y + o.h)))));
    let fb = best;
    if (!fb) {
      let far = -1;
      for (let d = 4; d < rt.len - 4; d += 2) {
        const c = pointAt(rt.pts, d);
        const q = { x: c.x - BR, y: c.y - BR, w: 2 * BR, h: 2 * BR };
        // never on a tile, a title or another wire; among the rest, the farthest from any border
        if (obstacles.some((o) => intersects(q, o, CLEAR)) || placed.some((o) => intersects(q, o, 3)) || wireDist(c) < WIRE) continue;
        const k = clearance(c);
        if (k > far) {
          far = k;
          fb = { c, at: d };
        }
      }
      // still nothing: the spot that keeps farthest from other wires and borders, never on a tile or another badge
      if (!fb) {
        let bestK = -Infinity;
        for (let d = 4; d < rt.len - 4; d += 2) {
          const c = pointAt(rt.pts, d);
          const q = { x: c.x - BR, y: c.y - BR, w: 2 * BR, h: 2 * BR };
          if (!inCanvas(q) || obstacles.some((o) => intersects(q, o, CLEAR)) || placed.some((o) => intersects(q, o, 4))) continue;
          const k = Math.min(clearance(c), wireDist(c) - BR);
          if (k > bestK) {
            bestK = k;
            fb = { c, at: d };
          }
        }
      }
      fb ??= { c: pointAt(rt.pts, rt.len / 2), at: rt.len / 2 };
    }
    placed.push({ x: fb.c.x - BR, y: fb.c.y - BR, w: 2 * BR, h: 2 * BR });
    badges.push({ rt, c: fb.c, n: rt.e.step, at: fb.at });
  }

  const labels: { rt: Routed; rect: Rect; text: string; covers?: boolean }[] = [];
  /** each group's title row, edge to edge: a wire's label never sits beside another group's title */
  const titleRows: Rect[] = [...groups.values()].map((gb) =>
    layout.tagBottom?.includes(gb.g.id) ? { x: gb.box.x, y: gb.label.y - 4, w: gb.box.w, h: gb.box.y + gb.box.h - gb.label.y + 4 } : { x: gb.box.x, y: gb.box.y, w: gb.box.w, h: gb.label.y + gb.label.h - gb.box.y + 4 },
  );
  const LS = 11;
  for (const rt of routed) {
    if (!rt.e.label) continue;
    // Noto Naskh at weight 600 runs wider than the estimate: an Arabic pill takes room so the words stay on it,
    // falling back to the estimate where a gap is too tight
    const lw0 = textWidth(rt.e.label, LS) + 10;
    const lwAr = hasArabic(rt.e.label) ? textWidth(rt.e.label, LS) * 1.15 + 10 : lw0;
    let lw = lwAr;
    let hit: { q: Rect; wires: Rect[] } | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt === 1) {
        if (lwAr === lw0) break;
        lw = lw0;
      }
    const lh = 17;
    const segs = rt.pts.slice(1).map((p, i) => ({ a: rt.pts[i]!, b: p, i, len: Math.abs(p.x - rt.pts[i]!.x) + Math.abs(p.y - rt.pts[i]!.y) }));
    const order = [...segs].sort((p, q) => q.len - p.len);
    const others = routed.filter((x) => x !== rt).flatMap((x) => segRects(x));
    const cands: { q: Rect; wires: Rect[] }[] = [];
    for (const s of order) {
      const horiz = s.a.y === s.b.y;
      // middle first, then outwards: a short segment may hold a label that overhangs its ends
      for (const t of [0.5, 0.38, 0.62, 0.26, 0.74, 0.14, 0.86, 0.05, 0.95, 0.2, 0.8, 0.32, 0.68, 0.44, 0.56]) {
        const p = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
        if (!horiz && s.len < 10) continue;
        const own = segRects(rt);
        // 8, 12 or 16 px from the wire: still within 24 px of it, with more room to clear neighbours
        for (const off of [CLEAR + 2, CLEAR + 6, CLEAR + 10]) {
          if (horiz) {
            cands.push({ q: { x: p.x - lw / 2, y: p.y - off - lh, w: lw, h: lh }, wires: [...others, ...own] });
            cands.push({ q: { x: p.x - lw / 2, y: p.y + off, w: lw, h: lh }, wires: [...others, ...own] });
          } else {
            const right = { x: p.x + off, y: p.y - lh / 2, w: lw, h: lh };
            const left = { x: p.x - off - lw, y: p.y - lh / 2, w: lw, h: lh };
            for (const q of opts.rtl ? [left, right] : [right, left]) cands.push({ q, wires: [...others, ...own] });
          }
        }
      }
    }
    // never on a wire or a group's border: a label always sits beside its line
    for (const c of cands) c.wires.push(...borders);
    // first choice: outside every group the wire doesn't run inside (a wire between two groups is labelled in
    // the gap between them, not inside one of them), and never in a group's title row
    const ends = [rt.e.from, rt.e.to].map((id) => nodes.get(id)?.box ?? groups.get(id)?.box).filter(Boolean) as Rect[];
    const within = (b: Rect, g: Rect) => b.x >= g.x && b.y >= g.y && b.x + b.w <= g.x + g.w && b.y + b.h <= g.y + g.h;
    const foreign = [...groups.values()].filter((gb) => !(ends.length === 2 && ends.every((b) => b !== gb.box && within(b, gb.box)))).map((gb) => gb.box);

    hit = cands.find((c) => free(c.q, c.wires) && !titleRows.some((t) => intersects(c.q, t, 4)) && !foreign.some((g) => intersects(c.q, g, 4)));
    hit ??= cands.find((c) => free(c.q, c.wires) && !titleRows.some((t) => intersects(c.q, t, 4)));
    if (!hit) {
      // last resort: the nearest free spot around the wire's middle, still clear of every node and label
      // last resort: the nearest free spot beside any point of the wire, still clear of every node, line and label
      const own = segRects(rt);
      // a label stays within 24 px of its wire, and never in a group's title row
      for (let rad = 8; rad <= 24 && !hit; rad += 4)
        for (const f of [0.5, 0.3, 0.7, 0.15, 0.85])
          for (let k = 0; k < 24 && !hit; k++) {
            const mid = pointAt(rt.pts, rt.len * f);
            const a = (k / 24) * Math.PI * 2;
            const q = { x: mid.x + Math.cos(a) * rad - lw / 2, y: mid.y + Math.sin(a) * rad - lh / 2, w: lw, h: lh };
            if (free(q, [...others, ...own, ...borders]) && !titleRows.some((t) => intersects(q, t, 4))) hit = { q, wires: [] };
          }
    }
      if (hit) break;
    }
    // still nothing beside the wire: on it, as an opaque pill over its own line (sample 5 labels its arrows this
    // way), on a straight run clear of its corners and both ends, and clear of every other wire, tile and title
    let covers = false;
    if (!hit) {
      const lh = 17;
      const others = routed.filter((x) => x !== rt).flatMap((x) => segRects(x));
      const segs = rt.pts.slice(1).map((p, i) => ({ a: rt.pts[i]!, b: p, len: Math.abs(p.x - rt.pts[i]!.x) + Math.abs(p.y - rt.pts[i]!.y), at: 0 }));
      let run = 0;
      for (const sg of segs) {
        sg.at = run;
        run += sg.len;
      }
      found: for (const sg of [...segs].sort((p, q) => q.len - p.len)) {
        const horiz = sg.a.y === sg.b.y;
        const need = (horiz ? lw : lh) / 2 + 8;
        for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
          const d = t * sg.len;
          // a straight stretch under the whole pill, and 26 px from the wire's start and its arrowhead
          if (d < need || sg.len - d < need || sg.at + d < 26 || rt.len - (sg.at + d) < 26) continue;
          const c = { x: sg.a.x + (sg.b.x - sg.a.x) * t, y: sg.a.y + (sg.b.y - sg.a.y) * t };
          const q = { x: c.x - lw / 2, y: c.y - lh / 2, w: lw, h: lh };
          if (free(q, [...others, ...borders]) && !titleRows.some((tr) => intersects(q, tr, 4))) {
            hit = { q, wires: [] };
            covers = true;
            break found;
          }
        }
      }
    }
    // a wire down a margin lane: its words beside it, outside the drawing's old edge (the canvas widens to fit)
    if (!hit) {
      wideOK = true;
      const lh = 17;
      const others = routed.filter((x) => x !== rt).flatMap((x) => segRects(x));
      const own = segRects(rt);
      for (const sg of rt.pts.slice(1).map((p, i) => ({ a: rt.pts[i]!, b: p })).filter((sg) => sg.a.x === sg.b.x).sort((p, q) => Math.abs(q.b.y - q.a.y) - Math.abs(p.b.y - p.a.y))) {
        if (hit) break;
        for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
          const y = sg.a.y + (sg.b.y - sg.a.y) * t - lh / 2;
          const outer = sg.a.x < W / 2 ? [{ x: sg.a.x - CLEAR - 4 - lw, y, w: lw, h: lh }] : [{ x: sg.a.x + CLEAR + 4, y, w: lw, h: lh }];
          const q = outer[0]!;
          if (free(q, [...others, ...own, ...borders]) && !titleRows.some((tr) => intersects(q, tr, 4))) {
            hit = { q, wires: [] };
            break;
          }
        }
      }
      wideOK = false;
    }
    if (!hit) {
      // a wire down a boundary's margin lane: give the boundary room on that side for the words, then render again
      for (const sg of rt.pts.slice(1).map((p, i) => ({ a: rt.pts[i]!, b: p }))) {
        if (sg.a.x !== sg.b.x || Math.abs(sg.b.y - sg.a.y) < 60) continue;
        const gb = [...groups.values()].find((g) => g.g.kind === 'boundary' && sg.a.x > g.box.x && sg.a.x < g.box.x + g.box.w && (sg.a.x - g.box.x < 64 || g.box.x + g.box.w - sg.a.x < 64));
        if (!gb) continue;
        const leftHere = sg.a.x - gb.box.x < 64;
        // groups were laid out before the RTL mirror: left here is right there
        throw new GrowPad(gb.g.id, leftHere !== !!opts.rtl ? 'l' : 'r', Math.ceil(lw + 20));
      }
      // a wire's words are never dropped (a phone figure says what the wide one says): no room is a layout bug
      throw new Error(`${spec.id}/${opts.variant}: no room for the label "${rt.e.label}" (${rt.e.from} → ${rt.e.to}) along ${rt.pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ")} in ${W}×${H}`);
    }
    const q = hit.q;
    placed.push(q);
    labels.push({ rt, rect: q, text: rt.e.label, covers });
  }


  // a label placed past a side: the canvas grows to keep it 16 px inside
  const growL = Math.max(0, 16 - Math.min(0, ...labels.map((l) => l.rect.x)) - (labels.some((l) => l.rect.x < 0) ? 0 : 16));
  const growR = Math.max(0, Math.max(W, ...labels.map((l) => l.rect.x + l.rect.w)) - W + (labels.some((l) => l.rect.x + l.rect.w > W) ? 16 : 0));
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
    `<svg class="an an-arch" data-diagram="${spec.id}" data-variant="${opts.variant}" data-cycle="${f4(T)}" viewBox="${r(-growL)} 0 ${r(W + growL + growR)} ${H}" width="${r(W + growL + growR)}" height="${H}" role="img" aria-labelledby="${prefix}-t ${prefix}-d">`,
    `<title id="${prefix}-t">${esc(spec.title)}</title><desc id="${prefix}-d">${esc(spec.desc)}</desc>`,
    '<defs>',
    ...icons.map((i) => symbol(prefix, i)),
    ...flows.map((f) => `<marker id="${prefix}-mk-${f}" class="an-mk an-f-${f}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker>`),
    '</defs>',
    `<rect class="an-canvas" x="${r(-growL)}" y="0" width="${r(W + growL + growR)}" height="${H}" rx="18"/>`,
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
  // nodes, then the wires over them: an arrowhead is never hidden under a tile, in either mode
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
    // marching light only where a figure asks for a stream: a dashed line means control, nothing else
    if (rt.e.stream) out.push(`<path class="an-march an-f-${rt.e.flow}" d="${d}"/>`);
    if (spec.motion === 'steps' && rt.e.step != null) {
      const a = ((rt.e.step - 1) * HOP) / T;
      const b = (rt.e.step * HOP) / T;
      const kt = `0;${f4(a)};${f4(b)};1`;
      // a control wire stays dashed: no solid lit trace over it, only the comet
      if (rt.e.flow !== 'control') out.push(`<path class="an-lit an-f-${rt.e.flow}" d="${d}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" values="1;1;0;0" keyTimes="${kt}" dur="${T}s" repeatCount="indefinite"/></path>`);
      out.push(`<circle class="an-comet an-f-${rt.e.flow}" r="5" opacity="0"><animateMotion dur="${T}s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="${kt}" calcMode="linear"><mpath href="#${rt.id}"/></animateMotion><animate attributeName="opacity" values="0;1;0" keyTimes="0;${f4(a)};${f4(Math.min(b + 0.01, 0.999))}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></circle>`);
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

  // labels and badges on top
  out.push('<g class="an-labels">');
  for (const l of labels) {
    out.push(`<g class="an-elabel an-f-${l.rt.e.flow}${l.covers ? ' an-elabel-on' : ''}" data-for="${l.rt.id}"${l.covers ? ' data-covers' : ''}><rect class="an-elabel-bg" x="${r(l.rect.x)}" y="${r(l.rect.y)}" width="${r(l.rect.w)}" height="${l.rect.h}" rx="${l.rect.h / 2}"/><text x="${r(l.rect.x + l.rect.w / 2)}" y="${r(l.rect.y + 12.5)}" text-anchor="middle" font-size="${LS}"${hasArabic(l.text) ? ' direction="rtl"' : ''}>${esc(l.text)}</text></g>`);
  }
  // two wires on one step (parallel branches fire together) read as sub-steps, never as one number twice: 3a, 3b
  // («٣أ», «٣ب»), lettered in wire order
  const shared = new Map<number, Routed[]>();
  for (const b of badges) shared.set(b.n, [...(shared.get(b.n) ?? []), b.rt]);
  const subLetters = opts.locale === 'ar' ? ['أ', 'ب', 'ج', 'د'] : ['a', 'b', 'c', 'd'];
  for (const b of badges) {
    const same = shared.get(b.n)!;
    const sub = same.length > 1 ? (subLetters[same.indexOf(b.rt)] ?? '') : '';
    const text = formatNumber(b.n, opts.locale ?? 'en') + sub;
    out.push(`<g class="an-badge an-f-${b.rt.e.flow}${sub ? ' an-badge-sub' : ''}" data-for="${b.rt.id}" data-covers><circle cx="${r(b.c.x)}" cy="${r(b.c.y)}" r="${BR}"/><text x="${r(b.c.x)}" y="${r(b.c.y + 4)}" text-anchor="middle"${sub && opts.locale === 'ar' ? ' direction="rtl"' : ''}>${text}</text></g>`);
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
