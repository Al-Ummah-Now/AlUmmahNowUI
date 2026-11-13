import type { SiteSettings } from '../../lib/cms-types';
import type { Builtin } from './types';

const settings: SiteSettings = {
  locale: 'en',
  site_title: 'Al Ummah Now',
  tagline: 'Share what matters to the Ummah',
  hero_title: 'Share what matters to the Ummah',
  hero_body:
    'Upload videos, go live and post to your channel, and see what the community is sharing, in Arabic and English.',
  social: [],
};

const headerNav = [
  { label: 'Articles', url: '/articles/' },
  { label: 'Videos', url: '/videos/' },
  { label: 'About', url: '/about/' },
];
const footerNav = [
  { label: 'About', url: '/about/' },
  { label: 'Articles', url: '/articles/' },
  { label: 'Videos', url: '/videos/' },
];

export const en: Builtin = {
  site: { settings, nav: { header: headerNav, footer: footerNav } },
  headerNav,
  footerNav,
  pillars: [
    {
      title: 'Videos and Shorts',
      body: 'Watch full videos, Shorts and live streams on every topic, and follow playlists from start to finish.',
    },
    {
      title: 'Channels and creators',
      body: "Mosques, scholars and creators publish on their own channels. Subscribe to the ones you like and see what's new.",
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
        'Al Ummah Now is a platform where you can share videos, Shorts and community posts.',
        '',
        "## What you'll find here",
        '',
        '- Watch and share **videos and Shorts**.',
        '- Read **community posts** from the channels you subscribe to.',
        '- Share **news** that matters to the Ummah.',
        '- Share **educational materials**.',
        '- Watch **live streams** as they happen.',
        '',
        '## Get started',
        '',
        'Explore videos, or create an account to subscribe to channels and save what you want to come back to.',
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
