import { describe, expect, it } from 'vitest';
import { cmsClient, load, worstSource, type CmsDeps } from '../src/lib/cms';
import { validate, type SiteResponse } from '../src/lib/cms-types';
import { MemoryCache, MemoryKV, waiter } from './helpers';

const SITE: SiteResponse = { settings: null, nav: { header: [{ label: 'CMS Articles', url: '/articles/' }], footer: [] } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(fetchCms: CmsDeps['fetchCms']) {
  const cache = new MemoryCache();
  const kv = new MemoryKV();
  const w = waiter();
  let now = 1_000_000;
  const deps: CmsDeps = {
    fetchCms,
    cacheKeyBase: 'https://www.test/__cms/v1',
    cache: cache as unknown as Cache,
    kv: kv as never,
    waitUntil: w.waitUntil,
    now: () => now,
    timeoutMs: 50,
  };
  return { deps, cache, kv, w, advance: (ms: number) => (now += ms) };
}
const builtin = () => ({ settings: null, nav: { header: [{ label: 'Builtin', url: '/x/' }], footer: [] } }) as SiteResponse;

describe('CMS fallback chain', () => {
  it('serves CMS data and caches it; the request path never writes KV (the cron does)', async () => {
    const { deps, kv, w } = setup(async () => json(SITE));
    const r = await load(deps, '/site?locale=en', validate.site, builtin);
    expect(r).toEqual({ status: 'ok', data: SITE, source: 'cms' });
    await w.flush();
    expect(kv.puts).toBe(0);
  });

  it('answers from a fresh cache entry without calling the CMS', async () => {
    let calls = 0;
    const { deps, w } = setup(async () => (calls++, json(SITE)));
    await load(deps, '/site', validate.site, builtin);
    await w.flush();
    const r = await load(deps, '/site', validate.site, builtin);
    expect(calls).toBe(1);
    expect(r.source).toBe('cms');
  });

  it('falls back to the stale cache entry when the CMS fails', async () => {
    let fail = false;
    const { deps, w, advance } = setup(async () => (fail ? json({}, 500) : json(SITE)));
    await load(deps, '/site', validate.site, builtin);
    await w.flush();
    fail = true;
    advance(120_000);
    const r = await load(deps, '/site', validate.site, builtin);
    expect(r).toEqual({ status: 'ok', data: SITE, source: 'cache' });
  });

  it('falls back to the KV snapshot when the cache is gone (timeout)', async () => {
    let hang = false;
    const { deps, cache, kv, w } = setup((_p, signal) =>
      hang ? new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))) : Promise.resolve(json(SITE)),
    );
    await kv.put('v1:/site', JSON.stringify(SITE)); // written by the snapshot cron
    await load(deps, '/site', validate.site, builtin);
    await w.flush();
    cache.store.clear();
    hang = true;
    const r = await load(deps, '/site', validate.site, builtin);
    expect(r).toEqual({ status: 'ok', data: SITE, source: 'snapshot' });
  });

  it('uses built-in content when nothing else is available (bad JSON)', async () => {
    const { deps } = setup(async () => new Response('<html>oops</html>', { status: 200 }));
    const r = await load(deps, '/site', validate.site, builtin);
    expect(r.status).toBe('ok');
    expect(r.source).toBe('builtin');
  });

  it('reports unavailable when there is no built-in version (network error)', async () => {
    const { deps } = setup(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await load(deps, '/posts/x', validate.post, () => null)).toEqual({ status: 'unavailable', source: 'builtin' });
  });

  it('treats 404 as an answer, not a failure', async () => {
    const { deps } = setup(async () => json({ error: 'not_found' }, 404));
    expect(await load(deps, '/pages/x', validate.page, () => null)).toEqual({ status: 'not_found', source: 'cms' });
  });

  it('1000 concurrent requests in many isolates write no KV at all', async () => {
    const { deps, kv, w, advance } = setup(async () => json(SITE));
    for (let wave = 0; wave < 5; wave++) {
      await Promise.all(Array.from({ length: 200 }, () => load(deps, '/site', validate.site, builtin)));
      advance(5 * 60_000);
    }
    await w.flush();
    expect(kv.puts).toBe(0);
  });

  it('the client tracks the worst source for X-Content-Source', async () => {
    const { deps } = setup(async (path) => (path.startsWith('/site') ? json(SITE) : json({}, 503)));
    const cms = cmsClient(deps);
    await cms.site('en');
    expect(cms.source()).toBe('cms');
    const posts = await cms.posts('en', 1);
    expect(posts.status).toBe('ok');
    expect(cms.source()).toBe('builtin');
    expect(worstSource(['cms', 'snapshot', 'cache'])).toBe('snapshot');
  });

  it('builds the contract paths with locale and pagination', async () => {
    const seen: string[] = [];
    const { deps } = setup(async (path) => (seen.push(path), json({}, 404)));
    const cms = cmsClient(deps);
    await cms.posts('ar', 2, 10);
    await cms.post('en', 'hello world');
    await cms.videos('en', 'home');
    expect(seen).toEqual(['/posts?locale=ar&page=2&limit=10', '/posts/hello%20world?locale=en', '/videos?locale=en&placement=home']);
  });
});
