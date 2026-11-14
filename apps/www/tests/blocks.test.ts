import { describe, expect, it } from 'vitest';
import { cardsHref, cardsQuery, prepareBlocks, SLOT_RE, type CardGrid, type PreparedPage } from '../src/lib/blocks';
import type { RequestContext } from '../src/lib/context';
import type { Block, CardsResponse, MediaRef, PostSummary } from '../src/lib/cms-types';
import { validate } from '../src/lib/cms-types';
import { normalizePageBlocks, servePageBlocks } from '../../../packages/render/src/page-blocks/page-blocks.generated';
import { SAMPLE_TYPES, samplePageBlocks, sampleServeRefs } from '../../../packages/render/src/page-blocks/page-blocks.sample.generated';

const img = (id: number, w = 1200, h = 800): MediaRef => ({ id, url: `https://cms.example/media/${id}.png`, alt: `Image ${id}`, width: w, height: h, mime: 'image/png' }) as MediaRef;
const card = (n: number): PostSummary =>
  ({ id: n, slug: `c${n}`, locale: 'en', title: `Card post ${n}`, excerpt: null, cover: null, tags: [], published_at: '2026-11-01T00:00:00Z', kind: 'cards', slide_count: 3, first_slide: { id: 's1', image: img(n), heading: `First ${n}`, body: null, position: 'bottom' } }) as unknown as PostSummary;

/** The parts of the request context blocks use, with a scripted /cards. The videos API is down. */
function fakeRc(cards: (page: number, limit: number, tag: string | null) => CardsResponse | null) {
  const calls: Array<[number, number, string | null]> = [];
  const rc = {
    cfg: { cmsPublicUrl: 'https://cms.example', videosWebUrl: 'https://videos.example' },
    videos: { fetch: async () => new Response(null, { status: 503 }) },
    cms: {
      cards: async (_l: string, page: number, limit: number, tag?: string | null) => {
        calls.push([page, limit, tag ?? null]);
        const data = cards(page, limit, tag ?? null);
        return data ? { status: 'ok', data, source: 'cms' } : { status: 'unavailable' };
      },
    },
  } as unknown as RequestContext;
  return { rc, calls };
}
const url = (q = '') => ({ pathname: '/en/stories/', search: new URLSearchParams(q) });
const page = (blocks: unknown[], extra: Partial<{ cover: MediaRef | null; locale: 'en' | 'ar'; title: string }> = {}) => ({ blocks: blocks as Block[], locale: 'en' as const, cover: null, title: 'Page title', ...extra });

/** The rendered blocks, by id, as a DOM-free lookup of each section's HTML. */
function sections(out: PreparedPage): Map<string, string> {
  const m = new Map<string, string>();
  const re = /<(section|div|figure|hr)[^>]*\bdata-block="([a-z0-9-]+)"/g;
  const starts = [...out.html.matchAll(re)].map((x) => ({ id: x[2]!, at: x.index! }));
  starts.forEach((s, i) => m.set(s.id, out.html.slice(s.at, starts[i + 1]?.at ?? out.html.length)));
  return m;
}

describe('block helpers', () => {
  it('reads the grid query with bounds', () => {
    expect(cardsQuery(new URLSearchParams('tag=hajj&page=2'))).toEqual({ tag: 'hajj', page: 2 });
    expect(cardsQuery(new URLSearchParams(`tag=${'x'.repeat(61)}&page=1000`))).toEqual({ tag: null, page: 1 });
    expect(cardsQuery(new URLSearchParams('page=-1'))).toEqual({ tag: null, page: 1 });
  });
  it('builds grid links that drop page 1 and no tag', () => {
    expect(cardsHref('/en/s/', { page: 1 })).toBe('/en/s/');
    expect(cardsHref('/en/s/', { tag: 'a b', page: 3 })).toBe('/en/s/?tag=a+b&page=3');
  });
  it('validates /cards', () => {
    expect(validate.cards({ items: [], page: 1, limit: 12, total: 0, tags: [] })).toBe(true);
    expect(validate.cards({ items: [] })).toBe(false);
  });
});

