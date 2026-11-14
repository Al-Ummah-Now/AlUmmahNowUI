/**
 * The Fawanees street's tile variant, picked per response on the server (AlUmmahNow
 * packages/fanous-tokens/street, vendored as themes/fanous-street.generated.js).
 *
 * www and the sites Worker cache identical anonymous HTML at the edge (html-cache.ts), so the variant
 * is never part of the cached copy: each Worker runs this on the response it is about to send, after
 * the cache read (HIT, STALE and MISS alike), and HTMLRewriter sets <html data-fanous-street-variant>
 * as the HTML streams through. Every visit gets its own random variant, the page arrives with it set
 * (nothing swaps after paint, no inline script), and only that tile downloads. Visual tests pin it
 * with the aun_street_variant cookie.
 */
import { pickStreetVariant, STREET_VARIANT_ATTR } from './themes/fanous-street.generated.js';

/** The part of HTMLRewriter this needs (the Workers runtime's; tests pass a stand-in). */
export interface HtmlRewriterLike {
  on(selector: string, handlers: { element(el: { setAttribute(name: string, value: string): void }): void }): HtmlRewriterLike;
  transform(response: Response): Response;
}

const workersRewriter = (): HtmlRewriterLike | null => {
  const R = (globalThis as unknown as { HTMLRewriter?: new () => HtmlRewriterLike }).HTMLRewriter;
  return R ? new R() : null;
};

/** The response with <html data-fanous-street-variant="N"> set, for HTML responses with a body; anything else as is. */
export function withStreetVariant(
  response: Response,
  request: Request,
  rewriter: () => HtmlRewriterLike | null = workersRewriter,
  pick: (cookie: string | null) => number = pickStreetVariant,
): Response {
  if (!response.body || !/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) return response;
  const r = rewriter();
  if (!r) return response;
  const variant = String(pick(request.headers.get('cookie')));
  return r.on('html', { element: (el) => el.setAttribute(STREET_VARIANT_ATTR, variant) }).transform(response);
}
