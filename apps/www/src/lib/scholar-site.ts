/**
 * Scholar sites on the platform side (wiki AUN-SCHOLAR-SITES, AlUmmahNow#1215): "the canonical
 * follows the brand host". www's pages never change for it (SS6: the scholar page is the full page,
 * fuelled by the channel's community posts, with or without a site); only their head does. When a
 * scholar's primary channel has a live site,
 *   - the scholar page's canonical and og:url are the site's home page, hreflang its languages;
 *   - a post referencing one of the channel's community posts still renders (no redirect), with
 *     canonical and og:url on the site's post page;
 *   - www's sitemap leaves both out.
 * Where the site is: `GET {VIDEOS_API_URL}/api/sites/by-channel/:channelId` → 200 PublicSiteLink
 * (live site, channel not suspended) or 404 (no live site). Each answer is cached 5 minutes (as the
 * API says). Any failure (5xx, timeout, a malformed body) is `unknown`, and www stays canonical: a
 * page never fails because of this lookup.
 */
import { VIDEO_ID } from './embeds';
import type { Locale } from './locale';
import type { VideosDeps } from './videos';

export interface ScholarSiteLink {
  channelId: string;
  primaryHost: string;
  /** `custom`: the scholar's own domain (their videos are canonical on the site too; not www's concern). */
  primaryKind: 'subdomain' | 'custom';
  /** The site's languages; the first is its default. */
  locales: Locale[];
}

export type SiteLookup = { kind: 'live'; link: ScholarSiteLink } | { kind: 'none' } | { kind: 'unknown' };

/** Seconds each answer is kept (the API's own `max-age`). */
export const SITE_LOOKUP_TTL = 300;
const HOST = /^[a-z0-9.-]+$/;

/** The API body as a link, or null when anything about it is off (then www stays canonical). */
export function toSiteLink(body: unknown, channelId: string): ScholarSiteLink | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const host = typeof b.primaryHost === 'string' ? b.primaryHost : '';
  if (!HOST.test(host) || host.length > 253 || !host.includes('.') || host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null;
  if (b.primaryKind !== 'subdomain' && b.primaryKind !== 'custom') return null;
  if (b.channelId !== undefined && b.channelId !== channelId) return null;
  const raw = Array.isArray(b.locales) ? b.locales : [];
  const locales = raw.filter((l, i): l is Locale => (l === 'en' || l === 'ar') && raw.indexOf(l) === i);
  if (!locales.length || locales.length !== raw.length) return null;
  return { channelId, primaryHost: host, primaryKind: b.primaryKind, locales };
}

/** Where the channel's live site is (memoised for the request, cached SITE_LOOKUP_TTL in the Cache API). */
export async function channelSite(deps: VideosDeps, channelId: string | null | undefined, memo?: Map<string, Promise<SiteLookup>>): Promise<SiteLookup> {
  if (!channelId || !VIDEO_ID.test(channelId)) return { kind: 'none' };
  const hit = memo?.get(channelId);
  if (hit) return hit;
  const run = lookup(deps, channelId);
  memo?.set(channelId, run);
  return run;
}

async function lookup(deps: VideosDeps, channelId: string): Promise<SiteLookup> {
  const key = `${deps.cacheKeyBase}/site-by-channel/${channelId}`;
  try {
    const cached = await deps.cache?.match(key);
    if (cached) {
      const { link } = (await cached.json()) as { link: unknown };
      const parsed = link === null ? null : toSiteLink(link, channelId);
      return parsed ? { kind: 'live', link: parsed } : { kind: 'none' };
    }
  } catch {
    // cache miss
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 2_500);
  let link: ScholarSiteLink | null;
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${deps.apiUrl}/api/sites/by-channel/${channelId}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (res.status === 404) {
      link = null;
    } else if (res.ok) {
      link = toSiteLink(await res.json(), channelId);
      if (!link) {
        deps.log?.('scholar site: malformed answer, www stays canonical', { channelId });
        return { kind: 'unknown' };
      }
    } else {
      deps.log?.('scholar site: lookup failed, www stays canonical', { channelId, status: res.status });
      return { kind: 'unknown' };
    }
  } catch (error) {
    deps.log?.('scholar site: lookup failed, www stays canonical', { channelId, error: controller.signal.aborted ? 'timeout' : String(error) });
    return { kind: 'unknown' };
  } finally {
    clearTimeout(timer);
  }
  if (deps.cache) {
    const res = new Response(JSON.stringify({ link }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${SITE_LOOKUP_TTL}` } });
    deps.waitUntil(deps.cache.put(key, res).catch(() => undefined));
  }
  return link ? { kind: 'live', link } : { kind: 'none' };
}

/** A page on the site: `https://<host>/<l>/<path>`; a language the site doesn't serve gets its default. */
export function siteUrl(link: Pick<ScholarSiteLink, 'primaryHost' | 'locales'>, locale: Locale, pathAfterLocale: string): string {
  const lang = link.locales.includes(locale) ? locale : (link.locales[0] as Locale);
  return `https://${link.primaryHost}/${lang}/${pathAfterLocale.replace(/^\/+/, '')}`;
}

/** The site's hreflang set for a page: its languages, plus x-default (its default) when it has two. */
export function siteHreflang(link: Pick<ScholarSiteLink, 'primaryHost' | 'locales'>, pathAfterLocale: string): { hreflang: string; href: string }[] {
  const links: { hreflang: string; href: string }[] = link.locales.map((l) => ({ hreflang: l, href: siteUrl(link, l, pathAfterLocale) }));
  if (links.length > 1) links.push({ hreflang: 'x-default', href: siteUrl(link, link.locales[0] as Locale, pathAfterLocale) });
  return links;
}

/** A community post id as a site path segment (the site's own POST_ID rule). */
export const REF_POST_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** The head links of a page canonical on the site (BaseLayout `seoLinks`). */
export interface SiteSeoLinks {
  canonical: string;
  hreflang: { hreflang: string; href: string }[];
}

/** The scholar page's head links: the site's home page in its default language, `https://<host>/<default>/`. */
export function siteHome(link: ScholarSiteLink): SiteSeoLinks {
  return { canonical: siteUrl(link, link.locales[0] as Locale, ''), hreflang: siteHreflang(link, '') };
}

/** A www post referencing community post `postId`: the site's post page, `https://<host>/<l>/posts/<id>/`. */
export function sitePostSeo(link: ScholarSiteLink, locale: Locale, postId: string): SiteSeoLinks {
  const path = `posts/${postId}/`;
  return { canonical: siteUrl(link, locale, path), hreflang: siteHreflang(link, path) };
}

/** Runs `fn` over `items` with at most `limit` at once (bounded fan-out for the sitemap's lookups). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}
