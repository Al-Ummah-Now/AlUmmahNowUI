/**
 * Orthogonal edge router: A* over a lattice (one point every G px) with node boxes as hard
 * obstacles, a bend penalty, and penalties for running on top of (or hugging) wires already routed.
 * Deterministic, runs at build time.
 */
export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Side = 'n' | 'e' | 's' | 'w';

export const G = 8;
const DIRS: Pt[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];
export const sideDir: Record<Side, number> = { e: 0, s: 1, w: 2, n: 3 };

class Heap {
  private a: number[] = [];
  private p: number[] = [];
  get size() {
    return this.a.length;
  }
  push(v: number, pr: number) {
    const a = this.a;
    const p = this.p;
    a.push(v);
    p.push(pr);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j]! <= p[i]!) break;
      [a[i]!, a[j]!] = [a[j]!, a[i]!];
      [p[i]!, p[j]!] = [p[j]!, p[i]!];
      i = j;
    }
  }
  pop(): number {
    const a = this.a;
    const p = this.p;
    const top = a[0]!;
    const lv = a.pop()!;
    const lp = p.pop()!;
    if (a.length) {
      a[0] = lv;
      p[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const rr = l + 1;
        let m = i;
        if (l < a.length && p[l]! < p[m]!) m = l;
        if (rr < a.length && p[rr]! < p[m]!) m = rr;
        if (m === i) break;
        [a[i]!, a[m]!] = [a[m]!, a[i]!];
        [p[i]!, p[m]!] = [p[m]!, p[i]!];
        i = m;
      }
    }
    return top;
  }
}

export interface Endpoint {
  /** the point on the box side */
  port: Pt;
  side: Side;
  /** the first lattice point outside the inflated box */
  stub: Pt;
}

