/**
 * What api-videos answers for a host (`GET /api/sites/by-host/:host`): the mirror of
 * AlUmmahNow packages/shared-types/src/site.ts `PublicSite`. Keep the two in step.
 */
export type SiteLocale = 'en' | 'ar';
export type SiteStatus = 'setup' | 'live' | 'suspended' | 'revoked';
export type SitePlatformMark = 'required' | 'minimal' | 'none';
export type SiteNavKind = 'home' | 'videos' | 'shorts' | 'posts' | 'about' | 'url';

export interface SiteNavItem {
  id: string;
  kind: SiteNavKind;
  label?: Partial<Record<SiteLocale, string>>;
  url?: string;
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
    platformMark: SitePlatformMark;
    primaryHost: string;
    primaryKind: 'subdomain' | 'custom';
    configVersion: number;
  };
  channel: PublicSiteChannel;
}
