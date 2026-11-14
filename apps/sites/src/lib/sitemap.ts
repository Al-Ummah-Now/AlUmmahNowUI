/**
 * This host's sitemap (wiki AUN-SCHOLAR-SITES §4.4): everything that is canonical here and nothing
 * that isn't.
 *   - the built-in pages (home, videos, posts, About) and the published site pages (SS16);
 *   - every public post;
 *   - every video and Short, only when the primary host is the scholar's own domain (SS7: on a
 *     `<slug>.alummahnow.org` site the videos site is canonical and lists them).
 * Each URL is listed once per language the site serves, with `xhtml:link` alternates for the site's
 * languages plus x-default on a two-language site, and `<lastmod>` where the data has a date.
 *
 * A small site is one `<urlset>` at /sitemap.xml. A bigger one is a `<sitemapindex>` there and
 * files under /sitemaps/ of at most FILE_ITEMS items each (≤ 2000 URLs on a two-language site):
 *   /sitemaps/pages.xml                  built-in and site pages (no upstream read)
 *   /sitemaps/posts-<n>.xml              posts (n-1)·FILE_ITEMS … by page number (≤ 20 reads)
 *   /sitemaps/videos-<n>.xml?cursor=…    FILE_ITEMS videos from that cursor (≤ 10 reads)
 *   /sitemaps/shorts-<n>.xml?cursor=…    the same for Shorts
 * The videos API pages by cursor and has no count, so the index walks each list once (bounded by
 * MAX_WALK_PAGES) and hands each file the cursor it starts at. Every upstream page is cached 60 s
 * (lib/data.ts), so the files mostly re-read the index's pages from the cache, and the Worker keeps
 * each sitemap in the HTML edge cache like any page.
 */
import { escapeHtml as x } from '../../../../packages/render/src/html';
import type { Locale } from '../../../../packages/render/src/locale';
import { channelPosts, channelShorts, channelVideos, CURSOR, MAX_POSTS_PAGE, MAX_VIDEOS_PAGE, type DataDeps, type SiteVideo } from './data';
import { watchPagesInSitemap } from './seo';
import type { PublicSite } from './site-types';

/** Items (posts, videos, pages) per file: one URL per language, so ≤ 2000 URLs on a two-language site. */
export const FILE_ITEMS = 1_000;
/** Upstream pages the index reads per video list (5000 videos and 5000 Shorts). */
export const MAX_WALK_PAGES = 50;
/** Post files the index lists at most (50 000 posts, the deepest page lib/data reads). */
const MAX_POST_FILES = 50;
const POST_READS_PER_FILE = FILE_ITEMS / MAX_POSTS_PAGE;
const VIDEO_READS_PER_FILE = FILE_ITEMS / MAX_VIDEOS_PAGE;
const BUILT_IN_PATHS = ['', 'videos/', 'posts/', 'about/'];

export type VideoList = 'videos' | 'shorts';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  alternates: { hreflang: string; href: string }[];
}

export interface SitemapResult {
  status: 200 | 404;
  body: string;
}

const NOT_FOUND: SitemapResult = { status: 404, body: 'Not found' };

