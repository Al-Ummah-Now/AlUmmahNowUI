/**
 * Host → site (wiki AUN-SCHOLAR-SITES §5.2). The registry is api-videos
 * (`GET /api/sites/by-host/:host`, from the R2 host index and the site's settings.json):
 *   1. per-isolate memo (SITE_FRESH_MS), else
 *   2. api-videos (edge-cached 60 s by the subrequest), else
 *   3. the host's last good config in CONTENT_SNAPSHOT (`site-config:<host>`), so an outage still
 *      renders the site in its own theme. It never falls back to the platform theme or another site.
 * Unknown hosts are `not_found` (a bare 404, never cached by the Worker). Previews skip 1 and 3.
 */
import type { PublicSite } from './site-types';
import type { KVNamespace } from './env';

export const SITE_FRESH_MS = 60_000;
export const NOT_FOUND_FRESH_MS = 15_000;
export const SITE_TIMEOUT_MS = 2_500;
export const SNAPSHOT_PREFIX = 'site-config:';
/** The internal request header that carries the site from the Worker to Astro. */
export const SITE_HEADER = 'x-aun-site';

export type SiteLookup =
  | { kind: 'site'; site: PublicSite; source: 'api' | 'memo' | 'snapshot' }
  | { kind: 'redirect'; location: string }
  | { kind: 'not_found' }
  | { kind: 'unavailable' };

/** Lowercase, no port, no trailing dot; null when it is not a plausible hostname. */
export function normalizeHost(input: string | null | undefined): string | null {
  const host = String(input ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (host.length < 4 || host.length > 253) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) return null;
  return host;
}

export const isPreviewToken = (v: string | null | undefined): v is string => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);

interface Memo {
  at: number;
  result: SiteLookup;
  snapshotVersion?: number;
}
const memo = new Map<string, Memo>();
export function resetSiteMemo(): void {
  memo.clear();
}

export interface LookupDeps {
  apiUrl: string;
  kv?: KVNamespace;
  waitUntil: (p: Promise<unknown>) => void;
  fetchImpl?: (url: string, init: RequestInit & { cf?: Record<string, unknown> }) => Promise<Response>;
  now?: () => number;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

function isPublicSite(body: unknown): body is PublicSite {
  const b = body as PublicSite | null;
  return !!b && typeof b.host === 'string' && !!b.site && typeof b.site.channelId === 'string' && typeof b.site.themeRef === 'string' && Array.isArray(b.site.locales) && b.site.locales.length > 0 && !!b.channel;
}

export async function lookupSite(rawHost: string, preview: string | null, deps: LookupDeps): Promise<SiteLookup> {
  const host = normalizeHost(rawHost);
  if (!host) return { kind: 'not_found' };
  const now = deps.now ?? Date.now;
  const token = isPreviewToken(preview) ? preview : null;
  const cached = token ? undefined : memo.get(host);
  if (cached && now() - cached.at < (cached.result.kind === 'not_found' ? NOT_FOUND_FRESH_MS : SITE_FRESH_MS)) {
    return cached.result.kind === 'site' ? { ...cached.result, source: 'memo' } : cached.result;
  }
  const fetcher = deps.fetchImpl ?? ((u, i) => fetch(u, i as RequestInit));
  const url = `${deps.apiUrl}/api/sites/by-host/${encodeURIComponent(host)}${token ? `?preview=${token}` : ''}`;
  let result: SiteLookup | null = null;
  try {
    const res = await fetcher(url, {
      signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
      headers: { accept: 'application/json' },
      ...(token ? {} : { cf: { cacheTtl: 60, cacheEverything: true } }),
    });
    if (res.status === 404) result = { kind: 'not_found' };
    else if (res.ok) {
      const body = (await res.json()) as unknown;
      const redirect = (body as { redirectTo?: unknown } | null)?.redirectTo;
      if (typeof redirect === 'string' && /^https?:\/\//.test(redirect)) result = { kind: 'redirect', location: redirect };
      else if (isPublicSite(body)) result = { kind: 'site', site: body, source: 'api' };
    }
    if (!result) deps.log?.('sites: lookup answered badly', { host, status: res.status });
  } catch (error) {
    deps.log?.('sites: lookup failed', { host, error: String(error) });
  }
  if (token) return result ?? { kind: 'unavailable' };
  if (result) {
    const entry: Memo = { at: now(), result, snapshotVersion: cached?.snapshotVersion };
    // Keep the last good config for outages; one KV write per config version per isolate
    if (result.kind === 'site' && deps.kv && cached?.snapshotVersion !== result.site.site.configVersion) {
      entry.snapshotVersion = result.site.site.configVersion;
      deps.waitUntil(deps.kv.put(`${SNAPSHOT_PREFIX}${host}`, JSON.stringify(result.site)).catch(() => undefined));
    }
    memo.set(host, entry);
    return result;
  }
  // api-videos down: the last good config, else 503 (never another theme or site)
  try {
    const snap = (await deps.kv?.get(`${SNAPSHOT_PREFIX}${host}`, 'json')) as unknown;
    if (isPublicSite(snap)) return { kind: 'site', site: snap, source: 'snapshot' };
  } catch {
    // KV unreachable too
  }
  return { kind: 'unavailable' };
}

const enc = new TextEncoder();
const dec = new TextDecoder();
function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(value: string): Uint8Array {
  const s = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** The request Astro renders: the site in SITE_HEADER (a client's own value is always replaced). */
export function withSiteHeader(request: Request, site: PublicSite | null): Request {
  const headers = new Headers(request.headers);
  headers.delete(SITE_HEADER);
  if (site) headers.set(SITE_HEADER, b64url(enc.encode(JSON.stringify(site))));
  return new Request(request, { headers });
}

/** In Astro: the site the Worker resolved (null when rendered without one). */
export function siteFromRequest(request: Request): PublicSite | null {
  const raw = request.headers.get(SITE_HEADER);
  if (!raw) return null;
  try {
    const site = JSON.parse(dec.decode(fromB64url(raw))) as unknown;
    return isPublicSite(site) ? site : null;
  } catch {
    return null;
  }
}
