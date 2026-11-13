import type { NavItem, Page, SiteResponse } from '../../lib/cms-types';

export interface Pillar { title: string; body: string }

/** Built-in content bundled in the Worker: shown when the CMS is down or empty. */
export interface Builtin {
  site: SiteResponse;
  pillars: Pillar[];
  headerNav: NavItem[];
  footerNav: NavItem[];
  pages: Record<string, Page>;
}
