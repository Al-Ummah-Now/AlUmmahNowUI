/**
 * The CMS search API (docs/CMS_PUBLIC_API.md "Search"): suggestions fetched from the browser, the
 * full search fetched server-side for /{l}/search. Any failure (network, 4xx/5xx, 404 before the
 * CMS has the endpoint, bad JSON) is "no answer": the box shows no suggestions and the form still
 * submits to the full search.
 */
import type { Locale } from '../locale';

export interface SearchHit {
  id: number;
  type: 'article' | 'cards';
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
