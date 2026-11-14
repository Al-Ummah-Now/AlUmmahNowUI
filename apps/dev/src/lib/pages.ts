/**
 * Every page of alummahnow.dev, in nav order (wiki AUN-DEV-SITE §Page map). Each exists in both
 * languages at /<locale>/<slug>/ ('' = the home page). Used by the pages, the nav, the sitemap,
 * the smoke and the screenshot script, so a page can't be added to one and missed by the others.
 * Plain TypeScript with no Astro imports: the Node scripts import it too.
 */
export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const PAGES = ['', 'community', 'technology', 'infrastructure', 'open-source', 'waqf', 'contact'] as const;
export type PageSlug = (typeof PAGES)[number];

export const pagePath = (locale: Locale, slug: PageSlug): string => (slug ? `/${locale}/${slug}/` : `/${locale}/`);

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
export const dir = (l: Locale): 'rtl' | 'ltr' => (l === 'ar' ? 'rtl' : 'ltr');
export const otherLocale = (l: Locale): Locale => (l === 'ar' ? 'en' : 'ar');

export const SITE_ORIGIN = 'https://alummahnow.dev';
