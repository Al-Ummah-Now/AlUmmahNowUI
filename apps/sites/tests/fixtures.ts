import type { PublicSite } from '../src/lib/site-types';

export function fixtureSite(over: Partial<PublicSite['site']> = {}, preview = false): PublicSite {
  return {
    host: 'mustafa-elbadry.alummahnow.org',
    redirectTo: null,
    preview,
    site: {
      channelId: 'ch_scholar',
      slug: 'mustafa-elbadry',
      status: 'live',
      themeRef: 'nahas@1.0.0',
      name: { en: 'Sh. Mustafa Elbadry', ar: 'الشيخ مصطفى البدري' },
      logoUrl: 'https://images.alummahnow.net/logo.png',
      faviconUrl: null,
      locales: ['en', 'ar'],
      navigation: [
        { id: 'videos', kind: 'videos' },
        { id: 'posts', kind: 'posts' },
        { id: 'about', kind: 'about' },
      ],
      about: { en: 'About **Mustafa**', ar: 'نبذة' },
      platformMark: 'minimal',
      primaryHost: 'mustafa-elbadry.alummahnow.org',
      primaryKind: 'subdomain',
      configVersion: 3,
      ...over,
    },
    channel: { id: 'ch_scholar', name: 'Mustafa Elbadry', handle: 'mustafa', avatarUrl: null, description: 'Channel description', links: [{ title: 'Books', url: 'https://example.com/books' }] },
  };
}