/** A date the sitemap protocol accepts (W3C datetime), or nothing for a missing or junk value. */
export function lastmodOf(...values: (string | null | undefined)[]): string | undefined {
  for (const v of values) {
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return undefined;
}

/** One entry per language for `pathAfterLocale`, each with the same alternates (`langs` default: the site's). */
export function entriesFor(site: PublicSite, origin: string, pathAfterLocale: string, lastmod?: string, langs: Locale[] = site.site.locales): SitemapEntry[] {
  const rest = pathAfterLocale.replace(/^\/+/, '');
  const href = (l: Locale) => `${origin}/${l}/${rest}`;
  const alternates = langs.length > 1 ? [...langs.map((l) => ({ hreflang: l, href: href(l) })), { hreflang: 'x-default', href: href(langs.includes(site.site.locales[0] as Locale) ? (site.site.locales[0] as Locale) : (langs[0] as Locale)) }] : [];
  return langs.map((l) => ({ loc: href(l), ...(lastmod ? { lastmod } : {}), alternates }));
}

export function urlsetXml(entries: SitemapEntry[]): string {
  const multi = entries.some((e) => e.alternates.length);
  const head = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${multi ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}>`;
  const rows = entries.map((e) => {
    const parts = [`<loc>${x(e.loc)}</loc>`];
    if (e.lastmod) parts.push(`<lastmod>${e.lastmod}</lastmod>`);
    for (const a of e.alternates) parts.push(`<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${x(a.href)}"/>`);
    return `  <url>${parts.join('')}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${head}\n${rows.join('\n')}${rows.length ? '\n' : ''}</urlset>\n`;
}

export function indexXml(locs: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map((l) => `  <sitemap><loc>${x(l)}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`;
}

function pageEntries(site: PublicSite, origin: string): SitemapEntry[] {
  const builtIn = BUILT_IN_PATHS.flatMap((p) => entriesFor(site, origin, p));
  // Published site pages (SS16) in the languages they have a title in (as the page's own hreflang)
  const pages = (site.site.pages ?? [])
    .filter((p) => p.status === 'published')
    .flatMap((p) => {
      const langs = site.site.locales.filter((l) => p.title[l]);
      return langs.length ? entriesFor(site, origin, `${p.slug}/`, lastmodOf(p.updatedAt), langs) : [];
    });
  return [...builtIn, ...pages];
}

const videoEntries = (site: PublicSite, origin: string, videos: SiteVideo[]) => videos.flatMap((v) => entriesFor(site, origin, `watch/${v.id}/`, lastmodOf(v.publishedAt)));

/** Posts pages `first`…`first+count-1` (stops at the last page). */
async function readPosts(deps: DataDeps, site: PublicSite, origin: string, first: number, count: number): Promise<SitemapEntry[]> {
  const out: SitemapEntry[] = [];
  for (let page = first; page < first + count; page++) {
    const { items, hasNext } = await channelPosts(deps, site.channel.id, page, MAX_POSTS_PAGE);
    for (const p of items) out.push(...entriesFor(site, origin, `posts/${p.id}/`, lastmodOf(p.updatedAt, p.createdAt)));
    if (!hasNext) break;
  }
  return out;
}

/** Up to `pages` pages of a video list from `cursor`: the videos, where each FILE_ITEMS-sized file starts, and whether it ran out of pages first. */
async function walkVideos(deps: DataDeps, list: VideoList, channelId: string, cursor: string, pages: number): Promise<{ videos: SiteVideo[]; starts: string[]; truncated: boolean }> {
  const read = list === 'videos' ? channelVideos : channelShorts;
  const videos: SiteVideo[] = [];
  const starts: string[] = [cursor];
  let next = cursor;
  for (let i = 0; i < pages; i++) {
    if (i > 0 && i % VIDEO_READS_PER_FILE === 0) starts.push(next);
    const page = await read(deps, channelId, { cursor: next || null, limit: MAX_VIDEOS_PAGE });
    // The list ended exactly on a file boundary: no empty file
    if (i > 0 && i % VIDEO_READS_PER_FILE === 0 && !page.items.length) starts.pop();
    videos.push(...page.items);
    next = page.cursor;
    if (!next) return { videos, starts, truncated: false };
  }
  return { videos, starts, truncated: true };
}

/** `/sitemap.xml`: one urlset for a small site, else the index of the /sitemaps/ files. */
export async function sitemapRoot(site: PublicSite, origin: string, deps: DataDeps): Promise<SitemapResult> {
  const pages = pageEntries(site, origin);
  const first = await channelPosts(deps, site.channel.id, 1, MAX_POSTS_PAGE);
  const postCount = first.total ?? first.items.length + (first.hasNext ? FILE_ITEMS : 0);
  const withVideos = watchPagesInSitemap(site);
  const none = { videos: [] as SiteVideo[], starts: [] as string[], truncated: false };
  const [videos, shorts] = withVideos
    ? await Promise.all([walkVideos(deps, 'videos', site.channel.id, '', MAX_WALK_PAGES), walkVideos(deps, 'shorts', site.channel.id, '', MAX_WALK_PAGES)])
    : [none, none];
  for (const [list, w] of [['videos', videos], ['shorts', shorts]] as const) {
    if (w.truncated) deps.log?.('sites: sitemap video list truncated', { channelId: site.channel.id, list, pages: MAX_WALK_PAGES });
  }

  const items = pages.length / site.site.locales.length + postCount + videos.videos.length + shorts.videos.length;
  if (items <= FILE_ITEMS && !videos.truncated && !shorts.truncated) {
    const firstPosts = first.items.flatMap((p) => entriesFor(site, origin, `posts/${p.id}/`, lastmodOf(p.updatedAt, p.createdAt)));
    const morePosts = first.hasNext ? await readPosts(deps, site, origin, 2, POST_READS_PER_FILE - 1) : [];
    return { status: 200, body: urlsetXml([...pages, ...firstPosts, ...morePosts, ...videoEntries(site, origin, videos.videos), ...videoEntries(site, origin, shorts.videos)]) };
  }

  const locs = [`${origin}/sitemaps/pages.xml`];
  const postFiles = Math.min(Math.ceil(postCount / FILE_ITEMS), MAX_POST_FILES);
  for (let n = 1; n <= postFiles; n++) locs.push(`${origin}/sitemaps/posts-${n}.xml`);
  for (const [list, w] of [['videos', videos], ['shorts', shorts]] as const) {
    if (!w.videos.length) continue;
    w.starts.forEach((cursor, i) => locs.push(`${origin}/sitemaps/${list}-${i + 1}.xml${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`));
  }
  return { status: 200, body: indexXml(locs) };
}

const FILE = /^(pages|posts|videos|shorts)(?:-([1-9]\d{0,2}))?$/;

/** `/sitemaps/<file>.xml`: one file the index lists; anything else (or videos on a subdomain site) is a 404. */
export async function sitemapFile(site: PublicSite, origin: string, deps: DataDeps, file: string, cursor: string | null): Promise<SitemapResult> {
  const m = FILE.exec(file);
  if (!m) return NOT_FOUND;
  const kind = m[1] as 'pages' | 'posts' | VideoList;
  const n = m[2] ? Number(m[2]) : null;
  if (kind === 'pages') return n === null ? { status: 200, body: urlsetXml(pageEntries(site, origin)) } : NOT_FOUND;
  if (n === null) return NOT_FOUND;
  if (kind === 'posts') {
    if (n > MAX_POST_FILES) return NOT_FOUND;
    const entries = await readPosts(deps, site, origin, (n - 1) * POST_READS_PER_FILE + 1, POST_READS_PER_FILE);
    return entries.length ? { status: 200, body: urlsetXml(entries) } : NOT_FOUND;
  }
  if (!watchPagesInSitemap(site)) return NOT_FOUND;
  // File 1 starts at the top; every later file at the cursor the index gave it
  const start = n === 1 ? '' : cursor && CURSOR.test(cursor) ? cursor : null;
  if (start === null) return NOT_FOUND;
  const { videos } = await walkVideos(deps, kind, site.channel.id, start, VIDEO_READS_PER_FILE);
  return videos.length ? { status: 200, body: urlsetXml(videoEntries(site, origin, videos)) } : NOT_FOUND;
}
