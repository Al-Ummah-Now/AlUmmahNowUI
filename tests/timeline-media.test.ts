import { describe, expect, it } from 'vitest';
import { isShort, playApiBase } from '../src/lib/timeline';
import { playable, shortsPage } from '../src/scripts/timeline-media';

const info = (over: Record<string, unknown> = {}) => ({
  id: 'abc',
  format: 'short',
  title: 'A minute with an ayah',
  channelName: 'Knowledge channel',
  width: 720,
  height: 1280,
  durationSeconds: 48,
  poster: null,
  mp4: { url: 'https://cdn.example/abc/play_480p.mp4', width: 270, height: 480 },
  hls: null,
  expiresAt: '2026-11-13T00:00:00.000Z',
  watchUrl: 'https://videos.alummahnow.net/en/watch/abc',
  ...over,
});

describe('which timeline videos are Shorts', () => {
  it('vertical or square and at most 3 minutes', () => {
    expect(isShort('ar-9x16', 48)).toBe(true);
    expect(isShort('ar-4x5', 180)).toBe(true);
    expect(isShort('ar-1x1', 30)).toBe(true);
    expect(isShort('ar-9x16', 181)).toBe(false);
    expect(isShort('ar-16x9', 30)).toBe(false);
  });
  it('without a known length the frame decides (a square needs the length)', () => {
    expect(isShort('ar-9x16', null)).toBe(true);
    expect(isShort('ar-1x1', null)).toBe(false);
  });
});

describe('the play API answers', () => {
  it('base path from the videos API URL', () => {
    expect(playApiBase('https://videos.api.alummahnow.net/')).toBe('https://videos.api.alummahnow.net/api/v1');
  });
  it('playable only with an https MP4', () => {
    expect(playable(info())).toBe(true);
    expect(playable(info({ mp4: null }))).toBe(false);
    expect(playable(info({ mp4: { url: 'http://cdn.example/a.mp4' } }))).toBe(false);
    expect(playable(info({ title: undefined }))).toBe(false);
    expect(playable(null)).toBe(false);
  });
  it('a Shorts page keeps the playable items and the cursor', () => {
    expect(shortsPage({ items: [info(), info({ id: 'x', mp4: null })], next: 'abc' })).toEqual({ items: [info()], next: 'abc' });
    expect(shortsPage({ items: 'nope', next: '' })).toEqual({ items: [], next: null });
    expect(shortsPage(undefined)).toEqual({ items: [], next: null });
  });
});
