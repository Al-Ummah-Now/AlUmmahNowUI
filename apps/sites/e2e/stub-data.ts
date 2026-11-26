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
  suspended: 'paused.sites.localhost',
};

/**
 * The fixture site's logo: a real picture (an eight-point star on a round field), as a data: URL so
 * it renders under the sites CSP (img-src 'self' data: + the image hosts) with no network.
 */
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
  '<circle cx="48" cy="48" r="48" fill="#123f3a"/>' +
  '<g fill="#e8c46a"><rect x="24" y="24" width="48" height="48" rx="3"/><rect x="24" y="24" width="48" height="48" rx="3" transform="rotate(45 48 48)"/></g>' +
  '<circle cx="48" cy="48" r="15" fill="#123f3a"/><circle cx="48" cy="48" r="8" fill="#e8c46a"/></svg>';
export const LOGO_URL = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`;

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
      logoUrl: LOGO_URL,
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

export const LONG_NAME = { en: 'Sheikh Mustafa Elbadry Institute for Islamic Studies and Quran Sciences', ar: 'معهد الشيخ مصطفى البدري للدراسات الإسلامية وعلوم القرآن الكريم' };

type StubEntry = { site?: { status?: string; primaryHost?: string } } & Record<string, unknown>;

export function stubSites(): Record<string, StubEntry | undefined> {
  return {
    [HOSTS.both]: site(HOSTS.both, {}),
    [HOSTS.arOnly]: site(HOSTS.arOnly, { themeRef: 'zujaj@1.0.0', locales: ['ar'], platformMark: 'required', name: { ar: 'موقع عربي' } }),
    // a long name: the header still holds one line (the wordmark truncates)
    [HOSTS.custom]: site(HOSTS.custom, { themeRef: 'lantern@1.0.0', primaryKind: 'custom', platformMark: 'none', name: LONG_NAME }),
    [HOSTS.old]: { redirectTo: `http://${HOSTS.both}:${SITES_PORT}` },
    [HOSTS.setup]: undefined,
    // suspended by an admin: visitors go to the channel, like a revoked site
    [HOSTS.suspended]: site(HOSTS.suspended, { status: 'suspended' }),
  };
}

export const VIDEOS = [
  { id: 'vid-e2e-1', title: 'First video', titleLocalized: { ar: 'المرئي الأول' }, description: 'About the first video.', channelId: CHANNEL_ID, isPublic: true, duration: 125, dateCreated: '2026-11-01T10:00:00Z' },
  { id: 'vid-e2e-2', title: 'Second video', channelId: CHANNEL_ID, isPublic: true, duration: 3600, dateCreated: '2026-11-02T10:00:00Z' },
];

export const SHORTS = [
  { id: 'short-e2e-1', title: 'A Short', channelId: CHANNEL_ID, isPublic: true, format: 'short', duration: 40, dateCreated: '2026-11-03T10:00:00Z' },
];

export const POSTS = [
  { id: 'post-e2e-1', channelId: CHANNEL_ID, type: 'text', content: 'A first post from the scholar.\n\nWith a second paragraph.', likes: 3, comments: 1, createdAt: '2026-11-10T10:00:00Z', status: 'published', visibility: 'public' },
  { id: 'post-e2e-2', channelId: CHANNEL_ID, type: 'poll', content: 'Which topic next?', poll: { options: [{ id: 'a', text: 'Fiqh' }, { id: 'b', text: 'Seerah' }] }, likes: 0, comments: 0, createdAt: '2026-11-09T10:00:00Z', status: 'published', visibility: 'public' },
  // Older posts past the first page of 50, so the sitemap has to follow the pages (#1215)
  ...Array.from({ length: 60 }, (_, i) => ({ id: `post-e2e-old-${i + 1}`, channelId: CHANNEL_ID, type: i === 0 ? 'quiz' : 'text', ...(i === 0 ? { quiz: { question: 'ما الجواب؟', options: [{ id: 'a', text: 'First answer' }, { id: 'b', text: 'الثاني' }], correctOptionId: 'b' } } : {}), content: `Older post ${i + 1}.`, likes: 0, comments: 0, createdAt: new Date(Date.UTC(2026, 9, 30 - Math.floor(i / 2), 10)).toISOString(), status: 'published', visibility: 'public' })),
];

/** A site page with one of every Studio block type (SS16), rendered by the shared page-builder renderer. */
export const SITE_PAGE = {
  id: 'pg_e2e_welcome',
  slug: 'welcome',
  title: { en: 'Welcome', ar: 'أهلًا بكم' },
  description: { en: 'Start here.', ar: 'ابدأ من هنا.' },
  status: 'published',
  updatedAt: '2026-11-12T10:00:00Z',
  createdAt: '2026-11-12T10:00:00Z',
  blocks: {
    en: [
      { id: 'Intro Text', type: 'markdown', text: 'Welcome to the channel.\n\n- Watch the **latest videos**.\n- Read the posts.\n\n<script>alert(1)</script>' },
      { id: 'img', type: 'image', url: 'https://images.alummahnow.net/e2e/banner.png', alt: 'A lantern-lit street', caption: 'The street at dusk.' },
      { id: 'vid', type: 'video', videoId: 'vid-e2e-1' },
      { id: 'btn', type: 'cta', label: 'All videos', href: '/en/videos/' },
      { id: 'bad', type: 'cta', label: 'Bad link', href: 'javascript:alert(1)' },
      { id: 'q', type: 'quote', text: 'And cooperate in righteousness and piety.', cite: 'Al-Maʾidah 5:2' },
      { id: 'hr', type: 'divider' },
      { id: 'posts', type: 'posts', count: 2 },
      { id: 'videos', type: 'videos', count: 2 },
      { id: 'future', type: 'hologram' },
    ],
    ar: [
      { id: 'intro', type: 'markdown', text: 'أهلًا بكم في القناة.\n\n- شاهد **أحدث المرئيات**.\n- اقرأ المنشورات.' },
      { id: 'q', type: 'quote', text: 'وتعاونوا على البر والتقوى', cite: 'المائدة ٢' },
      { id: 'btn', type: 'cta', label: 'كل المرئيات', href: '/ar/videos/' },
      { id: 'videos', type: 'videos', count: 2 },
    ],
  },
};
