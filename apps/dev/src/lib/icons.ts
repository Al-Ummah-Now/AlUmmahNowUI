/**
 * Vendored product icons (docs/ICONS.md): official brand marks and one open set (Lucide) for
 * generic actors, imported raw and rendered unmodified — scaled by CSS, coloured by the official
 * brand hex (Simple Icons are single-path currentColor marks; Lucide strokes take the text
 * colour). `id` is `<vendor>/<name>` and must match a file under src/assets/icons.
 */
const files = import.meta.glob<string>('../assets/icons/**/*.svg', { query: '?raw', import: 'default', eager: true });

export const ICONS: Record<string, string> = {};
for (const [path, raw] of Object.entries(files)) ICONS[path.replace('../assets/icons/', '').replace('.svg', '')] = raw as string;

/** A stable id for every vendored icon file. */
export type IconId = string;
export const iconRaw = (id: string): string => ICONS[id] ?? '';

/** Parse a vendored svg into a viewBox + inner markup, for nesting inside a diagram's svg. */
export function iconParts(id: string): { viewBox: string; inner: string; w: number; h: number } {
  const raw = ICONS[id] ?? '';
  const vb = /viewBox="([^"]+)"/.exec(raw)?.[1] ?? '0 0 24 24';
  const [, , , w, h] = vb.split(' ').map(Number);
  const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<\/svg>/g, '');
  return { viewBox: vb, inner, w: w || 24, h: h || 24 };
}

/** The official brand colour for a mark (ICONS.md); Lucide marks inherit the text colour. */
const BRAND: Record<string, string> = {
  'cloudflare/workers': '#F6821F',
  'cloudflare/r2': '#F6821F',
  'cloudflare/d1': '#F6821F',
  'cloudflare/kv': '#F6821F',
  'cloudflare/queues': '#F6821F',
  'cloudflare/durable-objects': '#F6821F',
  'cloudflare/containers': '#F6821F',
  'cloudflare/workers-ai': '#F6821F',
  'cloudflare/images': '#F6821F',
  'cloudflare/stream': '#F6821F',
  'cloudflare/cdn': '#F6821F',
  'cloudflare/waf': '#F6821F',
  'cloudflare/zero-trust': '#F6821F',
  'cloudflare/secrets-store': '#F6821F',
  'cloudflare/turnstile': '#F6821F',
  'simple-icons/cloudflare': '#F6821F',
  'simple-icons/githubactions': '#2088FF',
  'simple-icons/resend': '#000000',
  'simple-icons/ffmpeg': '#007808',
  'simple-icons/docker': '#2496ED',
  'simple-icons/openai': '#000000',
  'simple-icons/nextjs': '#000000',
  'simple-icons/astro': '#FF5D01',
  'simple-icons/apple': '#000000',
  'simple-icons/android': '#3DDC84',
  'simple-icons/windows': '#0078D6',
  'simple-icons/linux': '#FCC624',
  'brand/bunny-stream': '#FAAB1E',
};

/** Marks that exist only in black/white: inverted on the dark canvas (contrast, not recolour). */
const INVERT_IN_DARK = new Set(['simple-icons/resend', 'simple-icons/openai', 'simple-icons/nextjs', 'simple-icons/apple']);

/** Lucide glyphs are stroke sets; everything else is a filled mark. */
export const isStrokeIcon = (id: string) => id.startsWith('lucide/');

export interface IconStyle {
  class: string;
  style: string;
  size: number;
}

/** The classes + inline colour for an icon instance. */
export function iconStyle(id: string, size: number): IconStyle {
  const classes = ['pi'];
  if (isStrokeIcon(id)) classes.push('pi-strokes');
  if (INVERT_IN_DARK.has(id)) classes.push('pi-invert-dark');
  const colour = BRAND[id];
  return { class: classes.join(' '), style: `--pi:${size}px;${colour ? `color:${colour}` : ''}`, size };
}

export function iconClasses(id: string, size: number): string {
  return iconStyle(id, size).class;
}

export function iconColour(id: string): string | undefined {
  return BRAND[id];
}
