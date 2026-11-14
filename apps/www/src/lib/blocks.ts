/**
 * CMS page blocks → HTML, with the shared page-builder renderer (wiki AUN-CMS-PAGE-BUILDER;
 * packages/render/src/page-blocks, vendored from the monorepo by scripts/sync-page-blocks.ts). The CMS
 * editor's live preview, www, the scholar sites and the videos site all render blocks with it, so a
 * page looks the same wherever it is shown.
 *
 * www plugs its own parts into the renderer: responsive <picture>s, its markdown body renderer with
 * video facades, the videos-site facade for video blocks and its link rules. Three blocks need live
 * data or the reader's URL and keep www's components (src/components/Blocks.astro fills them in):
 * the paged card-post grid, video shelves (fresh from the videos API, removed videos left out) and
 * post lists. The renderer leaves a marker for each; everything else is one HTML string.
 *
 * Everything async happens here, once, server-side. A block type this build doesn't know is skipped
 * (the CMS may add types). A block whose data is gone (no public videos, an empty card grid with no
 * filter, empty text) renders nothing, never an empty frame.
 */
import { renderBody } from './body';
import type { BlockVideoItem, CardsResponse, CuratedSnapshot, CuratedVideo, MediaRef, Page, PostSummary } from './cms-types';
import type { RequestContext } from './context';
import { navHref } from './context';
import { facadeHtml } from './facade';
import { channelUrl, watchUrl } from './embeds';
import type { Locale } from './locale';
import { pictureHtml } from './picture';
import { resolveCurated, type ResolvedCurated, type VideoItem } from './videos';
import { leadsWithHero, MAX_BLOCKS, PAGE_BLOCK_TYPES, renderPageBlocks, type ServedBlock } from '../../../../packages/render/src/page-blocks/page-blocks.generated';
import { slotHtml } from '../../../../packages/render/src/page-blocks/slots';

export interface CardGrid {
  /** Cards on this grid page, each with its first slide's picture. */
  cards: { post: PostSummary; picture: string | null }[];
  page: number;
  pages: number;
  total: number;
  /** The tag filter: offered when the editor allowed it and there is more than one tag. */
  filter: { tags: string[]; active: string | null } | null;
  /** Links that keep the reader on this page (server-side filter and paging, no JS needed). */
  href: (q: { tag?: string | null; page?: number }) => string;
}

/** A block www renders with its own component, where the renderer left `<!--pb-slot:{id}-->`. */
export type SlotBlock =
  | { id: string; type: 'cards'; heading: string | null; grid: CardGrid }
  | { id: string; type: 'videos'; heading: string | null; items: ResolvedCurated[] }
  | { id: string; type: 'posts'; heading: string | null; items: PostSummary[] };

export { SLOT_RE, splitSlots } from '../../../../packages/render/src/page-blocks/slots';

/** Layout widths of www's own parts inside a block (page-blocks.css: content 46rem, wide 76rem). */
export const BLOCK_SIZES = {
  card: '(min-width: 74rem) 17rem, (min-width: 40rem) 45vw, calc(100vw - 2rem)',
} as const;

/** Reader query for the card grid: ?tag= (≤ 60 chars) and ?page= (1–999). Anything else is ignored. */
export function cardsQuery(search: URLSearchParams): { tag: string | null; page: number } {
  const rawTag = (search.get('tag') ?? '').trim();
  const tag = rawTag && rawTag.length <= 60 ? rawTag : null;
  const p = Number(search.get('page'));
  return { tag, page: Number.isInteger(p) && p >= 1 && p <= 999 ? p : 1 };
}

/** The page's own URL with the grid's query (other params dropped; page 1 and no tag are omitted). */
export function cardsHref(pathname: string, q: { tag?: string | null; page?: number }): string {
  const sp = new URLSearchParams();
  if (q.tag) sp.set('tag', q.tag);
  if (q.page && q.page > 1) sp.set('page', String(q.page));
  const s = sp.toString();
  return s ? `${pathname}?${s}` : pathname;
}

/** Block video items as curated entries (same snapshot rules as the home and videos shelves). */
export function asCurated(items: BlockVideoItem[]): CuratedVideo[] {
  return items.map((x, i) => ({ id: i, kind: x.kind, ref_id: x.ref_id, title_override: x.title_override, snapshot: x.snapshot, sort: i }));
}

export interface PreparedPage {
  /** The blocks as HTML (trusted: the renderer escapes all text), with slot markers. */
  html: string;
  /** The slot blocks by id. */
  slots: Record<string, SlotBlock>;
  /** The first block is a hero: it is the page's heading, and the page shows no header of its own. */
  hero: boolean;
  /** Videos shown inline (markdown ::video and video blocks), for JSON-LD. */
  videos: VideoItem[];
}

const isServed = (b: unknown): b is ServedBlock =>
  !!b && typeof b === 'object' && typeof (b as { id?: unknown }).id === 'string' && PAGE_BLOCK_TYPES.includes((b as { type: ServedBlock['type'] }).type);

/**
 * Resolves and renders a page's blocks. `search` and `pathname` are the reader's URL (the card grid
 * reads its filter and page from them).
 */