describe('prepareBlocks', () => {
  it('renders v1 blocks with the shared renderer and www’s parts, skipping empty or unknown ones', async () => {
    const { rc } = fakeRc(() => null);
    const blocks = [
      { id: 'a', type: 'markdown', text: 'Hello **world**' },
      { id: 'b', type: 'image', image: img(1), caption: 'A view', size: 'wide' },
      { id: 'c', type: 'gallery', columns: 3, items: [{ image: img(2), caption: null }] },
      { id: 'd', type: 'cta', heading: 'Join', text: null, label: 'Contact us', url: '/contact', tone: 'primary' },
      { id: 'f', type: 'quote', variant: 'callout', text: 'Note this', cite: null },
      { id: 'h', type: 'divider', style: 'space', size: 'm' },
      { id: 'i', type: 'hologram' },
      { id: 'j', type: 'posts', heading: 'News', items: [] },
      { id: 'k', type: 'columns', text: 'Side text', image: img(3), caption: 'cap', image_side: 'end' },
      { id: 'm', type: 'markdown', text: '   ' },
    ];
    const out = await prepareBlocks(rc, page(blocks), url());
    const s = sections(out);
    expect([...s.keys()]).toEqual(['a', 'b', 'c', 'd', 'f', 'h', 'k']);
    expect(out.hero).toBe(false);
    expect(s.get('a')).toContain('<strong>world</strong>');
    // www's responsive picture, sized; the first image is the LCP image when there's no cover
    expect(s.get('b')).toContain('width="1200" height="800"');
    expect(s.get('b')).toContain('fetchpriority="high"');
    expect(s.get('b')).toContain('A view');
    expect(s.get('c')).toContain('media/2.png');
    // site paths get the locale (navHref); external links keep rel=noopener
    expect(s.get('d')).toContain('href="/en/contact"');
    expect(s.get('h')).toContain('pb-k-divider');
    expect(s.get('k')).toContain('Side text');
    expect(out.html).toContain('lang="en" dir="ltr"');
  });

  it('keeps the cover as the LCP image', async () => {
    const { rc } = fakeRc(() => null);
    const out = await prepareBlocks(rc, page([{ id: 'b', type: 'image', image: img(1), caption: null, size: 'content' }], { cover: img(9) }), url());
    expect(out.html).not.toContain('fetchpriority="high"');
  });

  it('a page that opens with a hero: the hero is the h1 (the page title when it has none) and takes the LCP', async () => {
    const { rc } = fakeRc(() => null);
    const hero = { id: 'h1', type: 'hero', eyebrow: null, title: null, subtitle: 'Sub', background: 'image', image: img(5), height: 'm', buttons: [{ label: 'Watch', url: 'https://videos.example/en', variant: 'primary' }], appearance: { align: 'center', width: 'full', tone: 'none', space: 'l' } };
    const out = await prepareBlocks(rc, page([hero], { cover: img(9) }), url());
    expect(out.hero).toBe(true);
    expect(out.html).toMatch(/<h1[^>]*>Page title<\/h1>/);
    expect(out.html).toContain('fetchpriority="high"');
    expect(out.html).toContain('rel="noopener"');
  });

  it('renders every block type of the shared sample page, in English and Arabic', async () => {
    for (const locale of ['en', 'ar'] as const) {
      const all = [1, 2, 3].map(card);
      const { rc } = fakeRc((p, limit) => ({ items: all, page: p, limit, total: 3, tags: [] }));
      const refs = sampleServeRefs(locale, (id) => `https://cms.example/media/${id}.png`, () => null);
      const served = servePageBlocks(normalizePageBlocks(samplePageBlocks(locale)), refs);
      const out = await prepareBlocks(rc, page(served, { locale, title: 'Sample' }), url());
      const types = new Set([...out.html.matchAll(/data-block-type="([a-z]+)"/g)].map((m) => m[1]));
      // The videos API is down in this test: video blocks and shelves (live data) are left out.
      expect([...types].sort()).toEqual(SAMPLE_TYPES.filter((t) => t !== 'video' && t !== 'videos').sort());
      expect(out.html).toContain(`lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`);
      // Slots: www's card grid and post list take the place the renderer left them.
      const slotIds = [...out.html.matchAll(new RegExp(SLOT_RE.source, 'g'))].map((m) => m[1]);
      expect(slotIds.map((id) => out.slots[id!]!.type).sort()).toEqual(['cards', 'posts']);
      // Nothing unescaped or scripted from the content.
      expect(out.html).not.toMatch(/<script|javascript:|on[a-z]+=/i);
    }
  });

  it('loads the card grid for the reader’s tag and page, and falls back to the last page', async () => {
    const all = [1, 2, 3, 4, 5].map(card);
    const { rc, calls } = fakeRc((p, limit, tag) => {
      const items = tag === 'none' ? [] : all.slice((p - 1) * limit, p * limit);
      return { items, page: p, limit, total: tag === 'none' ? 0 : all.length, tags: ['hajj', 'quran'] };
    });
    const blocks = [{ id: 'g', type: 'cards', heading: 'Stories', tag: null, page_size: 3, filter: true }];
    const out = await prepareBlocks(rc, page(blocks), url('tag=hajj&page=7'));
    expect(calls).toEqual([[7, 3, 'hajj'], [2, 3, 'hajj']]);
    expect(out.html).toContain('<!--pb-slot:g-->');
    const grid = (out.slots.g as { grid: CardGrid }).grid;
    expect(grid.page).toBe(2);
    expect(grid.pages).toBe(2);
    expect(grid.cards.map((c) => c.post.slug)).toEqual(['c4', 'c5']);
    expect(grid.cards[0]!.picture).toContain('media/4.png');
    expect(grid.filter).toEqual({ tags: ['hajj', 'quran'], active: 'hajj' });
    expect(grid.href({ page: 1 })).toBe('/en/stories/?tag=hajj');
    expect(grid.href({ tag: null })).toBe('/en/stories/');

    // A filtered empty grid still renders (so the reader can clear the filter); an unfiltered one doesn't.
    const none = await prepareBlocks(rc, page(blocks), url('tag=none'));
    expect(Object.keys(none.slots)).toEqual(['g']);
    const fixed = [{ id: 'g', type: 'cards', heading: null, tag: 'none', page_size: 3, filter: false }];
    expect(Object.keys((await prepareBlocks(rc, page(fixed), url())).slots)).toEqual(['g']);
    const { rc: emptyRc } = fakeRc((p, limit) => ({ items: [], page: p, limit, total: 0, tags: [] }));
    const empty = await prepareBlocks(emptyRc, page([{ id: 'g', type: 'cards', heading: null, tag: null, page_size: 3, filter: false }]), url());
    expect(empty.html).not.toContain('data-block="g"');
  });

  it('ignores the reader’s ?tag= when the editor fixed the tag or turned the filter off', async () => {
    const { rc, calls } = fakeRc((p, limit) => ({ items: [card(1)], page: p, limit, total: 9, tags: ['a', 'b'] }));
    const out = await prepareBlocks(rc, page([{ id: 'g', type: 'cards', heading: null, tag: null, page_size: 3, filter: false }]), url('tag=a'));
    expect(calls[0]).toEqual([1, 3, null]);
    const grid = (out.slots.g as { grid: CardGrid }).grid;
    expect(grid.filter).toBeNull();
    expect(grid.href({ page: 2 })).toBe('/en/stories/?page=2');
  });
});
