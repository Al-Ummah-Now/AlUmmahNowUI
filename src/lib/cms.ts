/**
 * CMS client with the fallback chain of SPEC §5:
 *   fresh Cache API entry (60 s) → CMS (2.5 s timeout) → stale Cache API entry (≤ 10 min)
 *   → KV last-known-good (CONTENT_SNAPSHOT) → built-in content.
 * The request path only READS the KV snapshots; one writer (the cron in src/lib/snapshot-writer.ts)
 * writes them, so isolates never race on a key and older data never overwrites newer (audit UI-3).
 * A 404 from the CMS is an answer, not a failure. Timeout, network error, 5xx/4xx
 * other than 404, and bad JSON are failures.
 */
import { builtinContent } from '../content/fallback';
import type { HomeResponse, Page, Post, PostsResponse, SiteResponse, SitemapResponse, VideosResponse } from './cms-types';
import { validate } from './cms-types';
import type { KVNamespace } from './cf';
import type { Config, WwwEnv } from './env';
import type { Locale } from './locale';

export type ContentSource = 'cms' | 'cache' | 'snapshot' | 'builtin';

export type Result<T> =
  | { status: 'ok'; data: T; source: ContentSource }
  | { status: 'not_found'; source: ContentSource }
  /** CMS down and nothing to fall back to (e.g. an article never seen before) */
  | { status: 'unavailable'; source: 'builtin' };

export const FRESH_MS = 60_000;
export const STALE_MS = 600_000;
export const CMS_TIMEOUT_MS = 2_500;
const STORED_AT = 'x-www-stored-at';

