/**
 * The only writer of the KV last-known-good snapshots (CONTENT_SNAPSHOT), run by the cron trigger
 * (wrangler.jsonc `triggers.crons`, src/worker.ts `scheduled`). Audit UI-3: when every isolate
 * wrote snapshots on the request path, KV (no compare-and-set, reads cached ~60 s) let isolates
 * race on a key, so an isolate with older CMS data could overwrite a newer snapshot.
 *
 * One cron invocation writes each key at most once, in fetch order. Every snapshot carries
 * `fetchedAt` and a content hash in its metadata: unchanged content is not rewritten, and a write
 * never replaces a snapshot fetched later (should two runs ever overlap).
 */
import type { ListWire, PostsResponse, SitemapResponse } from './cms-types';
import { validate } from './cms-types';
import { cmsPaths, ARTICLES_PAGE_SIZE, RSS_ITEMS, snapshotKey } from './cms';
import { BUILTIN_LISTS } from './list-page';
import type { KVNamespace } from './cf';
import { LOCALES, type Locale } from './locale';

export const SNAPSHOT_CRON = '*/5 * * * *';
/**
 * Keys per run beyond the core ones. Each key costs ≤ 3 subrequests (CMS, KV read, KV write), so
 * this stays well under the 1000-subrequest limit; larger sites are covered over several runs.
 */
export const MAX_KEYS_PER_RUN = 250;
export const WRITER_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 10_000;

export interface SnapshotMeta {
  writtenAt: number;
  fetchedAt: number;
  hash: string;
}

export interface WriterDeps {
  fetchCms: (path: string, signal: AbortSignal) => Promise<Response>;
  kv: KVNamespace;
  now?: () => number;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

export interface WriterResult {
  written: number;
  unchanged: number;
  /** A newer snapshot was already stored. */
  newer: number;
  missing: number;
  failed: number;
  keys: number;
}

type Entry = { path: string; isValid: (v: unknown) => boolean };

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Fetch one path and store it if it is valid, changed and not older than what is stored. Returns the JSON. */
async function writeOne(deps: WriterDeps, e: Entry, out: WriterResult): Promise<unknown> {
  const now = deps.now ?? Date.now;
  const fetchedAt = now();
  let json: unknown;
  try {
    const res = await deps.fetchCms(e.path, AbortSignal.timeout(FETCH_TIMEOUT_MS));
    if (res.status === 404) {
      out.missing++;
      return undefined;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
    if (!e.isValid(json)) throw new Error('bad JSON');
  } catch (error) {
    out.failed++;
    deps.log?.('snapshot fetch failed', { path: e.path, error: String(error) });
    return undefined;
  }
  const body = JSON.stringify(json);
  const hash = await sha256(body);
  const key = snapshotKey(e.path);
  try {
    const existing = await deps.kv.getWithMetadata<SnapshotMeta>(key, 'text');
    const meta = existing.metadata;
    if (meta?.hash === hash) {
      out.unchanged++;
      return json;
    }
    if (typeof meta?.fetchedAt === 'number' && meta.fetchedAt > fetchedAt) {
      out.newer++;
      return json;
    }
    await deps.kv.put(key, body, { metadata: { writtenAt: now(), fetchedAt, hash } satisfies SnapshotMeta });
    out.written++;
  } catch (error) {
    out.failed++;
    deps.log?.('snapshot write failed', { key, error: String(error) });
  }
  return json;
}

async function runAll(deps: WriterDeps, entries: Entry[], out: WriterResult): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < entries.length) await writeOne(deps, entries[next++]!, out);
  };
  await Promise.all(Array.from({ length: Math.min(WRITER_CONCURRENCY, entries.length) }, worker));
}

/**
 * Every key the site reads, given the sitemap, the post totals per locale and the page count of
 * each built-in list page (/videos, /articles) per locale.
 */
export function contentEntries(
  sitemap: SitemapResponse | undefined,
  postTotals: Partial<Record<Locale, number>>,
  listPages: Partial<Record<`${Locale}:${string}`, number>> = {},
): Entry[] {
  const entries: Entry[] = [];
  for (const item of sitemap?.items ?? []) {
    entries.push(
      item.type === 'page'
        ? { path: cmsPaths.page(item.locale, item.slug), isValid: validate.page }
        : { path: cmsPaths.post(item.locale, item.slug), isValid: validate.post },
    );
  }
  for (const l of LOCALES) {
    const pages = Math.ceil((postTotals[l] ?? 0) / ARTICLES_PAGE_SIZE);
    for (let p = 2; p <= pages; p++) entries.push({ path: cmsPaths.posts(l, p, ARTICLES_PAGE_SIZE), isValid: validate.posts });
    for (const slug of BUILTIN_LISTS) {
      const n = Math.min(listPages[`${l}:${slug}`] ?? 1, 500);
      for (let p = 2; p <= n; p++) entries.push({ path: cmsPaths.list(l, slug, p), isValid: validate.list });
    }
  }
  return entries;
}

/** One run: the core keys every time, then a rotating window of up to MAX_KEYS_PER_RUN content keys. */
export async function writeSnapshots(deps: WriterDeps, run = Math.floor((deps.now ?? Date.now)() / (5 * 60_000))): Promise<WriterResult> {
  const out: WriterResult = { written: 0, unchanged: 0, newer: 0, missing: 0, failed: 0, keys: 0 };
  const core: Entry[] = [{ path: cmsPaths.sitemap(), isValid: validate.sitemap }];
  for (const l of LOCALES) {
    core.push(
      { path: cmsPaths.site(l), isValid: validate.site },
      ...BUILTIN_LISTS.map((slug) => ({ path: cmsPaths.list(l, slug, 1), isValid: validate.list })),
      { path: cmsPaths.posts(l, 1, ARTICLES_PAGE_SIZE), isValid: validate.posts },
    );
    // The RSS feed's first page, when its size differs from the articles list's
    if (RSS_ITEMS !== ARTICLES_PAGE_SIZE) core.push({ path: cmsPaths.posts(l, 1, RSS_ITEMS), isValid: validate.posts });
  }
  // The sitemap and the first articles page per locale tell us the rest.
  let sitemap: SitemapResponse | undefined;
  const totals: Partial<Record<Locale, number>> = {};
  const listPages: Partial<Record<`${Locale}:${string}`, number>> = {};
  const capture: Entry[] = core.map((e) => ({
    path: e.path,
    isValid: (v: unknown) => {
      if (!e.isValid(v)) return false;
      if (e.path === cmsPaths.sitemap()) sitemap = v as SitemapResponse;
      for (const l of LOCALES) {
        if (e.path === cmsPaths.posts(l, 1, ARTICLES_PAGE_SIZE)) totals[l] = (v as PostsResponse).total;
        for (const slug of BUILTIN_LISTS) if (e.path === cmsPaths.list(l, slug, 1)) listPages[`${l}:${slug}`] = (v as ListWire).pages;
      }
      return true;
    },
  }));
  await runAll(deps, capture, out);
  const rest = contentEntries(sitemap, totals, listPages);
  const window =
    rest.length <= MAX_KEYS_PER_RUN
      ? rest
      : Array.from({ length: MAX_KEYS_PER_RUN }, (_, i) => rest[(run * MAX_KEYS_PER_RUN + i) % rest.length]!);
  await runAll(deps, window, out);
  out.keys = core.length + window.length;
  return out;
}
