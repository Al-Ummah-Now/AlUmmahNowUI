import { describe, expect, it } from 'vitest';
import { clockDuration, isoDuration, resolveCurated, toVideoItem, type VideosDeps } from '../src/lib/videos';
import type { CuratedVideo } from '../src/lib/cms-types';

describe('videos API mapping', () => {
  it('maps a public video (real API shape, scheme-less thumbnail)', () => {
    const item = toVideoItem('video', 'v1', {
      id: 'v1', title: 'Lesson 4.mp4', thumbnailUrl: 'images.alummahnow.net/lesson 4.jpg', channel: 'Mostafa', channelName: '', duration: 61, dateCreated: '2025-04-04T15:12:03.127',
    });
    expect(item).toMatchObject({ kind: 'video', title: 'Lesson 4', thumbnailUrl: 'https://images.alummahnow.net/lesson%204.jpg', channelName: 'Mostafa', durationSeconds: 61 });
  });
  it('skips private, deleted and hidden items', () => {
    expect(toVideoItem('video', 'v', { title: 't', isPublic: false })).toBeNull();
    expect(toVideoItem('playlist', 'p', { title: 't', isDeleted: true })).toBeNull();
    expect(toVideoItem('video', 'v', { title: 't', isHidden: true })).toBeNull();
    expect(toVideoItem('channel', 'c', { name: 'n', isPrivate: true })).toBeNull();
    expect(toVideoItem('video', 'v', {})).toBeNull();
  });
  it('maps channels with handle and avatar', () => {
    expect(toVideoItem('channel', 'c', { name: 'Scholar', handle: 'scholar', avatarUrl: 'https://al-ummah-now-images.b-cdn.net/a.jpg' })).toMatchObject({
      title: 'Scholar', handle: 'scholar', thumbnailUrl: 'https://al-ummah-now-images.b-cdn.net/a.jpg',
    });
  });
  it('durations', () => {
    expect(isoDuration(3725)).toBe('PT1H2M5S');
    expect(isoDuration(60)).toBe('PT1M');
    expect(isoDuration(null)).toBeUndefined();
    expect(clockDuration(3725)).toBe('1:02:05');
    expect(clockDuration(65)).toBe('1:05');
  });
});

describe('localized titles', () => {
  const body = { title: 'Intro', titleLocalized: { en: 'Intro', ar: 'مقدمة' }, descriptionLocalized: { ar: 'وصف' }, description: 'Desc' };
  it('picks the page language and falls back to the default title', async () => {
    const { localizeItem } = await import('../src/lib/videos');
    const item = toVideoItem('video', 'v', body)!;
    expect(localizeItem(item, 'ar')).toMatchObject({ title: 'مقدمة', description: 'وصف' });
    expect(localizeItem(item, 'en')).toMatchObject({ title: 'Intro', description: 'Desc' });
    expect(localizeItem(toVideoItem('video', 'v', { title: 'Only' })!, 'ar').title).toBe('Only');
    expect(localizeItem(toVideoItem('channel', 'c', { name: 'Ch', nameLocalized: { ar: 'قناة' } })!, 'ar').title).toBe('قناة');
  });
  it('resolveCurated localizes, and an editor override still wins', async () => {
    const deps: VideosDeps = { apiUrl: 'https://api', cacheKeyBase: 'https://w/__v', waitUntil: () => undefined, fetchImpl: (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch };
    const c = (id: number, title_override: string | null): CuratedVideo => ({ id, kind: 'video', ref_id: 'v' + id, title_override, snapshot: null, sort: id });
    const out = await resolveCurated(deps, [c(1, null), c(2, 'Override')], 'ar');
    expect(out.map((r) => r.item.title)).toEqual(['مقدمة', 'Override']);
  });
});

describe('resolveCurated', () => {
  it('keeps CMS order, applies title overrides and silently drops non-public or failing items', async () => {
    const logs: string[] = [];
    const deps: VideosDeps = {
      apiUrl: 'https://api',
      cacheKeyBase: 'https://w/__videos',
      waitUntil: () => undefined,
      log: (m) => logs.push(m),
      fetchImpl: (async (url: string) => {
        if (url.endsWith('/videos/a')) return new Response(JSON.stringify({ title: 'A' }));
        if (url.endsWith('/videos/private')) return new Response('{}', { status: 404 });
        if (url.endsWith('/playlists/p')) return new Response(JSON.stringify({ title: 'P', isPublic: true, videos: ['x'] }));
        throw new Error('network');
      }) as never,
    };
    const c = (id: number, kind: CuratedVideo['kind'], ref_id: string, sort: number, title_override: string | null = null): CuratedVideo => ({ id, kind, ref_id, sort, title_override, snapshot: null });
    const out = await resolveCurated(deps, [c(1, 'playlist', 'p', 2), c(2, 'video', 'a', 1, 'Override'), c(3, 'video', 'private', 0), c(4, 'channel', 'down', 3)]);
    expect(out.map((r) => r.item.title)).toEqual(['Override', 'P']);
    expect(logs.length).toBe(2);
  });
});