export async function prepareBlocks(
  rc: RequestContext,
  page: Pick<Page, 'blocks' | 'locale' | 'cover' | 'title'> & { images?: MediaRef[] },
  url: { pathname: string; search: URLSearchParams },
): Promise<PreparedPage> {
  const locale: Locale = page.locale;
  const cmsOrigin = new URL(rc.cfg.cmsPublicUrl).origin;
  const list = (Array.isArray(page.blocks) ? (page.blocks as unknown[]) : []).filter(isServed).slice(0, MAX_BLOCKS);
  const hero = leadsWithHero(list);
  const q = cardsQuery(url.search);
  const videos: VideoItem[] = [];
  const markdown = new Map<string, string>();
  const facades = new Map<string, string>();
  const slots: Record<string, SlotBlock> = {};

  // Async parts first, in parallel; each answers whether its block stays on the page.
  const keep = await Promise.all(
    list.map(async (b): Promise<boolean> => {
      switch (b.type) {
        case 'markdown':
        case 'columns': {
          const body = await renderBody(rc, b.text, locale, page.images);
          videos.push(...body.videos);
          markdown.set(b.id, body.html);
          return b.type === 'columns' ? !!body.html.trim() || !!b.image : !!body.html.trim();
        }
        case 'video': {
          const [r] = await resolveCurated(rc.videos, asCurated([{ kind: b.kind, ref_id: b.ref_id, title_override: null, snapshot: b.snapshot as CuratedSnapshot | null }]), locale);
          if (!r) return false;
          videos.push(r.item);
          facades.set(b.id, facadeHtml(r.item, { videosWebUrl: rc.cfg.videosWebUrl, lang: locale, headingLevel: 3 }));
          return true;
        }
        case 'videos': {
          const items = await resolveCurated(rc.videos, asCurated(b.items as BlockVideoItem[]), locale);
          if (!items.length) return false;
          slots[b.id] = { id: b.id, type: 'videos', heading: b.heading, items };
          return true;
        }
        case 'posts': {
          if (!b.items?.length) return false;
          // The CMS serves full post summaries (docs/CMS_PUBLIC_API.md); the shared type names only the fields its renderer reads.
          slots[b.id] = { id: b.id, type: 'posts', heading: b.heading, items: b.items as unknown as PostSummary[] };
          return true;
        }
        case 'cards': {
          const tag = b.tag ?? (b.filter ? q.tag : null);
          const limit = Math.min(24, Math.max(3, b.page_size || 12));
          const res = await rc.cms.cards(locale, q.page, limit, tag);
          let data: CardsResponse | null = res.status === 'ok' ? res.data : null;
          // A page past the end (old link) shows the last page rather than an empty grid.
          if (data && !data.items.length && data.total > 0 && q.page > 1) {
            const last = Math.max(1, Math.ceil(data.total / limit));
            const again = await rc.cms.cards(locale, last, limit, tag);
            if (again.status === 'ok') data = again.data;
          }
          if (!data || (!data.items.length && !tag)) return false;
          const pages = Math.max(1, Math.ceil(data.total / limit));
          slots[b.id] = {
            id: b.id,
            type: 'cards',
            heading: b.heading,
            grid: {
              cards: data.items.map((post) => {
                const ref = post.first_slide?.image ?? post.cover;
                return { post, picture: ref && typeof ref.url === 'string' ? pictureHtml(ref, cmsOrigin, { sizes: BLOCK_SIZES.card }) : null };
              }),
              page: Math.min(data.page, pages),
              pages,
              total: data.total,
              filter: b.filter && !b.tag && data.tags.length > 1 ? { tags: data.tags, active: tag } : null,
              href: (h) => cardsHref(url.pathname, { tag: !b.filter || b.tag ? null : 'tag' in h ? h.tag : tag, page: h.page ?? 1 }),
            },
          };
          return true;
        }
        default:
          return true;
      }
    }),
  );
  const shown = list.filter((_, i) => keep[i]);

  const html = renderPageBlocks(shown, {
    locale,
    pageTitle: page.title,
    // The hero is the page's h1 only when it is still first once empty blocks are left out.
    heroIsPageHeading: hero && shown[0]?.type === 'hero',
    // With a hero first the page shows no header, so no cover above the blocks.
    hasCover: !!page.cover && !hero,
    href: (u) => navHref(u, locale),
    image: (ref, o) => pictureHtml(ref as MediaRef, cmsOrigin, { sizes: o.sizes, priority: o.priority, className: o.className }),
    markdown: (_text, id) => markdown.get(id) ?? null,
    video: (b) => facades.get(b.id) ?? null,
    // A ::video inside a layout column or an FAQ answer (the renderer's own facade) links to its watch page.
    watchHref: (kind, id) => {
      try {
        return kind === 'channel' ? channelUrl(rc.cfg.videosWebUrl, { id, lang: locale }) : watchUrl(rc.cfg.videosWebUrl, { kind, id, lang: locale });
      } catch {
        return null;
      }
    },
    slot: (b) => {
      const s = slots[b.id];
      if (!s) return null;
      // The card grid is a labelled section of its own; the shelves and lists take the frame's.
      return s.type === 'cards' ? slotHtml(b, { tag: 'div' }) : slotHtml(b, { labelled: !!s.heading });
    },
  });
  return { html, slots, hero, videos };
}
