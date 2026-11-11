import { describe, expect, it } from 'vitest';
import { cmsPaths, ARTICLES_PAGE_SIZE, RSS_ITEMS, snapshotKey } from '../src/lib/cms';
import { MAX_KEYS_PER_RUN, writeSnapshots, type WriterDeps } from '../src/lib/snapshot-writer';
import { MemoryKV } from './helpers';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fake CMS public API. `version` is stamped into every body, so tests can see which fetch a snapshot came from. */
function fakeCms(opts: { pages?: number; posts?: number; postTotal?: number; listPages?: number } = {}) {
  const state = { version: 1, fail: new Set<string>(), delay: new Map<string, Promise<void>>(), calls: [] as string[] };
  const sitemap = {
    items: [
      ...Array.from({ length: opts.pages ?? 2 }, (_, i) => ({ type: 'page', locale: i % 2 ? 'ar' : 'en', slug: `p${i}`, updated_at: '2026-01-01T00:00:00Z' })),
      ...Array.from({ length: opts.posts ?? 2 }, (_, i) => ({ type: 'post', locale: i % 2 ? 'ar' : 'en', slug: `n${i}`, updated_at: '2026-01-01T00:00:00Z' })),
    ],
  };
  const fetchCms: WriterDeps['fetchCms'] = async (path) => {
    state.calls.push(path);
    const v = state.version;
    await state.delay.get(path);
    if (state.fail.has(path)) return json({ error: 'boom' }, 500);
    const url = new URL(`https://cms${path}`);
    if (url.pathname === '/sitemap') return json({ ...sitemap, v });
    if (url.pathname === '/site') return json({ settings: { v }, nav: { header: [], footer: [] } });
    if (url.pathname.startsWith('/lists/')) {
      const slug = url.pathname.split('/').pop()!;
      const pages = slug === 'articles' ? (opts.listPages ?? 1) : 1;
      return json({ page: { slug, locale: url.searchParams.get('locale'), title: slug, list_kind: 'filter', alternates: [] }, pinned: [], items: [], page_number: Number(url.searchParams.get('page')), pages, total: 0, limit: 20, v });
    }
    if (url.pathname === '/posts') {
      const page = Number(url.searchParams.get('page'));
      const limit = Number(url.searchParams.get('limit'));
      return json({ items: [], page, limit, total: opts.postTotal ?? 0, v });
    }
    if (url.pathname.startsWith('/pages/') || url.pathname.startsWith('/posts/')) {
      const slug = url.pathname.split('/').pop()!;
      if (slug === 'gone') return json({ error: 'not_found' }, 404);
      return json({ slug, locale: url.searchParams.get('locale'), title: `T${v}`, body: 'b', alternates: [], v });
    }
    return json({ error: 'not_found' }, 404);
  };
  return { state, fetchCms };
}

const read = async (kv: MemoryKV, path: string) => kv.get(snapshotKey(path), 'json') as Promise<{ v?: number; settings?: { v: number } } | null>;

