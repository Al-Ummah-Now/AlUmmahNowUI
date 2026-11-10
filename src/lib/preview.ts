/**
 * Draft preview (CMS issue #9; CMS docs/PUBLIC_API.md "Preview API").
 *
 *   /preview?token=…        from the CMS editor: keep the token in an HttpOnly cookie for that one
 *                           row, 303 to a token-free URL (the token never stays in the address bar,
 *                           history, analytics, the sign-in `return`, or a Referer)
 *   /preview/{kind}/{id}    render the row with the cookie's token (CMS checks it on every render)
 *   /preview/invalid|expired  friendly pages for a broken or old link
 *
 * www never trusts the token: it only reads `k`, `id` and `exp` to name the cookie and set its
 * lifetime. Preview responses are `private, no-store, no-transform`, noindex, no Referer, and the
 * edge HTML cache never sees them (src/lib/edge.ts).
 */
import type { Page, Post } from './cms-types';
import { validate } from './cms-types';
import type { Config, WwwEnv } from './env';

export type PreviewKind = 'pages' | 'posts';
export interface PreviewClaims {
  k: PreviewKind;
  id: number;
  exp: number;
}

export const PREVIEW_PREFIX = '/preview';
export const PREVIEW_TIMEOUT_MS = 5_000;
const MAX_TOKEN = 512;

export const isPreviewPath = (pathname: string) => pathname === PREVIEW_PREFIX || pathname.startsWith(`${PREVIEW_PREFIX}/`);
export const isPreviewKind = (k: unknown): k is PreviewKind => k === 'pages' || k === 'posts';

/** The token's claims if it is well formed (signature NOT checked: that is the CMS's job). */
export function readClaims(token: string | null | undefined): PreviewClaims | null {
  if (!token || token.length > MAX_TOKEN) return null;
  const m = /^v1\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+$/.exec(token);
  if (!m) return null;
  try {
    const part = m[1] ?? '';
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4));
    const c = JSON.parse(json) as Partial<PreviewClaims>;
    if (!isPreviewKind(c.k) || !Number.isSafeInteger(c.id) || (c.id as number) <= 0 || typeof c.exp !== 'number') return null;
    return { k: c.k, id: c.id as number, exp: c.exp };
  } catch {
    return null;
  }
}

/** One cookie per row, so two previews in two tabs never collide. */
export const previewCookieName = (kind: PreviewKind, id: number) => `__Host-aun_preview_${kind}_${id}`;

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-transform',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

const see = (location: string, cookie?: string) => {
  const h = new Headers({ Location: location, ...NO_STORE });
  if (cookie) h.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers: h });
};

/** GET /preview?token=… → cookie + 303 /preview/{kind}/{id}; a broken or old link → its friendly page. */
export function enterPreview(url: URL, nowSec = Math.floor(Date.now() / 1000)): Response {
  const token = url.searchParams.get('token');
  const claims = readClaims(token);
  if (!claims) return see(`${PREVIEW_PREFIX}/invalid`);
  const left = Math.min(claims.exp - nowSec, 60 * 60);
  if (left <= 0) return see(`${PREVIEW_PREFIX}/expired`);
  const cookie = `${previewCookieName(claims.k, claims.id)}=${token}; Path=/; Max-Age=${left}; HttpOnly; Secure; SameSite=Lax`;
  return see(`${PREVIEW_PREFIX}/${claims.k}/${claims.id}`, cookie);
}

export type PreviewData =
  | { kind: 'page'; status: PreviewStatus; expiresAt: string; editUrl: string; content: Page }
  | { kind: 'post'; status: PreviewStatus; expiresAt: string; editUrl: string; content: Post };

/** `scheduled`: published in the CMS with a go-live time still ahead, so not on the site yet. */
export type PreviewStatus = 'draft' | 'scheduled' | 'published';
const STATUSES: readonly unknown[] = ['draft', 'scheduled', 'published'];

export type PreviewResult =
  | { state: 'ok'; data: PreviewData }
  /** no cookie (the link ran out, or was opened in another browser) or the CMS says expired */
  | { state: 'expired' }
  | { state: 'invalid' }
  /** the row was deleted */
  | { state: 'gone' }
  | { state: 'unavailable' };

export function parsePreview(kind: PreviewKind, body: unknown): PreviewData | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const want = kind === 'pages' ? 'page' : 'post';
  if (b.kind !== want || !STATUSES.includes(b.status) || typeof b.expires_at !== 'string' || typeof b.edit_url !== 'string') return null;
  const ok = kind === 'pages' ? validate.page(b.content) : validate.post(b.content);
  if (!ok) return null;
  return { kind: want, status: b.status, expiresAt: b.expires_at, editUrl: b.edit_url, content: b.content } as PreviewData;
}

export type FetchPreview = (path: string, token: string, signal: AbortSignal) => Promise<Response>;

/** The CMS preview API through the service binding (local dev: CMS_PUBLIC_URL). Never cached: subrequests
 * with an Authorization header bypass Cloudflare's cache, and the API answers private, no-store. */
export function previewFetcher(env: WwwEnv, cfg: Config): FetchPreview {
  const binding = cfg.appEnv === 'local' ? undefined : env.CMS;
  return (path, token, signal) => {
    const init = { signal, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } };
    return binding
      ? binding.fetch(new Request(`https://cms.internal/api/preview/v1${path}`, init))
      : fetch(`${cfg.cmsPublicUrl}/api/preview/v1${path}`, init);
  };
}

export async function loadPreview(fetchPreview: FetchPreview, kind: PreviewKind, id: number, token: string | null, timeoutMs = PREVIEW_TIMEOUT_MS): Promise<PreviewResult> {
  if (!token) return { state: 'expired' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchPreview(`/${kind}/${id}`, token, controller.signal);
    if (res.status === 401) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { state: body?.error === 'expired_token' ? 'expired' : 'invalid' };
    }
    if (res.status === 404) return { state: 'gone' };
    if (!res.ok) return { state: 'unavailable' };
    const data = parsePreview(kind, await res.json().catch(() => null));
    return data ? { state: 'ok', data } : { state: 'unavailable' };
  } catch {
    return { state: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

/** Whole minutes left (at least 1 while the link still works). */
export function minutesLeft(expiresAt: string, nowMs = Date.now()): number {
  const ms = Date.parse(expiresAt) - nowMs;
  return Number.isFinite(ms) ? Math.max(1, Math.ceil(ms / 60_000)) : 1;
}
