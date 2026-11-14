/**
 * The site's content from the videos API, read anonymously (public items only), each read cached
 * 60 s in the Cache API. Failures are an empty list (and logged), never an error page.
 *   - videos: GET /api/channels/:id/videos?sort=latest&limit=&cursor= (long-form only)
 *   - Shorts: GET /api/channels/:id/shorts?sort=latest&limit=&cursor=
 *   - one video: GET /api/videos/:id (only when it belongs to this site's channel)
 *   - posts: GET /api/community/channels/:id/posts?page=&limit= (the channel's community posts, SS4/SS6)
 *   - one post: GET /api/community/channels/:id/posts/:postId
 */
import { VIDEO_ID } from '../../../../packages/render/src/embeds';
import { normalizeImageUrl } from '../../../../packages/render/src/images';
import type { Locale } from '../../../../packages/render/src/locale';
import { safeOutsideUrl } from '../../../../packages/render/src/posts/post-kinds';
import type { PostLinkData } from '../../../../packages/render/src/posts/types';
import type { SitePage } from './site-types';

export const CURSOR = /^[A-Za-z0-9._~:+/=-]{1,512}$/;
export const POST_ID = /^[A-Za-z0-9_-]{1,80}$/;

export interface DataDeps {
  apiUrl: string;
  cache: Cache | null;
  waitUntil: (p: Promise<unknown>) => void;
  fetchImpl?: typeof fetch;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

export interface SiteVideo {
  id: string;
  title: string;
  titles: Partial<Record<Locale, string>>;
  description: string | null;
  descriptions: Partial<Record<Locale, string>>;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  channelId: string | null;
  isShort: boolean;
  views: number | null;
}

export type PostKind = 'text' | 'image' | 'poll' | 'quiz' | 'video' | 'gif' | 'article' | 'cards' | 'link';

export interface SitePost {
  id: string;
  kind: PostKind;
  text: string | null;
  images: { url: string; alt: string; width: number | null; height: number | null }[];
  videoId: string | null;
  article: { title: string; excerpt: string | null; coverUrl: string | null; url: string | null } | null;
  options: string[];
  /** A link post's page (SS14): preview card with image, title and site name. */
  link: PostLinkData | null;
  gif: { url: string; width: number | null; height: number | null } | null;
  /** A cards post's cards: real overlay text, never burned into the image. */
  slides: { url: string; alt: string; heading: string | null; body: string | null }[];
  likes: number;
  comments: number;
  createdAt: string;
  /** Last edit, when the API has one (the sitemap's lastmod). */
  updatedAt: string | null;
  pinned: boolean;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const localized = (v: unknown): Partial<Record<Locale, string>> => {
  const out: Partial<Record<Locale, string>> = {};
  if (v && typeof v === 'object') for (const l of ['en', 'ar'] as const) { const t = str((v as Record<string, unknown>)[l]); if (t) out[l] = t; }
  return out;
};

export function toSiteVideo(body: unknown): SiteVideo | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b.id !== 'string' || !VIDEO_ID.test(b.id)) return null;
  if (b.isDeleted === true || b.isHidden === true || b.isPublic === false || b.isPrivate === true) return null;
  const title = str(b.title);
  if (!title) return null;
  const thumb = str(b.thumbnailUrl) ?? str(b.coverUrl);
  return {
    id: b.id,
    title: title.replace(/\.(mp4|mov|mkv|webm)$/i, ''),
    titles: localized(b.titleLocalized),
    description: str(b.description),
    descriptions: localized(b.descriptionLocalized),
    thumbnailUrl: normalizeImageUrl(thumb),
    durationSeconds: num(b.duration),
    publishedAt: str(b.publishedAt) ?? str(b.dateCreated),
    channelId: str(b.channelId),
    isShort: b.format === 'short' || b.isShort === true,
    views: num(b.views),
  };
}

function toLink(v: unknown): PostLinkData | null {
  const l = v as Record<string, unknown> | null | undefined;
  const url = l ? safeOutsideUrl(str(l.url)) : null;
  if (!l || !url) return null;
  const img = l.image as Record<string, unknown> | null | undefined;
  const imgUrl = img ? normalizeImageUrl(str(img.url)) : null;
  return {
    url,
    title: str(l.title),
    description: str(l.description),
    siteName: str(l.siteName),
    image: imgUrl ? { url: imgUrl, alt: null, width: num(img?.width), height: num(img?.height) } : null,
  };
}

function toGif(v: unknown): SitePost['gif'] {
  const g = v as Record<string, unknown> | null | undefined;
  const url = g ? normalizeImageUrl(str(g.url)) : null;
  return url ? { url, width: num(g?.width), height: num(g?.height) } : null;
}

