/**
 * The videos API's search, as e2e/stub-cms.ts answers it for www's local E2E (www's VIDEOS_API_URL
 * points at the stub): `GET /api/search?type=video` (the search page, server-side) and
 * `GET /api/search/suggestions?types=video` (the search boxes, from the browser). Any query
 * matches the same two videos; the word "novideos" matches none.
 */
export const STUB_VIDEOS = [
  { id: 'stub-video-1', en: 'Patience in hard times', ar: 'الصبر في الشدائد', channel: { en: 'Knowledge channel', ar: 'قناة العلم' }, duration: 754, isShort: false },
  { id: 'stub-short-1', en: 'A minute on patience', ar: 'دقيقة عن الصبر', channel: { en: 'Knowledge channel', ar: 'قناة العلم' }, duration: 48, isShort: true },
];

export function videoSearchFixture(url: URL): { status: number; body: unknown } | null {
  const none = (url.searchParams.get('q') ?? '').includes('novideos');
  if (url.pathname === '/api/search' && url.searchParams.get('type') === 'video') {
    return {
      status: 200,
      body: {
        success: true,
        query: url.searchParams.get('q') ?? '',
        type: 'video',
        results: none
          ? []
          : STUB_VIDEOS.map((v) => ({
              type: 'video',
              id: v.id,
              score: 1,
              video: { id: v.id, title: v.en, titleLocalized: { en: v.en, ar: v.ar }, thumbnailUrl: null, duration: v.duration, isShort: v.isShort, channelId: 'c1', channelName: v.channel.en, channelNameLocalized: v.channel, dateCreated: '2026-11-01T00:00:00.000Z', views: 0, likesCount: 0, commentsCount: 0, dislikesCount: 0, tags: [], isLive: false },
              channel: { id: 'c1', name: v.channel.en, nameLocalized: v.channel, isVerified: false },
            })),
        nextCursor: null,
        hasMore: false,
        relaxed: false,
        searchTime: 1,
      },
    };
  }
  if (url.pathname === '/api/search/suggestions' && url.searchParams.get('types') === 'video') {
    return {
      status: 200,
      body: none ? [] : STUB_VIDEOS.map((v) => ({ text: v.en, type: 'video', id: v.id, thumbnailUrl: null, subtitle: v.channel.en, verified: false, metadata: { videoId: v.id, channelId: 'c1', isShort: v.isShort, duration: v.duration } })),
    };
  }
  return null;
}
