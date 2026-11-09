import { describe, expect, it } from 'vitest';
import { clockDuration, CURATED_MAX, isoDuration, LIVE_LOOKUPS_MAX, resolveCurated, snapshotItem, toVideoItem, type VideosDeps } from '../src/lib/videos';
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

describe('resolveCurated fan-out (audit UI-1)', () => {
  const NOW = Date.parse('2026-11-09T12:00:00Z');
  const fresh = new Date(NOW - 10 * 60_000).toISOString();
  const old = new Date(NOW - 5 * 60 * 60_000).toISOString();
  const snapshot = (id: string, refreshed_at?: string) => ({
    title: `Snap ${id}`,
    thumbnail_url: `https://vz.b-cdn.net/${id}/thumbnail.jpg?token=t&expires=${Math.floor(NOW / 1000) + 3600}`,
    channel_name: 'Ch',
    refreshed_at,
    description: 'D',
    titles: { ar: `لقطة ${id}` },
    duration_seconds: 90,
    upload_date: '2026-01-01T00:00:00.000Z',
  });
  const row = (i: number, refreshed_at?: string): CuratedVideo => ({ id: i, kind: 'video', ref_id: `v${i}`, title_override: null, snapshot: snapshot(`v${i}`, refreshed_at), sort: i });
  function counting() {
    const calls: string[] = [];
    const deps: VideosDeps = {
      apiUrl: 'https://api',
      cacheKeyBase: 'https://w/__videos',
      waitUntil: () => undefined,
      now: () => NOW,
      fetchImpl: (async (url: string) => {
        calls.push(url);
        return new Response(JSON.stringify({ title: 'Live' }));
      }) as never,
    };
    return { calls, deps };
  }

  it('1000 renders in parallel of 500 freshly-snapshotted rows make zero videos API calls and show 48 items each', async () => {
    const { calls, deps } = counting();
    const rows = Array.from({ length: 500 }, (_, i) => row(i, fresh));
    const out = await Promise.all(Array.from({ length: 1000 }, () => resolveCurated(deps, rows, 'ar')));
    expect(calls).toHaveLength(0);
    for (const r of out) expect(r).toHaveLength(CURATED_MAX);
    expect(out[0]![0]!.item).toMatchObject({ id: 'v0', title: 'لقطة v0', channelName: 'Ch', durationSeconds: 90, description: 'D', uploadDate: '2026-01-01T00:00:00.000Z' });
  });

  it('rows without a fresh snapshot cost at most LIVE_LOOKUPS_MAX calls per render; the rest render from their old snapshot', async () => {
    const { calls, deps } = counting();
    const rows = Array.from({ length: 200 }, (_, i) => row(i, i % 2 ? old : undefined));
    const renders = 50;
    const out = await Promise.all(Array.from({ length: renders }, () => resolveCurated(deps, rows)));
    expect(calls.length).toBe(renders * LIVE_LOOKUPS_MAX);
    for (const r of out) {
      expect(r).toHaveLength(CURATED_MAX);
      expect(r.slice(0, LIVE_LOOKUPS_MAX).every((x) => x.item.title === 'Live')).toBe(true);
      expect(r[LIVE_LOOKUPS_MAX]!.item.title).toBe(`Snap v${LIVE_LOOKUPS_MAX}`);
    }
  });

  it('an expired signed thumbnail from a stale snapshot is dropped; a fresh one is kept', () => {
    const c = row(1, old);
    c.snapshot!.thumbnail_url = `https://vz.b-cdn.net/v1/thumbnail.jpg?token=t&expires=${Math.floor(NOW / 1000) - 1}`;
    expect(snapshotItem(c, NOW)).toBeNull();
    expect(snapshotItem(c, NOW, true)?.thumbnailUrl).toBeNull();
    expect(snapshotItem(row(2, fresh), NOW)?.thumbnailUrl).toMatch(/^https:\/\/vz\.b-cdn\.net\/v2\//);
  });

  it('rows with neither a fresh snapshot nor budget left, and no snapshot at all, are skipped (and logged)', async () => {
    const logs: string[] = [];
    const { calls, deps } = counting();
    deps.log = (m) => logs.push(m);
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...row(i), snapshot: null }));
    const out = await resolveCurated(deps, rows);
    expect(calls).toHaveLength(LIVE_LOOKUPS_MAX);
    expect(out).toHaveLength(LIVE_LOOKUPS_MAX);
    expect(logs.filter((l) => l.includes('budget'))).toHaveLength(20 - LIVE_LOOKUPS_MAX);
  });
});
