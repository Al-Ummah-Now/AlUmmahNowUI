/**
 * The site theme: the one the admin chose for the whole site (videos admin → Site theme), read
 * from the same public source as the videos app and the CMS: `GET <ADMIN_API_URL>/public/site-theme`
 * → `{ theme }`. The server renders it as `<html data-theme>`, so the first paint is already right.
 *
 * Caching: the answer is kept per isolate for THEME_FRESH_MS; after that the last answer keeps being
 * used while one background refresh runs (stale-while-revalidate), so a page never waits on the admin
 * API except on a cold isolate (THEME_TIMEOUT_MS at most). The admin API itself sends max-age=30, and
 * the subrequest is cached at the edge for as long. The theme is part of the HTML cache key
 * (src/lib/edge.ts), so a change in the admin reaches every page within about a minute, no deploy.
 *
 * Any failure renders DEFAULT_THEME (as the videos app does) and marks the page as a fallback, which
 * the HTML cache does not store. A theme package made in the admin's theme builder is not vendored
 * here (only the four built-in themes are), so it also renders the default.
 *
 * On QA, stage and local, `?theme=<id>` previews a built-in theme for that one request (the query
 * string keeps it out of the HTML cache). Production ignores it.
 */
import type { Config } from './env';
import { DEFAULT_THEME, THEME_CHROME, THEME_IDS, type ThemeId } from './site-themes.generated';

export { DEFAULT_THEME, THEME_CHROME, THEME_IDS, type ThemeId };

export const THEME_FRESH_MS = 30_000;
export const THEME_TIMEOUT_MS = 500;
const EDGE_TTL_SEC = 30;

/** The internal request header that carries the resolved theme from the Worker to Astro. */
export const THEME_HEADER = 'x-www-site-theme';
/** On a rendered page: where its theme came from (`fallback` pages are not stored in the HTML cache). */
export const THEME_SOURCE_HEADER = 'X-Site-Theme-Source';

export type ThemeSource = 'admin' | 'fallback' | 'preview';
export interface ResolvedTheme {
  id: ThemeId;
  source: ThemeSource;
}

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);

interface Entry {
  url: string;
  at: number;
  theme: ResolvedTheme;
  refreshing?: Promise<void>;
}
let memo: Entry | undefined;

/** Test hook. */
export function resetSiteThemeCache(): void {
  memo = undefined;
}

type Fetcher = (url: string, init: RequestInit & { cf?: Record<string, unknown> }) => Promise<Response>;

async function fetchTheme(url: string, fetcher: Fetcher): Promise<ResolvedTheme> {
  try {
    const res = await fetcher(url, {
      signal: AbortSignal.timeout(THEME_TIMEOUT_MS),
      headers: { accept: 'application/json' },
      cf: { cacheTtl: EDGE_TTL_SEC, cacheEverything: true },
    });
    if (!res.ok) return { id: DEFAULT_THEME, source: 'fallback' };
    const body = (await res.json()) as { theme?: unknown };
    return isThemeId(body.theme) ? { id: body.theme, source: 'admin' } : { id: DEFAULT_THEME, source: 'fallback' };
  } catch {
    return { id: DEFAULT_THEME, source: 'fallback' };
  }
}

/** The admin's theme, cached per isolate (see the file comment). */
export async function siteTheme(
  adminApiUrl: string,
  waitUntil: (p: Promise<unknown>) => void,
  fetcher: Fetcher = (u, i) => fetch(u, i as RequestInit),
  now: () => number = Date.now,
): Promise<ResolvedTheme> {
  if (!adminApiUrl) return { id: DEFAULT_THEME, source: 'fallback' };
  const url = `${adminApiUrl}/public/site-theme`;
  const entry = memo && memo.url === url ? memo : undefined;
  // A fallback is retried on the next request; a real answer is served stale while it refreshes.
  if (entry && entry.theme.source === 'admin') {
    if (now() - entry.at >= THEME_FRESH_MS && !entry.refreshing) {
      entry.refreshing = fetchTheme(url, fetcher).then((theme) => {
        // Keep the last real answer when the refresh fails; try again after another FRESH period
        memo = { url, at: now(), theme: theme.source === 'admin' ? theme : entry.theme };
      });
      waitUntil(entry.refreshing);
    }
    return entry.theme;
  }
  const theme = await fetchTheme(url, fetcher);
  memo = { url, at: now(), theme };
  return theme;
}

/** The theme for this request: a non-production `?theme=` preview, else the admin's. */
export async function resolveTheme(
  request: Request,
  cfg: Config,
  waitUntil: (p: Promise<unknown>) => void,
  fetcher?: Fetcher,
): Promise<ResolvedTheme> {
  if (!cfg.isProduction) {
    const preview = new URL(request.url).searchParams.get('theme');
    if (isThemeId(preview)) return { id: preview, source: 'preview' };
  }
  return siteTheme(cfg.adminApiUrl, waitUntil, fetcher);
}

/** The request Astro renders: the resolved theme in THEME_HEADER (a client's own value is replaced). */
export function withThemeHeader(request: Request, theme: ResolvedTheme): Request {
  const headers = new Headers(request.headers);
  headers.set(THEME_HEADER, `${theme.id};${theme.source}`);
  return new Request(request, { headers });
}

/** In Astro: the theme the Worker resolved (DEFAULT_THEME when rendered without it, e.g. `astro dev`). */
export function themeFromRequest(request: Request): ResolvedTheme {
  const [id, source] = (request.headers.get(THEME_HEADER) ?? '').split(';');
  if (isThemeId(id) && (source === 'admin' || source === 'fallback' || source === 'preview')) return { id, source };
  return { id: DEFAULT_THEME, source: 'fallback' };
}