export class Router {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;
  private soft: Uint16Array;
  private useH: Uint8Array;
  private useV: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cols = Math.ceil(w / G) + 1;
    this.rows = Math.ceil(h / G) + 1;
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.soft = new Uint16Array(n);
    this.useH = new Uint8Array(n);
    this.useV = new Uint8Array(n);
  }

  private idx(c: number, r: number) {
    return r * this.cols + c;
  }

  /** Mark every lattice point inside the rect (inflated by m) as blocked. */
  block(rc: Rect, m: number) {
    this.mark(rc, m, (i) => (this.blocked[i] = 1));
  }
  /** Add a soft cost to lattice points inside the rect. */
  penalise(rc: Rect, m: number, cost: number) {
    this.mark(rc, m, (i) => (this.soft[i]! = Math.min(65000, this.soft[i]! + cost)));
  }
  private mark(rc: Rect, m: number, f: (i: number) => void) {
    const c0 = Math.max(0, Math.ceil((rc.x - m) / G));
    const c1 = Math.min(this.cols - 1, Math.floor((rc.x + rc.w + m) / G));
    const r0 = Math.max(0, Math.ceil((rc.y - m) / G));
    const r1 = Math.min(this.rows - 1, Math.floor((rc.y + rc.h + m) / G));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) f(this.idx(c, r));
  }

  isBlocked(p: Pt) {
    const c = Math.round(p.x / G);
    const r = Math.round(p.y / G);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    return this.blocked[this.idx(c, r)] === 1;
  }

  /**
   * Route from any start endpoint to any goal endpoint. Returns lattice points from the chosen
   * start stub to the chosen goal stub, plus which endpoints were used.
   * `within`: a box the whole route stays inside (a wire between two things inside an account boundary
   * never leaves the boundary).
   */
  route(starts: Endpoint[], goals: Endpoint[], bend = 6, within?: Rect): { pts: Pt[]; start: Endpoint; goal: Endpoint } | null {
    const { cols, rows } = this;
    const N = cols * rows * 4;
    const g = new Float64Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const heap = new Heap();
    const goalAt = new Map<number, Endpoint[]>();
    for (const e of goals) {
      const k = this.idx(Math.round(e.stub.x / G), Math.round(e.stub.y / G));
      goalAt.set(k, [...(goalAt.get(k) ?? []), e]);
    }
    const gx = goals.map((e) => e.stub);
    const hfun = (c: number, r: number) => {
      let best = Infinity;
      for (const s of gx) best = Math.min(best, Math.abs(s.x / G - c) + Math.abs(s.y / G - r));
      return best;
    };
    const startOf = new Map<number, Endpoint>();
    for (const s of starts) {
      const c = Math.round(s.stub.x / G);
      const r = Math.round(s.stub.y / G);
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const d = sideDir[s.side];
      const st = this.idx(c, r) * 4 + d;
      if (g[st]! > 0) {
        g[st] = 0;
        startOf.set(st, s);
        heap.push(st, hfun(c, r));
      }
    }
    let endState = -1;
    let endGoal: Endpoint | null = null;
    let endCost = Infinity;
    while (heap.size) {
      const st = heap.pop();
      const cell = st >> 2;
      const d = st & 3;
      const c = cell % cols;
      const r = (cell - c) / cols;
      const cost = g[st]!;
      if (cost >= endCost) break;
      const gl = goalAt.get(cell);
      if (gl) {
        for (const e of gl) {
          // arriving direction must point into the target: opposite of its side normal
          const want = (sideDir[e.side] + 2) & 3;
          // never arriving backwards: a wire that overshoots its stub and doubles back to the port draws a hook
          if (d === ((want + 2) & 3)) continue;
          // arriving head-on is preferred: a sideways arrival turns at the stub, right before the arrowhead
          const total = cost + (d === want ? 0 : bend * 3);
          if (total < endCost) {
            endCost = total;
            endState = st;
            endGoal = e;
          }
        }
      }
      for (let nd = 0; nd < 4; nd++) {
        if (nd === ((d + 2) & 3)) continue;
        const nc = c + DIRS[nd]!.x;
        const nr = r + DIRS[nd]!.y;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = this.idx(nc, nr);
        if (this.blocked[ni] && !goalAt.has(ni)) continue;
        if (within && (nc * G < within.x || nc * G > within.x + within.w || nr * G < within.y || nr * G > within.y + within.h)) continue;
        const horiz = nd === 0 || nd === 2;
        let step = 1 + this.soft[ni]!;
        if (horiz ? this.useH[ni] : this.useV[ni]) step += 24;
        else if (horiz ? this.useV[ni] : this.useH[ni]) step += 3;
        // keep a channel's width between parallel wires
        const n1 = horiz ? [this.idx(nc, Math.max(0, nr - 1)), this.idx(nc, Math.min(rows - 1, nr + 1))] : [this.idx(Math.max(0, nc - 1), nr), this.idx(Math.min(cols - 1, nc + 1), nr)];
        for (const k of n1) if (horiz ? this.useH[k] : this.useV[k]) step += 2;
        if (nd !== d) step += bend;
        const ns = ni * 4 + nd;
        const ng = cost + step;
        if (ng < g[ns]!) {
          g[ns] = ng;
          from[ns] = st;
          heap.push(ns, ng + hfun(nc, nr));
        }
      }
    }
    if (endState < 0 || !endGoal) return null;
    const cells: Pt[] = [];
    let s = endState;
    let first = s;
    while (s >= 0) {
      const cell = s >> 2;
      const c = cell % cols;
      cells.push({ x: c * G, y: ((cell - c) / cols) * G });
      first = s;
      s = from[s]!;
    }
    cells.reverse();
    return { pts: cells, start: startOf.get(first)!, goal: endGoal };
  }

  /** Record a routed polyline so later wires keep their distance. */
  commit(poly: Pt[]) {
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1]!;
      const b = poly[i]!;
      const horiz = a.y === b.y;
      const n = Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / G);
      for (let k = 0; k <= n; k++) {
        const x = a.x + ((b.x - a.x) * k) / Math.max(1, n);
        const y = a.y + ((b.y - a.y) * k) / Math.max(1, n);
        const c = Math.round(x / G);
        const r = Math.round(y / G);
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
        const i2 = this.idx(c, r);
        if (horiz) this.useH[i2] = 1;
        else this.useV[i2] = 1;
      }
    }
  }
}

/** Drop collinear points. */
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (out.length && out[out.length - 1]!.x === p.x && out[out.length - 1]!.y === p.y) continue;
    out.push(p);
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3) as [Pt, Pt, Pt];
      if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) out.splice(out.length - 2, 1);
      else break;
    }
  }
  return out;
}

/** SVG path for a polyline with rounded corners. */
export function roundedPath(pts: Pt[], radius = 8): string {
  if (pts.length < 2) return '';
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1]!;
    const q = pts[i]!;
    const n = pts[i + 1]!;
    const l1 = Math.hypot(q.x - p.x, q.y - p.y);
    const l2 = Math.hypot(n.x - q.x, n.y - q.y);
    const rr = Math.min(radius, l1 / 2, l2 / 2);
    const a = { x: q.x - ((q.x - p.x) / l1) * rr, y: q.y - ((q.y - p.y) / l1) * rr };
    const b = { x: q.x + ((n.x - q.x) / l2) * rr, y: q.y + ((n.y - q.y) / l2) * rr };
    d += ` L${f(a.x)} ${f(a.y)} Q${f(q.x)} ${f(q.y)} ${f(b.x)} ${f(b.y)}`;
  }
  const last = pts[pts.length - 1]!;
  d += ` L${f(last.x)} ${f(last.y)}`;
  return d;
}

export const polyLength = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.abs(p.x - pts[i]!.x) + Math.abs(p.y - pts[i]!.y), 0);

export function intersects(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}
