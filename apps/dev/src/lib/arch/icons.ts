/**
 * Official icons inside diagram SVGs (docs/ICONS.md). Each vendored file becomes a <symbol> in the
 * diagram's own <defs>, with every internal id prefixed so two diagrams on one page never clash, and
 * is drawn with <use width height>: the box is exactly the size we ask for, so a mark can never spill
 * out of its node. Paths are untouched; brand colour is applied as the fill the mark is designed for.
 */
import { ICONS } from '../icons.ts';

export type IconId = string;

/** How a mark is coloured: brand hex for single-colour brand marks, the ink for Lucide, black/white for mono marks. */
const BRAND: Record<string, string> = {
  'simple-icons/cloudflare': '#F6821F',
  'simple-icons/githubactions': '#2088FF',
  'simple-icons/ffmpeg': '#007808',
  'simple-icons/docker': '#2496ED',
  'simple-icons/astro': '#FF5D01',
  'simple-icons/android': '#3DDC84',
  'simple-icons/windows': '#0078D6',
  'simple-icons/linux': '#FCC624',
  'simple-icons/google': '#4285F4',
};
const MONO = new Set(['simple-icons/resend', 'simple-icons/openai', 'simple-icons/nextjs', 'simple-icons/nextdotjs', 'simple-icons/apple', 'simple-icons/github']);

export function iconExists(id: IconId): boolean {
  return id in ICONS;
}

/** Class for the <use>: the colour rule lives in arch.css so both modes are handled by CSS. */
export function iconClass(id: IconId): string {
  if (id.startsWith('cloudflare/')) return 'an-ic an-ic-cf';
  if (id.startsWith('lucide/')) return 'an-ic an-ic-lucide';
  if (MONO.has(id)) return 'an-ic an-ic-mono';
  if (id.startsWith('brand/')) return 'an-ic an-ic-own';
  return 'an-ic an-ic-brand';
}
export function iconFill(id: IconId): string | undefined {
  return BRAND[id];
}

const KEEP = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule'];

/** The symbol id for an icon inside one diagram. */
export const symId = (prefix: string, id: IconId) => `${prefix}-i-${id.replace(/[^a-z0-9]+/gi, '-')}`;

/** A <symbol> for one vendored icon, ids prefixed. Throws for an unknown icon: a missing mark fails the build. */
export function symbol(prefix: string, id: IconId): string {
  const raw = ICONS[id];
  if (!raw) throw new Error(`diagram icon not vendored: ${id}`);
  // start at the <svg> tag (drops the XML prolog and licence comments), then remove any inner
  // comments until none are left (the files are vendored, but never trust one pass)
  let clean = raw.slice(Math.max(0, raw.indexOf('<svg')));
  for (let prev = ''; prev !== clean; ) {
    prev = clean;
    clean = clean.replace(/<!--[\s\S]*?-->/g, '').replace(/<!--|-->/g, '');
  }
  const open = /<svg\b([^>]*)>/.exec(clean);
  if (!open) throw new Error(`not an svg: ${id}`);
  const attrs = open[1] ?? '';
  const vb = /viewBox="([^"]+)"/.exec(attrs)?.[1] ?? '0 0 24 24';
  const keep = KEEP.map((k) => {
    const m = new RegExp(`\\s${k}="([^"]*)"`).exec(attrs);
    return m ? ` ${k}="${m[1]}"` : '';
  }).join('');
  const sid = symId(prefix, id);
  let inner = clean.slice(open.index + open[0].length).replace(/<\/svg>\s*$/, '').trim();
  // prefix internal ids (gradients, clip paths) so the same mark twice on a page stays valid
  const ids = [...inner.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? '');
  for (const x of ids) {
    const esc = x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    inner = inner
      .replace(new RegExp(`id="${esc}"`, 'g'), `id="${sid}-${x}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${sid}-${x})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${sid}-${x}"`);
  }
  return `<symbol id="${sid}" viewBox="${vb}"><g${keep}>${inner}</g></symbol>`;
}

/** A <use> of an icon at (x, y) with a square box of `size`. */
export function useIcon(prefix: string, id: IconId, x: number, y: number, size: number): string {
  const fill = iconFill(id);
  return `<use data-icon="${id}" class="${iconClass(id)}" href="#${symId(prefix, id)}" x="${r(x)}" y="${r(y)}" width="${size}" height="${size}"${fill ? ` fill="${fill}"` : ''}/>`;
}

export const r = (n: number) => Math.round(n * 10) / 10;

/**
 * Platform outline colours as classes (arch.css), never inline styles: the site's CSP is
 * `style-src 'self'`, which drops style attributes. A new accent must be added here and in arch.css.
 */
const ACCENTS: Record<string, string> = { '#f29b1d': 'bunny', '#f6821f': 'cf', 'var(--an-boundary)': 'blue', 'var(--an-ink)': 'ink' };
export function accentClass(accent: string): string {
  const k = ACCENTS[accent];
  if (!k) throw new Error(`diagram accent without a class: ${accent}`);
  return `an-accent-${k}`;
}
