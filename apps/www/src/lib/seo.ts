/** SEO helpers (SPEC §8): canonical/hreflang URLs and JSON-LD objects. */
import type { Config } from './env';
import type { Locale } from './locale';
import { embedUrl, watchUrl } from './embeds';
import { isoDuration, type VideoItem } from './videos';
import { itemThumb, stableImageUrl } from './images';

export type Alternates = Partial<Record<Locale, string>>;

export const absolute = (cfg: Config, path: string) => (/^https?:\/\//.test(path) ? path : `${cfg.siteUrl}${path}`);

/**
 * og:image / twitter:image: crawlers and link unfurlers keep it for weeks, so never a signed
 * (expiring) URL: a video thumbnail becomes the stable /thumb one (stableImageUrl), else the brand image.
 */
export const ogImageUrl = (cfg: Config, image: string | null | undefined) =>
  absolute(cfg, stableImageUrl(cfg.videosWebUrl, image) || '/brand/og-default.jpg');

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
    // Sitelinks search box: the site's own search page
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${cfg.siteUrl}/${locale}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * A list page's items (wiki AUN-SEO): an ItemList of links, never a VideoObject per item. The
 * videos' own watch pages carry their VideoObject; a list is not where a video is the main content.
 */
export function itemListLd(cfg: Config, items: VideoItem[], locale: Locale) {
  const urls = items.flatMap((item) => (item.kind === 'video' || item.kind === 'playlist' ? [watchUrl(cfg.videosWebUrl, { kind: item.kind, id: item.id, lang: locale })] : []));
  if (urls.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: urls.map((url, i) => ({ '@type': 'ListItem', position: i + 1, url })),
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
  const image = stableImageUrl(cfg.videosWebUrl, a.image);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title.slice(0, 110),
    description: a.description,
    mainEntityOfPage: absolute(cfg, a.url),
    ...(image ? { image: [image] } : {}),
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
  const image = stableImageUrl(cfg.videosWebUrl, s.image);
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
      ...(image ? { image } : {}),
      ...(s.sameAs.length ? { sameAs: s.sameAs } : {}),
    },
  };
}

export function videoObjectLd(cfg: Config, item: VideoItem, locale: Locale) {
  if (item.kind !== 'video') return null;
  const thumb = itemThumb(cfg.videosWebUrl, item);
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: item.title,
    description: item.description ?? item.title,
    // never a signed URL: crawlers keep it for weeks, a token dies in hours
    ...(thumb ? { thumbnailUrl: [thumb] } : {}),
    ...(item.uploadDate ? { uploadDate: item.uploadDate } : {}),
    ...(isoDuration(item.durationSeconds) ? { duration: isoDuration(item.durationSeconds) } : {}),
    embedUrl: embedUrl(cfg.videosWebUrl, { kind: 'video', id: item.id, lang: locale }),
    url: watchUrl(cfg.videosWebUrl, { kind: 'video', id: item.id, lang: locale }),
  };
}

/** JSON for a <script type="application/ld+json">: `<` escaped so content can never close the tag. */
export const jsonLdText = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

/**
 * Training-only AI crawlers, blocked on every public host (owner decision D-SEO-8). AI search and
 * answer bots that link back (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot,
 * Claude-User, DuckAssistBot, Applebot...) fall under the general rules and are allowed.
 */
export const AI_TRAINING_CRAWLERS = [
  'Google-Extended', 'GPTBot', 'CCBot', 'ClaudeBot', 'anthropic-ai', 'Applebot-Extended', 'Bytespider',
  'meta-externalagent', 'FacebookBot', 'cohere-training-data-crawler', 'Diffbot', 'Omgilibot',
  'img2dataset', 'PanguBot', 'Timpibot',
] as const;

/** robots.txt: production is indexable; QA and stage disallow everything (SPEC §8). */
export function robotsTxt(isProduction: boolean, siteUrl: string): string {
  if (!isProduction) return 'User-agent: *\nDisallow: /\n';
  const blocked = AI_TRAINING_CRAWLERS.map((bot) => `User-agent: ${bot}\nDisallow: /\n`).join('\n');
  return `User-agent: *\nAllow: /\nDisallow: /auth/\nDisallow: /preview\n\n${blocked}\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
