/** CMS public read API v1 (docs/CMS_PUBLIC_API.md). Keep in step with the contract. */
import type { FeedItem } from './feed';
import type { Locale } from './locale';

export interface MediaRef {
  url: string; alt: string | null; width: number | null; height: number | null;
  /** CMS-10 (additive; absent on older CMS builds): srcset strings per format. */
  variants?: MediaVariants | null;
}
export interface MediaVariants {
  widths: number[];
  fallback_type: 'image/jpeg' | 'image/png';
  avif: string; webp: string; fallback: string;
}
/** url: relative "/..." (www-relative, no locale prefix) or absolute https */
export interface NavItem { label: string; url: string }

export interface SiteSettings {
  locale: Locale;
  site_title: string;
  tagline: string | null;
  hero_title: string | null;
  hero_body: string | null;
  social: { kind: string; url: string }[];
}

export interface Alternate { locale: Locale; slug: string }

export interface Page {
  slug: string; locale: Locale; title: string; summary: string | null;
  body: string;
  seo_title: string | null; seo_description: string | null;
  cover: MediaRef | null;
  published_at: string;
  updated_at: string;
  alternates: Alternate[];
  /** CMS media used inline in body (CMS-10; absent on older CMS builds). */
  images?: MediaRef[];
  /** The page as blocks, in order (additive; absent on older CMS builds: render `body`). */
  blocks?: Block[];
  /**
   * A list page (AlUmmahNowCMS docs/specs/WWW-PAGES.md): render it from GET /lists/:slug. Null or
   * absent (older CMS builds) = a content page.
   */
  list_kind?: ListKind | null;
}

export type ListKind = 'curated' | 'filter';
export type ListFilterKind = 'article' | 'cards' | 'video' | 'playlist' | 'channel';

/** GET /lists/:slug: a curated or filter page's head (docs/specs/WWW-PAGES.md §4 "Public API"). */
export interface ListPageHead {
  slug: string;
  locale: Locale;
  title: string;
  summary: string | null;
  seo_title: string | null;
  seo_description: string | null;
  list_kind: ListKind;
  list_filter: { kinds: ListFilterKind[]; tag: string | null } | null;
  /** The other live translations (the same shape as /pages/:slug `alternates`). */
  alternates: Alternate[];
}

/**
 * GET /lists/:slug?locale&page as www uses it: 20 items per page, numbered pages from 1; `pinned`
 * only on a curated page's first page. Items are the home feed's FeedItem (src/lib/feed.ts).
 * The wire shape (ListWire) is normalised into this by src/lib/cms.ts `toList`.
 */
export interface ListResponse {
  head: ListPageHead;
  pinned: FeedItem[];
  items: FeedItem[];
  page: number;
  pages: number;
  total: number;
  limit: number;
}

/** The wire shape: `page` is the head, `page_number` the page number. */
export interface ListWire {
  page: ListPageHead;
  pinned?: unknown[];
  items: unknown[];
  page_number?: number;
  pages: number;
  total: number;
  limit?: number;
}

/** A scholar's post (AlUmmahNowCMS docs/SCHOLARS.md): their name and page. Null for staff posts. */
export interface PostAuthor { slug: string; name: string; avatar: MediaRef | null }

// Post kinds, references and their summaries are shared with the scholar sites Worker.
export type { PostKind, PostRef, PostV2Summary, CommunityPostData } from '../../../../packages/render/src/posts/types';
import type { PostKind, PostRef, PostV2Summary, CommunityPostData } from '../../../../packages/render/src/posts/types';

