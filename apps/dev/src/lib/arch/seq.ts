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
import { bindPhrases, esc, hasArabic, textWidth } from './text.ts';
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
/** gap between a message's words and its arrow (the badge on the arrow has radius BR) */
const LIFT = 17;
const codeW = (s: string) => [...s].length * CS * 0.62;
/** the widest call a desktop column grows to hold on one line */
const CODE_CAP = 440;

/**
 * Greedy word wrap by the build-time width estimate. Code is then balanced: the narrowest width that
 * keeps the same number of lines, so a long route splits near its middle and no piece of it
 * ("seg_<n>.m4s", "reason=stall_timeout") is left alone on a short last line.
 */
function wrap(s0: string, size: number, max: number, code = false): string[] {
  const first = greedyWrap(s0, size, max, code);
  if (!code || first.length < 2) return first;
  let best = first;
  for (let m = max - 4; m > 0; m -= 4) {
    const next = greedyWrap(s0, size, m, code);
    if (next.length !== first.length) break;
    best = next;
  }
  return best;
}

function greedyWrap(s0: string, size: number, max: number, code = false): string[] {
  const s = code ? s0 : bindPhrases(s0);
  const width = (x: string) => (code ? codeW(x) : textWidth(x, size));
  if (width(s) <= max) return [s];
  const out: string[] = [];
  let line = '';
  // a path longer than the line breaks after a '/', never in the middle of a name
  // (or before its query: "…/playback" | "?exclude=…")
  const words = s.split(' ').flatMap((w) => (code && width(w) > max ? w.split(/(?<=[/.(&])|(?=\?)/) : [w]));
  for (const w of words) {
    const glue = code && (/[/.(&]$/.test(line) || w.startsWith('?')) ? '' : ' ';
    const next = line ? `${line}${glue}${w}` : w;
    if (line && width(next) > max) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  // no scrap on the last line ("8", «أولًا» alone): the line before gives up its last word when the last line
  // still fits (only at a space: a path piece keeps its place)
  if (out.length > 1 && width(out[out.length - 1]!) < max / 3) {
    const prev = out[out.length - 2]!;
    const cut = prev.lastIndexOf(' ');
    const moved = `${prev.slice(cut + 1)} ${out[out.length - 1]}`;
    if (cut > 0 && width(moved) <= max) {
      out[out.length - 2] = prev.slice(0, cut);
      out[out.length - 1] = moved;
    }
  }
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
  // tiles leave room inside their column, so a boundary on the column edges never touches them
  const colW = layout.colW;
  const nCols = spec.actors.length;
  // desktop: each gap between two lifelines is as wide as the messages crossing it need (a long call widens only the
  // gaps under its own arrow): every message's words fit over their arrow on two lines at most, and a call sits on one
  // line unless it is too long for any column (a long URL then breaks at a space or after a '/', on two lines at most)
  const gaps = Array.from({ length: nCols - 1 }, () => colW);
  // room past the last column for a self-call there
  let tail = 0;
  const need = (s: SeqMessage) => {
    let sp = 0;
    while (wrap(s.label, LS, sp).length > 2 || (s.label && Math.max(...wrap(s.label, LS, sp).map((l) => textWidth(l, LS))) > sp)) sp += 8;
    if (s.code) {
      const tokens = s.code.split(' ').filter(Boolean);
      const cw = codeW(s.code);
      let sc = cw <= CODE_CAP ? cw : Math.max(...tokens.map(codeW));
      if (cw > CODE_CAP) while (wrap(s.code, CS, sc, true).length > 2) sc += 8;
      sp = Math.max(sp, sc);
    }
    return Math.ceil(sp);
  };
  if (!keyMode) {
    const msgs = spec.steps.filter((x): x is SeqMessage => !isNote(x));
    const order = [...msgs].sort((x, y) => Math.abs(col.get(x.to)! - col.get(x.from)!) - Math.abs(col.get(y.to)! - col.get(y.from)!));
    for (let pass = 0; pass < 3; pass++)
      for (const m of order) {
        const i = Math.min(col.get(m.from)!, col.get(m.to)!);
        const j = Math.max(col.get(m.from)!, col.get(m.to)!);
        if (i === j) {
          // a self-call's words run from its loop to just short of the next lifeline
          const want = need(m) + 48;
          if (i < nCols - 1) gaps[i] = Math.max(gaps[i]!, want);
          else tail = Math.max(tail, want - colW);
          continue;
        }
        const want = need(m) + BR + 20;
        const have = gaps.slice(i, j).reduce((t, g) => t + g, 0);
        if (have < want) for (let k = i; k < j; k++) gaps[k]! += Math.ceil((want - have) / (j - i));
      }
  }
  const centres = [PAD + colW / 2];
  for (const g of gaps) centres.push(centres[centres.length - 1]! + g);
  // the space over a message's arrow for its words
  const spanOf = (s: SeqMessage) => {
    const i = col.get(s.from)!;
    if (s.from === s.to) return (i < nCols - 1 ? gaps[i]! : colW + tail) - 34 - 14;
    return Math.abs(centres[col.get(s.to)!]! - centres[i]!) - BR - 20;
  };
  const tileW = colW - (keyMode ? 16 : 20);
  const heads = spec.actors.map((a) => ({ a, name: keyMode ? [] : wrap(a.name, NS, tileW - 12), role: a.role && !keyMode ? wrap(a.role, RS, tileW - 12) : [] }));
  const headH = keyMode ? 8 + S + 4 + NS + 6 : Math.max(...heads.map((h) => 8 + S + 6 + h.name.length * (NS + LG) + h.role.length * (RS + LG) + 6));
  const headY = groupTop + tagH;
  const baseW = centres[nCols - 1]! + colW / 2 + tail + PAD;
  const cx = (id: string) => centres[col.get(id)!]!;

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
      const x0 = keyMode ? PAD + 4 : Math.min(cx(s.over[0]), cx(s.over[1])) - colW / 2 + 10;
      const x1 = keyMode ? baseW - PAD - 4 : Math.max(cx(s.over[0]), cx(s.over[1])) + colW / 2 - 10;
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
    // desktop: the words stay over their own arrow (a self-call's words stop short of the next lifeline); the
    // columns are as wide as the words need (colW below)
    const span = spanOf(s);
    const max = layout.narrow ? baseW - 2 * PAD - 12 : span;
    const lines = wrap(s.label, LS, max);
    const code = s.code ? wrap(s.code, CS, max, true) : [];
    // on a phone the label starts by its arrow, moving toward the edge only as far as it must to fit
    const blockW = Math.max(...lines.map((l) => textWidth(l, LS)), ...code.map(codeW), 0);
    const lx = layout.narrow ? Math.max(PAD + 6, Math.min(lo, baseW - PAD - 6 - blockW)) : lo;
    const blockH = lines.length * (LS + LG) + code.length * (CS + LG + 1);
    // the words end 17 px above their arrow: clear of the step badge on it
    const ay = y + blockH + LIFT;
    if (!s.reply) n += 1;
    rows.push({ s, y: ay, lines, code, lx, n: s.reply ? undefined : n });
    W = Math.max(W, lx + Math.max(...lines.map((l) => textWidth(l, LS)), ...code.map(codeW), 0) + PAD);
    y = ay + Math.max(layout.rowH - blockH - 10, self ? 34 : 16);
  }
  if (keyMode) W = Math.max(W, ...spec.actors.map((x) => 2 * PAD + 30 + 22 + 10 + textWidth(x.name, NS, true) + 10 + (x.role ? textWidth(x.role, RS) : 0) + 14));
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
    const x0 = centres[Math.min(...cs)]! - colW / 2;
    const x1 = centres[Math.max(...cs)]! + colW / 2;
    const bx = opts.rtl ? W - x1 : x0;
    const bw = x1 - x0;
    out.push(`<g class="an-group an-group-boundary" data-group="${g.id}" data-members="${g.members.join(' ')}">`);
    // around the participants' tiles only: message labels below cross several lanes and must never sit on a border
    out.push(`<rect class="an-group-box" x="${r(bx)}" y="${r(groupTop - 6)}" width="${r(bw)}" height="${r(headY + headH + 8 - (groupTop - 6))}" rx="16"/>`);
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
  // a lifeline pauses behind a message's words, so the words never sit on a dashed line (a phone row runs
  // wider than its arrow; on desktop the words stay over their own arrow)
  const blocks = rows
    .filter((row) => !isNote(row.s))
    .map((row) => {
      const blockH = row.lines.length * (LS + LG) + row.code.length * (CS + LG + 1);
      const top = row.y - LIFT - blockH;
      const w = Math.max(...row.lines.map((l) => textWidth(l, LS)), ...row.code.map(codeW));
      const bx = opts.rtl ? W - row.lx - w : row.lx;
      return { x0: bx - 6, x1: bx + w + 6, y0: top - 4, y1: top + blockH + 4 };
    });
  for (const a of spec.actors) {
    const x = mx(cx(a.id));
    const gaps = blocks.filter((b) => x > b.x0 && x < b.x1).sort((p, q) => p.y0 - q.y0);
    let y0 = headY + headH;
    const d: string[] = [];
    for (const gp of gaps) {
      if (gp.y0 > y0) d.push(`M${r(x)} ${r(y0)} V${r(gp.y0)}`);
      y0 = Math.max(y0, gp.y1);
    }
    if (H - PAD + 4 > y0) d.push(`M${r(x)} ${r(y0)} V${r(H - PAD + 4)}`);
    if (d.length) out.push(`<path class="an-lifeline" d="${d.join(' ')}"/>`);
  }
  out.push('</g>');

  // notes (behind the messages)
  const ids = new Map<Row, string>();
  const paths = new Map<Row, string>();
  out.push('<g class="an-notes">');
  for (const row of rows) {
    if (!isNote(row.s)) continue;
    const s = row.s;
    // on a phone a note spans the whole canvas, so it stays a line or two
    const x0 = keyMode ? PAD + 4 : Math.min(cx(s.over[0]), cx(s.over[1])) - colW / 2 + 10;
    const x1 = keyMode ? W - PAD - 4 : Math.max(cx(s.over[0]), cx(s.over[1])) + colW / 2 - 10;
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
    // a control message stays dashed: no solid lit trace over it
    if (s.flow !== 'control') out.push(`<path class="an-lit an-f-${s.flow}" d="${paths.get(row)}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" values="1;1;0;0" keyTimes="${kt}" dur="${T}s" repeatCount="indefinite"/></path>`);
    out.push(
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
      // the lane's number, repeated under its icon below: two lanes with the same kind of icon stay apart
      out.push(`<text class="an-seq-n" x="${r(mx(PAD + 16))}" y="${r(y0 + 19)}" text-anchor="middle" font-size="${NS}">${formatNumber(i + 1, opts.locale)}</text>`);
      out.push(useIcon(prefix, a.icon, opts.rtl ? W - PAD - 30 - KS : PAD + 30, y0 + 3, KS));
      const nx = PAD + 30 + KS + 10;
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
    if (keyMode) out.push(`<text class="an-seq-n" x="${r(x)}" y="${r(headY + 8 + S + 4 + NS - 1)}" text-anchor="middle" font-size="${NS}">${formatNumber(col.get(h.a.id)! + 1, opts.locale)}</text>`);
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
    const top = row.y - LIFT - blockH;
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
