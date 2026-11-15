import { describe, expect, it, vi } from 'vitest';
import { searchVideos } from '../src/lib/search/server';
import { fetchVideoSuggestions, isVideoHref, videoHitsFromSearch, videoHitsFromSuggest, videoSearchUrl, videosSiteSearchUrl, videoSuggestUrl } from '../src/lib/search/videos';

const WEB = 'https://videos.test';
const API = 'https://api.videos.test/';

const searchAnswer = {
  success: true,
  query: 'sabr',
  type: 'video',
  results: [
    {
      type: 'video',
      id: 'v1',
      score: 1,
      video: {
        id: 'v1',
        title: 'Patience',
        titleLocalized: { ar: 'الصبر' },
        thumbnailUrl: 'https://img.test/v1.jpg',
        duration: 754.4,
        isShort: false,
        channelId: 'c1',
        channelName: 'Channel',
        channelNameLocalized: { ar: 'قناة' },
        dateCreated: '2026-11-01T00:00:00.000Z',
      },
      channel: { id: 'c1', name: 'Channel', isVerified: false },
    },
    { type: 'video', id: 'bad', score: 1, video: { id: 'not/valid', title: 'x' } },
    { type: 'video', id: 'v3', score: 1, video: { id: 'v3', title: '', thumbnailUrl: 'http://insecure' } },
    { type: 'channel', id: 'c1', score: 1, channel: { id: 'c1', name: 'Channel' } },
    { type: 'video', id: 'v4', score: 1, video: { id: 'v4', title: 'Short one', thumbnailUrl: 'javascript:alert(1)', isShort: true } },
  ],
  nextCursor: null,
  hasMore: false,
  relaxed: false,
  searchTime: 3,
};

describe('videos in www search', () => {
  it('builds the videos API and videos site URLs', () => {
    expect(videoSearchUrl(API, 'sabr')).toBe('https://api.videos.test/api/search?q=sabr&type=video&limit=6');
    expect(videoSuggestUrl(API, 'صبر')).toBe(`https://api.videos.test/api/search/suggestions?q=${encodeURIComponent('صبر')}&types=video&limit=3`);
    expect(videosSiteSearchUrl(WEB, 'ar', 'a b')).toBe('https://videos.test/ar/search?q=a+b');
    expect(videoSearchUrl(API, 'x'.repeat(300))).toContain(`q=${'x'.repeat(100)}&`);
  });

  it('maps search results: titles and channel names in the page language, only valid ids and https thumbnails', () => {
    expect(videoHitsFromSearch(searchAnswer, 'ar', WEB)).toEqual([
      { id: 'v1', title: 'الصبر', href: 'https://videos.test/ar/video/v1', thumbnailUrl: 'https://img.test/v1.jpg', channelName: 'قناة', durationSeconds: 754, isShort: false, publishedAt: '2026-11-01T00:00:00.000Z' },
      { id: 'v4', title: 'Short one', href: 'https://videos.test/ar/video/v4', thumbnailUrl: null, channelName: null, durationSeconds: null, isShort: true, publishedAt: '' },
    ]);
    expect(videoHitsFromSearch(searchAnswer, 'en', WEB)![0]).toMatchObject({ title: 'Patience', channelName: 'Channel', href: 'https://videos.test/en/video/v1' });
    expect(videoHitsFromSearch({ success: false, error: 'search_failed' }, 'en', WEB)).toBeNull();
    expect(videoHitsFromSearch('nope', 'en', WEB)).toBeNull();
  });

  it('maps suggestions; anything that is not a video is dropped', () => {
    const answer = [
      { text: 'Patience', type: 'video', id: 'v1', thumbnailUrl: 'https://img.test/1.jpg', subtitle: 'Channel', metadata: { videoId: 'v1', isShort: true, duration: 40 } },
      { text: 'Channel', type: 'channel', id: 'c1' },
      { text: '', type: 'video', id: 'v2' },
    ];
    expect(videoHitsFromSuggest(answer, 'en', WEB)).toEqual([
      { id: 'v1', title: 'Patience', href: 'https://videos.test/en/video/v1', thumbnailUrl: 'https://img.test/1.jpg', channelName: 'Channel', durationSeconds: 40, isShort: true, publishedAt: '' },
    ]);
    expect(videoHitsFromSuggest({ success: false }, 'en', WEB)).toBeNull();
  });

  it('only accepts watch links on the videos site', () => {
    expect(isVideoHref('https://videos.test/en/video/v1', WEB)).toBe(true);
    expect(isVideoHref('https://videos.test/en/channels/v1', WEB)).toBe(false);
    expect(isVideoHref('https://evil.test/en/video/v1', WEB)).toBe(false);
    expect(isVideoHref('javascript:alert(1)', WEB)).toBe(false);
  });

  it('suggestions: a failure or a 429 is no answer', async () => {
    const signal = new AbortController().signal;
    expect(await fetchVideoSuggestions('u', 'en', WEB, signal, (async () => new Response('{}', { status: 429 })) as typeof fetch)).toBeNull();
    expect(await fetchVideoSuggestions('u', 'en', WEB, signal, (async () => { throw new Error('offline'); }) as typeof fetch)).toBeNull();
    expect(await fetchVideoSuggestions('u', 'en', WEB, signal, (async () => Response.json([])) as typeof fetch)).toEqual([]);
  });

  it('the search page fetch: ok, error status, bad JSON and timeout', async () => {
    const cfg = { videosApiUrl: API, videosWebUrl: WEB };
    const log = vi.fn();
    const ok = await searchVideos((async (url: string) => (expect(url).toBe('https://api.videos.test/api/search?q=sabr&type=video&limit=6'), Response.json(searchAnswer))) as typeof fetch, cfg, 'en', 'sabr', { log });
    expect(ok).toMatchObject({ status: 'ok', items: [{ id: 'v1' }, { id: 'v4' }] });
    expect(await searchVideos((async () => new Response('x', { status: 503 })) as typeof fetch, cfg, 'en', 'q', { log })).toEqual({ status: 'unavailable' });
    expect(await searchVideos((async () => new Response('not json')) as typeof fetch, cfg, 'en', 'q', { log })).toEqual({ status: 'unavailable' });
    const hang = ((_u: string, init: RequestInit) => new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
    expect(await searchVideos(hang, cfg, 'en', 'q', { log, timeoutMs: 10 })).toEqual({ status: 'unavailable' });
    expect(log).toHaveBeenLastCalledWith('video search failed', { error: 'timeout' });
  });
});