export interface CmsDeps {
  fetchCms: (path: string, signal: AbortSignal) => Promise<Response>;
  /** Cache key prefix (an https URL on the site's own zone). */
  cacheKeyBase: string;
  cache?: Cache | null;
  kv?: KVNamespace | null;
  waitUntil: (p: Promise<unknown>) => void;
  now?: () => number;
  timeoutMs?: number;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

type Stored<T> = { notFound: true } | { notFound?: false; data: T };

async function readCache<T>(deps: CmsDeps, key: string): Promise<{ value: Stored<T>; ageMs: number } | null> {
  if (!deps.cache) return null;
  try {
    const hit = await deps.cache.match(key);
    if (!hit) return null;
    const storedAt = Number(hit.headers.get(STORED_AT));
    const value = (await hit.json()) as Stored<T>;
    return { value, ageMs: (deps.now ?? Date.now)() - (Number.isFinite(storedAt) ? storedAt : 0) };
  } catch {
    return null;
  }
}

function writeCache(deps: CmsDeps, key: string, value: Stored<unknown>) {
  if (!deps.cache) return;
  const res = new Response(JSON.stringify(value), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${(FRESH_MS + STALE_MS) / 1000}`,
      [STORED_AT]: String((deps.now ?? Date.now)()),
    },
  });
  deps.waitUntil(deps.cache.put(key, res).catch(() => undefined));
}

export async function load<T>(
  deps: CmsDeps,
  path: string,
  isValid: (v: unknown) => v is T,
  builtin: () => T | null,
): Promise<Result<T>> {
  const key = `${deps.cacheKeyBase}${path}`;
  const cached = await readCache<T>(deps, key);
  if (cached && cached.ageMs < FRESH_MS) {
    if (cached.value.notFound) return { status: 'not_found', source: 'cms' };
    if (isValid(cached.value.data)) return { status: 'ok', data: cached.value.data, source: 'cms' };
  }

  let failure: string;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? CMS_TIMEOUT_MS);
  try {
    const res = await deps.fetchCms(path, controller.signal);
    if (res.status === 404) {
      writeCache(deps, key, { notFound: true });
      return { status: 'not_found', source: 'cms' };
    }
    if (res.ok) {
      const json: unknown = await res.json().catch(() => undefined);
      if (isValid(json)) {
        writeCache(deps, key, { data: json });
        return { status: 'ok', data: json, source: 'cms' };
      }
      failure = 'bad JSON';
    } else {
      failure = `HTTP ${res.status}`;
    }
  } catch (error) {
    failure = controller.signal.aborted ? 'timeout' : String(error);
  } finally {
    clearTimeout(timer);
  }
  deps.log?.('cms fetch failed', { path, failure });

  if (cached && cached.ageMs < FRESH_MS + STALE_MS) {
    if (cached.value.notFound) return { status: 'not_found', source: 'cache' };
    if (isValid(cached.value.data)) return { status: 'ok', data: cached.value.data, source: 'cache' };
  }
  if (deps.kv) {
    const snap = await deps.kv.get(snapshotKey(path), 'json').catch(() => null);
    if (isValid(snap)) return { status: 'ok', data: snap, source: 'snapshot' };
  }
  const fallback = builtin();
  return fallback === null ? { status: 'unavailable', source: 'builtin' } : { status: 'ok', data: fallback, source: 'builtin' };
}

const RANK: Record<ContentSource, number> = { cms: 0, cache: 1, snapshot: 2, builtin: 3 };
/** The least fresh source among the loads that made a page (for X-Content-Source). */
export function worstSource(sources: ContentSource[]): ContentSource {
  return sources.reduce<ContentSource>((worst, s) => (RANK[s] > RANK[worst] ? s : worst), 'cms');
}

export function createCmsDeps(env: WwwEnv, cfg: Config, waitUntil: (p: Promise<unknown>) => void, cache: Cache | null): CmsDeps {
  // Local dev (APP_ENV unset): the binding is not connected, use CMS_PUBLIC_URL instead
  const binding = cfg.appEnv === 'local' ? undefined : env.CMS;
  return {
    fetchCms: (path, signal) =>
      binding
        ? binding.fetch(new Request(`https://cms.internal/api/public/v1${path}`, { signal, headers: { Accept: 'application/json' } }))
        : fetch(`${cfg.cmsPublicUrl}/api/public/v1${path}`, { signal, headers: { Accept: 'application/json' } }),
    cacheKeyBase: `${cfg.siteUrl}/__cms/v1`,
    cache,
    kv: env.CONTENT_SNAPSHOT ?? null,
    waitUntil,
    log: (message, data) => console.warn(JSON.stringify({ msg: message, ...data })),
  };
}

const q = (params: Record<string, string | number>) => `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
const enc = encodeURIComponent;

/** CMS paths (also the KV snapshot keys, `v1:<path>`): shared by the client and the snapshot writer. */
export const cmsPaths = {
  site: (l: Locale) => `/site${q({ locale: l })}`,
  home: (l: Locale) => `/home${q({ locale: l })}`,
  page: (l: Locale, slug: string) => `/pages/${enc(slug)}${q({ locale: l })}`,
  posts: (l: Locale, page: number, limit: number) => `/posts${q({ locale: l, page, limit })}`,
  post: (l: Locale, slug: string) => `/posts/${enc(slug)}${q({ locale: l })}`,
  videos: (l: Locale, placement: 'home' | 'videos') => `/videos${q({ locale: l, placement })}`,
  sitemap: () => '/sitemap',
};
export const snapshotKey = (path: string) => `v1:${path}`;
/** Page sizes the site requests (/articles and the RSS feed): the snapshot writer covers exactly these. */
export const ARTICLES_PAGE_SIZE = 10;
export const RSS_ITEMS = 20;

/** Typed endpoints of the CMS public API. Every call tracks its source for the page header. */
export function cmsClient(deps: CmsDeps) {
  const sources: ContentSource[] = [];
  const track = async <T>(p: Promise<Result<T>>): Promise<Result<T>> => {
    const r = await p;
    sources.push(r.source);
    return r;
  };
  return {
    sources,
    source: () => worstSource(sources),
    site: (l: Locale) => track(load<SiteResponse>(deps, cmsPaths.site(l), validate.site, () => builtinContent(l).site)),
    home: (l: Locale) => track(load<HomeResponse>(deps, cmsPaths.home(l), validate.home, () => builtinContent(l).home)),
    page: (l: Locale, slug: string) => track(load<Page>(deps, cmsPaths.page(l, slug), validate.page, () => builtinContent(l).pages[slug] ?? null)),
    posts: (l: Locale, page: number, limit = 10) =>
      track(load<PostsResponse>(deps, cmsPaths.posts(l, page, limit), validate.posts, () => ({ items: [], page, limit, total: 0 }))),
    post: (l: Locale, slug: string) => track(load<Post>(deps, cmsPaths.post(l, slug), validate.post, () => null)),
    videos: (l: Locale, placement: 'home' | 'videos' = 'videos') =>
      track(load<VideosResponse>(deps, cmsPaths.videos(l, placement), validate.videos, () => ({ items: [] }))),
    sitemap: () => track(load<SitemapResponse>(deps, cmsPaths.sitemap(), validate.sitemap, () => ({ items: [] }))),
  };
}
export type CmsClient = ReturnType<typeof cmsClient>;
