/**
 * www's sitemap (wiki AUN-SEO, "Sitemap architecture"):
 * - the static sections (home, articles, videos, scholars) once per language, with an en/ar
 *   hreflang pair, x-default (English) and the newest lastmod of what they list;
 * - CMS pages and posts, with hreflang + x-default between the languages of one item
 *   (CMS translation_key), never a second copy of a static section;
 * - scholar pages in both languages.
 * Scholar pages and scholar post references whose canonical is the scholar's own site (a live site,
 * AUN-SCHOLAR-SITES SS7) are left out: that site's sitemap lists them (withoutSiteCanonicals).
 */
import { escapeHtml as x } from './html';
import { LOCALES, type Locale } from './locale';
import type { SitemapResponse } from './cms-types';
import type { SiteLookup } from './scholar-site';
import { mapLimit } from './scholar-site';

type Item = SitemapResponse['items'][number];
type Scholar = NonNullable<SitemapResponse['scholars']>[number];

/** Static sections; a CMS page with one of these slugs is that section, listed once. */
const STATIC_SECTIONS: Record<string, string> = { '': '/', articles: '/articles/', videos: '/videos/', scholars: '/scholars/' };
const SKIP_PAGE_SLUGS = new Set(['home', 'articles', 'videos', 'scholars']);

const day = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null);
const newest = (dates: (string | null)[]) => dates.filter((d): d is string => !!d).sort().pop() ?? null;

function entry(loc: string, lastmod: string | null, alternates: Partial<Record<Locale, string>>): string {
  const links = LOCALES.filter((l) => alternates[l]).map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${x(alternates[l]!)}"/>`);
  const xDefault = alternates.en ?? alternates.ar;
  // Only items that exist in more than one language carry alternates
  const alts = links.length > 1 && xDefault ? [...links, `<xhtml:link rel="alternate" hreflang="x-default" href="${x(xDefault)}"/>`].join('') : '';
  return `<url><loc>${x(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${alts}</url>`;
}

export function buildSitemap(siteUrl: string, items: Item[], scholars: Scholar[]): string {
  const live = items.filter((i) => i.locale === 'en' || i.locale === 'ar');
  const urls: string[] = [];

  // Static sections: lastmod = the newest item each one lists
  const postsDay = newest(live.filter((i) => i.type === 'post').map((i) => day(i.updated_at)));
  const sectionDay: Record<string, string | null> = {
    '/': newest([postsDay, ...live.filter((i) => i.slug === 'home').map((i) => day(i.updated_at))]),
    '/articles/': newest([postsDay, ...live.filter((i) => i.type === 'page' && i.slug === 'articles').map((i) => day(i.updated_at))]),
    '/videos/': newest(live.filter((i) => i.type === 'page' && i.slug === 'videos').map((i) => day(i.updated_at))),
    '/scholars/': newest(scholars.map((s) => day(s.updated_at))),
  };
  for (const path of Object.values(STATIC_SECTIONS)) {
    const alternates = Object.fromEntries(LOCALES.map((l) => [l, `${siteUrl}/${l}${path}`])) as Record<Locale, string>;
    for (const l of LOCALES) urls.push(entry(alternates[l], sectionDay[path] ?? null, alternates));
  }

  // CMS pages and posts, paired by translation_key
  const pathOf = (i: Item) => (i.type === 'post' ? `/${i.locale}/articles/${encodeURIComponent(i.slug)}/` : `/${i.locale}/${encodeURIComponent(i.slug)}/`);
  const listed = live.filter((i) => !(i.type === 'page' && SKIP_PAGE_SLUGS.has(i.slug)));
  const groups = new Map<string, Item[]>();
  for (const i of listed) {
    const key = i.translation_key ? `${i.type}:${i.translation_key}` : `${i.type}:${i.locale}:${i.slug}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  for (const group of groups.values()) {
    const alternates: Partial<Record<Locale, string>> = {};
    for (const i of group) alternates[i.locale] ??= `${siteUrl}${pathOf(i)}`;
    for (const i of group) urls.push(entry(`${siteUrl}${pathOf(i)}`, day(i.updated_at), alternates));
  }

  // Scholar pages: one slug, both languages
  for (const s of scholars) {
    if (!/^[a-z0-9-]{1,60}$/.test(s.slug)) continue;
    const alternates = Object.fromEntries(LOCALES.map((l) => [l, `${siteUrl}/${l}/scholars/${s.slug}/`])) as Record<Locale, string>;
    for (const l of LOCALES) urls.push(entry(alternates[l], day(s.updated_at), alternates));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Distinct channels looked up per sitemap build, at most (each lookup is up to 3 subrequests: cache read, fetch, cache write). */
export const MAX_SITE_LOOKUPS = 150;
const LOOKUP_CONCURRENCY = 8;
const CHANNEL = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The sitemap without what is canonical on a scholar's site: scholar pages whose primary channel has
 * a live site, and post references to that channel's community posts. A channel whose lookup failed
 * (or past MAX_SITE_LOOKUPS) keeps its URLs here: www stays canonical until it knows otherwise.
 */
export async function withoutSiteCanonicals(
  data: { items: Item[]; scholars: Scholar[] },
  lookup: (channelId: string) => Promise<SiteLookup>,
  log?: (message: string, data?: Record<string, unknown>) => void,
): Promise<{ items: Item[]; scholars: Scholar[] }> {
  const valid = (c: string | null | undefined): c is string => typeof c === 'string' && CHANNEL.test(c);
  const channels = [...new Set([...data.scholars.map((s) => s.primary_channel_id), ...data.items.map((i) => (i.type === 'post' && i.ref_post_id ? i.ref_channel_id : null))].filter(valid))];
  if (channels.length > MAX_SITE_LOOKUPS) log?.('sitemap: scholar site lookups capped', { channels: channels.length, max: MAX_SITE_LOOKUPS });
  const checked = channels.slice(0, MAX_SITE_LOOKUPS);
  const results = await mapLimit(checked, LOOKUP_CONCURRENCY, (c) => lookup(c).catch((): SiteLookup => ({ kind: 'unknown' })));
  const live = new Set(checked.filter((_, i) => results[i]?.kind === 'live'));
  if (!live.size) return data;
  return {
    items: data.items.filter((i) => !(i.type === 'post' && i.ref_post_id && valid(i.ref_channel_id) && live.has(i.ref_channel_id))),
    scholars: data.scholars.filter((s) => !(valid(s.primary_channel_id) && live.has(s.primary_channel_id))),
  };
}