describe('KV snapshot writer (single writer, audit UI-3)', () => {
  it('writes every key the site reads, then nothing while content is unchanged', async () => {
    const kv = new MemoryKV();
    const cms = fakeCms({ pages: 4, posts: 6, postTotal: 35, listPages: 3 });
    let now = 1_000;
    const deps: WriterDeps = { fetchCms: cms.fetchCms, kv: kv as never, now: () => now };
    const first = await writeSnapshots(deps);
    // core 9 (sitemap; per locale: site, /lists/videos, /lists/articles, posts page 1 = the RSS page)
    // + 10 sitemap items + posts page 2 and /lists/articles pages 2..3 for each locale
    expect(RSS_ITEMS).toBe(ARTICLES_PAGE_SIZE);
    expect(first).toMatchObject({ written: 9 + 10 + 2 + 4, failed: 0, keys: 25 });
    for (const path of [cmsPaths.site('ar'), cmsPaths.list('en', 'videos', 1), cmsPaths.list('ar', 'articles', 1), cmsPaths.list('en', 'articles', 3), cmsPaths.posts('ar', 1, RSS_ITEMS), cmsPaths.posts('en', 2, ARTICLES_PAGE_SIZE), cmsPaths.page('en', 'p0'), cmsPaths.post('ar', 'n1'), cmsPaths.sitemap()]) {
      expect(await read(kv, path), path).not.toBeNull();
    }
    now += 5 * 60_000;
    const second = await writeSnapshots(deps);
    expect(second).toMatchObject({ written: 0, unchanged: 25 });
    expect(kv.puts).toBe(25);
  });

  it('a slower, older fetch never overwrites a newer snapshot (overlapping runs)', async () => {
    const kv = new MemoryKV();
    const cms = fakeCms();
    let clock = 0;
    const deps: WriterDeps = { fetchCms: cms.fetchCms, kv: kv as never, now: () => ++clock };
    const sitePath = cmsPaths.site('en');
    let release!: () => void;
    cms.state.delay.set(sitePath, new Promise<void>((r) => (release = r)));
    const slow = writeSnapshots(deps); // fetches /site at version 1, then hangs
    await new Promise((r) => setTimeout(r, 0));
    cms.state.delay.delete(sitePath);
    cms.state.version = 2;
    await writeSnapshots(deps); // writes version 2
    expect((await read(kv, sitePath))?.settings?.v).toBe(2);
    release();
    const r = await slow;
    expect(r.newer).toBeGreaterThan(0);
    expect((await read(kv, sitePath))?.settings?.v).toBe(2);
  });

  it('20 overlapping runs while content changes: every key ends at the newest version, none regresses', async () => {
    const kv = new MemoryKV();
    const cms = fakeCms({ pages: 6, posts: 6, postTotal: 25 });
    let clock = 0;
    const deps: WriterDeps = { fetchCms: cms.fetchCms, kv: kv as never, now: () => ++clock };
    const runs = Array.from({ length: 20 }, async (_, i) => {
      await new Promise((r) => setTimeout(r, i));
      cms.state.version = i + 1;
      return writeSnapshots(deps);
    });
    await Promise.all(runs);
    await writeSnapshots(deps); // one last, settled run
    for (const [key, { value }] of kv.store) expect(JSON.parse(value).v ?? JSON.parse(value).settings?.v, key).toBe(20);
  });

  it('keeps the previous snapshot when the CMS fails or answers bad JSON; skips 404s', async () => {
    const kv = new MemoryKV();
    const cms = fakeCms();
    const deps: WriterDeps = { fetchCms: cms.fetchCms, kv: kv as never };
    await writeSnapshots(deps);
    cms.state.version = 2;
    cms.state.fail.add(cmsPaths.list('en', 'videos', 1));
    const r = await writeSnapshots(deps);
    expect(r.failed).toBe(1);
    expect((await read(kv, cmsPaths.list('en', 'videos', 1)))?.v).toBe(1);
    expect((await read(kv, cmsPaths.list('ar', 'videos', 1)))?.v).toBe(2);
    const bad = await writeSnapshots({ ...deps, fetchCms: async () => new Response('<html>oops</html>', { status: 200 }) });
    expect(bad.written).toBe(0);
    expect((await read(kv, cmsPaths.list('ar', 'videos', 1)))?.v).toBe(2);
  });

  it(`covers large sites over several runs, at most ${MAX_KEYS_PER_RUN} content keys per run`, async () => {
    const kv = new MemoryKV();
    const cms = fakeCms({ pages: 300, posts: 300 });
    const deps: WriterDeps = { fetchCms: cms.fetchCms, kv: kv as never };
    for (let run = 0; run < 3; run++) {
      cms.state.calls.length = 0;
      const r = await writeSnapshots(deps, run);
      expect(r.keys).toBe(9 + MAX_KEYS_PER_RUN);
      expect(cms.state.calls.length).toBe(9 + MAX_KEYS_PER_RUN);
    }
    expect(kv.store.size).toBe(9 + 600);
  });
});
