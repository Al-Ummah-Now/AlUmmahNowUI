/** The fixture sites, videos and posts the stub serves (e2e/stub-api.ts) and the specs check. */
export const STUB_PORT = Number(process.env.SITES_STUB_PORT || 8686);
export const SITES_PORT = Number(process.env.SITES_PORT || 4322);
export const CHANNEL_ID = 'ch_scholar_e2e';

export const HOSTS = {
  both: 'mustafa-elbadry.sites.localhost',
  arOnly: 'arabic-only.sites.localhost',
  custom: 'scholar-example.localhost',
  old: 'old-name.sites.localhost',
  setup: 'not-yet.sites.localhost',
};

const channel = {
  id: CHANNEL_ID,
  name: 'Mustafa Elbadry',
  nameLocalized: { ar: 'مصطفى البدري' },
  handle: 'mustafa-e2e',
  avatarUrl: null,
  description: 'Videos and posts from the channel.',
  descriptionLocalized: { ar: 'مرئيات ومنشورات القناة.' },
  links: [{ title: 'Books', url: 'https://example.com/books' }],
};

function site(host: string, over: Record<string, unknown>) {
  return {
    host,
    redirectTo: null,
    preview: false,
    site: {
      channelId: CHANNEL_ID,
      slug: host.split('.')[0],
      status: 'live',
      themeRef: 'nahas@1.0.0',
      name: { en: 'Sh. Mustafa Elbadry', ar: 'الشيخ مصطفى البدري' },
      logoUrl: 'https://images.alummahnow.net/e2e/logo.png',
      faviconUrl: null,
      locales: ['en', 'ar'],
      navigation: [
        { id: 'videos', kind: 'videos' },
        { id: 'posts', kind: 'posts' },
        { id: 'about', kind: 'about' },
        { id: 'books', kind: 'url', url: 'https://example.com/books', label: { en: 'Books', ar: 'الكتب' } },
      ],
      about: { en: 'About **Sh. Mustafa**.', ar: 'نبذة عن **الشيخ مصطفى**.' },
      platformMark: 'minimal',
      primaryHost: `${host}:${SITES_PORT}`,
      primaryKind: 'subdomain',
      configVersion: 1,
      ...over,
    },
    channel,
  };
}

type StubEntry = { site?: { status?: string; primaryHost?: string } } & Record<string, unknown>;

export function stubSites(): Record<string, StubEntry | undefined> {
  return {
    [HOSTS.both]: site(HOSTS.both, {}),
    [HOSTS.arOnly]: site(HOSTS.arOnly, { themeRef: 'zujaj@1.0.0', locales: ['ar'], platformMark: 'required', name: { ar: 'موقع عربي' } }),
    [HOSTS.custom]: site(HOSTS.custom, { themeRef: 'lantern@1.0.0', primaryKind: 'custom', platformMark: 'none' }),
    [HOSTS.old]: { redirectTo: `http://${HOSTS.both}:${SITES_PORT}` },
    [HOSTS.setup]: undefined,
  };
}

export const VIDEOS = [
  { id: 'vid-e2e-1', title: 'First video', titleLocalized: { ar: 'المرئي الأول' }, description: 'About the first video.', channelId: CHANNEL_ID, isPublic: true, duration: 125, dateCreated: '2026-11-01T10:00:00Z' },
  { id: 'vid-e2e-2', title: 'Second video', channelId: CHANNEL_ID, isPublic: true, duration: 3600, dateCreated: '2026-11-02T10:00:00Z' },
];

export const POSTS = [
  { id: 'post-e2e-1', channelId: CHANNEL_ID, type: 'text', content: 'A first post from the scholar.\n\nWith a second paragraph.', likes: 3, comments: 1, createdAt: '2026-11-10T10:00:00Z', status: 'published', visibility: 'public' },
  { id: 'post-e2e-2', channelId: CHANNEL_ID, type: 'poll', content: 'Which topic next?', poll: { options: [{ id: 'a', text: 'Fiqh' }, { id: 'b', text: 'Seerah' }] }, likes: 0, comments: 0, createdAt: '2026-11-09T10:00:00Z', status: 'published', visibility: 'public' },
];
