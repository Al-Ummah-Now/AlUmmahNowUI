/**
 * The full search for /{l}/search, server-side through the CMS service binding (local dev:
 * CMS_PUBLIC_URL). Not cached here: the CMS caches answers by normalised query, and passes the
 * visitor's IP on (X-Client-IP) so its per-IP limit applies to this page too.
 */
import { CMS_TIMEOUT_MS } from '../cms';
import type { Config, WwwEnv } from '../env';
import type { Locale } from '../locale';
import { isSearchHit, isSearchPage, QUERY_MAX, SEARCH_PAGE_SIZE, type SearchPage } from './suggest';

export type SearchResult = { status: 'ok'; data: SearchPage } | { status: 'limited' } | { status: 'unavailable' };

export interface SearchDeps {
  fetchCms: (path: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

export function searchDeps(env: WwwEnv, cfg: Config): SearchDeps {
  const binding = cfg.appEnv === 'local' ? undefined : env.CMS;
  return {
    fetchCms: (path, init) =>
      binding
        ? binding.fetch(new Request(`https://cms.internal/api/public/v1${path}`, init))
        : fetch(`${cfg.cmsPublicUrl}/api/public/v1${path}`, init),
    log: (message, data) => console.warn(JSON.stringify({ msg: message, ...data })),
  };
}

export async function searchPosts(deps: SearchDeps, locale: Locale, q: string, page: number, clientIp: string | null): Promise<SearchResult> {
  const params = new URLSearchParams({ locale, q: q.slice(0, QUERY_MAX), page: String(page), limit: String(SEARCH_PAGE_SIZE) });
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (clientIp) headers['X-Client-IP'] = clientIp;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? CMS_TIMEOUT_MS);
  try {
    const res = await deps.fetchCms(`/search?${params}`, { headers, signal: controller.signal });
    if (res.status === 429) return { status: 'limited' };
    if (res.ok) {
      const json: unknown = await res.json().catch(() => undefined);
      if (isSearchPage(json)) return { status: 'ok', data: { ...json, items: json.items.filter(isSearchHit) } };
    }
    deps.log?.('search failed', { status: res.status });
  } catch (error) {
    deps.log?.('search failed', { error: controller.signal.aborted ? 'timeout' : String(error) });
  } finally {
    clearTimeout(timer);
  }
  return { status: 'unavailable' };
}
