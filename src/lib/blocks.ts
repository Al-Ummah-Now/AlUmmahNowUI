/**
 * CMS page blocks → what src/components/Blocks.astro renders (docs/CMS_PUBLIC_API.md "Blocks").
 * Everything async or HTML-producing happens here, once, server-side: markdown with video facades,
 * responsive pictures, curated video shelves, the card-post grid page. The component only lays out.
 *
 * A block type this build doesn't know is skipped (the CMS may add types). A block whose data is
 * gone (no public videos, an empty card grid with no filter) renders nothing, never an empty frame.
 */
import { renderBody } from './body';
import type { Block, BlockVideoItem, CardsResponse, CuratedVideo, MediaRef, Page, PostSummary } from './cms-types';
import type { RequestContext } from './context';
import { navHref } from './context';
import { facadeHtml } from './facade';
import type { Locale } from './locale';
import { pictureHtml, SIZES } from './picture';
import { resolveCurated, type ResolvedCurated, type VideoItem } from './videos';

export type PreparedBlock =
  | { id: string; type: 'markdown'; html: string }
  | { id: string; type: 'image'; picture: string; caption: string | null; size: 'content' | 'wide' }
  | { id: string; type: 'gallery'; columns: 2 | 3 | 4; items: { picture: string; caption: string | null }[] }
  | { id: string; type: 'posts'; heading: string | null; items: PostSummary[] }
  | { id: string; type: 'cards'; heading: string | null; grid: CardGrid }
  | { id: string; type: 'videos'; heading: string | null; items: ResolvedCurated[] }
  | { id: string; type: 'video'; facade: string; caption: string | null }
  | { id: string; type: 'cta'; heading: string | null; text: string | null; label: string; href: string; external: boolean; tone: 'primary' | 'quiet' }
  | { id: string; type: 'columns'; html: string; picture: string | null; caption: string | null; imageSide: 'start' | 'end' }
  | { id: string; type: 'quote'; variant: 'quote' | 'callout'; text: string; cite: string | null }
  | { id: string; type: 'divider'; style: 'line' | 'space'; size: 's' | 'm' | 'l' };

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

