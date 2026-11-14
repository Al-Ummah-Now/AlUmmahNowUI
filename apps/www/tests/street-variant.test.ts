import { describe, expect, it } from 'vitest';
import { withStreetVariant, type HtmlRewriterLike } from '../../../packages/render/src/street-variant';
import { pickStreetVariant } from '../../../packages/render/src/themes/fanous-street.generated.js';
import { withHtmlCache } from '../src/lib/edge';
import { MemoryCache, waiter } from './helpers';

/** A stand-in for the Workers HTMLRewriter: sets the attribute on <html> by text replacement. */
function fakeRewriter(): HtmlRewriterLike {
  const attrs: [string, string][] = [];
  const r: HtmlRewriterLike = {
    on(selector, handlers) {
      expect(selector).toBe('html');
      handlers.element({ setAttribute: (n, v) => attrs.push([n, v]) });
      return r;
    },
    transform(res) {
      const body = res.text().then((t) => t.replace(/<html\b/, `<html ${attrs.map(([n, v]) => `${n}="${v}"`).join(' ')}`));
      return new Response(new ReadableStream({ async start(c) { c.enqueue(new TextEncoder().encode(await body)); c.close(); } }), res);
    },
  };
  return r;
}

const html = (headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' }) => new Response('<!doctype html><html lang="en"><body>x</body></html>', { headers });
const req = (cookie?: string) => new Request('https://www.example/en/', { headers: cookie ? { cookie } : {} });

describe('the street variant, set per response after the cache read', () => {
  it('sets <html data-fanous-street-variant> on HTML, from the pick', async () => {
    const out = await withStreetVariant(html(), req(), fakeRewriter, () => 3).text();
    expect(out).toContain('<html data-fanous-street-variant="3" lang="en">');
  });

  it('gives the same cached HTML a different variant on different visits', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40 && seen.size < 2; i++) {
      const out = await withStreetVariant(html(), req(), fakeRewriter).text();
      seen.add(/data-fanous-street-variant="([1-4])"/.exec(out)![1]!);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('honours the aun_street_variant cookie (visual tests)', async () => {
    const out = await withStreetVariant(html(), req('a=1; aun_street_variant=4'), fakeRewriter).text();
    expect(out).toContain('data-fanous-street-variant="4"');
    expect(pickStreetVariant('aun_street_variant=7', () => 0)).toBe(1);
  });

  it('leaves non-HTML, bodiless responses and runtimes without HTMLRewriter alone', async () => {
    const json = new Response('{}', { headers: { 'content-type': 'application/json' } });
    expect(withStreetVariant(json, req(), fakeRewriter)).toBe(json);
    const empty = new Response(null, { status: 304, headers: { 'content-type': 'text/html' } });
    expect(withStreetVariant(empty, req(), fakeRewriter)).toBe(empty);
    const page = html();
    expect(withStreetVariant(page, req(), () => null)).toBe(page);
  });

  it('the edge cache keeps one copy with no variant; every HIT still gets its own', async () => {
    const cache = new MemoryCache();
    const w = waiter();
    let renders = 0;
    const render = async () => { renders++; return new Response('<!doctype html><html lang="en"><body>x</body></html>', { headers: { 'Content-Type': 'text/html', 'X-Content-Source': 'cms' } }); };
    const visit = async (pick: number) => {
      const request = new Request('https://w/en/');
      const cached = await withHtmlCache(request, cache as unknown as Cache, w.waitUntil, render, () => 1_000, new Map());
      const res = withStreetVariant(cached, request, fakeRewriter, () => pick);
      return { state: cached.headers.get('X-Edge-Cache'), html: await res.text() };
    };
    const first = await visit(2);
    await w.flush();
    expect(first.state).toBe('MISS');
    expect(first.html).toContain('data-fanous-street-variant="2"');
    const stored = [...cache.store.values()][0]!;
    expect(await stored.clone().text()).not.toContain('data-fanous-street-variant');
    const second = await visit(4), third = await visit(1);
    expect([second.state, third.state]).toEqual(['HIT', 'HIT']);
    expect(second.html).toContain('data-fanous-street-variant="4"');
    expect(third.html).toContain('data-fanous-street-variant="1"');
    expect(renders).toBe(1);
  });
});
