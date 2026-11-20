/**
 * Sequence diagrams in the reference-architecture style: participants across the top (official icon,
 * name, role, the same tiles as arch.ts), dashed lifelines, and numbered messages top to bottom. Each
 * message has a plain-words label and, under it, the real call in code type (a route, a binding, a
 * queue). Replies are dashed. A note spans the participants it is about.
 *
 * Same contract as arch.ts: one SVG string, data-node / data-edge / data-for hooks for the browser
 * gate (e2e/diagram-gate.ts), no inline styles (CSP style-src 'self'), motion only under
 * .an-motion (hidden for prefers-reduced-motion).
 */
import { esc, hasArabic, textWidth } from './text.ts';
import { r, symbol, useIcon, type IconId } from './icons.ts';
import { formatNumber } from '../../../../../packages/render/src/format.ts';
import type { Flow } from './arch.ts';

export interface SeqActor {
  id: string;
  icon: IconId;
  name: string;
  role?: string;
}
export interface SeqMessage {
  from: string;
  to: string;
  /** plain words */
  label: string;
  /** the real call, in code type: a route, a binding, a queue */
  code?: string;
  flow: Flow;
  /** a response: dashed, no number */
  reply?: boolean;
}
export interface SeqNote {
  note: string;
  /** first and last participant it spans */
  over: [string, string];
}
export type SeqStep = SeqMessage | SeqNote;
export interface SeqGroup {
  id: string;
  label: string;
  members: string[];
  tag?: IconId;
}
export interface SeqSpec {
  id: string;
  title: string;
  desc: string;
  actors: SeqActor[];
  steps: SeqStep[];
  groups?: SeqGroup[];
  /** seconds per numbered message */
  hop?: number;
}
export interface SeqLayout {
  colW: number;
  /** minimum height of one message row */
  rowH: number;
  /** phone: labels start at the canvas edge and wrap to its width */
  narrow?: boolean;
  iconSize?: number;
}
export interface SeqOpts {
  rtl: boolean;
  variant: string;
  locale: 'en' | 'ar';
}

const isNote = (s: SeqStep): s is SeqNote => 'note' in s;
const PAD = 24;
const NS = 12.5;
const RS = 11;
const LS = 12.5;
const CS = 11.5;
const BR = 10;
const codeW = (s: string) => [...s].length * CS * 0.62;