export interface PostSummary {
  author?: PostAuthor | null;
  slug: string; locale: Locale; title: string; excerpt: string | null;
  cover: MediaRef | null; author_name: string | null; tags: string[];
  published_at: string; updated_at: string;
  /** Additive (card posts; scholar post references: any PostV2 kind): absent = article. */
  kind?: PostKind;
  /** Additive: a scholar post reference (null for staff posts; absent on older CMS builds). */
  ref?: PostRef | null;
  /** Additive: a reference's kind-specific summary. */
  v2?: PostV2Summary | null;
  slide_count?: number;
  /** A card post's face: its first slide. */
  first_slide?: Slide | null;
  /**
   * Card posts: in a summary (lists, home, /cards, the feed), the first ≤ 10 slides, so lists show
   * the post whole (slide_count counts them all); on the full Post, every slide. [] for articles.
   */
  slides?: Slide[];
}
export interface Post extends PostSummary {
  body: string; seo_title: string | null; seo_description: string | null; alternates: Alternate[];
  images?: MediaRef[];
  /** Additive: a reference's community post (null when the CMS could not read it: render from v2). */
  community?: CommunityPostData | null;
}

/** A card post slide: an image with a heading and short text drawn on it. */
export interface Slide {
  id: string;
  image: MediaRef;
  heading: string | null;
  body: string | null;
  position: 'top' | 'middle' | 'bottom';
}

export interface BlockVideoItem {
  kind: 'video' | 'playlist' | 'channel';
  ref_id: string;
  title_override: string | null;
  snapshot: CuratedSnapshot | null;
}

/** Page blocks (docs/CMS_PUBLIC_API.md "Blocks"). New types may appear: unknown ones are skipped. */
export type Block =
  | { id: string; type: 'markdown'; text: string }
  | { id: string; type: 'image'; image: MediaRef; caption: string | null; size: 'content' | 'wide' }
  | { id: string; type: 'gallery'; columns: 2 | 3 | 4; items: { image: MediaRef; caption: string | null }[] }
  | { id: string; type: 'posts'; heading: string | null; mode: 'latest' | 'tag' | 'picked'; items: PostSummary[] }
  | { id: string; type: 'cards'; heading: string | null; tag: string | null; page_size: number; filter: boolean }
  | { id: string; type: 'videos'; heading: string | null; items: BlockVideoItem[] }
  | { id: string; type: 'video'; kind: 'video' | 'playlist'; ref_id: string; caption: string | null; snapshot: CuratedSnapshot | null }
  | { id: string; type: 'cta'; heading: string | null; text: string | null; label: string; url: string; tone: 'primary' | 'quiet' }
  | { id: string; type: 'columns'; text: string; image: MediaRef | null; caption: string | null; image_side: 'start' | 'end' }
  | { id: string; type: 'quote'; variant: 'quote' | 'callout'; text: string; cite: string | null }
  | { id: string; type: 'divider'; style: 'line' | 'space'; size: 's' | 'm' | 'l' };

/**
 * What the CMS stored for a curated item. The picker takes it and the CMS refreshes it every
 * 30 minutes; the fields after channel_name exist once refreshed (refreshed_at set). A refreshed
 * thumbnail_url is a signed URL valid ≥ 6 h after refreshed_at.
 */
export interface CuratedSnapshot {
  title: string;
  /** Channels (docs/specs/WWW-PAGES.md D7): their newest ≤ 3 public videos, newest first. */
  latest?: ChannelLatest[];
  thumbnail_url: string | null;
  channel_name: string | null;
  refreshed_at?: string;
  handle?: string | null;
  description?: string | null;
  titles?: Partial<Record<Locale, string>>;
  descriptions?: Partial<Record<Locale, string>>;
  duration_seconds?: number | null;
  upload_date?: string | null;
  video_count?: number | null;
  /** Videos (CMS FEED_FORMAT 3): the encoded size, for the player frame's shape. */
  width?: number | null;
  height?: number | null;
  /** Videos (CMS FEED_FORMAT 3): their channel's name per language. */
  channel_names?: Partial<Record<Locale, string>>;
}

export interface ChannelLatest { id: string; title: string; thumbnail_url: string | null; duration_seconds: number | null }

export interface CuratedVideo {
  id: number;
  kind: 'video' | 'playlist' | 'channel';
  ref_id: string;
  title_override: string | null;
  snapshot: CuratedSnapshot | null;
  sort: number;
}

