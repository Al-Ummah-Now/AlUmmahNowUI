/**
 * The isometric hero (style samples 6 and 7): each provider is an isometric platform outlined in its
 * brand colour with a corner tag; components stand on it as shaded blocks with their official icon
 * floating above on a tile; thick glowing pipes carry requests, uploads, playback and deploys between
 * platforms along the isometric axes. Platforms are grids of blocks, so their size follows what they
 * hold, and the viewBox is fitted to the drawing. Same icon symbols and data-* gate hooks as arch.ts.
 */
import type { diagramsEn } from '../../i18n/diagrams.en.ts';
import { accentClass, r, symbol, symId, useIcon } from './icons.ts';
import { esc, hasArabic, textWidth } from './text.ts';
import type { Flow } from './arch.ts';

type Copy = typeof diagramsEn.hero;
const C = Math.cos(Math.PI / 6);
const SN = 0.5;
const T = 12; // slab thickness

interface BlockSpec {
  id: string;
  icon: string;
  label: string;
  h?: number;
}
interface PlatSpec {
  id: string;
  at: [number, number];
  cols: number;
  rows: number;
  blocks: (BlockSpec | null)[];
  label: string;
  tag?: string;
  tagLogo?: { id: string; w: number; h: number };
  accent: string;
  tone: 'cf' | 'plain' | 'bunny' | 'prov';
  dashed?: boolean;
}
type PSide = 'x0' | 'x1' | 'y0' | 'y1';
interface PipeSpec {
  id: string;
  from: [string, PSide, number];
  to: [string, PSide, number];
  flow: Flow;
  label?: string;
  /** which segment carries the label (default: the longest) */
  labelSeg?: number;
}
interface SceneSpec {
  step: number;
  /** room between a platform's back edges and its blocks: the name pills float up toward them */
  pad: number;
  /** room between the blocks and the platform's front edges (default: pad) */
  padFront?: number;
  /** platform positions scaled by this: room between platforms for tags, pills and pipes (default 1) */
  spread?: number;
  /** where a platform's tag hangs: off its start corner (default) or its end corner, so a phone's scroll box opens on blocks, not a row of tags */
  tagAt?: 'start' | 'end';
  size: number;
  platforms: PlatSpec[];
  pipes: PipeSpec[];
}

