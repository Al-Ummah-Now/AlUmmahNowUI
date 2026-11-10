/**
 * CMS images as responsive `<picture>` (CMS-10, docs/CMS_PUBLIC_API.md "Image variants"):
 * AVIF and WebP sources plus a JPEG/PNG fallback `srcset`, `sizes` from the layout, width/height
 * so the box is reserved before the image loads (no layout shift), lazy below the fold and
 * eager + fetchpriority=high for the page's LCP image.
 *
 * A MediaRef without variants (older CMS, width not known yet) renders a plain <img>. Every srcset
 * candidate must be on the CMS origin (CSP img-src); otherwise the variants are ignored.
 */
import type { MediaRef, MediaVariants } from './cms-types';
import { escapeHtml } from './html';

/** Layout widths (src/styles/global.css): .cover is ≤ 56rem, .prose ≤ 42rem; gutters ≥ 1rem a side. */
export const SIZES = {
  cover: '(min-width: 60rem) 56rem, calc(100vw - 2rem)',
  prose: '(min-width: 46rem) 42rem, calc(100vw - 2rem)',
} as const;

export interface PictureOptions {
  sizes: string;
  /** The LCP image: eager, fetchpriority=high. Everything else is lazy. */
  priority?: boolean;
  className?: string;
  /** Overrides MediaRef.alt (inline images keep the alt written in the markdown). */
  alt?: string;
}

function srcsetOk(srcset: string, origin: string): boolean {
  if (!srcset) return false;
  return srcset.split(', ').every((part) => {
    const [url, w, extra] = part.split(' ');
    if (extra !== undefined || !/^\d+w$/.test(w ?? '')) return false;
    try {
      return new URL(url ?? '').origin === origin;
    } catch {
      return false;
    }
  });
}

/** The variants when they are well-formed and on `cmsOrigin`, else null. */
export function usableVariants(v: MediaVariants | null | undefined, cmsOrigin: string): MediaVariants | null {
  if (!v || typeof v !== 'object' || !Array.isArray(v.widths) || !v.widths.length) return null;
  if (v.fallback_type !== 'image/jpeg' && v.fallback_type !== 'image/png') return null;
  return srcsetOk(v.avif, cmsOrigin) && srcsetOk(v.webp, cmsOrigin) && srcsetOk(v.fallback, cmsOrigin) ? v : null;
}

const dim = (n: number | null | undefined) => (typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null);

export function pictureHtml(ref: MediaRef, cmsOrigin: string, opts: PictureOptions): string {
  const a = (s: string) => escapeHtml(s);
  const alt = opts.alt ?? ref.alt ?? '';
  const w = dim(ref.width);
  const h = w ? dim(ref.height) : null;
  const attrs = [
    opts.className ? `class="${a(opts.className)}"` : '',
    `src="${a(ref.url)}"`,
    `alt="${a(alt)}"`,
    w && h ? `width="${w}" height="${h}"` : '',
    opts.priority ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"',
    'decoding="async"',
  ];
  const v = usableVariants(ref.variants, cmsOrigin);
  if (!v) return `<img ${attrs.filter(Boolean).join(' ')}>`;
  const sizes = a(opts.sizes);
  // The fallback srcset's largest candidate is also the plain src (browsers without srcset).
  const largest = v.fallback.split(', ').at(-1)!.split(' ')[0]!;
  attrs[1] = `src="${a(largest)}" srcset="${a(v.fallback)}" sizes="${sizes}"`;
  return (
    `<picture>` +
    `<source type="image/avif" srcset="${a(v.avif)}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${a(v.webp)}" sizes="${sizes}">` +
    `<img ${attrs.filter(Boolean).join(' ')}>` +
    `</picture>`
  );
}

/** Matches an inline image URL from the markdown to the MediaRef the CMS sent for it (by URL path). */
export function imageIndex(images: MediaRef[] | undefined, cmsOrigin: string): (src: string) => MediaRef | null {
  const byPath = new Map<string, MediaRef>();
  const key = (u: string) => {
    try {
      const url = new URL(u);
      return url.origin === cmsOrigin ? decodeURIComponent(url.pathname) : null;
    } catch {
      return null;
    }
  };
  for (const ref of Array.isArray(images) ? images : []) {
    const k = ref && typeof ref.url === 'string' ? key(ref.url) : null;
    if (k) byPath.set(k, ref);
  }
  return (src) => {
    const k = key(src);
    return k ? (byPath.get(k) ?? null) : null;
  };
}
