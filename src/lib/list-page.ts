/**
 * List pages (AlUmmahNowCMS docs/specs/WWW-PAGES.md §2, §6): /videos, /articles and any CMS page
 * whose `list_kind` is set. Their items come from GET /lists/:slug (curated or filter), numbered
 * pages of LIST_PAGE_SIZE, rendered with the home timeline's cards (src/components/ListPage.astro).
 *
 * /videos and /articles never 404 on page 1: when the CMS has no such page, or the CMS, the cache
 * and the snapshot all fail, they are www's own built-in filter pages, from what www can read
 * without the list endpoint (/posts for articles; nothing for videos, whose page then shows the
 * "Browse the full library" empty state).
 */
import type { ListFilterKind, ListKind } from './cms-types';
import type { CmsClient, Result } from './cms';
import { LIST_PAGE_SIZE } from './cms';
import { postItem, type FeedItem } from './feed';
import { strings } from '../i18n';
import { otherLocale, type Locale } from './locale';

/** The list pages www has a built-in fallback for, by slug (the same slug in both locales). */
export const BUILTIN_LISTS = ['videos', 'articles'] as const;
export type BuiltinList = (typeof BUILTIN_LISTS)[number];

const BUILTIN_KINDS: Record<BuiltinList, ListFilterKind[]> = {
  videos: ['video', 'playlist', 'channel'],
  articles: ['article', 'cards'],
};

export interface ListView {
  slug: string;
  title: string;
  summary: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  listKind: ListKind;
  kinds: ListFilterKind[];
  pinned: FeedItem[];
  items: FeedItem[];
  page: number;
  pages: number;
  total: number;
  /** cms: GET /lists (from the CMS or its cache/snapshot); builtin: www's own filter page. */
  origin: 'cms' | 'builtin';
  /** The page's slug per locale (its own, and the CMS alternates). */
  slugs: Partial<Record<Locale, string>>;
}

export type ListLoad = { status: 'ok'; view: ListView } | { status: 'not_found' } | { status: 'unavailable' };

/** `?page=` → the page number (absent = 1), or null for anything else (the route answers 404). */
export function parsePage(raw: string | null): number | null {
  if (raw === null) return 1;
  return /^[1-9]\d{0,3}$/.test(raw) ? Number(raw) : null;
}

/** The query string of page `n` (page 1 has none, so it has one URL). */
export const pageQuery = (n: number) => (n === 1 ? '' : `?page=${n}`);

export type PageLink = number | 'gap';

/** The numbered links: the first, the last, and the pages next to the current one. */
export function pageNumbers(page: number, pages: number): PageLink[] {
  if (pages <= 1) return [];
  const want = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...want].sort((a, b) => a - b);
  const out: PageLink[] = [];
  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === 'number' && n - prev === 2) out.push(n - 1);
    else if (typeof prev === 'number' && n - prev > 2) out.push('gap');
    out.push(n);
  }
  return out;
}

type ListCms = Pick<CmsClient, 'list' | 'posts'>;

/**
 * One list page. With `builtin`, a missing or unreachable CMS page falls back to www's own filter
 * page; without it (a CMS page from [slug]), that is `not_found` / `unavailable`.
 * 404 (`not_found`) past the last page only when the CMS itself said how many pages there are.
 */
export async function loadList(opts: { cms: ListCms; locale: Locale; slug: string; page: number; builtin?: BuiltinList }): Promise<ListLoad> {
  const { cms, locale, slug, page } = opts;
  const r = await cms.list(locale, slug, page);
  if (r.status === 'ok') {
    const d = r.data;
    if (page > d.pages && r.source === 'cms') return { status: 'not_found' };
    return {
      status: 'ok',
      view: {
        slug,
        title: d.head.title,
        summary: d.head.summary,
        seoTitle: d.head.seo_title,
        seoDescription: d.head.seo_description,
        listKind: d.head.list_kind,
        kinds: d.head.list_filter?.kinds ?? [],
        // Pinned items lead the first page only (the CMS sends them there; never repeat them)
        pinned: page === 1 ? d.pinned : [],
        items: d.items,
        page,
        pages: d.pages,
        total: d.total,
        origin: 'cms',
        slugs: { ...Object.fromEntries(d.head.alternates.map((a) => [a.locale, a.slug])), [locale]: d.head.slug || slug },
      },
    };
  }
  if (!opts.builtin) return { status: r.status };
  return builtinList(cms, locale, opts.builtin, page, r);
}

async function builtinList(cms: ListCms, locale: Locale, which: BuiltinList, page: number, listResult: Result<unknown>): Promise<ListLoad> {
  const t = strings(locale)[which];
  const base = {
    slug: which,
    title: t.title,
    summary: t.intro,
    seoTitle: null,
    seoDescription: null,
    listKind: 'filter' as const,
    kinds: BUILTIN_KINDS[which],
    pinned: [],
    page,
    origin: 'builtin' as const,
    slugs: { en: which, ar: which },
  };
  if (which === 'videos') {
    // Nothing to list without the CMS library; page 1 shows the empty state. Past it, 404 only
    // when the CMS answered (the page is not there), not while it is unreachable.
    if (page > 1 && listResult.status === 'not_found' && listResult.source === 'cms') return { status: 'not_found' };
    return { status: 'ok', view: { ...base, items: [], pages: 1, total: 0 } };
  }
  const posts = await cms.posts(locale, page, LIST_PAGE_SIZE);
  const list = posts.status === 'ok' ? posts.data : { items: [], total: 0 };
  if (page > 1 && list.items.length === 0 && posts.source === 'cms') return { status: 'not_found' };
  // Keys only need to be unique on the page (nothing is built from them).
  const items = list.items.map((p, i) => postItem({ ...p, videos: [] }, (page - 1) * LIST_PAGE_SIZE + i + 1));
  return { status: 'ok', view: { ...base, items, pages: Math.max(1, Math.ceil(list.total / LIST_PAGE_SIZE)), total: list.total } };
}

/**
 * An empty first page in this locale: is the same page in the other locale listing anything?
 * (docs/SPEC.md §4 "Articles in one language": say so and link there instead of "nothing yet".)
 * One more read, only for an empty first page. Returns the other locale's page path, or null.
 */
export async function otherLocaleList(cms: ListCms, locale: Locale, view: ListView, builtin?: BuiltinList): Promise<string | null> {
  if (view.page !== 1 || view.total > 0 || view.pinned.length > 0 || view.items.length > 0) return null;
  const other = otherLocale(locale);
  if (builtin) {
    if (view.origin === 'builtin') {
      if (builtin !== 'articles') return null;
      const r = await cms.posts(other, 1, 1);
      return r.status === 'ok' && r.data.total > 0 ? `/${other}/${builtin}/` : null;
    }
    const r = await cms.list(other, builtin, 1);
    return r.status === 'ok' && (r.data.total > 0 || r.data.pinned.length > 0) ? `/${other}/${builtin}/` : null;
  }
  const slug = view.slugs[other];
  if (!slug) return null;
  const r = await cms.list(other, slug, 1);
  return r.status === 'ok' && (r.data.total > 0 || r.data.pinned.length > 0) ? `/${other}/${encodeURIComponent(slug)}/` : null;
}

/** The document title: the SEO title or the title, with "Page N of M" past the first page. */
export function listTitle(view: ListView, pageOf: (page: number, pages: number) => string): string {
  const title = view.seoTitle || view.title;
  return view.page > 1 ? `${title}: ${pageOf(view.page, view.pages)}` : title;
}