/** Layout widths (src/styles/global.css "blocks"): content column, wide, gallery, columns, cards. */
export const BLOCK_SIZES = {
  content: SIZES.prose,
  wide: '(min-width: 78rem) 74rem, calc(100vw - 2rem)',
  gallery: (cols: number) => `(min-width: 78rem) ${Math.round(74 / cols)}rem, (min-width: 40rem) ${Math.round(100 / Math.min(cols, 2))}vw, calc(100vw - 2rem)`,
  columns: '(min-width: 60rem) 28rem, calc(100vw - 2rem)',
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

function picture(rc: RequestContext, ref: MediaRef | null | undefined, sizes: string, priority = false): string | null {
  if (!ref || typeof ref.url !== 'string') return null;
  return pictureHtml(ref, new URL(rc.cfg.cmsPublicUrl).origin, { sizes, priority });
}

export interface PreparedPage {
  blocks: PreparedBlock[];
  /** Videos shown inline (markdown ::video and video blocks), for JSON-LD. */
  videos: VideoItem[];
}

/**
 * Resolves a page's blocks. `search` and `pathname` are the reader's URL (the card grid reads its
 * filter and page from them). `priority`: the first image block is the LCP image when the page has
 * no cover.
 */
export async function prepareBlocks(rc: RequestContext, page: Pick<Page, 'blocks' | 'locale' | 'cover'> & { images?: MediaRef[] }, url: { pathname: string; search: URLSearchParams }): Promise<PreparedPage> {
  const locale: Locale = page.locale;
  const blocks = (Array.isArray(page.blocks) ? page.blocks : []).slice(0, 80);
  const videos: VideoItem[] = [];
  let lcpTaken = !!page.cover;
  const lcp = () => {
    if (lcpTaken) return false;
    lcpTaken = true;
    return true;
  };
  const q = cardsQuery(url.search);

  const out = await Promise.all(
    blocks.map(async (b: Block): Promise<PreparedBlock | null> => {
      if (!b || typeof b !== 'object' || typeof b.id !== 'string') return null;
      switch (b.type) {
        case 'markdown': {
          const body = await renderBody(rc, b.text, locale, page.images);
          videos.push(...body.videos);
          return body.html.trim() ? { id: b.id, type: 'markdown', html: body.html } : null;
        }
        case 'image': {
          const pic = picture(rc, b.image, b.size === 'wide' ? BLOCK_SIZES.wide : BLOCK_SIZES.content, lcp());
          return pic ? { id: b.id, type: 'image', picture: pic, caption: b.caption, size: b.size === 'wide' ? 'wide' : 'content' } : null;
        }
        case 'gallery': {
          const cols = b.columns === 2 || b.columns === 4 ? b.columns : 3;
          const items = (b.items ?? []).flatMap((x) => {
            const pic = picture(rc, x.image, BLOCK_SIZES.gallery(cols));
            return pic ? [{ picture: pic, caption: x.caption }] : [];
          });
          return items.length ? { id: b.id, type: 'gallery', columns: cols, items } : null;
        }
        case 'posts':
          return b.items?.length ? { id: b.id, type: 'posts', heading: b.heading, items: b.items } : null;
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
          if (!data || (!data.items.length && !tag)) return null;
          const pages = Math.max(1, Math.ceil(data.total / limit));
          return {
            id: b.id,
            type: 'cards',
            heading: b.heading,
            grid: {
              cards: data.items.map((post) => ({ post, picture: picture(rc, post.first_slide?.image ?? post.cover, BLOCK_SIZES.card) })),
              page: Math.min(data.page, pages),
              pages,
              total: data.total,
              filter: b.filter && !b.tag && data.tags.length > 1 ? { tags: data.tags, active: tag } : null,
              href: (h) => cardsHref(url.pathname, { tag: !b.filter || b.tag ? null : 'tag' in h ? h.tag : tag, page: h.page ?? 1 }),
            },
          };
        }
        case 'videos': {
          const items = await resolveCurated(rc.videos, asCurated(b.items ?? []), locale);
          return items.length ? { id: b.id, type: 'videos', heading: b.heading, items } : null;
        }
        case 'video': {
          if (b.kind !== 'video' && b.kind !== 'playlist') return null;
          const [r] = await resolveCurated(rc.videos, asCurated([{ kind: b.kind, ref_id: b.ref_id, title_override: null, snapshot: b.snapshot }]), locale);
          if (!r) return null;
          videos.push(r.item);
          return { id: b.id, type: 'video', facade: facadeHtml(r.item, { videosWebUrl: rc.cfg.videosWebUrl, lang: locale, headingLevel: 3 }), caption: b.caption };
        }
        case 'cta': {
          const href = navHref(b.url, locale);
          return href ? { id: b.id, type: 'cta', heading: b.heading, text: b.text, label: b.label, href, external: /^https:/i.test(href), tone: b.tone === 'quiet' ? 'quiet' : 'primary' } : null;
        }
        case 'columns': {
          const body = await renderBody(rc, b.text, locale, page.images);
          videos.push(...body.videos);
          const pic = picture(rc, b.image, BLOCK_SIZES.columns);
          if (!body.html.trim() && !pic) return null;
          return { id: b.id, type: 'columns', html: body.html, picture: pic, caption: pic ? b.caption : null, imageSide: b.image_side === 'end' ? 'end' : 'start' };
        }
        case 'quote':
          return b.text?.trim() ? { id: b.id, type: 'quote', variant: b.variant === 'callout' ? 'callout' : 'quote', text: b.text, cite: b.cite } : null;
        case 'divider':
          return { id: b.id, type: 'divider', style: b.style === 'space' ? 'space' : 'line', size: b.size === 's' || b.size === 'l' ? b.size : 'm' };
        default:
          return null;
      }
    }),
  );
  return { blocks: out.filter((b): b is PreparedBlock => b !== null), videos };
}
