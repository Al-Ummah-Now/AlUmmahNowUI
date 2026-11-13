/** Site pages, home, SEO and redirects on the sites Worker (SS16): path redirects, page reads (drafts only in a preview, never cached), playlist blocks only for this channel. */
import { describe, expect, it } from 'vitest';
import { pathRedirect } from '../src/lib/edge';
import { homePage, playlistVideos, sitePage } from '../src/lib/data';
import { fixtureSite } from './fixtures';

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });

describe('site pages on the sites Worker', () => {
  it('redirects the site’s own paths (exact, 301), only to own paths or https://', () => {
    const site = fixtureSite();
    site.site.redirects = [
      { from: '/old-page', to: '/en/about/' },
      { from: '/blog/', to: 'https://blog.example.com/' },
      { from: '/bad', to: 'javascript:alert(1)' },
      { from: '/proto', to: '//evil.example/' },
    ];
    const r = pathRedirect(new URL('https://s.example/old-page/'), site)!;
    expect([r.status, r.headers.get('location')]).toEqual([301, '/en/about/']);
    expect(pathRedirect(new URL('https://s.example/blog'), site)!.headers.get('location')).toBe('https://blog.example.com/');
    expect(pathRedirect(new URL('https://s.example/bad'), site)).toBeNull();
    expect(pathRedirect(new URL('https://s.example/proto'), site)).toBeNull();
    expect(pathRedirect(new URL('https://s.example/en/'), site)).toBeNull();
  });

  it('reads a published page through the cache; a preview reads drafts and is never cached', async () => {
    const calls: string[] = [];
    const puts: string[] = [];
    const cache = { match: async () => undefined, put: async (k: Request) => void puts.push(k.url) } as unknown as Cache;
    const deps = { apiUrl: 'https://api.example', cache, waitUntil: (p: Promise<unknown>) => void p, fetchImpl: (async (u: string) => (calls.push(u), json({ page: { id: 'pg_1', slug: 'about-us', title: { en: 'About' }, blocks: {}, description: {}, status: 'published' } }))) as typeof fetch };
    expect((await sitePage(deps, 's.example', 'about-us', null))?.title.en).toBe('About');
    expect(calls.at(-1)).toBe('https://api.example/api/sites/by-host/s.example/pages/about-us');
    expect(puts).toHaveLength(1);
    await sitePage(deps, 's.example', 'about-us', 'a'.repeat(32));
    expect(calls.at(-1)).toBe(`https://api.example/api/sites/by-host/s.example/pages/about-us?preview=${'a'.repeat(32)}`);
    expect(puts).toHaveLength(1);
    expect(await sitePage(deps, 's.example', '../x', null)).toBeNull();
    await homePage(deps, 's.example', 'not-a-token');
    expect(calls.at(-1)).toBe('https://api.example/api/sites/by-host/s.example/home');
  });

  it('a playlist block shows only this channel’s playlist and videos', async () => {
    const answer = (channelId: string) => json({ result: { playlist: { channelId }, items: [{ id: 'v1', title: 'One', channelId: 'ch1' }, { id: 'v2', title: 'Other', channelId: 'ch9' }] } });
    const mk = (channelId: string) => ({ apiUrl: 'https://api.example', cache: null, waitUntil: () => undefined, fetchImpl: (async () => answer(channelId)) as typeof fetch });
    expect((await playlistVideos(mk('ch1'), 'ch1', 'pl_1234', 6)).map((v) => v.id)).toEqual(['v1']);
    expect(await playlistVideos(mk('ch9'), 'ch1', 'pl_1234', 6)).toEqual([]);
  });
});