export function toSitePost(body: unknown): SitePost | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b.id !== 'string' || !POST_ID.test(b.id)) return null;
  if (b.isDeleted === true || (b.status && b.status !== 'published') || (b.visibility && b.visibility !== 'public')) return null;
  const kind = (str(b.type) ?? 'text') as PostKind;
  const images = (Array.isArray(b.images) ? b.images : [])
    .map((i) => {
      const img = i as Record<string, unknown>;
      const url = normalizeImageUrl(str(img.url));
      return url ? { url, alt: str(img.alt) ?? str(img.altText) ?? '', width: num(img.width), height: num(img.height) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 10);
  const a = b.article as Record<string, unknown> | undefined;
  const optionsSource = (b.poll as { options?: unknown } | undefined)?.options ?? (b.quiz as { options?: unknown } | undefined)?.options;
  return {
    id: b.id,
    kind,
    text: str(b.content),
    images,
    videoId: typeof b.videoId === 'string' && VIDEO_ID.test(b.videoId) ? b.videoId : null,
    article: a && str(a.title) ? { title: str(a.title) as string, excerpt: str(a.excerpt), coverUrl: normalizeImageUrl(str(a.coverUrl)), url: str(a.url) } : null,
    link: toLink(b.link),
    gif: toGif(b.gif),
    slides: (Array.isArray(b.slides) ? b.slides : [])
      .map((x) => {
        const sl = x as Record<string, unknown>;
        const img = (sl.image ?? {}) as Record<string, unknown>;
        const url = normalizeImageUrl(str(img.url));
        return url ? { url, alt: str(img.alt) ?? '', heading: str(sl.heading), body: str(sl.body) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 40),
    options: (Array.isArray(optionsSource) ? optionsSource : []).map((o) => str((o as Record<string, unknown>)?.text) ?? '').filter(Boolean).slice(0, 10),
    likes: num(b.likes) ?? 0,
    comments: num(b.comments) ?? 0,
    createdAt: str(b.createdAt) ?? '',
    updatedAt: str(b.updatedAt),
    pinned: b.pinned === true,
  };
}

async function cachedJson(deps: DataDeps, url: string): Promise<unknown | null> {
  const key = new Request(`https://sites-data.internal/${encodeURIComponent(url)}`);
  try {
    const hit = await deps.cache?.match(key);
    if (hit) return await hit.json();
  } catch {
    // miss
  }
  try {
    const res = await (deps.fetchImpl ?? fetch)(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(2_500) });
    if (!res.ok) {
      if (res.status !== 404) deps.log?.('sites: data read failed', { url, status: res.status });
      return null;
    }
    const body = await res.json();
    if (deps.cache) deps.waitUntil(deps.cache.put(key, new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } })).catch(() => undefined));
    return body;
  } catch (error) {
    deps.log?.('sites: data read failed', { url, error: String(error) });
    return null;
  }
}

/** Most items per videos or Shorts page (api-videos' channel index reads at most 100 at a time). */
export const MAX_VIDEOS_PAGE = 100;

async function channelList(deps: DataDeps, list: 'videos' | 'shorts', channelId: string, opts: { cursor?: string | null; limit?: number }): Promise<{ items: SiteVideo[]; cursor: string }> {
  if (!VIDEO_ID.test(channelId)) return { items: [], cursor: '' };
  const cursor = opts.cursor && CURSOR.test(opts.cursor) ? opts.cursor : '';
  const params = new URLSearchParams({ sort: 'latest', limit: String(Math.min(Math.max(opts.limit ?? 12, 1), MAX_VIDEOS_PAGE)), ...(cursor ? { cursor } : {}) });
  const body = (await cachedJson(deps, `${deps.apiUrl}/api/channels/${channelId}/${list}?${params}`)) as { data?: unknown; cursor?: unknown } | null;
  const rows = Array.isArray(body?.data) ? body.data : [];
  return {
    items: rows.map(toSiteVideo).filter((v): v is SiteVideo => v !== null),
    cursor: typeof body?.cursor === 'string' && CURSOR.test(body.cursor) ? body.cursor : '',
  };
}

/** The channel's long-form videos, newest first, one page. */
export function channelVideos(deps: DataDeps, channelId: string, opts: { cursor?: string | null; limit?: number } = {}): Promise<{ items: SiteVideo[]; cursor: string }> {
  return channelList(deps, 'videos', channelId, opts);
}

/** The channel's Shorts, newest first, one page. */
export function channelShorts(deps: DataDeps, channelId: string, opts: { cursor?: string | null; limit?: number } = {}): Promise<{ items: SiteVideo[]; cursor: string }> {
  return channelList(deps, 'shorts', channelId, opts);
}

