import { describe, expect, it } from 'vitest';
import { cmsClient } from '../src/lib/cms';

/** www asks the CMS slug history for a renamed post's or page's current slug (D-SEO-7). */
function client(answer: (path: string) => Response) {
  const paths: string[] = [];
  const c = cmsClient({
    fetchCms: async (path) => {
      paths.push(path);
      return answer(path);
    },
    cacheKeyBase: 'https://www.test/cms-cache',
    cache: null,
    kv: null,
    waitUntil: () => {},
  });
  return { c, paths };
}

describe('cms.redirect', () => {
  it('returns the current slug of a renamed post', async () => {
    const { c, paths } = client(() => Response.json({ slug: 'judgment-is-only-for-allah' }));
    expect(await c.redirect('post', 'ar', '1')).toBe('judgment-is-only-for-allah');
    expect(paths).toEqual(['/redirects/post/1?locale=ar']);
  });
  it('is null when the CMS knows no rename, cannot answer, or sends nonsense', async () => {
    expect(await client(() => new Response(null, { status: 404 })).c.redirect('page', 'en', 'old')).toBeNull();
    expect(await client(() => new Response(null, { status: 500 })).c.redirect('page', 'en', 'old')).toBeNull();
    expect(await client(() => Response.json({ slug: '../../evil' })).c.redirect('page', 'en', 'old')).toBeNull();
    expect(await client(() => Response.json({ slug: 'old' })).c.redirect('page', 'en', 'old')).toBeNull();
  });
  it('does not count as a content source of the page', async () => {
    const { c } = client(() => new Response(null, { status: 500 }));
    await c.redirect('post', 'en', 'x');
    expect(c.sources).toEqual([]);
  });
});
