/**
 * The CMS search API (docs/CMS_PUBLIC_API.md "Search"): suggestions fetched from the browser, the
 * full search fetched server-side for /{l}/search. Any failure (network, 4xx/5xx, 404 before the
 * CMS has the endpoint, bad JSON) is "no answer": the box shows no suggestions and the form still
 * submits to the full search.
 */
import type { Locale } from '../locale';

export interface SearchHit {
  id: number;
  /** 'scholar': a scholar's page (from /search/scholars), listed before the posts. */
  type: 'article' | 'cards' | 'scholar';
  title: string;
  slug: string;
  locale: Locale;
  href: string;
  thumbnailUrl: string | null;
  excerpt: string | null;
  publishedAt: string;
}

export interface SearchPage {
  items: SearchHit[];
  page: number;
  limit: number;
  total: number;
}

/** Characters of the query sent (the CMS cuts at the same length). */
export const QUERY_MAX = 100;
export const SUGGEST_LIMIT = 6;
export const SEARCH_PAGE_SIZE = 10;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const strOrNull = (v: unknown) => v === null || typeof v === 'string';

/** A www-relative path (never another origin, never javascript:). */
export const isSafeHref = (v: unknown): v is string => typeof v === 'string' && /^\/(?:en|ar)\/[^\s\\]*$/.test(v) && !v.startsWith('//');

export function isSearchHit(v: unknown): v is SearchHit {
  return (
    isObj(v) &&
    typeof v.id === 'number' &&
    (v.type === 'article' || v.type === 'cards') &&
    typeof v.title === 'string' &&
    typeof v.slug === 'string' &&
    (v.locale === 'en' || v.locale === 'ar') &&
    isSafeHref(v.href) &&
    (v.thumbnailUrl === null || (typeof v.thumbnailUrl === 'string' && v.thumbnailUrl.startsWith('https://'))) &&
    strOrNull(v.excerpt) &&
    typeof v.publishedAt === 'string'
  );
}

/** Valid hits of an answer; anything else in it is dropped. */
export function hitsOf(v: unknown): SearchHit[] | null {
  return Array.isArray(v) ? v.filter(isSearchHit) : null;
}

export function isSearchPage(v: unknown): v is SearchPage {
  return isObj(v) && Array.isArray(v.items) && typeof v.page === 'number' && typeof v.limit === 'number' && typeof v.total === 'number';
}

export function suggestUrl(cmsPublicUrl: string, locale: Locale, q: string, limit = SUGGEST_LIMIT): string {
  const params = new URLSearchParams({ locale, q: q.slice(0, QUERY_MAX), limit: String(limit) });
  return `${cmsPublicUrl}/api/public/v1/search/suggest?${params}`;
}

/** Suggestions, or null when there is no answer (the caller shows none). Abortable. */
export async function fetchSuggestions(
  url: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<SearchHit[] | null> {
  try {
    const res = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, credentials: 'omit' });
    if (!res.ok) return null;
    return hitsOf(await res.json());
  } catch {
    return null;
  }
}

/** Scholars whose name matches (AlUmmahNowCMS `/search/scholars`): their pages, before the posts. */
export const SCHOLAR_SUGGEST_LIMIT = 3;

export function scholarSuggestUrl(cmsPublicUrl: string, locale: Locale, q: string, limit = SCHOLAR_SUGGEST_LIMIT): string {
  const params = new URLSearchParams({ locale, q: q.slice(0, QUERY_MAX), limit: String(limit) });
  return `${cmsPublicUrl}/api/public/v1/search/scholars?${params}`;
}

/** Valid scholar answers as hits (type 'scholar'); anything else is dropped. Pure (unit-tested). */
export function scholarHitsOf(v: unknown, locale: Locale): SearchHit[] | null {
  if (!Array.isArray(v)) return null;
  const out: SearchHit[] = [];
  v.forEach((r, i) => {
    if (!isObj(r) || r.type !== 'scholar' || typeof r.slug !== 'string' || typeof r.title !== 'string' || !isSafeHref(r.href)) return;
    const thumb = typeof r.thumbnailUrl === 'string' && r.thumbnailUrl.startsWith('https://') ? r.thumbnailUrl : null;
    out.push({ id: -(i + 1), type: 'scholar', title: r.title, slug: r.slug, locale, href: r.href, thumbnailUrl: thumb, excerpt: null, publishedAt: '' });
  });
  return out;
}

export async function fetchScholarSuggestions(url: string, locale: Locale, signal: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<SearchHit[] | null> {
  try {
    const res = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, credentials: 'omit' });
    if (!res.ok) return null;
    return scholarHitsOf(await res.json(), locale);
  } catch {
    return null;
  }
}
