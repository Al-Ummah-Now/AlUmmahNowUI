/**
 * Continue watching on the www home (AlUmmahNowUI#4): the signed-in viewer's started, unfinished
 * videos, newest first, from the videos API (`GET /api/continue-watching`, the same list the native
 * apps use; deleted, hidden and private videos are left out there). Hidden while their watch history
 * is paused (`GET /api/watch-history/settings`), like the videos site's shelf.
 *
 * The home HTML stays the same for everyone (edge-cached): the row is fetched by the browser from
 * `GET /auth/continue-watching?locale=` (private, no-store), which reads the sealed session, refreshes
 * the 15-minute access token when needed (re-sealing the cookie with the rotated refresh token) and
 * answers display-ready items. Any failure is "no row", never an error on the page.
 */
import { accessExpiry, cookie, refreshRequestBody, sessionFromAccessToken, SESSION_COOKIE, SESSION_VERSION, type Session } from './auth';
import type { AuthDeps } from './auth-routes';
import { readSession } from './auth-routes';
import { watchUrl, VIDEO_ID } from './embeds';
import { stableImageUrl } from './images';
import { isLocale, type Locale } from './locale';
import { seal } from './session';

export const CONTINUE_LIMIT = 10;
/** Refresh this many seconds before the access token expires. */
const REFRESH_EARLY_SEC = 60;
const TIMEOUT_MS = 2500;

export interface ContinueItem {
  id: string;
  title: string;
  /** Watch page on the videos site (the player resumes from the saved position). */
  href: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  durationSeconds: number | null;
  /** 0–100 */
  percent: number;
}

const json = (body: unknown, status = 200, cookies: string[] = []) => {
  const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' });
  for (const c of cookies) h.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers: h });
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** `/api/continue-watching` items → display items (anything malformed is dropped). Pure. */
export function toContinueItems(body: unknown, locale: Locale, videosWebUrl: string): ContinueItem[] {
  const items = isObj(body) && Array.isArray(body.items) ? body.items : [];
  const out: ContinueItem[] = [];
  for (const it of items) {
    if (!isObj(it) || !isObj(it.video)) continue;
    const v = it.video;
    const id = str(v.id, 64) ?? str(it.videoId, 64);
    const title = str(v.title);
    if (!id || !VIDEO_ID.test(id) || !title) continue;
    const names = isObj(v.channelNameLocalized) ? v.channelNameLocalized : {};
    const duration = typeof v.duration === 'number' && v.duration > 0 ? Math.round(v.duration) : null;
    const pct = typeof it.percentageWatched === 'number' && Number.isFinite(it.percentageWatched) ? it.percentageWatched : 0;
    const thumb = typeof v.thumbnailUrl === 'string' && /^https:\/\//.test(v.thumbnailUrl) ? v.thumbnailUrl : null;
    out.push({
      id,
      title,
      href: watchUrl(videosWebUrl, { kind: 'video', id, lang: locale }),
      thumbnailUrl: stableImageUrl(videosWebUrl, thumb) ?? null,
      channelName: str(names[locale], 120) ?? str(v.channelName, 120),
      durationSeconds: duration,
      percent: Math.min(100, Math.max(0, Math.round(pct))),
    });
    if (out.length >= CONTINUE_LIMIT) break;
  }
  return out;
}

type Fresh = { access: string; session: Session; refreshed: boolean };

/**
 * A usable access token for the session: the stored one while it has a minute left, else a new one
 * from the refresh token (same user only). Null when there is none (an older session, revoked or
 * expired refresh token, auth unreachable).
 */
export async function freshAccess(s: Session, deps: AuthDeps): Promise<Fresh | null> {
  const tok = s.tok;
  if (!tok?.access) return null;
  const nowSec = Math.floor((deps.now?.() ?? Date.now()) / 1000);
  if (tok.accessExp - REFRESH_EARLY_SEC > nowSec) return { access: tok.access, session: s, refreshed: false };
  if (!tok.refresh) return null;
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${deps.cfg.authUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: refreshRequestBody(deps.cfg, tok.refresh).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ msg: 'continue watching: refresh refused', status: res.status }));
      return null;
    }
    const body = (await res.json()) as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== 'string' || !body.access_token) return null;
    // The same user only (a refresh answer is verified like a sign-in's: signature, iss, exp)
    const fields = await (deps.verify ?? ((t: string) => sessionFromAccessToken(t, deps.cfg)))(body.access_token);
    if (fields.sub !== s.sub) return null;
    const session: Session = {
      ...s,
      tok: {
        access: body.access_token,
        accessExp: accessExpiry(body.access_token, body.expires_in, nowSec),
        refresh: typeof body.refresh_token === 'string' && body.refresh_token ? body.refresh_token : tok.refresh,
      },
    };
    return { access: body.access_token, session, refreshed: true };
  } catch (error) {
    console.warn(JSON.stringify({ msg: 'continue watching: refresh failed', error: String(error) }));
    return null;
  }
}

/** GET /auth/continue-watching?locale=en|ar */
export async function continueWatching(request: Request, deps: AuthDeps): Promise<Response> {
  const l = new URL(request.url).searchParams.get('locale');
  const locale: Locale = isLocale(l) ? l : 'en';
  const s = await readSession(request, deps.secret);
  if (!s || s.v !== SESSION_VERSION) return json({ signedIn: false, items: [] }, 401);
  const fresh = await freshAccess(s, deps);
  if (!fresh) return json({ signedIn: true, items: [] }, 401);
  const cookies: string[] = [];
  if (fresh.refreshed && deps.secret) {
    const nowSec = Math.floor((deps.now?.() ?? Date.now()) / 1000);
    cookies.push(cookie(SESSION_COOKIE, await seal(deps.secret, { ...fresh.session }), Math.max(0, s.exp - nowSec)));
  }
  const api = deps.cfg.videosApiUrl;
  const headers = { Accept: 'application/json', Authorization: `Bearer ${fresh.access}` };
  const get = (path: string) => (deps.fetchImpl ?? fetch)(`${api}${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  try {
    const [list, settings] = await Promise.all([get(`/api/continue-watching?limit=${CONTINUE_LIMIT}`), get('/api/watch-history/settings').catch(() => null)]);
    if (!list.ok) {
      console.warn(JSON.stringify({ msg: 'continue watching: list failed', status: list.status }));
      return json({ signedIn: true, items: [] }, list.status === 401 ? 401 : 502, cookies);
    }
    // Paused history: no row (the videos site hides its shelf too). Unknown settings: show the row.
    const paused = settings?.ok ? ((await settings.json().catch(() => null)) as { paused?: unknown } | null)?.paused === true : false;
    const items = paused ? [] : toContinueItems(await list.json().catch(() => null), locale, deps.cfg.videosWebUrl);
    return json({ signedIn: true, items }, 200, cookies);
  } catch (error) {
    console.warn(JSON.stringify({ msg: 'continue watching: failed', error: String(error) }));
    return json({ signedIn: true, items: [] }, 502, cookies);
  }
}