/** A video of THIS site's channel, else null (another channel's video never renders on the site). */
export async function siteVideo(deps: DataDeps, channelId: string, videoId: string): Promise<SiteVideo | null> {
  if (!VIDEO_ID.test(videoId)) return null;
  const video = toSiteVideo(await cachedJson(deps, `${deps.apiUrl}/api/videos/${videoId}`));
  return video && video.channelId === channelId ? video : null;
}

/** Most posts per page api-videos answers. */
export const MAX_POSTS_PAGE = 50;
/** Deepest page read (the sitemap walks further than the list pages, which stop at 100). */
const MAX_POSTS_PAGE_NUMBER = 1_000;

/** One page of the channel's public posts; `total` is the API's count (null when it doesn't say or the read failed). */
export async function channelPosts(deps: DataDeps, channelId: string, page = 1, limit = 10): Promise<{ items: SitePost[]; hasNext: boolean; total: number | null }> {
  if (!VIDEO_ID.test(channelId)) return { items: [], hasNext: false, total: null };
  const p = Math.min(Math.max(Math.trunc(page) || 1, 1), MAX_POSTS_PAGE_NUMBER);
  const n = Math.min(Math.max(Math.trunc(limit) || 10, 1), MAX_POSTS_PAGE);
  const body = (await cachedJson(deps, `${deps.apiUrl}/api/community/channels/${channelId}/posts?page=${p}&limit=${n}`)) as { posts?: unknown; pagination?: { hasNext?: unknown; total?: unknown } } | null;
  const rows = Array.isArray(body?.posts) ? body.posts : [];
  const total = body?.pagination?.total;
  return {
    items: rows.map(toSitePost).filter((x): x is SitePost => x !== null),
    hasNext: body?.pagination?.hasNext === true,
    total: typeof total === 'number' && Number.isInteger(total) && total >= 0 ? total : null,
  };
}

export async function sitePost(deps: DataDeps, channelId: string, postId: string): Promise<SitePost | null> {
  if (!VIDEO_ID.test(channelId) || !POST_ID.test(postId)) return null;
  const body = await cachedJson(deps, `${deps.apiUrl}/api/community/channels/${channelId}/posts/${postId}`);
  const post = toSitePost((body as { post?: unknown } | null)?.post ?? body);
  const owner = (body as { channelId?: unknown } | null)?.channelId;
  return post && (owner === undefined || owner === channelId) ? post : null;
}

export function localizedTitle(v: SiteVideo, locale: Locale): string {
  return v.titles[locale] ?? v.title;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// Site pages (SS16): published pages by slug, the home page, playlist videos for a block
// ---------------------------------------------------------------------------------------------

const PAGE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const PREVIEW_TOKEN = /^[0-9a-f]{32}$/;

/** Reads a page answer; a preview is never cached (it shows drafts). */
async function pageJson(deps: DataDeps, url: string, preview: string | null): Promise<SitePage | null> {
  if (preview) {
    try {
      const res = await (deps.fetchImpl ?? fetch)(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(2_500) });
      if (!res.ok) return null;
      return ((await res.json()) as { page?: SitePage | null }).page ?? null;
    } catch (error) {
      deps.log?.('sites: page read failed', { error: String(error) });
      return null;
    }
  }
  return ((await cachedJson(deps, url)) as { page?: SitePage | null } | null)?.page ?? null;
}

export async function sitePage(deps: DataDeps, host: string, slug: string, preview: string | null): Promise<SitePage | null> {
  if (!PAGE_SLUG.test(slug)) return null;
  const token = preview && PREVIEW_TOKEN.test(preview) ? preview : null;
  return pageJson(deps, `${deps.apiUrl}/api/sites/by-host/${encodeURIComponent(host)}/pages/${slug}${token ? `?preview=${token}` : ''}`, token);
}

export async function homePage(deps: DataDeps, host: string, preview: string | null): Promise<SitePage | null> {
  const token = preview && PREVIEW_TOKEN.test(preview) ? preview : null;
  return pageJson(deps, `${deps.apiUrl}/api/sites/by-host/${encodeURIComponent(host)}/home${token ? `?preview=${token}` : ''}`, token);
}

/** A playlist's first videos in its saved order, only when the playlist is this channel's. */
export async function playlistVideos(deps: DataDeps, channelId: string, playlistId: string, limit: number): Promise<SiteVideo[]> {
  if (!VIDEO_ID.test(playlistId)) return [];
  const body = (await cachedJson(deps, `${deps.apiUrl}/api/playlists/${playlistId}/queue?limit=${Math.min(Math.max(limit, 1), 24)}`)) as { result?: { playlist?: { channelId?: unknown }; items?: unknown[] } } | null;
  if (body?.result?.playlist?.channelId !== channelId) return [];
  return (body.result.items ?? []).map(toSiteVideo).filter((v): v is SiteVideo => v !== null && v.channelId === channelId).slice(0, limit);
}