function sceneSpec(c: Copy, variant: string): SceneSpec {
  const n = c.node;
  const p = c.platform;
  const b = (id: keyof Copy['node'], icon: string, h?: number): BlockSpec => ({ id, icon, label: n[id], h });
  const logo = { id: 'brand/bunnynet-logo-dark', w: 62, h: 18 };
  if (variant === 'wide') {
    return {
      step: 170,
      // a block's name pill keeps 6 px from its platform's edges: deep at the back, where the pills float
      pad: 150,
      padFront: 70,
      spread: 1.2,
      size: 50,
      platforms: [
        { id: 'people', at: [0, 200], cols: 1, rows: 3, blocks: [b('browser', 'lucide/browser'), b('phone', 'lucide/smartphone'), b('tv', 'lucide/tv')], label: p.people, accent: 'var(--an-ink)', tone: 'plain', dashed: true },
        {
          id: 'cf',
          at: [330, 0],
          cols: 4,
          rows: 2,
          blocks: [b('cdn', 'cloudflare/cache'), b('workers', 'cloudflare/workers', 46), b('containers', 'cloudflare/containers', 40), b('ai', 'cloudflare/workers-ai'), b('r2', 'cloudflare/r2'), b('d1', 'cloudflare/d1'), b('kv', 'cloudflare/kv'), b('queues', 'cloudflare/queues')],
          label: p.cf,
          tag: 'simple-icons/cloudflare',
          accent: '#f6821f',
          tone: 'cf',
        },
        { id: 'bunny', at: [330, 520], cols: 2, rows: 1, blocks: [b('stream', 'brand/bunny-stream', 34), b('bunnyCdn', 'brand/bunny-cdn')], label: p.bunny, tagLogo: logo, accent: '#f29b1d', tone: 'bunny' },
        { id: 'providers', at: [1150, -250], cols: 1, rows: 3, blocks: [b('qf', 'lucide/book-open'), b('resend', 'simple-icons/resend'), b('github', 'simple-icons/github')], label: p.providers, accent: 'var(--an-boundary)', tone: 'prov' },
      ],
      pipes: [
        { id: 'req', from: ['people', 'x1', 66 / 532], to: ['cf', 'x0', 266 / 362], flow: 'request', label: c.wire.requests },
        { id: 'play', from: ['bunny', 'x0', 0.5], to: ['people', 'x1', 416 / 532], flow: 'delivery', label: c.wire.playback },
        { id: 'up', from: ['cf', 'y1', 96 / 702], to: ['bunny', 'y0', 96 / 362], flow: 'media', label: c.wire.upload },
        { id: 'api', from: ['cf', 'x1', 186 / 362], to: ['providers', 'x0', 436 / 532], flow: 'request' },
      ],
    };
  }
  return {
    step: 150,
    pad: 140,
    padFront: 72,
    spread: 1.2,
    tagAt: 'end',
    size: 40,
    platforms: [
      { id: 'people', at: [0, 0], cols: 3, rows: 1, blocks: [b('browser', 'lucide/browser'), b('phone', 'lucide/smartphone'), b('tv', 'lucide/tv')], label: p.people, accent: 'var(--an-ink)', tone: 'plain', dashed: true },
      { id: 'cf', at: [260, 260], cols: 2, rows: 2, blocks: [b('cdn', 'cloudflare/cache'), b('workers', 'cloudflare/workers', 40), b('ai', 'cloudflare/workers-ai'), b('containers', 'cloudflare/containers', 36)], label: p.cfCompute, tag: 'simple-icons/cloudflare', accent: '#f6821f', tone: 'cf' },
      { id: 'cfData', at: [640, 640], cols: 2, rows: 2, blocks: [b('r2', 'cloudflare/r2'), b('d1', 'cloudflare/d1'), b('kv', 'cloudflare/kv'), b('queues', 'cloudflare/queues')], label: p.cfData, tag: 'simple-icons/cloudflare', accent: '#f6821f', tone: 'cf' },
      { id: 'bunny', at: [1020, 1020], cols: 2, rows: 1, blocks: [b('stream', 'brand/bunny-stream', 30), b('bunnyCdn', 'brand/bunny-cdn')], label: p.bunny, tagLogo: logo, accent: '#f29b1d', tone: 'bunny' },
      { id: 'providers', at: [1330, 1300], cols: 3, rows: 1, blocks: [b('qf', 'lucide/book-open'), b('resend', 'simple-icons/resend'), b('github', 'simple-icons/github')], label: p.providers, accent: 'var(--an-boundary)', tone: 'prov' },
    ],
    pipes: [
      // into the middle of the platform's back edge: its end corner carries the tag
      { id: 'req', from: ['people', 'x1', 0.5], to: ['cf', 'y0', 0.5], flow: 'request', label: c.wire.requests },
      { id: 'data', from: ['cf', 'y1', 216 / 282], to: ['cfData', 'x0', 106 / 282], flow: 'request' },
      { id: 'up', from: ['cfData', 'y1', 216 / 282], to: ['bunny', 'x0', 0.45], flow: 'media', label: c.wire.upload },
      { id: 'api', from: ['bunny', 'y1', 216 / 282], to: ['providers', 'x0', 0.45], flow: 'request' },
    ],
  };
}

/** The shape each component stands as (samples 4, 6, 9): stores are cylinders, edges and queues flat slabs, the transcoder a tower. */
type Shape = 'cube' | 'cyl' | 'slab' | 'tower';
const SHAPE: Record<string, Shape> = { r2: 'cyl', d1: 'cyl', kv: 'cyl', cdn: 'slab', queues: 'slab', bunnyCdn: 'slab', containers: 'tower' };
const HEIGHT: Record<Shape, number> = { cube: 30, cyl: 34, slab: 12, tower: 58 };

interface Plat extends PlatSpec {
  x: number;
  y: number;
  w: number;
  d: number;
}

