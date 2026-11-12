import { describe, expect, it } from 'vitest';
import { channelUrl, embedOrigin, embedUrl, libraryUrl, watchUrl } from '../src/lib/embeds';
import { facadeHtml } from '../src/lib/facade';
import type { VideoItem } from '../src/lib/videos';

const BASE = 'https://videos.qa.alummahnow.net/';
const ID = '0216ba7e-bcca-4f16-841e-97c87a48e301';

describe('embeds adapter', () => {
  it('builds video and playlist embed URLs with lang and start', () => {
    expect(embedUrl(BASE, { kind: 'video', id: ID, lang: 'ar' })).toBe(`https://videos.qa.alummahnow.net/embed/v/${ID}?lang=ar`);
    expect(embedUrl(BASE, { kind: 'video', id: ID, lang: 'en', start: 90 })).toBe(`https://videos.qa.alummahnow.net/embed/v/${ID}?lang=en&start=90`);
    // gesture only means something with autoplay
    expect(embedUrl(BASE, { kind: 'video', id: ID, lang: 'en', autoplay: true, gesture: true })).toBe(`https://videos.qa.alummahnow.net/embed/v/${ID}?lang=en&autoplay=1&gesture=1`);
    expect(embedUrl(BASE, { kind: 'video', id: ID, lang: 'en', gesture: true })).toBe(`https://videos.qa.alummahnow.net/embed/v/${ID}?lang=en`);
    expect(embedUrl(BASE, { kind: 'playlist', id: 'pl_1', lang: 'en' })).toBe('https://videos.qa.alummahnow.net/embed/p/pl_1?lang=en');
  });
  it('drops invalid start values and start on playlists', () => {
    expect(embedUrl(BASE, { kind: 'video', id: ID, lang: 'en', start: -5 })).not.toContain('start');
    expect(embedUrl(BASE, { kind: 'video', id: ID, lang: 'en', start: 1.5 })).not.toContain('start');
    expect(embedUrl(BASE, { kind: 'playlist', id: 'p', lang: 'en', start: 10 })).not.toContain('start');
  });
  it('rejects ids that could break out of the path', () => {
    for (const id of ['../x', 'a/b', 'a?b', '', 'x'.repeat(65), 'a b', '<script>']) {
      expect(() => embedUrl(BASE, { kind: 'video', id, lang: 'en' })).toThrow();
    }
  });
  it('watch, channel and library URLs follow the videos web app', () => {
    expect(watchUrl(BASE, { kind: 'video', id: ID, lang: 'ar' })).toBe(`https://videos.qa.alummahnow.net/ar/video/${ID}`);
    expect(watchUrl(BASE, { kind: 'playlist', id: 'p1', lang: 'en' })).toBe('https://videos.qa.alummahnow.net/en/playlist/p1');
    expect(channelUrl(BASE, { id: 'c1', handle: 'Scholar.One', lang: 'en' })).toBe('https://videos.qa.alummahnow.net/en/@Scholar.One');
    expect(channelUrl(BASE, { id: 'c1', handle: null, lang: 'ar' })).toBe('https://videos.qa.alummahnow.net/ar/channels/c1');
    expect(channelUrl(BASE, { id: 'c1', handle: 'bad handle/../', lang: 'ar' })).toBe('https://videos.qa.alummahnow.net/ar/channels/c1');
    expect(libraryUrl(BASE, 'ar')).toBe('https://videos.qa.alummahnow.net/ar');
    expect(embedOrigin(BASE)).toBe('https://videos.qa.alummahnow.net');
  });
});

describe('facade', () => {
  const item: VideoItem = {
    kind: 'video', id: ID, title: 'Tafsir "Al-Fatiha" <1>', description: null, thumbnailUrl: 'https://images.alummahnow.net/a.jpg',
    channelName: 'Channel', handle: null, durationSeconds: 125, uploadDate: null, videoCount: null,
  };
  it('renders an accessible play button, escaped title and no iframe', () => {
    const html = facadeHtml(item, { videosWebUrl: BASE, lang: 'en' });
    expect(html).toContain('<button type="button" class="facade-play" aria-label="Play: Tafsir &quot;Al-Fatiha&quot; &lt;1&gt;">');
    expect(html).not.toContain('<iframe');
    // inserted on the viewer's click: autoplay with sound (gesture=1)
    expect(html).toContain(`data-embed-src="https://videos.qa.alummahnow.net/embed/v/${ID}?lang=en&amp;autoplay=1&amp;gesture=1"`);
    expect(html).toContain('2:05');
  });
  it('localizes the play label', () => {
    expect(facadeHtml(item, { videosWebUrl: BASE, lang: 'ar' })).toContain('aria-label="تشغيل: ');
  });
});
