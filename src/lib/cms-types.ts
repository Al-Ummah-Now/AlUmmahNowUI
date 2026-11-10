/** CMS public read API v1 (docs/CMS_PUBLIC_API.md). Keep in step with the contract. */
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
}

export interface PostSummary {
  slug: string; locale: Locale; title: string; excerpt: string | null;
  cover: MediaRef | null; author_name: string | null; tags: string[];
  published_at: string; updated_at: string;
}
export interface Post extends PostSummary {
  body: string; seo_title: string | null; seo_description: string | null; alternates: Alternate[];
  images?: MediaRef[];
}

/**
 * What the CMS stored for a curated item. The picker takes it and the CMS refreshes it every
 * 30 minutes; the fields after channel_name exist once refreshed (refreshed_at set). A refreshed
 * thumbnail_url is a signed URL valid ≥ 6 h after refreshed_at.
 */
export interface CuratedSnapshot {
  title: string;
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
}

export interface CuratedVideo {
  id: number;
  kind: 'video' | 'playlist' | 'channel';
  ref_id: string;
  title_override: string | null;
  snapshot: CuratedSnapshot | null;
  sort: number;
}

export interface SiteResponse { settings: SiteSettings | null; nav: { header: NavItem[]; footer: NavItem[] } }
export interface HomeResponse { settings: SiteSettings | null; videos: CuratedVideo[]; posts: PostSummary[] }
export interface PostsResponse { items: PostSummary[]; page: number; limit: number; total: number }
export interface VideosResponse { items: CuratedVideo[] }
export interface SitemapResponse { items: { type: 'page' | 'post'; locale: Locale; slug: string; updated_at: string }[] }

// Shallow shape checks: enough to reject an HTML error page or a truncated body
// ("bad JSON" in SPEC §5 counts as a CMS failure and takes the fallback path).
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isArr = Array.isArray;

export const validate = {
  site: (v: unknown): v is SiteResponse => isObj(v) && 'settings' in v && isObj(v.nav) && isArr(v.nav.header) && isArr(v.nav.footer),
  home: (v: unknown): v is HomeResponse => isObj(v) && 'settings' in v && isArr(v.videos) && isArr(v.posts),
  page: (v: unknown): v is Page => isObj(v) && typeof v.slug === 'string' && typeof v.title === 'string' && typeof v.body === 'string',
  posts: (v: unknown): v is PostsResponse => isObj(v) && isArr(v.items) && typeof v.total === 'number',
  post: (v: unknown): v is Post => isObj(v) && typeof v.slug === 'string' && typeof v.title === 'string' && typeof v.body === 'string',
  videos: (v: unknown): v is VideosResponse => isObj(v) && isArr(v.items),
  sitemap: (v: unknown): v is SitemapResponse => isObj(v) && isArr(v.items),
};