export interface SiteResponse { settings: SiteSettings | null; nav: { header: NavItem[]; footer: NavItem[] } }
export interface PostsResponse { items: PostSummary[]; page: number; limit: number; total: number }
/** GET /cards: card posts only, newest first; `tags` = every tag on this locale's card posts. */
export interface CardsResponse { items: PostSummary[]; page: number; limit: number; total: number; tags: string[] }
export interface SitemapResponse {
  /** translation_key pairs one item's languages (absent from older CMS versions) */
  items: {
    type: 'page' | 'post'; locale: Locale; slug: string; updated_at: string; translation_key?: string | null;
    /** Additive: a scholar post reference's community post and channel (null for staff posts; absent on older CMS builds). */
    ref_post_id?: string | null;
    ref_channel_id?: string | null;
  }[];
  /** Scholar pages (both locales each). Absent from older CMS versions. */
  scholars?: {
    slug: string; updated_at: string;
    /** Additive: the scholar's primary channel (absent on older CMS builds). */
    primary_channel_id?: string | null;
  }[];
}

export interface ScholarSummary {
  slug: string;
  name: string;
  name_en: string | null;
  name_ar: string | null;
  bio_excerpt: string | null;
  avatar: MediaRef | null;
  updated_at: string;
  post_count?: number;
}
export interface Scholar extends ScholarSummary {
  bio: string | null;
  bio_en: string | null;
  bio_ar: string | null;
  channel_ids: string[];
  /** Additive: the primary channel (CMS `scholars.primary_channel_id`; absent on older builds, where it is channel_ids[0]). */
  primary_channel_id?: string | null;
  created_at: string;
}
export interface ScholarsResponse { items: ScholarSummary[]; page: number; limit: number; total: number }
export interface ScholarPageResponse {
  scholar: Scholar;
  posts: PostsResponse;
  post_counts: Record<Locale, number>;
}

// Shallow shape checks: enough to reject an HTML error page or a truncated body
// ("bad JSON" in SPEC §5 counts as a CMS failure and takes the fallback path).
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isArr = Array.isArray;

const isHead = (v: unknown): v is ListPageHead =>
  isObj(v) && typeof v.slug === 'string' && typeof v.title === 'string';
/** The head of a /lists answer (its `page` object), or null. */
export function listHead(v: Record<string, unknown>): ListPageHead | null {
  return isHead(v.page) ? v.page : null;
}

export const validate = {
  site: (v: unknown): v is SiteResponse => isObj(v) && 'settings' in v && isObj(v.nav) && isArr(v.nav.header) && isArr(v.nav.footer),
  page: (v: unknown): v is Page => isObj(v) && typeof v.slug === 'string' && typeof v.title === 'string' && typeof v.body === 'string',
  posts: (v: unknown): v is PostsResponse => isObj(v) && isArr(v.items) && typeof v.total === 'number',
  post: (v: unknown): v is Post => isObj(v) && typeof v.slug === 'string' && typeof v.title === 'string' && typeof v.body === 'string',
  cards: (v: unknown): v is CardsResponse => isObj(v) && isArr(v.items) && typeof v.total === 'number' && isArr(v.tags),
  sitemap: (v: unknown): v is SitemapResponse => isObj(v) && isArr(v.items),
  scholars: (v: unknown): v is ScholarsResponse => isObj(v) && isArr(v.items) && typeof v.total === 'number',
  list: (v: unknown): v is ListWire => isObj(v) && isArr(v.items) && typeof v.pages === 'number' && typeof v.total === 'number' && listHead(v) !== null,
  scholar: (v: unknown): v is ScholarPageResponse =>
    isObj(v) && isObj(v.scholar) && typeof v.scholar.slug === 'string' && typeof v.scholar.name === 'string' && isObj(v.posts) && isArr(v.posts.items) && isObj(v.post_counts),
};
