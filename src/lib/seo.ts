/** SEO helpers (SPEC §8): canonical/hreflang URLs and JSON-LD objects. */
import type { Config } from './env';
import type { Locale } from './locale';
import { embedUrl, watchUrl } from './embeds';
import { isoDuration, type VideoItem } from './videos';

export type Alternates = Partial<Record<Locale, string>>;

export const absolute = (cfg: Config, path: string) => (/^https?:\/\//.test(path) ? path : `${cfg.siteUrl}${path}`);

export function hreflangLinks(cfg: Config, alternates: Alternates): { hreflang: string; href: string }[] {
  const links: { hreflang: string; href: string }[] = [];
  if (alternates.en) links.push({ hreflang: 'en', href: absolute(cfg, alternates.en) });
  if (alternates.ar) links.push({ hreflang: 'ar', href: absolute(cfg, alternates.ar) });
  const xDefault = alternates.en ?? alternates.ar;
  if (xDefault) links.push({ hreflang: 'x-default', href: absolute(cfg, xDefault) });
  return links;
}

export function organizationLd(cfg: Config, name: string, sameAs: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${cfg.siteUrl}/#organization`,
    name,
    alternateName: name === 'Al Ummah Now' ? 'الأمة الآن' : 'Al Ummah Now',
    url: `${cfg.siteUrl}/`,
    logo: `${cfg.siteUrl}/brand/logo-512.webp`,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteLd(cfg: Config, name: string, locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${cfg.siteUrl}/#website`,
    name,
    url: `${cfg.siteUrl}/${locale}/`,
    inLanguage: locale,
    publisher: { '@id': `${cfg.siteUrl}/#organization` },
  };
}

export function articleLd(
  cfg: Config,
  a: {
    title: string;
    description: string;
    url: string;
    image: string | null;
    published: string;
    modified: string;
    author: string | null;
    locale: Locale;
    /** A scholar's post: the author is a Person with their page (scholarLd's @id). */
    authorUrl?: string | null;
  },
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title.slice(0, 110),
    description: a.description,
    mainEntityOfPage: absolute(cfg, a.url),
    ...(a.image ? { image: [a.image] } : {}),
    datePublished: a.published,
    dateModified: a.modified,
    inLanguage: a.locale,
    author: a.author
      ? { '@type': 'Person', name: a.author, ...(a.authorUrl ? { '@id': `${absolute(cfg, a.authorUrl)}#person`, url: absolute(cfg, a.authorUrl) } : {}) }
      : { '@id': `${cfg.siteUrl}/#organization` },
    publisher: { '@id': `${cfg.siteUrl}/#organization` },
  };
}

/** A scholar's page: a ProfilePage about a Person (their articles name it as author by @id). */
export function scholarLd(cfg: Config, s: { name: string; url: string; description: string | null; image: string | null; locale: Locale; sameAs: string[] }) {
  const url = absolute(cfg, s.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    inLanguage: s.locale,
    mainEntity: {
      '@type': 'Person',
      '@id': `${url}#person`,
      name: s.name,
      url,
      ...(s.description ? { description: s.description.slice(0, 300) } : {}),
      ...(s.image ? { image: s.image } : {}),
      ...(s.sameAs.length ? { sameAs: s.sameAs } : {}),
    },
  };
}

export function videoObjectLd(cfg: Config, item: VideoItem, locale: Locale) {
  if (item.kind !== 'video') return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: item.title,
    description: item.description ?? item.title,
    ...(item.thumbnailUrl ? { thumbnailUrl: [item.thumbnailUrl] } : {}),
    ...(item.uploadDate ? { uploadDate: item.uploadDate } : {}),
    ...(isoDuration(item.durationSeconds) ? { duration: isoDuration(item.durationSeconds) } : {}),
    embedUrl: embedUrl(cfg.videosWebUrl, { kind: 'video', id: item.id, lang: locale }),
    url: watchUrl(cfg.videosWebUrl, { kind: 'video', id: item.id, lang: locale }),
  };
}

/** JSON for a <script type="application/ld+json">: `<` escaped so content can never close the tag. */
export const jsonLdText = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

/** robots.txt: production is indexable; QA and stage disallow everything (SPEC §8). */
export function robotsTxt(isProduction: boolean, siteUrl: string): string {
  if (!isProduction) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\nDisallow: /auth/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
