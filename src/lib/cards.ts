/**
 * Card post viewer rules, shared by the server render (src/components/CardViewer.astro) and the
 * script (src/scripts/cards.ts). Pure, so they are unit-tested.
 */

/** 0-based slide from a deep link: `?slide=3` or `#3` (1-based, as readers count). Out of range → 0. */
export function slideFromLink(search: string, hash: string, count: number): number {
  const fromHash = /^#(\d{1,3})$/.exec(hash)?.[1];
  const fromQuery = /^(\d{1,3})$/.exec(new URLSearchParams(search).get('slide') ?? '')?.[1];
  const n = Number(fromHash ?? fromQuery ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : 0;
}

/**
 * The step an arrow key takes, in the reading direction. In Arabic (RTL) "next" is to the left:
 * ← goes forward and → goes back. Home/End jump to the ends. Anything else → null.
 */
export function keyStep(key: string, dir: 'ltr' | 'rtl'): number | 'first' | 'last' | null {
  if (key === 'ArrowRight') return dir === 'rtl' ? -1 : 1;
  if (key === 'ArrowLeft') return dir === 'rtl' ? 1 : -1;
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  return null;
}

/**
 * A finished touch gesture → step, or 0 when it isn't a swipe (too short, or mostly vertical, so a
 * scroll never turns the slide). A swipe toward the start of the line moves forward: right-to-left
 * in English, left-to-right in Arabic.
 */
export function swipeStep(dx: number, dy: number, dir: 'ltr' | 'rtl', threshold = 40): number {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  const forward = dir === 'rtl' ? dx > 0 : dx < 0;
  return forward ? 1 : -1;
}

/** "8 cards" with the plural forms Arabic needs (1, 2, 3–10, 11+). */
export function slideCountLabel(t: { oneSlide: string; twoSlides: string; slideCount: string; manySlides: string }, n: number): string {
  if (n === 1) return t.oneSlide;
  if (n === 2) return t.twoSlides;
  return (n >= 3 && n <= 10 ? t.slideCount : t.manySlides).replace('{count}', String(n));
}

/** Clamp to the slides (no wrap: the end is an end, and "3 / 8" stays honest). */
export function clampSlide(i: number, count: number): number {
  return Math.max(0, Math.min(count - 1, i));
}

/** The slides to load ahead of time around `i` (the neighbours a reader reaches next). */
export function neighbours(i: number, count: number): number[] {
  return [i - 1, i + 1, i + 2].filter((n) => n >= 0 && n < count);
}

/**
 * What a card post shares (og:image, description): its cover if it has one, else its first card's
 * image; the first card's text when the post has no excerpt.
 */
export function cardPostSeo(post: { cover?: { url: string } | null; kind?: string; slides?: Array<{ image: { url: string }; heading: string | null; body: string | null }> }): { image: string | null; text: string } {
  const first = post.kind === 'cards' ? post.slides?.[0] : undefined;
  const text = first ? [first.heading, first.body].filter(Boolean).join(' — ').slice(0, 180) : '';
  return { image: post.cover?.url ?? first?.image.url ?? null, text };
}
