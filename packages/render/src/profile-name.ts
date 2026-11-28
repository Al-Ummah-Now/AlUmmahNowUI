/**
 * The signed-in user's name in the header, one source for www and the scholar sites: the user's
 * videos profile (AlUmmahNow shared-types `resolveDisplayName`), never only auth's account name,
 * which is the Latin name auth stores. Read once at sign-in with the user's access token
 * (fetchOwnProfile: the full view, incl. first/last name per language) and merged on every /auth/me
 * with the public profile (fetchProfile: fresh for 60 s); the page then picks the name in its own
 * language (displayLabel), so an Arabic page shows the Arabic name.
 */
import { normalizeImageUrl } from './images';
import { sanitizeLogError } from './urls.ts';

type Loc = 'en' | 'ar';
const LOCS: readonly Loc[] = ['en', 'ar'];

/** The user's own videos profile, read once at sign-in with their access token. */
export interface SessionProfile {
  /** The resolved name per language (resolveDisplayName). */
  names: Partial<Record<Loc, string>>;
  /** Any resolved name (English first). */
  name: string | null;
  avatarUrl: string | null;
}

/** The public profile fields the header shows (the videos site's profile, same record). */
export interface MeProfile {
  displayName: string | null;
  displayNameLocalized: Partial<Record<Loc, string>>;
  avatarUrl: string | null;
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const joinName = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ').trim().slice(0, 120) || null;
const locOf = (v: unknown, l: Loc) => (v && typeof v === 'object' ? str((v as Record<string, unknown>)[l], 120) : null);

/**
 * The name a user is shown by, the platform's one rule (AlUmmahNow shared-types
 * `resolveDisplayName`, owner rule 2026-11-12): the display name in `locale`, the plain display
 * name, first + last name (in `locale` when localized, else the plain ones), then a name in the
 * other language. Never the email (the caller falls back to it) and never a handle (handles
 * belong to channels). '' when the profile has no name.
 */
export function resolveDisplayName(p: Record<string, unknown>, locale: Loc): string {
  const full = (l: Loc | null) =>
    joinName(l ? locOf(p.firstNameLocalized, l) : str(p.firstName, 60), l ? locOf(p.lastNameLocalized, l) : str(p.lastName, 60));
  const other: Loc = locale === 'en' ? 'ar' : 'en';
  return (
    locOf(p.displayNameLocalized, locale) ??
    str(p.displayName, 120) ??
    full(locale) ??
    full(null) ??
    locOf(p.displayNameLocalized, other) ??
    full(other) ??
    ''
  );
}

/** The user's own profile as a session keeps it: the resolved name per language, and the avatar. */
export function profileNames(p: Record<string, unknown>): SessionProfile {
  const names: SessionProfile['names'] = {};
  for (const l of LOCS) {
    const n = resolveDisplayName(p, l);
    if (n) names[l] = n;
  }
  return { names, name: names.en ?? names.ar ?? null, avatarUrl: normalizeImageUrl(str(p.avatarUrl, 500)) };
}

/** GET {VIDEOS_API}/api/profile with the user's access token (the full view, incl. first/last name). */
export async function fetchOwnProfile(accessToken: string, cfg: { videosApiUrl: string }, fetchImpl: typeof fetch = fetch): Promise<SessionProfile | null> {
  try {
    const res = await fetchImpl(`${cfg.videosApiUrl}/api/profile`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ msg: 'sign-in: own profile unavailable', status: res.status }));
      return null;
    }
    const body = (await res.json()) as { result?: { profile?: unknown } } | null;
    const p = body?.result?.profile;
    return p && typeof p === 'object' ? profileNames(p as Record<string, unknown>) : null;
  } catch (error) {
    console.warn(JSON.stringify({ msg: 'sign-in: own profile failed', error: sanitizeLogError(error) }));
    return null;
  }
}

/**
 * The signed-in user's public profile from the videos API (GET /api/profiles/:id, public; the
 * profile id is the auth user id). Short edge cache and timeout: the header falls back to the
 * session's name/email when the profile is missing or slow.
 */
export async function fetchProfile(sub: string, cfg: { videosApiUrl: string }, fetchImpl: typeof fetch = fetch): Promise<MeProfile | null> {
  try {
    const init: RequestInit & { cf?: Record<string, unknown> } = {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(1500),
      cf: { cacheTtl: 60, cacheEverything: true },
    };
    const res = await fetchImpl(`${cfg.videosApiUrl}/api/profiles/${encodeURIComponent(sub)}`, init);
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: { profile?: Record<string, unknown> } } | null;
    const p = body?.result?.profile;
    if (!p || typeof p !== 'object') return null;
    const loc = (p.displayNameLocalized ?? {}) as Record<string, unknown>;
    const displayNameLocalized: MeProfile['displayNameLocalized'] = {};
    for (const l of LOCS) {
      const v = str(loc[l], 120);
      if (v) displayNameLocalized[l] = v;
    }
    return {
      displayName: str(p.displayName, 120) ?? str(p.resolvedDisplayName, 120),
      displayNameLocalized,
      avatarUrl: normalizeImageUrl(str(p.avatarUrl, 500)),
    };
  } catch {
    return null;
  }
}

/**
 * The header's profile: the public view is fresh (60 s) but has no first/last name; the session
 * has the names from sign-in. Public values win when set (a display name or avatar changed since).
 */
export function mergeProfile(own: SessionProfile | null, pub: MeProfile | null): MeProfile | null {
  if (!own && !pub) return null;
  const displayNameLocalized: MeProfile['displayNameLocalized'] = {};
  for (const l of LOCS) {
    const n = pub?.displayNameLocalized[l] ?? own?.names[l];
    if (n) displayNameLocalized[l] = n;
  }
  return {
    displayName: pub?.displayName ?? own?.name ?? null,
    displayNameLocalized,
    avatarUrl: pub?.avatarUrl ?? own?.avatarUrl ?? null,
  };
}

export interface MeProfileView {
  displayName?: string | null;
  displayNameLocalized?: Partial<Record<string, string>> | null;
}

/**
 * The header's name for the signed-in account (owner's order, 2026-11-12): the profile's display
 * name in the page language, its plain display name (already first + last when that is all the
 * profile has), a name in the other language, auth's name for the user, and only then the email.
 * Handles belong to channels, never to the user's name.
 */
export function displayLabel(
  me: { name?: string | null; email?: string | null; sub?: string | null; profile?: MeProfileView | null },
  locale: string,
): string {
  const p = me.profile ?? {};
  const other = locale === 'ar' ? 'en' : 'ar';
  // auth's own name for the user (a name, never a handle); /auth/me sends the email in `name` when there is none
  const authName = me.name && me.name !== me.email ? me.name : null;
  const pick = [p.displayNameLocalized?.[locale], p.displayName, p.displayNameLocalized?.[other], authName, me.email, me.sub];
  for (const v of pick) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
}