/** Greedy word wrap by the build-time width estimate. */
function wrap(s: string, size: number, max: number, code = false): string[] {
  const width = (x: string) => (code ? codeW(x) : textWidth(x, size));
  if (width(s) <= max) return [s];
  const out: string[] = [];
  let line = '';
  for (const w of s.split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (line && width(next) > max) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export function renderSeq(spec: SeqSpec, layout: SeqLayout, opts: SeqOpts): string {
  const S = layout.iconSize ?? 34;
  const LG = opts.locale === 'ar' ? 6 : 3;
  const prefix = `${spec.id}-${opts.variant}`;
  const col = new Map(spec.actors.map((a, i) => [a.id, i]));
  for (const s of spec.steps) for (const id of isNote(s) ? s.over : [s.from, s.to]) if (!col.has(id)) throw new Error(`${spec.id}: unknown participant ${id}`);
  const groups = spec.groups ?? [];
  const tagH = groups.length ? 34 : 0;
  // phone: identifiers don't fit a narrow column, so a key names each participant (icon, name,
  // role) across the full width, and the columns below carry only the icon
  const keyMode = !!layout.narrow;
  const KR = 34;
  const keyH = keyMode ? spec.actors.length * KR : 0;
  const groupTop = PAD + (keyMode ? keyH + 12 : 0);

  // participants: one tile per column, names wrapped to the tile
  const tileW = layout.colW - (keyMode ? 8 : 14);
  const heads = spec.actors.map((a) => ({ a, name: keyMode ? [] : wrap(a.name, NS, tileW - 12), role: a.role && !keyMode ? wrap(a.role, RS, tileW - 12) : [] }));
  const headH = keyMode ? 8 + S + 8 : Math.max(...heads.map((h) => 8 + S + 6 + h.name.length * (NS + LG) + h.role.length * (RS + LG) + 6));
  const headY = groupTop + tagH;
  const baseW = PAD * 2 + layout.colW * spec.actors.length;
  const cx = (id: string) => PAD + layout.colW * (col.get(id)! + 0.5);

  // rows
  interface Row {
    s: SeqStep;
    y: number;
    lines: string[];
    code: string[];
    lx: number;
    n?: number;
  }
  const rows: Row[] = [];
  let y = headY + headH + 22;
  let n = 0;
  let W = baseW;
  for (const s of spec.steps) {
    if (isNote(s)) {
      // on a phone a note spans the whole canvas, so it stays a line or two
      const x0 = keyMode ? PAD + 4 : Math.min(cx(s.over[0]), cx(s.over[1])) - layout.colW / 2 + 10;
      const x1 = keyMode ? baseW - PAD - 4 : Math.max(cx(s.over[0]), cx(s.over[1])) + layout.colW / 2 - 10;
      const lines = wrap(s.note, RS, x1 - x0 - 20);
      const h = lines.length * (RS + LG + 2) + 14;
      rows.push({ s, y, lines, code: [], lx: x0 });
      y += h + 16;
      continue;
    }
    const a = cx(s.from);
    const b = cx(s.to);
    const self = s.from === s.to;
    const lo = self ? a + 34 : Math.min(a, b) + BR + 8;
    const span = self ? layout.colW * 1.6 : Math.abs(b - a) - BR - 20;
    const lx = layout.narrow ? PAD + 6 : lo;
    const max = layout.narrow ? baseW - 2 * PAD - 12 : Math.max(span, 230);
    const lines = wrap(s.label, LS, max);
    const code = s.code ? wrap(s.code, CS, max, true) : [];
    const blockH = lines.length * (LS + LG) + code.length * (CS + LG + 1);
    const ay = y + blockH + 10;
    if (!s.reply) n += 1;
    rows.push({ s, y: ay, lines, code, lx, n: s.reply ? undefined : n });
    W = Math.max(W, lx + Math.max(...lines.map((l) => textWidth(l, LS)), ...code.map(codeW), 0) + PAD);
    y = ay + Math.max(layout.rowH - blockH - 10, self ? 34 : 16);
  }
  if (keyMode) W = Math.max(W, ...spec.actors.map((x) => 2 * PAD + 8 + 22 + 10 + textWidth(x.name, NS, true) + 10 + (x.role ? textWidth(x.role, RS) : 0) + 14));
  const H = y + PAD - 6;
  W = Math.ceil(W);
  const mx = (x: number) => (opts.rtl ? W - x : x);
  const anchor = opts.rtl ? 'end' : 'start';
  /** text aligned to the reading start (left in English, right in Arabic): Arabic runs right to left, so its "start" is the right edge */
  const atStart = (t: string) => (hasArabic(t) ? `text-anchor="${opts.rtl ? 'start' : 'end'}" direction="rtl"` : `text-anchor="${anchor}"`);

  const HOP = spec.hop ?? 1.1;
  const T = n * HOP + 1.6;
  const flows = [...new Set(spec.steps.filter((s): s is SeqMessage => !isNote(s)).map((s) => s.flow))];
  const icons = [...new Set([...spec.actors.map((a) => a.icon), ...groups.flatMap((g) => (g.tag ? [g.tag] : []))])];
  const out: string[] = [];
  out.push(
    `<svg class="an an-seq" data-diagram="${spec.id}" data-variant="${opts.variant}" data-cycle="${f4(T)}" viewBox="0 0 ${W} ${Math.ceil(H)}" width="${W}" height="${Math.ceil(H)}" role="img" aria-labelledby="${prefix}-t ${prefix}-d">`,
    `<title id="${prefix}-t">${esc(spec.title)}</title><desc id="${prefix}-d">${esc(spec.desc)}</desc>`,
    '<defs>',
    ...icons.map((i) => symbol(prefix, i)),
    ...flows.map((f) => `<marker id="${prefix}-mk-${f}" class="an-mk an-f-${f}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker>`),
    '</defs>',
    `<rect class="an-canvas" x="0" y="0" width="${W}" height="${Math.ceil(H)}" rx="18"/>`,
  );

  // groups: a boundary around a run of columns, its tag above their tiles
  out.push('<g class="an-groups">');
  for (const g of groups) {
    const cs = g.members.map((m) => col.get(m)!);
    const x0 = PAD + layout.colW * Math.min(...cs) + 2;
    const x1 = PAD + layout.colW * (Math.max(...cs) + 1) - 2;
    const bx = opts.rtl ? W - x1 : x0;
    const bw = x1 - x0;
    out.push(`<g class="an-group an-group-boundary" data-group="${g.id}" data-members="${g.members.join(' ')}">`);
    out.push(`<rect class="an-group-box" x="${r(bx)}" y="${r(groupTop - 6)}" width="${r(bw)}" height="${r(H - 12 - (groupTop - 6))}" rx="16"/>`);
    const tw = Math.min(textWidth(g.label, 12, true) + (g.tag ? 44 : 24), bw - 12);
    const tx = opts.rtl ? bx + bw - 6 - tw : bx + 6;
    out.push(`<g data-tag="${g.id}"><rect class="an-tag" x="${r(tx)}" y="${r(groupTop + 2)}" width="${r(tw)}" height="24" rx="12"/>`);
    if (g.tag) out.push(useIcon(prefix, g.tag, opts.rtl ? tx + tw - 28 : tx + 10, groupTop + 5, 18));
    out.push(`<text class="an-tag-text" x="${r(opts.rtl ? tx + tw - (g.tag ? 34 : 12) : tx + (g.tag ? 34 : 12))}" y="${r(groupTop + 19)}" ${atStart(g.label)}>${esc(g.label)}</text></g>`);
    out.push('</g>');
  }
  out.push('</g>');

  // lifelines
  out.push('<g class="an-lifelines">');
  for (const a of spec.actors) out.push(`<path class="an-lifeline" d="M${r(mx(cx(a.id)))} ${r(headY + headH)} V${r(H - PAD + 4)}"/>`);
  out.push('</g>');

  // notes (behind the messages)
  const ids = new Map<Row, string>();
  const paths = new Map<Row, string>();
  out.push('<g class="an-notes">');
  for (const row of rows) {
    if (!isNote(row.s)) continue;
    const s = row.s;
    // on a phone a note spans the whole canvas, so it stays a line or two
    const x0 = keyMode ? PAD + 4 : Math.min(cx(s.over[0]), cx(s.over[1])) - layout.colW / 2 + 10;
    const x1 = keyMode ? W - PAD - 4 : Math.max(cx(s.over[0]), cx(s.over[1])) + layout.colW / 2 - 10;
    const h = row.lines.length * (RS + LG + 2) + 14;
    const bx = opts.rtl ? W - x1 : x0;
    out.push(`<rect class="an-seq-note-box" x="${r(bx)}" y="${r(row.y)}" width="${r(x1 - x0)}" height="${r(h)}" rx="8"/>`);
    row.lines.forEach((l, i) =>
      out.push(`<text class="an-seq-note" x="${r(bx + (x1 - x0) / 2)}" y="${r(row.y + 7 + (i + 1) * (RS + LG + 2) - LG)}" text-anchor="middle" font-size="${RS}"${hasArabic(l) ? ' direction="rtl"' : ''}>${esc(l)}</text>`),
    );
  }
  out.push('</g>');

  // messages
  out.push('<g class="an-edges">');
  rows.forEach((row, i) => {
    if (isNote(row.s)) return;
    const s = row.s;
    const id = `${prefix}-m${i}`;
    ids.set(row, id);
    const a = mx(cx(s.from));
    const b = mx(cx(s.to));
    const dir = b >= a ? 1 : -1;
    let d: string;
    if (s.from === s.to) {
      const o = opts.rtl ? -30 : 30;
      d = `M${r(a)} ${r(row.y - 6)} H${r(a + o)} V${r(row.y + 14)} H${r(a + (opts.rtl ? -2 : 2))}`;
    } else d = `M${r(a + dir * 2)} ${r(row.y)} H${r(b - dir * 3)}`;
    paths.set(row, d);
    out.push(`<path id="${id}" data-edge="${id}" data-from="${s.from}" data-to="${s.to}" class="an-edge an-f-${s.flow}${s.reply ? ' an-reply' : ''}" d="${d}" marker-end="url(#${prefix}-mk-${s.flow})"/>`);
  });
  out.push('</g>');

  // motion: each numbered message lights in turn (hidden under prefers-reduced-motion)
  out.push('<g class="an-motion" aria-hidden="true">');
  for (const row of rows) {
    if (isNote(row.s) || row.n === undefined) continue;
    const s = row.s;
    const id = ids.get(row)!;
    const a0 = ((row.n - 1) * HOP) / T;
    const b0 = (row.n * HOP) / T;
    const kt = `0;${f4(a0)};${f4(b0)};1`;
    out.push(
      `<path class="an-lit an-f-${s.flow}" d="${paths.get(row)}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" values="1;1;0;0" keyTimes="${kt}" dur="${T}s" repeatCount="indefinite"/></path>`,
      `<circle class="an-comet an-f-${s.flow}" r="5" opacity="0"><animateMotion dur="${T}s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="${kt}" calcMode="linear"><mpath href="#${id}"/></animateMotion><animate attributeName="opacity" values="0;1;0" keyTimes="0;${f4(a0)};${f4(Math.min(b0 + 0.01, 0.999))}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></circle>`,
    );
  }
  out.push('</g>');

  // participants
  out.push('<g class="an-nodes">');
  if (keyMode)
    spec.actors.forEach((a, i) => {
      const y0 = PAD + i * KR;
      const KS = 22;
      out.push(`<g class="an-node an-seq-key" data-node="key-${a.id}">`);
      out.push(`<rect class="an-node-box" x="${r(PAD)}" y="${r(y0)}" width="${r(W - 2 * PAD)}" height="${KR - 6}" rx="8"/>`);
      out.push(useIcon(prefix, a.icon, opts.rtl ? W - PAD - 8 - KS : PAD + 8, y0 + 3, KS));
      const nx = PAD + 8 + KS + 10;
      const nw = textWidth(a.name, NS, true);
      out.push(`<text class="an-name" x="${r(mx(nx))}" y="${r(y0 + 19)}" ${atStart(a.name)} font-size="${NS}">${esc(a.name)}</text>`);
      if (a.role) out.push(`<text class="an-role" x="${r(mx(nx + nw + 10))}" y="${r(y0 + 19)}" ${atStart(a.role)} font-size="${RS}">${esc(a.role)}</text>`);
      out.push('</g>');
    });
  for (const h of heads) {
    const x = mx(cx(h.a.id));
    const bx = x - tileW / 2;
    out.push(`<g class="an-node" data-node="${h.a.id}">`);
    out.push(`<rect class="an-node-box" x="${r(bx)}" y="${r(headY)}" width="${r(tileW)}" height="${r(headH)}" rx="10"/>`);
    out.push(useIcon(prefix, h.a.icon, x - S / 2, headY + 8, S));
    let ty = headY + 8 + S + 6;
    for (const l of h.name) {
      ty += NS + LG;
      out.push(`<text class="an-name" x="${r(x)}" y="${r(ty - LG - 1)}" text-anchor="middle" font-size="${NS}"${hasArabic(l) ? ' direction="rtl"' : ''}>${esc(l)}</text>`);
    }
    for (const l of h.role) {
      ty += RS + LG;
      out.push(`<text class="an-role" x="${r(x)}" y="${r(ty - LG - 1)}" text-anchor="middle" font-size="${RS}"${hasArabic(l) ? ' direction="rtl"' : ''}>${esc(l)}</text>`);
    }
    out.push('</g>');
  }
  out.push('</g>');

  // labels: plain words, then the real call in code type; a number badge on the sender's lifeline
  out.push('<g class="an-labels">');
  for (const row of rows) {
    if (isNote(row.s)) continue;
    const s = row.s;
    const id = ids.get(row)!;
    const blockH = row.lines.length * (LS + LG) + row.code.length * (CS + LG + 1);
    const top = row.y - 10 - blockH;
    const w = Math.max(...row.lines.map((l) => textWidth(l, LS)), ...row.code.map(codeW));
    const bx = opts.rtl ? W - row.lx - w : row.lx;
    out.push(`<g class="an-seq-text" data-for="${id}">`);
    out.push(`<rect class="an-elabel-bg an-seq-bg" x="${r(bx - 4)}" y="${r(top - 2)}" width="${r(w + 8)}" height="${r(blockH + 4)}" rx="5"/>`);
    let ty = top;
    for (const l of row.lines) {
      ty += LS + LG;
      out.push(`<text class="an-seq-label" x="${r(mx(row.lx))}" y="${r(ty - LG - 1)}" ${atStart(l)} font-size="${LS}">${esc(l)}</text>`);
    }
    for (const l of row.code) {
      ty += CS + LG + 1;
      out.push(`<text class="an-seq-code" x="${r(mx(row.lx))}" y="${r(ty - LG - 2)}" text-anchor="${anchor}" direction="ltr" font-size="${CS}">${esc(l)}</text>`);
    }
    out.push('</g>');
    if (row.n !== undefined) {
      const c = { x: mx(cx(s.from)), y: row.y };
      out.push(`<g class="an-badge an-f-${s.flow}" data-for="${id}" data-covers><circle cx="${r(c.x)}" cy="${r(c.y)}" r="${BR}"/><text x="${r(c.x)}" y="${r(c.y + 4)}" text-anchor="middle">${formatNumber(row.n, opts.locale)}</text></g>`);
    }
  }
  out.push('</g>');
  out.push('</svg>');
  return out.join('');
}

const f4 = (x: number) => String(Math.round(x * 10000) / 10000);
export const seqFlows = (spec: SeqSpec) => [...new Set(spec.steps.filter((s): s is SeqMessage => !isNote(s)).map((s) => s.flow))];
