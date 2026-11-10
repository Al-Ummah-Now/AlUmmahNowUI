import { describe, expect, it } from 'vitest';
import { cardsHref, cardsQuery, prepareBlocks } from '../src/lib/blocks';
import type { RequestContext } from '../src/lib/context';
import type { Block, CardsResponse, MediaRef, PostSummary } from '../src/lib/cms-types';
import { validate } from '../src/lib/cms-types';

const img = (id: number, w = 1200, h = 800): MediaRef => ({ id, url: `https://cms.example/media/${id}.png`, alt: `Image ${id}`, width: w, height: h, mime: 'image/png' }) as MediaRef;
const card = (n: number): PostSummary =>
  ({ id: n, slug: `c${n}`, locale: 'en', title: `Card post ${n}`, excerpt: null, cover: null, tags: [], published_at: '2026-11-01T00:00:00Z', kind: 'cards', slide_count: 3, first_slide: { id: 's1', image: img(n), heading: `First ${n}`, body: null, position: 'bottom' } }) as unknown as PostSummary;

/** The parts of the request context blocks use, with a scripted /cards. */
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
  it('prepares each block type and skips empty or unknown ones', async () => {
    const { rc } = fakeRc(() => null);
    const blocks = [
      { id: 'a', type: 'markdown', text: 'Hello **world**' },
      { id: 'b', type: 'image', image: img(1), caption: 'A view', size: 'wide' },
      { id: 'c', type: 'gallery', columns: 5, items: [{ image: img(2), caption: null }, { image: null, caption: 'gone' }] },
      { id: 'd', type: 'cta', heading: 'Join', text: null, label: 'Contact us', url: '/contact', tone: 'primary' },
      { id: 'e', type: 'cta', heading: null, text: null, label: 'Bad', url: 'javascript:alert(1)', tone: 'quiet' },
      { id: 'f', type: 'quote', variant: 'callout', text: 'Note this', cite: null },
      { id: 'g', type: 'quote', variant: 'quote', text: '   ', cite: null },
      { id: 'h', type: 'divider', style: 'space', size: 'x' },
      { id: 'i', type: 'hologram' },
      { id: 'j', type: 'posts', heading: 'News', items: [] },
      { id: 'k', type: 'columns', text: 'Side text', image: img(3), caption: 'cap', image_side: 'end' },
    ] as unknown as Block[];
    const { blocks: out } = await prepareBlocks(rc, { blocks, locale: 'en', cover: null }, url());
    expect(out.map((b) => b.id)).toEqual(['a', 'b', 'c', 'd', 'f', 'h', 'k']);
    const [md, image, gallery, cta, , divider, cols] = out;
    expect(md).toMatchObject({ type: 'markdown' });
    expect((md as { html: string }).html).toContain('<strong>world</strong>');
    // the first image is the LCP image when there's no cover
    expect((image as { picture: string }).picture).toContain('fetchpriority="high"');
    expect(image).toMatchObject({ size: 'wide', caption: 'A view' });
    expect((image as { picture: string }).picture).toContain('width="1200" height="800"');
    expect(gallery).toMatchObject({ columns: 3 });
    expect((gallery as { items: unknown[] }).items).toHaveLength(1);
    expect(cta).toMatchObject({ href: '/en/contact', external: false, tone: 'primary' });
    expect(divider).toMatchObject({ style: 'space', size: 'm' });
    expect(cols).toMatchObject({ imageSide: 'end', caption: 'cap' });
  });

  it('keeps the cover as the LCP image', async () => {
    const { rc } = fakeRc(() => null);
    const blocks = [{ id: 'b', type: 'image', image: img(1), caption: null, size: 'content' }] as unknown as Block[];
    const { blocks: out } = await prepareBlocks(rc, { blocks, locale: 'en', cover: img(9) }, url());
    expect((out[0] as { picture: string }).picture).not.toContain('fetchpriority="high"');
  });

  it('loads the card grid for the reader’s tag and page, and falls back to the last page', async () => {
    const all = [1, 2, 3, 4, 5].map(card);
    const { rc, calls } = fakeRc((page, limit, tag) => {
      const items = tag === 'none' ? [] : all.slice((page - 1) * limit, page * limit);
      return { items, page, limit, total: tag === 'none' ? 0 : all.length, tags: ['hajj', 'quran'] };
    });
    const blocks = [{ id: 'g', type: 'cards', heading: 'Stories', tag: null, page_size: 3, filter: true }] as unknown as Block[];
    const { blocks: out } = await prepareBlocks(rc, { blocks, locale: 'en', cover: null }, url('tag=hajj&page=7'));
    expect(calls).toEqual([[7, 3, 'hajj'], [2, 3, 'hajj']]);
    const grid = (out[0] as { grid: import('../src/lib/blocks').CardGrid }).grid;
    expect(grid.page).toBe(2);
    expect(grid.pages).toBe(2);
    expect(grid.cards.map((c) => c.post.slug)).toEqual(['c4', 'c5']);
    expect(grid.cards[0]!.picture).toContain('media/4.png');
    expect(grid.filter).toEqual({ tags: ['hajj', 'quran'], active: 'hajj' });
    expect(grid.href({ page: 1 })).toBe('/en/stories/?tag=hajj');
    expect(grid.href({ tag: null })).toBe('/en/stories/');

    // A filtered empty grid still renders (so the reader can clear the filter); an unfiltered one doesn't.
    const none = await prepareBlocks(rc, { blocks, locale: 'en', cover: null }, url('tag=none'));
    expect(none.blocks).toHaveLength(1);
    const fixed = [{ id: 'g', type: 'cards', heading: null, tag: 'none', page_size: 3, filter: false }] as unknown as Block[];
    expect((await prepareBlocks(rc, { blocks: fixed, locale: 'en', cover: null }, url())).blocks).toHaveLength(1);
  });

  it('ignores the reader’s ?tag= when the editor fixed the tag or turned the filter off', async () => {
    const { rc, calls } = fakeRc((page, limit) => ({ items: [card(1)], page, limit, total: 9, tags: ['a', 'b'] }));
    const blocks = [{ id: 'g', type: 'cards', heading: null, tag: null, page_size: 3, filter: false }] as unknown as Block[];
    const { blocks: out } = await prepareBlocks(rc, { blocks, locale: 'en', cover: null }, url('tag=a'));
    expect(calls[0]).toEqual([1, 3, null]);
    const grid = (out[0] as { grid: import('../src/lib/blocks').CardGrid }).grid;
    expect(grid.filter).toBeNull();
    expect(grid.href({ page: 2 })).toBe('/en/stories/?page=2');
  });
});
