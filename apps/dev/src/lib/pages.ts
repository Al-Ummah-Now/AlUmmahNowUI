/**
 * Every page of alummahnow.dev (wiki AUN-DEV-SITE §Page map). Each exists in both
 * languages at /<locale>/<slug>/ ('' = the home page). Used by the pages, the sitemap,
 * the smoke and the screenshot script, so a page can't be added to one and missed by the others.
 * NAV (below) is what the header lists; PAGES includes the system-design subpages.
 * Plain TypeScript with no Astro imports: the Node scripts import it too.
 */
export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * The System design section (wiki AUN-DEV-SITE): a hub (the overview) at /<locale>/system-design/
 * and one subpage per topic. Subpage slugs exist here before their page does, so each stage adds
 * only the slugs it ships; sitemap, smoke, screenshots and the e2e loop all follow PAGES.
 */
export const PAGES = [
  '',
  'community',
  'technology',
  'infrastructure',
  'system-design',
  'system-design/video-pipeline',
  'system-design/delivery-caching',
  'system-design/data',
  'system-design/async',
  'system-design/realtime',
  'system-design/identity',
  'system-design/ai',
  'system-design/cost',
  'system-design/scaling',
  'system-design/clients',
  'system-design/release',
  'auth',
  'auth/web',
  'auth/native',
  'auth/servers',
  'auth/tokens',
  'auth/reference',
  'auth/tools',
  'open-source',
  'contact',
] as const;
export type PageSlug = (typeof PAGES)[number];
export type SystemDesignSubpage = Extract<PageSlug, `system-design/${string}`>;
/** The section's subpages, in PAGES order. */
export const SYSTEM_DESIGN = PAGES.filter((p): p is SystemDesignSubpage => p.startsWith('system-design/'));

/** The Sign-in API section (wiki AUTH-R4): its hub and subpages, in PAGES order. */
export type AuthPage = Extract<PageSlug, 'auth' | `auth/${string}`>;
export const AUTH_PAGES = PAGES.filter((p): p is AuthPage => p === 'auth' || p.startsWith('auth/'));

/** What the header and the footer list: the top-level pages, not the section's subpages. */
export const NAV = ['', 'community', 'technology', 'infrastructure', 'system-design', 'auth', 'open-source', 'contact'] as const;
export type NavSlug = (typeof NAV)[number];

export const pagePath = (locale: Locale, slug: PageSlug): string => (slug ? `/${locale}/${slug}/` : `/${locale}/`);

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
export const dir = (l: Locale): 'rtl' | 'ltr' => (l === 'ar' ? 'rtl' : 'ltr');
export const otherLocale = (l: Locale): Locale => (l === 'ar' ? 'en' : 'ar');

export const SITE_ORIGIN = 'https://alummahnow.dev';
