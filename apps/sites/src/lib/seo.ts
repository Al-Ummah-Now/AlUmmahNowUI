/**
 * Canonical URLs and structured data for scholar sites (wiki AUN-SCHOLAR-SITES §4.4, SS7):
 *  - posts, pages, About, home, lists: canonical on the site's primary host;
 *  - videos (watch pages): canonical on the videos site for a `<slug>.alummahnow.org` site, and on
 *    the site's own watch page when the primary host is the scholar's own domain ("the canonical
 *    follows the brand host").
 * hreflang pairs only the languages the site serves (SS13: a site may have one).
 */
import type { Locale } from '../../../../packages/render/src/locale';
import { watchUrl } from '../../../../packages/render/src/embeds';
import type { PublicSite } from './site-types';

export const siteOrigin = (site: PublicSite, scheme = 'https') => `${scheme}://${site.site.primaryHost}`;

/** Path in each of the site's languages: `/en/posts/` → { en: '/en/posts/', ar: '/ar/posts/' }. */
export function alternates(site: PublicSite, pathAfterLocale: string): Partial<Record<Locale, string>> {
  const rest = pathAfterLocale.replace(/^\/+/, '');
  return Object.fromEntries(site.site.locales.map((l) => [l, `/${l}/${rest}`]));
}

export function canonicalUrl(site: PublicSite, locale: Locale, pathAfterLocale: string, scheme = 'https'): string {
  return `${siteOrigin(site, scheme)}/${locale}/${pathAfterLocale.replace(/^\/+/, '')}`;
}

/** The canonical of a watch page (SS7). */
export function watchCanonical(site: PublicSite, locale: Locale, videoId: string, videosWebUrl: string, scheme = 'https'): string {
  return site.site.primaryKind === 'custom' ? canonicalUrl(site, locale, `watch/${videoId}/`, scheme) : watchUrl(videosWebUrl, { kind: 'video', id: videoId, lang: locale });
}

/** Watch pages are in this host's sitemap only when they are canonical here (own domain). */
export const watchPagesInSitemap = (site: PublicSite) => site.site.primaryKind === 'custom';

export function siteName(site: PublicSite, locale: Locale): string {
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  return site.site.name[locale] || site.channel.nameLocalized?.[locale] || site.site.name[other] || site.channel.name || site.site.primaryHost;
}

export function hreflangLinks(site: PublicSite, alts: Partial<Record<Locale, string>>, scheme = 'https'): { hreflang: string; href: string }[] {
  const links = Object.entries(alts).map(([l, path]) => ({ hreflang: l, href: `${siteOrigin(site, scheme)}${path}` }));
  if (links.length > 1) {
    const def = alts[site.site.locales[0] as Locale];
    if (def) links.push({ hreflang: 'x-default', href: `${siteOrigin(site, scheme)}${def}` });
  }
  return links;
}

/** `WebSite` + `Person`/`Organization` with sameAs to the channel on the videos site. */
export function siteJsonLd(site: PublicSite, locale: Locale, channelUrl: string, scheme = 'https'): unknown[] {
  const origin = siteOrigin(site, scheme);
  const name = siteName(site, locale);
  return [
    { '@context': 'https://schema.org', '@type': 'WebSite', name, url: `${origin}/${locale}/`, inLanguage: locale },
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name,
      url: `${origin}/${locale}/about/`,
      ...(site.site.logoUrl || site.channel.avatarUrl ? { image: site.site.logoUrl || site.channel.avatarUrl } : {}),
      sameAs: [channelUrl, ...(site.channel.links ?? []).map((l) => l.url).filter((u) => /^https:\/\//.test(u)).slice(0, 10)],
    },
  ];
}

/** JSON for a <script type="application/ld+json">: `<` escaped so it can never close the tag. */
export const jsonLdText = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
