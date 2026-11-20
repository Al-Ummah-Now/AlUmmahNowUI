/** The System design section in reading order: the hub, then every subpage (PAGES order). */
import { SYSTEM_DESIGN, pagePath, type Locale, type PageSlug } from './pages.ts';
import type { Strings } from '../i18n';

export interface SdEntry {
  slug: PageSlug;
  title: string;
  href: string;
}

export function sdEntries(locale: Locale, t: Strings): SdEntry[] {
  const titles = new Map(t.systemDesign.pages.map((p) => [`system-design/${p.href.replace(/\/$/, '')}`, p.title]));
  return [
    { slug: 'system-design', title: t.sdNav.overview, href: pagePath(locale, 'system-design') },
    ...SYSTEM_DESIGN.map((slug) => {
      const title = titles.get(slug);
      if (!title) throw new Error(`no hub card for ${slug}`);
      return { slug, title, href: pagePath(locale, slug) };
    }),
  ];
}