export function renderIso(c: Copy, opts: { rtl: boolean; variant: string }): string {
  const sc = sceneSpec(c, opts.variant);
  const prefix = `hero-${opts.variant}`;
  const k = sc.spread ?? 1;
  const pf = sc.padFront ?? sc.pad;
  const plats: Plat[] = sc.platforms.map((p) => ({ ...p, x: p.at[0] * k, y: p.at[1] * k, w: sc.pad + pf + (p.cols - 1) * sc.step, d: sc.pad + pf + (p.rows - 1) * sc.step }));
  const byId = new Map(plats.map((p) => [p.id, p]));

  // raw projection, fitted afterwards
  const Q = (x: number, y: number, z = 0): [number, number] => [(x - y) * C, (x + y) * SN - z];
  const edgePt = ([id, side, t]: [string, PSide, number]): [number, number] => {
    const p = byId.get(id)!;
    if (side === 'x0') return [p.x, p.y + p.d * t];
    if (side === 'x1') return [p.x + p.w, p.y + p.d * t];
    if (side === 'y0') return [p.x + p.w * t, p.y];
    return [p.x + p.w * t, p.y + p.d];
  };
  const pipePts = (pp: PipeSpec): [number, number][] => {
    const a = edgePt(pp.from);
    const b = edgePt(pp.to);
    const ax = pp.from[1][0] === 'x';
    const bx = pp.to[1][0] === 'x';
    if (ax && bx) {
      const mx = (a[0] + b[0]) / 2;
      return a[1] === b[1] ? [a, b] : [a, [mx, a[1]], [mx, b[1]], b];
    }
    if (!ax && !bx) {
      const my = (a[1] + b[1]) / 2;
      return a[0] === b[0] ? [a, b] : [a, [a[0], my], [b[0], my], b];
    }
    return ax ? [a, [b[0], a[1]], b] : [a, [a[0], b[1]], b];
  };

  // blocks
  interface Blk extends BlockSpec {
    x: number;
    y: number;
    s: number;
    h: number;
    tone: Plat['tone'];
    shape: Shape;
  }
  const blocks: Blk[] = [];
  for (const p of plats)
    p.blocks.forEach((b, i) => {
      if (!b) return;
      const col = i % p.cols;
      const row = Math.floor(i / p.cols);
      const shape = SHAPE[b.id] ?? 'cube';
      const h = p.tone === 'plain' ? 22 : HEIGHT[shape];
      blocks.push({ ...b, x: p.x + sc.pad + col * sc.step, y: p.y + sc.pad + row * sc.step, s: shape === 'slab' ? sc.size * 1.15 : sc.size, h, tone: p.tone, shape });
    });

  // fit: every drawn point, the tiles above blocks, the labels under them, the tags
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (q: [number, number], dx = 0, dy = 0) => {
    xs.push(q[0] - dx, q[0] + dx);
    ys.push(q[1] - dy, q[1] + dy);
  };
  for (const p of plats) for (const q of [Q(p.x, p.y), Q(p.x + p.w, p.y), Q(p.x + p.w, p.y + p.d, -T), Q(p.x, p.y + p.d, -T)]) add(q, 0, 0);
  const pillW = (b: BlockSpec) => textWidth(b.label, 12.5, true) + 22;
  for (const b of blocks) {
    const tc = Q(b.x, b.y, b.h);
    add([tc[0], tc[1] - 70], pillW(b) / 2 + 2, 0);
  }
  const tagW = (p: Plat) => (p.tagLogo ? p.tagLogo.w + 24 : textWidth(p.label, 13, true) + (p.tag ? 36 : 24));
  for (const p of plats) {
    if (sc.tagAt === 'end') {
      const l = Q(p.x + p.w, p.y);
      add([l[0] + 18 + tagW(p), l[1] - 46]);
    } else {
      const l = Q(p.x, p.y + p.d);
      add([l[0] - 14 - tagW(p), l[1] - 38]);
    }
  }
  const M = 26;
  const ox = M - Math.min(...xs);
  const oy = M - Math.min(...ys);
  const W = Math.ceil(Math.max(...xs) + ox + M);
  const H = Math.ceil(Math.max(...ys) + oy + M);
  const P = (x: number, y: number, z = 0): [number, number] => {
    const q = Q(x, y, z);
    const sx = q[0] + ox;
    return [opts.rtl ? W - sx : sx, q[1] + oy];
  };
  const pts = (list: [number, number][]) => list.map(([x, y]) => `${r(x)},${r(y)}`).join(' ');

  const icons = [...new Set([...blocks.map((b) => b.icon), ...plats.flatMap((p) => [p.tag, p.tagLogo?.id]).filter(Boolean) as string[]])];
  const o: string[] = [];
  const g = 28;
  o.push(
    `<svg class="an an-iso" data-diagram="hero" data-variant="${opts.variant}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${prefix}-t ${prefix}-d">`,
    `<title id="${prefix}-t">${esc(c.title)}</title><desc id="${prefix}-d">${esc(c.desc)}</desc><defs>${icons.map((i) => symbol(prefix, i)).join('')}`,
    `<filter id="${prefix}-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>`,
    ...(['cf', 'bunny', 'prov', 'plain'] as const).map((t) => `<linearGradient id="${prefix}-cyl-${t}" class="an-tone-${t}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" class="an-cyl-a"/><stop offset="0.55" class="an-cyl-b"/><stop offset="1" class="an-cyl-c"/></linearGradient>`),
    `<pattern id="${prefix}-grid" x="${r(ox % (2 * C * g))}" y="${r(oy % g)}" width="${r(2 * C * g)}" height="${g}" patternUnits="userSpaceOnUse"><path class="an-iso-gridline" d="M0 ${g / 2} L${r(C * g)} 0 L${r(2 * C * g)} ${g / 2} L${r(C * g)} ${g} Z"/></pattern>`,
    `</defs><rect class="an-canvas" width="${W}" height="${H}" rx="18"/><rect class="an-iso-floor" width="${W}" height="${H}" rx="18" fill="url(#${prefix}-grid)"/>`,
  );

  // platforms, back to front
  const tags: string[] = [];
  const polys: [number, number][][] = [];
  /** each block's drawn box (shape, icon and name pill): a pipe's label keeps clear of it */
  const blockBoxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  o.push('<g class="an-groups">');
  for (const p of [...plats].sort((a, b) => a.x + a.y - (b.x + b.y))) {
    const a = P(p.x, p.y);
    const b = P(p.x + p.w, p.y);
    const cc = P(p.x + p.w, p.y + p.d);
    const d = P(p.x, p.y + p.d);
    const low = (q: [number, number]): [number, number] => [q[0], q[1] + T];
    polys.push([d, cc, low(cc), low(d)], [b, cc, low(cc), low(b)], [a, b, cc, d]);
    o.push(`<g class="an-iso-plat ${accentClass(p.accent)}${p.dashed ? ' an-iso-dashed' : ''}" data-group="${p.id}">`);
    o.push(`<polygon class="an-iso-side-l" points="${pts([d, cc, low(cc), low(d)])}"/><polygon class="an-iso-side-r" points="${pts([b, cc, low(cc), low(b)])}"/><polygon class="an-iso-top" points="${pts([a, b, cc, d])}"/>`);
    o.push('</g>');
    // the tag hangs off the platform's start corner (left, or right in Arabic), or on a phone its end corner
    const end = sc.tagAt === 'end';
    const corner = end ? b : d;
    const tw = tagW(p);
    // off the start corner it hangs outward (left in English); off the end corner, outward the other way
    const tx = end ? (opts.rtl ? corner[0] - 18 - tw : corner[0] + 18) : opts.rtl ? corner[0] + 18 : corner[0] - 18 - tw;
    const ty = corner[1] - 46;
    const pin = (opts.rtl ? !end : end) ? tx : tx + tw;
    tags.push(`<g data-tag="${p.id}" class="an-iso-tag ${accentClass(p.accent)}"><path class="an-iso-tagpin" d="M${r(pin)} ${r(ty + 14)} L${r(corner[0])} ${r(corner[1])}"/><rect class="an-tag${p.tagLogo ? ' an-tag-logo' : ''}" x="${r(tx)}" y="${r(ty)}" width="${r(tw)}" height="28" rx="8"/>`);
    if (p.tagLogo) tags.push(`<use data-icon="${p.tagLogo.id}" href="#${symId(prefix, p.tagLogo.id)}" x="${r(tx + 12)}" y="${r(ty + 5)}" width="${p.tagLogo.w}" height="${p.tagLogo.h}"><title>${esc(p.label)}</title></use>`);
    else {
      if (p.tag) tags.push(useIcon(prefix, p.tag, opts.rtl ? tx + tw - 28 : tx + 10, ty + 5, 18));
      const inner0 = p.tag && !opts.rtl ? tx + 30 : tx + 6;
      const inner1 = p.tag && opts.rtl ? tx + tw - 30 : tx + tw - 6;
      tags.push(`<text class="an-tag-text" x="${r((inner0 + inner1) / 2)}" y="${r(ty + 19)}" text-anchor="middle"${hasArabic(p.label) ? ' direction="rtl"' : ''}>${esc(p.label)}</text>`);
    }
    tags.push('</g>');
  }
  o.push('</g>');

  // pipes on the ground, between platforms
  const pipeD = sc.pipes.map((pp) => {
    const q = pipePts(pp).map(([x, y]) => P(x, y));
    return { pp, q, d: `M${q.map(([x, y]) => `${r(x)} ${r(y)}`).join(' L')}` };
  });
  o.push('<g class="an-edges">');
  for (const { pp, d } of pipeD) o.push(`<path class="an-pipe-tube an-f-${pp.flow}" d="${d}"/><path id="${prefix}-${pp.id}" data-edge="${pp.id}" data-from="${pp.from[0]}" data-to="${pp.to[0]}" class="an-edge an-pipe an-f-${pp.flow}" d="${d}"/>`);
  o.push('</g><g class="an-motion" aria-hidden="true">');
  for (const { pp, q, d } of pipeD) {
    o.push(`<path class="an-march an-f-${pp.flow}" d="${d}"/>`);
    const len = q.slice(1).reduce((s, b, k) => s + Math.hypot(b[0]! - q[k]![0], b[1]! - q[k]![1]), 0);
    const dur = Math.max(2, len / 80);
    for (const k of [0, 0.5]) o.push(`<circle class="an-pulse an-pulse-big an-f-${pp.flow}" r="5"><animateMotion dur="${r(dur)}s" begin="-${r(dur * k)}s" repeatCount="indefinite"><mpath href="#${prefix}-${pp.id}"/></animateMotion></circle>`);
  }
  o.push('</g>');

  // blocks, back to front: a product-coloured shape, its icon on the top face, a name pill above
  o.push('<g class="an-nodes">');
  const RY = Math.SQRT2 * SN;
  const RX = Math.SQRT2 * C;
  for (const b of [...blocks].sort((a, bb) => a.x + a.y - (bb.x + bb.y))) {
    const s = b.s;
    const x0 = b.x - s / 2;
    const y0 = b.y - s / 2;
    const tc = P(b.x, b.y, b.h);
    const base = P(b.x, b.y, 0);
    const shapes: string[] = [];
    let pts2: [number, number][];
    // soft ground shadow, cast away from the light (upper left; upper right in Arabic)
    const sh = [P(x0, y0), P(x0 + s, y0), P(x0 + s, y0 + s), P(x0, y0 + s)].map(([x, y]) => [x + (opts.rtl ? -8 : 8), y + 6] as [number, number]);
    shapes.push(`<polygon class="an-iso-shadow" points="${pts(sh)}" filter="url(#${prefix}-soft)"/>`);
    if (b.shape === 'cyl') {
      const R = s / 2;
      const rx = R * RX;
      const ry = R * RY;
      shapes.push(
        `<path class="an-iso-cyl" fill="url(#${prefix}-cyl-${b.tone})" d="M${r(tc[0] - rx)} ${r(tc[1])} L${r(base[0] - rx)} ${r(base[1])} A${r(rx)} ${r(ry)} 0 0 0 ${r(base[0] + rx)} ${r(base[1])} L${r(tc[0] + rx)} ${r(tc[1])} Z"/>`,
        `<path class="an-iso-band" d="M${r(tc[0] - rx)} ${r(tc[1] + b.h * 0.45)} A${r(rx)} ${r(ry)} 0 0 0 ${r(tc[0] + rx)} ${r(tc[1] + b.h * 0.45)}"/>`,
        `<ellipse class="an-iso-face-t" cx="${r(tc[0])}" cy="${r(tc[1])}" rx="${r(rx)}" ry="${r(ry)}"/>`,
      );
      pts2 = [[tc[0] - rx, tc[1] - ry], [tc[0] + rx, base[1] + ry]];
    } else {
      const top = [P(x0, y0, b.h), P(x0 + s, y0, b.h), P(x0 + s, y0 + s, b.h), P(x0, y0 + s, b.h)];
      const front = [P(x0, y0 + s, b.h), P(x0 + s, y0 + s, b.h), P(x0 + s, y0 + s), P(x0, y0 + s)];
      const side = [P(x0 + s, y0, b.h), P(x0 + s, y0 + s, b.h), P(x0 + s, y0 + s), P(x0 + s, y0)];
      const [lf, rf] = opts.rtl ? [side, front] : [front, side];
      shapes.push(`<polygon class="an-iso-face-l" points="${pts(lf)}"/><polygon class="an-iso-face-r" points="${pts(rf)}"/><polygon class="an-iso-face-t" points="${pts(top)}"/>`);
      // a lit rim along the two top edges facing the light
      const rim = opts.rtl ? [top[1]!, top[0]!, top[3]!] : [top[3]!, top[0]!, top[1]!];
      shapes.push(`<polyline class="an-iso-rim" points="${pts(rim)}"/>`);
      if (b.shape === 'tower') {
        // a seam halfway up: the stacked look of a container rack
        const mid = [P(x0, y0 + s, b.h / 2), P(x0 + s, y0 + s, b.h / 2), P(x0 + s, y0, b.h / 2)];
        shapes.push(`<polyline class="an-iso-seam" points="${pts(opts.rtl ? mid.map(([x, y]) => [x, y] as [number, number]) : mid)}"/>`);
      }
      pts2 = [...top, ...lf, ...rf];
    }
    const IS = b.shape === 'slab' ? 30 : 30;
    const ix = tc[0] - IS / 2;
    const iy = tc[1] - IS + 4;
    const pw = pillW(b);
    const px0 = tc[0] - pw / 2;
    const py0 = iy - 10 - 22;
    const xs = pts2.map((q) => q[0]);
    const ys = pts2.map((q) => q[1]);
    const bx0 = Math.min(...xs, px0, ix) - 3;
    const bx1 = Math.max(...xs, px0 + pw, ix + IS) + 3;
    const by0 = py0 - 3;
    const by1 = Math.max(...ys) + 3;
    blockBoxes.push({ x0: bx0, y0: by0, x1: bx1, y1: by1 });
    o.push(`<g class="an-node an-iso-block an-tone-${b.tone} an-shape-${b.shape}" data-node="${b.id}">`);
    o.push(`<rect data-box class="an-iso-hit" x="${r(bx0)}" y="${r(by0)}" width="${r(bx1 - bx0)}" height="${r(by1 - by0)}"/>`);
    o.push(...shapes);
    o.push(`<ellipse class="an-iso-icon-shadow" cx="${r(tc[0] + (opts.rtl ? -2 : 2))}" cy="${r(tc[1] + 3)}" rx="${r(IS * 0.42)}" ry="${r(IS * 0.16)}"/>`);
    o.push(useIcon(prefix, b.icon, ix, iy, IS));
    o.push(`<rect class="an-iso-pill" x="${r(px0)}" y="${r(py0)}" width="${r(pw)}" height="22" rx="11"/>`);
    o.push(`<text class="an-name" x="${r(tc[0])}" y="${r(py0 + 15.5)}" text-anchor="middle" font-size="12.5"${hasArabic(b.label) ? ' direction="rtl"' : ''}>${esc(b.label)}</text>`);
    o.push('</g>');
  }
  o.push('</g>');

  // tags and pipe labels on top
  o.push(`<g class="an-labels">${tags.join('')}`);
  for (const { pp, q } of pipeD) {
    if (!pp.label) continue;
    let best = 0;
    let bi = 1;
    for (let k = 1; k < q.length; k++) {
      const l = Math.hypot(q[k]![0] - q[k - 1]![0], q[k]![1] - q[k - 1]![1]);
      if (l > best) {
        best = l;
        bi = k;
      }
    }
    if (pp.labelSeg != null) bi = pp.labelSeg + 1;
    const lw = textWidth(pp.label, 11.5, true) + 16;
    // beside its pipe, never on it: offset along the pipe's normal (upward side) until the pill clears its glow (half the 11 px tube + 3) by 6 px
    const dx = q[bi]![0] - q[bi - 1]![0];
    const dy = q[bi]![1] - q[bi - 1]![1];
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (ny > 0 || (ny === 0 && nx > 0)) [nx, ny] = [-nx, -ny];
    const off = Math.abs(nx) * (lw / 2) + Math.abs(ny) * 10 + 15;
    // slide along the segment from its middle until the pill keeps 6 px from every platform outline and every glow
    const segDist = (px: number, py: number, s: [number, number], e: [number, number]) => {
      const vx = e[0] - s[0];
      const vy = e[1] - s[1];
      const t = Math.max(0, Math.min(1, ((px - s[0]) * vx + (py - s[1]) * vy) / (vx * vx + vy * vy || 1)));
      return Math.hypot(px - s[0] - t * vx, py - s[1] - t * vy);
    };
    const clear = (cx: number, cy: number) => {
      const bx = [cx - lw / 2, cx + lw / 2];
      const by = [cy - 10, cy + 10];
      const boxDist = (s: [number, number], e: [number, number]) => {
        let best = Infinity;
        for (let i = 0; i <= 20; i++) {
          const px = s[0] + ((e[0] - s[0]) * i) / 20;
          const py = s[1] + ((e[1] - s[1]) * i) / 20;
          const dx = Math.max(bx[0]! - px, 0, px - bx[1]!);
          const dy = Math.max(by[0]! - py, 0, py - by[1]!);
          best = Math.min(best, Math.hypot(dx, dy));
        }
        // a box corner closer to the segment than any sample
        for (const X of bx) for (const Y of by) best = Math.min(best, segDist(X, Y, s, e));
        return best;
      };
      for (const poly of polys) for (let i = 0; i < poly.length; i++) if (boxDist(poly[i]!, poly[(i + 1) % poly.length]!) < 8) return false;
      for (const { q: qq } of pipeD) for (let i = 1; i < qq.length; i++) if (boxDist(qq[i - 1]!, qq[i]!) < 11) return false;
      if (blockBoxes.some((k) => bx[0]! < k.x1 + 6 && bx[1]! > k.x0 - 6 && by[0]! < k.y1 + 6 && by[1]! > k.y0 - 6)) return false;
      // and it still reads as this pipe's label: within 22 px of the pipe (the gate allows 24)
      let own = Infinity;
      for (let i = 1; i < q.length; i++) own = Math.min(own, boxDist(q[i - 1]!, q[i]!));
      return own <= 22;
    };
    let m = [(q[bi]![0] + q[bi - 1]![0]) / 2 + nx * off, (q[bi]![1] + q[bi - 1]![1]) / 2 + ny * off];
    // the chosen segment first, then the pipe's other segments, longest first: a label never falls back onto a block
    const segOrder = [bi, ...[...Array(q.length - 1).keys()].map((k) => k + 1).filter((k) => k !== bi).sort((u, v) => Math.hypot(q[v]![0] - q[v - 1]![0], q[v]![1] - q[v - 1]![1]) - Math.hypot(q[u]![0] - q[u - 1]![0], q[u]![1] - q[u - 1]![1]))];
    // 15 or 20 px from the pipe's centre line (the glow reaches 8.5; the gate allows 24), upper side first
    found: for (const k of segOrder) {
      const sx = q[k]![0] - q[k - 1]![0];
      const sy = q[k]![1] - q[k - 1]![1];
      const sl = Math.hypot(sx, sy) || 1;
      let ux = -sy / sl;
      let uy = sx / sl;
      if (uy > 0 || (uy === 0 && ux > 0)) [ux, uy] = [-ux, -uy];
      const so = Math.abs(ux) * (lw / 2) + Math.abs(uy) * 10 + 15;
      for (const [side, extra] of [[1, 0], [1, 3], [-1, 0], [-1, 3]] as const)
        for (const t of [0.5, 0.44, 0.56, 0.38, 0.62, 0.32, 0.68, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86, 0.08, 0.92]) {
          const cx = q[k - 1]![0] + sx * t + ux * (so + extra) * side;
          const cy = q[k - 1]![1] + sy * t + uy * (so + extra) * side;
          if (clear(cx, cy)) {
            m = [cx, cy];
            break found;
          }
        }
    }
    o.push(`<g class="an-elabel an-f-${pp.flow}" data-for="${prefix}-${pp.id}"><rect class="an-elabel-bg an-pipe-label" x="${r(m[0]! - lw / 2)}" y="${r(m[1]! - 10)}" width="${r(lw)}" height="20" rx="10"/><text x="${r(m[0]!)}" y="${r(m[1]! + 4)}" text-anchor="middle" font-size="11.5"${hasArabic(pp.label) ? ' direction="rtl"' : ''}>${esc(pp.label)}</text></g>`);
  }
  o.push('</g></svg>');
  return o.join('');
}
