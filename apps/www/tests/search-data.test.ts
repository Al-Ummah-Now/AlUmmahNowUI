import { describe, expect, it, vi } from 'vitest';
import { addRecent, clearRecent, readRecent, RECENT_KEY, RECENT_MAX, removeRecent, type StorageLike } from '../src/lib/search/recent';
import { hit, memoryStore } from './search-fixtures';
import { fetchSuggestions, hitsOf, isSafeHref, suggestUrl } from '../src/lib/search/suggest';
import { searchPosts } from '../src/lib/search/server';

describe('recent searches', () => {
  it('newest first, de-duplicated by normalised text, capped', () => {
    const store = memoryStore();
    addRecent(store, 'أحمد');
    addRecent(store, 'prayer');
    expect(addRecent(store, '  احمد ')).toEqual(['احمد', 'prayer']);
    for (let i = 0; i < 15; i++) addRecent(store, `q${i}`);
    expect(readRecent(store)).toHaveLength(RECENT_MAX);
    expect(readRecent(store)[0]).toBe('q14');
    expect(addRecent(store, ' ?! ')).toHaveLength(RECENT_MAX);
  });
  it('remove and clear', () => {
    const store = memoryStore();
    addRecent(store, 'a1');
    addRecent(store, 'b2');
    expect(removeRecent(store, 'A1')).toEqual(['b2']);
    expect(clearRecent(store)).toEqual([]);
    expect(store.data.has(RECENT_KEY)).toBe(false);
  });
  it('never throws: no storage, throwing storage, junk JSON', () => {
    expect(readRecent(null)).toEqual([]);
    expect(addRecent(null, 'x')).toEqual(['x']);
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readRecent(throwing)).toEqual([]);
    expect(addRecent(throwing, 'x')).toEqual(['x']);
    expect(clearRecent(throwing)).toEqual([]);
    const junk = memoryStore();
    junk.setItem(RECENT_KEY, '{nope');
    expect(readRecent(junk)).toEqual([]);
    junk.setItem(RECENT_KEY, JSON.stringify(['ok', 3, null, 'ok']));
    expect(readRecent(junk)).toEqual(['ok']);
  });
});

describe('suggest client', () => {
  it('builds the URL, cutting q', () => {
    const url = new URL(suggestUrl('https://cms.test', 'ar', 'x'.repeat(150)));
    expect(url.pathname).toBe('/api/public/v1/search/suggest');
    expect(url.searchParams.get('locale')).toBe('ar');
    expect(url.searchParams.get('q')).toHaveLength(100);
    expect(url.searchParams.get('limit')).toBe('6');
  });
  it('drops hits with unsafe links or images', () => {
    expect(hitsOf([hit(), hit({ href: 'javascript:alert(1)' }), hit({ href: '//evil.test/x' }), hit({ thumbnailUrl: 'http://x/y.png' }), { nope: 1 }])).toEqual([hit()]);
    expect(hitsOf({ items: [] })).toBeNull();
    expect(isSafeHref('/ar/articles/x/')).toBe(true);
    expect(isSafeHref('https://evil.test/')).toBe(false);
  });
  it('error, 404, bad JSON, network failure → null (no suggestions)', async () => {
    const signal = new AbortController().signal;
    const ok = vi.fn(async () => Response.json([hit()]));
    expect(await fetchSuggestions('u', signal, ok as unknown as typeof fetch)).toEqual([hit()]);
    expect(await fetchSuggestions('u', signal, (async () => new Response('x', { status: 404 })) as unknown as typeof fetch)).toBeNull();
    expect(await fetchSuggestions('u', signal, (async () => new Response('{', { status: 200 })) as unknown as typeof fetch)).toBeNull();
    expect(await fetchSuggestions('u', signal, (async () => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch)).toBeNull();
  });
});

describe('full search (server)', () => {
  it('passes the visitor IP, returns valid hits only', async () => {
    let seen: { path: string; init: RequestInit } | undefined;
    const r = await searchPosts(
      {
        fetchCms: async (path, init) => {
          seen = { path, init };
          return Response.json({ items: [hit(), hit({ href: 'javascript:x' })], page: 1, limit: 10, total: 2 });
        },
      },
      'en',
      'pray',
      1,
      '203.0.113.9',
    );
    expect(r).toEqual({ status: 'ok', data: { items: [hit()], page: 1, limit: 10, total: 2 } });
    expect(seen?.path).toBe('/search?locale=en&q=pray&page=1&limit=10');
    expect((seen?.init.headers as Record<string, string>)['X-Client-IP']).toBe('203.0.113.9');
  });
  it('429 → limited; 404/500/timeout → unavailable (logged)', async () => {
    const log = vi.fn();
    expect(await searchPosts({ fetchCms: async () => new Response('', { status: 429 }), log }, 'en', 'x', 1, null)).toEqual({ status: 'limited' });
    expect(await searchPosts({ fetchCms: async () => new Response('', { status: 404 }), log }, 'en', 'x', 1, null)).toEqual({ status: 'unavailable' });
    expect(await searchPosts({ fetchCms: async () => new Response('', { status: 500 }), log }, 'en', 'x', 1, null)).toEqual({ status: 'unavailable' });
    const hang = (_p: string, init: RequestInit) => new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    expect(await searchPosts({ fetchCms: hang, timeoutMs: 5, log }, 'en', 'x', 1, null)).toEqual({ status: 'unavailable' });
    expect(log).toHaveBeenCalledWith('search failed', { error: 'timeout' });
  });
});
