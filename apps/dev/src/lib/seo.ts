/**
 * Head links and structured data. Canonicals always name production (alummahnow.dev): QA and stage
 * serve the same HTML with noindex headers (scripts/env-files.ts), so a preview never competes with
 * the real page. Structured data states facts only (name, URL, logo, the GitHub org, our sites).
 */
import { LOCALES, SITE_ORIGIN, pagePath, type Locale, type PageSlug } from './pages.ts';
import { GH, VIDEOS, WWW } from './links.ts';

export interface HeadLinks {
  canonical: string;
  alternates: { hreflang: string; href: string }[];
}

export function headLinks(locale: Locale, slug: PageSlug): HeadLinks {
  const alternates: HeadLinks['alternates'] = LOCALES.map((l) => ({ hreflang: l, href: `${SITE_ORIGIN}${pagePath(l, slug)}` }));
  alternates.push({ hreflang: 'x-default', href: `${SITE_ORIGIN}${pagePath('en', slug)}` });
  return { canonical: `${SITE_ORIGIN}${pagePath(locale, slug)}`, alternates };
}

export const OG_IMAGE = `${SITE_ORIGIN}/brand/og-default.jpg`;

export function jsonLd(locale: Locale, name: string, alternateName: string, description: string): unknown[] {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#org`,
    name,
    alternateName,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/brand/logo-512.webp`,
    sameAs: [GH, WWW, VIDEOS],
  };
  const site = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#site-${locale}`,
    url: `${SITE_ORIGIN}${pagePath(locale, '')}`,
    name,
    description,
    inLanguage: locale,
    publisher: { '@id': `${SITE_ORIGIN}/#org` },
  };
  return [org, site];
}

/** JSON for a <script type="application/ld+json">, safe against "</script>" in strings. */
export const jsonLdText = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c');
