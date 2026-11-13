import type { StorageLike } from '../src/lib/search/recent';
import type { SearchHit } from '../src/lib/search/suggest';

export function memoryStore(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

export const hit = (over: Partial<SearchHit> = {}): SearchHit => ({
  id: 1,
  type: 'article',
  title: 'Prayer times',
  slug: 'prayer-times',
  locale: 'en',
  href: '/en/articles/prayer-times/',
  thumbnailUrl: null,
  excerpt: null,
  publishedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});
