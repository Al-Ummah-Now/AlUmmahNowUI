import type { SiteSettings } from '../../lib/cms-types';
import type { Builtin } from './types';

const settings: SiteSettings = {
  locale: 'en',
  site_title: 'Al Ummah Now',
  tagline: 'Islamic videos and community',
  hero_title: 'Beneficial knowledge, close at hand',
  hero_body:
    'Lessons, lectures and reminders from scholars and creators you can trust, in Arabic and English. Watch, follow channels, and keep learning with one account.',
  social: [],
};

const headerNav = [
  { label: 'News', url: '/news/' },
  { label: 'Videos', url: '/videos/' },
  { label: 'About', url: '/about/' },
];
const footerNav = [
  { label: 'About', url: '/about/' },
  { label: 'News', url: '/news/' },
  { label: 'Videos', url: '/videos/' },
];

export const en: Builtin = {
  site: { settings, nav: { header: headerNav, footer: footerNav } },
  home: { settings, videos: [], posts: [] },
  headerNav,
  footerNav,
  pillars: [
    {
      title: 'Lessons and lectures',
      body: 'Tafsir, hadith, fiqh, seerah and everyday reminders, organised into series you can follow from the first lesson to the last.',
    },
    {
      title: 'Channels you trust',
      body: 'Scholars, mosques and creators publish on their own channels. Follow the ones you learn from and see what is new.',
    },
    {
      title: 'One account, every app',
      body: 'Sign in once to watch, save playlists and manage your profile across Al Ummah Now, in Arabic or English.',
    },
  ],
  pages: {
    about: {
      slug: 'about',
      locale: 'en',
      title: 'About Al Ummah Now',
      summary: 'An Islamic video and community platform, in Arabic and English.',
      body: [
        'Al Ummah Now is a home for beneficial Islamic content: lessons, lectures, series and reminders from scholars, mosques and creators.',
        '',
        '## What we are building',
        '',
        '- **Videos** where you can watch, follow channels and keep playlists.',
        '- **One account** that works across every Al Ummah Now app.',
        '- **Arabic and English** from the start, so the same knowledge reaches more people.',
        '',
        '## Get started',
        '',
        'Browse the video library, or create an account to follow channels and save what you want to come back to.',
      ].join('\n'),
      seo_title: null,
      seo_description: null,
      cover: null,
      published_at: '2026-11-01T00:00:00.000Z',
      updated_at: '2026-11-01T00:00:00.000Z',
      alternates: [{ locale: 'ar', slug: 'about' }],
    },
  },
};
