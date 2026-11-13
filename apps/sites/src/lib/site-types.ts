/**
 * What api-videos answers for a host (`GET /api/sites/by-host/:host`): the mirror of
 * AlUmmahNow packages/shared-types/src/site.ts `PublicSite`. Keep the two in step.
 */
export type SiteLocale = 'en' | 'ar';
export type SiteStatus = 'setup' | 'live' | 'suspended' | 'revoked';
export type SitePlatformMark = 'required' | 'minimal' | 'none';
export type SiteNavKind = 'home' | 'videos' | 'shorts' | 'posts' | 'about' | 'page' | 'url';

export interface SiteNavItem {
  id: string;
  kind: SiteNavKind;
  label?: Partial<Record<SiteLocale, string>>;
  url?: string;
  /** `page` only. */
  pageId?: string;
}

/** Site pages, home, SEO and redirects (SS16; AlUmmahNow site.ts). */
export interface SitePageSummary {
  id: string;
  slug: string;
  title: Partial<Record<SiteLocale, string>>;
  status: 'draft' | 'published';
  updatedAt: string;
}

export type SiteBlock =
  | { id: string; type: 'markdown'; text: string }
  | { id: string; type: 'image'; url: string; alt: string; caption?: string | null }
  | { id: string; type: 'video'; videoId: string }
  | { id: string; type: 'cta'; label: string; href: string }
  | { id: string; type: 'quote'; text: string; cite?: string | null }
  | { id: string; type: 'divider' }
  | { id: string; type: 'posts'; count: number }
  | { id: string; type: 'videos'; count: number; playlistId?: string | null };

export interface SitePage extends SitePageSummary {
  description: Partial<Record<SiteLocale, string>>;
  blocks: Partial<Record<SiteLocale, SiteBlock[]>>;
  createdAt: string;
}

export interface SiteSeo {
  titleTemplate?: string | null;
  description?: Partial<Record<SiteLocale, string>>;
  googleVerification?: string | null;
  bingVerification?: string | null;
}

export interface SiteRedirect {
  from: string;
  to: string;
}

export interface PublicSiteChannel {
  id: string;
  name: string;
  nameLocalized?: Partial<Record<SiteLocale, string>>;
  handle: string | null;
  avatarUrl: string | null;
  description: string | null;
  descriptionLocalized?: Partial<Record<SiteLocale, string>>;
  links?: { title?: string; url: string }[];
}

export interface PublicSite {
  host: string;
  redirectTo: string | null;
  preview: boolean;
  site: {
    channelId: string;
    slug: string;
    status: SiteStatus;
    themeRef: string;
    name: Partial<Record<SiteLocale, string>>;
    logoUrl: string | null;
    faviconUrl: string | null;
    locales: SiteLocale[];
    navigation: SiteNavItem[];
    about: Partial<Record<SiteLocale, string>>;
    /** Published pages (drafts too in a preview); absent before AlUmmahNow #1281. */
    pages?: SitePageSummary[];
    home?: { pageId: string | null };
    seo?: SiteSeo;
    redirects?: SiteRedirect[];
    platformMark: SitePlatformMark;
    primaryHost: string;
    primaryKind: 'subdomain' | 'custom';
    configVersion: number;
  };
  channel: PublicSiteChannel;
}
