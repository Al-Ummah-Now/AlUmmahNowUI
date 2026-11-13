/**
 * The HTML edge cache shared by www and the sites Worker (AUN-SCHOLAR-SITES SS3): anonymous,
 * identical HTML in the Cache API, fresh for HTML_FRESH_SEC, then served stale while one
 * revalidation runs (a lease stops every isolate of the colo rendering at once). Each app decides
 * what may be cached (`cacheableRequest` / `cacheableResponse`) and what the key holds (URL plus
 * build version, theme, site config version...).
 */

export const HTML_FRESH_SEC = 60;
export const HTML_SWR_SEC = 600;
/**
 * Revalidation lease (audit UI-2): on a STALE hit, the stale entry is first re-stored as fresh for
 * this long, so requests in other isolates of the colo see a HIT instead of each starting their
 * own render. Within one isolate an in-flight map collapses concurrent revalidations completely.
 */
export const HTML_LEASE_SEC = 15;
const STORED_AT = 'x-www-stored-at';
/** When the entry's content was rendered: a lease moves STORED_AT, never this (bounds staleness). */
const RENDERED_AT = 'x-www-rendered-at';
export const HTML_CACHE_CONTROL = `public, max-age=0, s-maxage=${HTML_FRESH_SEC}, stale-while-revalidate=${HTML_SWR_SEC}`;

/** A cache key URL: the page URL with each part that changes the HTML as a query parameter. */
export function cacheKeyUrl(url: string, parts: Record<string, string>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(parts)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

export interface HtmlCacheOptions {
  key: string;
  cacheableRequest: (request: Request) => boolean;
  cacheableResponse: (response: Response) => boolean;
  now?: () => number;
  inflight?: Map<string, Promise<unknown>>;
}

/** Revalidations in flight in this isolate, by key. */
const revalidating = new Map<string, Promise<unknown>>();

export async function cachedHtml(
  request: Request,
  cache: Cache | null,
  waitUntil: (p: Promise<unknown>) => void,
  render: () => Promise<Response>,
  opts: HtmlCacheOptions,
): Promise<Response> {
  const now = opts.now ?? Date.now;
  const inflight = opts.inflight ?? revalidating;
  if (!cache || !opts.cacheableRequest(request)) return render();
  const key = new Request(opts.key, { method: 'GET' });
  const put = (res: Response, storedAt: number, renderedAt: number) => {
    const copy = new Response(res.body, res);
    copy.headers.set(STORED_AT, String(storedAt));
    copy.headers.set(RENDERED_AT, String(renderedAt));
    const left = Math.max(1, Math.ceil(HTML_FRESH_SEC + HTML_SWR_SEC - (now() - renderedAt) / 1000));
    copy.headers.set('Cache-Control', `public, max-age=${left}`);
    return cache.put(key, copy).catch(() => undefined);
  };
  const store = async (res: Response) => {
    if (!opts.cacheableResponse(res)) return;
    const t = now();
    await put(res.clone(), t, t);
  };
  const finish = (res: Response, state: string) => {
    const out = new Response(res.body, res);
    out.headers.delete(STORED_AT);
    out.headers.delete(RENDERED_AT);
    out.headers.set('Cache-Control', HTML_CACHE_CONTROL);
    out.headers.set('X-Edge-Cache', state);
    return out;
  };

  const hit = await cache.match(key).catch(() => undefined);
  if (hit) {
    const storedAt = Number(hit.headers.get(STORED_AT) ?? 0);
    const renderedAt = Number(hit.headers.get(RENDERED_AT) ?? storedAt);
    const age = (now() - storedAt) / 1000;
    const life = (now() - renderedAt) / 1000;
    if (life < HTML_FRESH_SEC + HTML_SWR_SEC) {
      if (age < HTML_FRESH_SEC) return finish(hit, 'HIT');
      if (!inflight.has(key.url)) {
        // Lease first (the stale copy, fresh for HTML_LEASE_SEC), then render and store.
        const lease = put(hit.clone(), now() - (HTML_FRESH_SEC - HTML_LEASE_SEC) * 1000, renderedAt);
        const job = lease
          .then(render)
          .then(store)
          .catch(() => undefined)
          .finally(() => inflight.delete(key.url));
        inflight.set(key.url, job);
        waitUntil(job);
      }
      return finish(hit, 'STALE');
    }
  }
  const fresh = await render();
  waitUntil(store(fresh));
  return opts.cacheableResponse(fresh) ? finish(fresh, 'MISS') : fresh;
}
