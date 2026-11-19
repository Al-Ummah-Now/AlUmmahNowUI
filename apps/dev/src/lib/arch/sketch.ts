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

interface SNode {
  id: string;
  icon: string;
  title: string;
  note?: string;
  x: number;
  y: number;
  w: number;
  tone: string;
}
interface SEdge {
  from: string;
  to: string;
  a: [number, number];
  b: [number, number];
  ctrl?: [number, number];
  dashed?: boolean;
  tag?: string;
  tagAt?: [number, number];
  tone?: string;
}

export function renderSketch(c: Copy, opts: { rtl: boolean; variant: string }): string {
  const s = c.step;
  const wide = opts.variant === 'wide';
  const prefix = `sketch-${opts.variant}`;
  const pen = new Pen(prefix);
  const H_NODE = 124;
  const nodes: SNode[] = wide
    ? [
        { id: 'viewer', icon: 'lucide/user', title: s.viewer, note: s.viewerNote, x: 92, y: 190, w: 170, tone: 'yellow' },
        { id: 'player', icon: 'lucide/play', title: s.player, note: s.playerNote, x: 312, y: 190, w: 180, tone: 'blue' },
        { id: 'api', icon: 'cloudflare/workers', title: s.api, note: s.apiNote, x: 548, y: 190, w: 210, tone: 'orange' },
        { id: 'r2', icon: 'cloudflare/r2', title: `${s.edge} · ${s.r2}`, note: s.edgeNote, x: 820, y: 110, w: 230, tone: 'green' },
        { id: 'bunny', icon: 'brand/bunny-cdn', title: `${s.edge} · ${s.bunny}`, note: s.edgeNote, x: 820, y: 280, w: 230, tone: 'green' },
        { id: 'plays', icon: 'lucide/monitor', title: s.play, note: s.playNote, x: 1110, y: 190, w: 220, tone: 'pink' },
      ]
    : [
        { id: 'viewer', icon: 'lucide/user', title: s.viewer, note: s.viewerNote, x: 120, y: 112, w: 200, tone: 'yellow' },
        { id: 'player', icon: 'lucide/play', title: s.player, note: s.playerNote, x: 120, y: 292, w: 200, tone: 'blue' },
        { id: 'api', icon: 'cloudflare/workers', title: s.api, note: s.apiNote, x: 110, y: 472, w: 220, tone: 'orange' },
        { id: 'r2', icon: 'cloudflare/r2', title: s.r2, note: s.edgeNote, x: 50, y: 666, w: 158, tone: 'green' },
        { id: 'bunny', icon: 'brand/bunny-cdn', title: s.bunny, note: s.edgeNote, x: 222, y: 666, w: 158, tone: 'green' },
        { id: 'plays', icon: 'lucide/monitor', title: s.play, note: s.playNote, x: 100, y: 860, w: 240, tone: 'pink' },
      ];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const L = (id: string) => byId.get(id)!;
  const mid = (n: SNode, side: 'n' | 's' | 'e' | 'w', d = 0): [number, number] =>
    side === 'n' ? [n.x + n.w / 2 + d, n.y - 6] : side === 's' ? [n.x + n.w / 2 + d, n.y + H_NODE + 8] : side === 'e' ? [n.x + n.w + 8, n.y + H_NODE / 2 + d] : [n.x - 8, n.y + H_NODE / 2 + d];
  const obsY = wide ? 500 : 1090;
  const obs = wide
    ? [
        { id: 'logs', icon: 'cloudflare/logs', title: c.obs.logs, x: 470 },
        { id: 'errors', icon: 'lucide/activity', title: c.obs.errors, x: 680 },
        { id: 'vitals', icon: 'lucide/gauge', title: c.obs.vitals, x: 890 },
      ]
    : [
        { id: 'logs', icon: 'cloudflare/logs', title: c.obs.logs, x: 80 },
        { id: 'errors', icon: 'lucide/activity', title: c.obs.errors, x: 220 },
        { id: 'vitals', icon: 'lucide/gauge', title: c.obs.vitals, x: 360 },
      ];
  const edges: SEdge[] = wide
    ? [
        { from: 'viewer', to: 'player', a: mid(L('viewer'), 'e'), b: mid(L('player'), 'w') },
        { from: 'player', to: 'api', a: mid(L('player'), 'e'), b: mid(L('api'), 'w') },
        { from: 'api', to: 'r2', a: mid(L('api'), 'e', -16), b: mid(L('r2'), 'w'), ctrl: [790, 160] },
        { from: 'api', to: 'bunny', a: mid(L('api'), 'e', 16), b: mid(L('bunny'), 'w'), ctrl: [790, 300] },
        { from: 'r2', to: 'plays', a: mid(L('r2'), 'e'), b: mid(L('plays'), 'w', -16), ctrl: [1085, 175] },
        { from: 'bunny', to: 'plays', a: mid(L('bunny'), 'e'), b: mid(L('plays'), 'w', 16), ctrl: [1085, 290] },
        { from: 'plays', to: 'api', a: mid(L('plays'), 's', -60), b: mid(L('api'), 's', 40), ctrl: [930, 600], dashed: true, tag: c.tag.optional, tagAt: [931, 462], tone: 'pink' },
        { from: 'plays', to: 'vitals', a: mid(L('plays'), 's', 60), b: [944, obsY + 20], ctrl: [1220, 500], dashed: true, tag: c.tag.async, tagAt: [1153, 450], tone: 'blue' },
      ]
    : [
        { from: 'viewer', to: 'player', a: mid(L('viewer'), 's'), b: mid(L('player'), 'n') },
        { from: 'player', to: 'api', a: mid(L('player'), 's'), b: mid(L('api'), 'n') },
        { from: 'api', to: 'r2', a: mid(L('api'), 's', -50), b: mid(L('r2'), 'n') },
        { from: 'api', to: 'bunny', a: mid(L('api'), 's', 50), b: mid(L('bunny'), 'n') },
        { from: 'r2', to: 'plays', a: mid(L('r2'), 's'), b: mid(L('plays'), 'n', -50) },
        { from: 'bunny', to: 'plays', a: mid(L('bunny'), 's'), b: mid(L('plays'), 'n', 50) },
        { from: 'plays', to: 'api', a: mid(L('plays'), 'e'), b: mid(L('api'), 'e'), ctrl: [480, 730], dashed: true, tag: c.tag.optional, tagAt: [382, 630], tone: 'pink' },
        { from: 'plays', to: 'vitals', a: mid(L('plays'), 's', 70), b: [376, obsY - 8], dashed: true, tag: c.tag.async, tagAt: [300, 1040], tone: 'blue' },
      ];

  const W = wide ? 1400 : 440;
  const Hc = wide ? 650 : 1230;
  const mirror = (x: number) => (opts.rtl ? W - x : x);
  const ar = hasArabic(c.title2);
  const fam = ar ? 'an-hand-ar' : 'an-hand';
  const icons = [...new Set([...nodes.map((n) => n.icon), ...obs.map((o) => o.icon)])];
  const o: string[] = [];
  o.push(
    `<svg class="an an-sketch" data-diagram="sketch-play" data-variant="${opts.variant}" viewBox="0 0 ${W} ${Hc}" width="${W}" height="${Hc}" role="img" aria-labelledby="${prefix}-t ${prefix}-d" style="--an-w:${W}px">`,
    `<title id="${prefix}-t">${esc(c.title)}</title><desc id="${prefix}-d">${esc(c.desc)}</desc><defs>${icons.map((i) => symbol(prefix, i)).join('')}</defs>`,
    `<rect class="an-canvas an-paper" width="${W}" height="${Hc}" rx="18"/>`,
  );
  // the cloud of observability around everything
  const cl = wide ? [64, 96, W - 128, Hc - 150] : [44, 70, W - 88, Hc - 112];
  o.push(`<g class="an-groups"><path class="an-sk-cloud" d="${pen.cloud(cl[0]!, cl[1]!, cl[2]!, cl[3]!)}"/>`);
  // flip the cloud for RTL by mirroring its path through a transform-free rebuild
  o.push('</g>');
  if (opts.rtl) {
    // mirror the cloud path in place: rebuild with mirrored x
    o[o.length - 2]! = o[o.length - 2]!.replace(/([MQL ])(-?[\d.]+) (-?[\d.]+)/g, (_m, p, x, y) => `${p}${r(W - Number(x))} ${y}`);
  }
  const titleY = wide ? 52 : 46;
  o.push(`<g data-node-label="title"><text class="an-sk-title ${fam}" x="${r(W / 2)}" y="${titleY}" text-anchor="middle"${ar ? ' direction="rtl"' : ''}>${esc(c.title2)}</text></g>`);
  // the side note, written up the cloud's edge
  const sx = opts.rtl ? W - (wide ? 30 : 22) : wide ? 30 : 22;
  const sy = wide ? Hc / 2 : 640;
  o.push(`<text class="an-sk-side ${fam}" x="${sx}" y="${sy}" text-anchor="middle" transform="rotate(${opts.rtl ? 90 : -90} ${sx} ${sy})"${ar ? ' direction="rtl"' : ''}>${esc(c.around)}</text>`);

  // edges
  o.push('<g class="an-edges">');
  const tags: string[] = [];
  edges.forEach((e, i) => {
    const a: [number, number] = [mirror(e.a[0]), e.a[1]];
    const b: [number, number] = [mirror(e.b[0]), e.b[1]];
    const ctrl = e.ctrl ? ([mirror(e.ctrl[0]), e.ctrl[1]] as [number, number]) : undefined;
    const { shaft, head } = pen.arrow(a[0], a[1], b[0], b[1], ctrl);
    o.push(`<path id="${prefix}-e${i}" data-edge="${prefix}-e${i}" data-from="${e.from}" data-to="${e.to}" class="an-edge an-sk-arrow${e.dashed ? ' an-sk-dashed' : ''}" d="${shaft}"/><path class="an-sk-head" d="${head}"/>`);
    if (e.tag && e.tagAt) {
      const tw = textWidth(e.tag, 15, true) + 18;
      const tx = mirror(e.tagAt[0]);
      tags.push(`<g class="an-sk-tag an-sk-${e.tone}"><path class="an-sk-mark" d="${pen.marker(tx - tw / 2 - 4, e.tagAt[1] - 15, tw, 26)}"/><path class="an-sk-line" d="${pen.rect(tx - tw / 2, e.tagAt[1] - 14, tw, 26)}"/><text class="${fam}" x="${r(tx)}" y="${r(e.tagAt[1] + 4)}" text-anchor="middle"${hasArabic(e.tag) ? ' direction="rtl"' : ''}>${esc(e.tag)}</text></g>`);
    }
  });
  o.push('</g><g class="an-motion" aria-hidden="true">');
  edges.forEach((e, i) => {
    if (e.dashed) return;
    o.push(`<circle class="an-pulse an-sk-dot" r="4"><animateMotion dur="2.4s" begin="-${r(i * 0.4)}s" repeatCount="indefinite"><mpath href="#${prefix}-e${i}"/></animateMotion></circle>`);
  });
  o.push('</g>');

  // nodes
  o.push('<g class="an-nodes">');
  for (const n of nodes) {
    const x = opts.rtl ? W - n.x - n.w : n.x;
    o.push(`<g class="an-node an-sk-node an-sk-${n.tone}" data-node="${n.id}">`);
    o.push(`<rect data-box class="an-sk-hit" x="${r(x - 4)}" y="${r(n.y - 4)}" width="${r(n.w + 12)}" height="${H_NODE + 12}"/>`);
    o.push(`<path class="an-sk-mark" d="${pen.marker(x, n.y, n.w, H_NODE)}"/><path class="an-sk-line" d="${pen.rect(x, n.y, n.w, H_NODE)}"/>`);
    o.push(useIcon(prefix, n.icon, x + n.w / 2 - 20, n.y + 12, 40));
    o.push(`<text class="an-sk-name ${fam}" x="${r(x + n.w / 2)}" y="${r(n.y + 78)}" text-anchor="middle"${hasArabic(n.title) ? ' direction="rtl"' : ''}>${esc(n.title)}</text>`);
    if (n.note) o.push(`<text class="an-sk-note ${fam}" x="${r(x + n.w / 2)}" y="${r(n.y + 108)}" text-anchor="middle"${hasArabic(n.note) ? ' direction="rtl"' : ''}>${esc(n.note)}</text>`);
    o.push('</g>');
  }
  for (const ob of obs) {
    const x = mirror(ob.x);
    const tw = Math.max(64, textWidth(ob.title, 16, true) + 12);
    o.push(`<g class="an-node an-sk-obs" data-node="${ob.id}"><rect data-box class="an-sk-hit" x="${r(x - tw / 2)}" y="${obsY - 4}" width="${r(tw)}" height="92"/>`);
    o.push(useIcon(prefix, ob.icon, x - 20, obsY, 40));
    o.push(`<text class="an-sk-name ${fam}" x="${r(x)}" y="${obsY + 62}" text-anchor="middle"${hasArabic(ob.title) ? ' direction="rtl"' : ''}>${esc(ob.title)}</text></g>`);
  }
  o.push(`</g><g class="an-labels">${tags.join('')}</g></svg>`);
  return o.join('');
}
