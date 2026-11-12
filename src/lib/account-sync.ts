/**
 * "If you are signed in, you are signed in": the browser-side decisions behind the header.
 * Pure functions (no DOM, no fetch) so they are unit-testable; src/scripts/site.ts wires them.
 *
 * Auth keeps the browser session on its own origin (host-only `__session`), so only the
 * page can ask it, with a credentialed fetch of `{AUTH}/session/accounts` (no session:
 * 200 `{"accounts":[]}`; older auth answered 401, mapped to signed-out):
 *  - www has no session and auth has an active account → silent sign-in (prompt=none)
 *  - www has a session for someone other than auth's active account (switched elsewhere)
 *    → silent sign-in once, to follow auth
 * Each silent sign-in is guarded in sessionStorage so a failure can never loop.
 */

export interface AuthAccount {
  userId: string;
  name: string | null;
  email: string | null;
  isActive: boolean;
}

export type AccountsResult =
  | { status: 'ok'; accounts: AuthAccount[] }
  /** 401: auth has no browser session */
  | { status: 'signed-out' }
  /** An unexpected answer (malformed body, 4xx): auth answered, so it counts as checked */
  | { status: 'unavailable' }
  /** Network error, timeout, 5xx or 429 (an auth hiccup): not an answer, ask again */
  | { status: 'error' };

/** Set when this tab already probed while anonymous; cleared whenever www is signed in. */
export const PROBE_KEY = 'aun_www_probed';
/** userId of the last "follow auth's active account" sign-in attempted in this tab. */
export const SYNC_KEY = 'aun_www_synced';

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Body of GET {AUTH}/session/accounts → accounts (active first), or null when malformed. */
export function parseAccounts(json: unknown): AuthAccount[] | null {
  if (!json || typeof json !== 'object' || !Array.isArray((json as { accounts?: unknown }).accounts)) return null;
  const seen = new Set<string>();
  const out: AuthAccount[] = [];
  let haveActive = false;
  for (const raw of (json as { accounts: unknown[] }).accounts) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const userId = str(r.userId, 200);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    const isActive = r.isActive === true && !haveActive;
    if (isActive) haveActive = true;
    out.push({ userId, name: str(r.name, 120), email: str(r.email, 200), isActive });
    if (out.length >= 20) break;
  }
  return out.sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

/** Maps the accounts fetch outcome (status + body) to an AccountsResult; status 0 = the fetch failed. */
export function accountsResult(status: number, body: unknown): AccountsResult {
  if (status === 401) return { status: 'signed-out' };
  if (isTransientStatus(status)) return { status: 'error' };
  if (status !== 200) return { status: 'unavailable' };
  const accounts = parseAccounts(body);
  return accounts ? { status: 'ok', accounts } : { status: 'unavailable' };
}

export const activeAccount = (r: AccountsResult): AuthAccount | null => (r.status === 'ok' ? (r.accounts.find((a) => a.isActive) ?? null) : null);

export function accountLabel(a: Pick<AuthAccount, 'name' | 'email' | 'userId'>): string {
  return a.name || a.email || a.userId;
}

/** Fetch auth's account list only when it can change something: signed in (menu) or not yet probed. */
export function shouldFetchAccounts(signedIn: boolean, probed: string | null, storageOk: boolean): boolean {
  if (signedIn) return true;
  // Without sessionStorage the loop guard cannot persist, so never probe
  return storageOk && !probed;
}

/**
 * Retrying the silent check (2026-11-12: one auth hiccup kept a signed-in tab signed out until it
 * was closed). A network error, a timeout, 5xx or 429 is not an answer: the check is retried after
 * PROBE_BACKOFF_MS, and the tab is marked checked (PROBE_KEY) only after a definitive answer
 * (signed in, or signed out per auth). Once the retries are used up, focus and "online" recheck,
 * at most PROBE_RECHECKS_MAX times per tab. A silent sign-in that failed on auth's side comes back
 * with the PROBE_RETRY_COOKIE; at most SILENT_ATTEMPTS_MAX silent round trips per tab.
 */
export const PROBE_BACKOFF_MS = [1000, 3000] as const;
export const PROBE_TIMEOUT_MS = 5000;
export const PROBE_RECHECKS_MAX = 5;
export const SILENT_ATTEMPTS_KEY = 'aun_www_silent_n';
export const SILENT_ATTEMPTS_MAX = 3;
export const PROBE_RETRY_COOKIE = 'aun_www_probe_retry';

/** status 0 = the fetch failed (network, timeout, CORS). */
export const isTransientStatus = (status: number) => status === 0 || status === 408 || status === 429 || status >= 500;

/** /auth/me's answer: signed in or out, or 'error' (no answer: network, timeout, 5xx). */
export type MeCheck = { signedIn: boolean } | 'error';

/** The check's outcome: a definitive answer, or 'retry' (not an answer yet). */
export function probeOutcome(me: MeCheck, accounts: AccountsResult): 'answer' | 'retry' {
  if (me === 'error') return 'retry';
  if (me.signedIn) return 'answer';
  return accounts.status === 'error' ? 'retry' : 'answer';
}

/** Another silent round trip in this tab? (count of the ones already made) */
export const mayTrySilent = (attempts: string | null) => (Number(attempts) || 0) < SILENT_ATTEMPTS_MAX;

export type Decision =
  | { action: 'stay' }
  /** Navigate to /auth/login?prompt=none; `guard` is the sessionStorage key/value to set first. */
  | { action: 'silent-login'; guard: { key: string; value: string } };

export interface DecisionInput {
  signedIn: boolean;
  /** www session subject (auth user id) */
  sub: string | null;
  accounts: AccountsResult;
  probed: string | null;
  synced: string | null;
  storageOk: boolean;
}

export function decide(i: DecisionInput): Decision {
  if (!i.storageOk) return { action: 'stay' };
  const active = activeAccount(i.accounts);
  if (!active) return { action: 'stay' };
  if (!i.signedIn) return i.probed ? { action: 'stay' } : { action: 'silent-login', guard: { key: PROBE_KEY, value: '1' } };
  if (i.sub && active.userId !== i.sub && i.synced !== active.userId) return { action: 'silent-login', guard: { key: SYNC_KEY, value: active.userId } };
  return { action: 'stay' };
}

/** www login route; prompt=none for silent sign-in, prompt=login for "Add another account". */
export function loginHref(returnPath: string, prompt?: 'none' | 'login'): string {
  const q = new URLSearchParams();
  if (prompt) q.set('prompt', prompt);
  q.set('return', returnPath);
  return `/auth/login?${q.toString()}`;
}

/** Accounts shown in the header menu: auth's list when available, else the www session alone. */
export function menuAccounts(
  accounts: AccountsResult,
  me: { sub?: string | null; name?: string | null; email?: string | null },
): { accounts: AuthAccount[]; fromAuth: boolean } {
  if (accounts.status === 'ok' && accounts.accounts.length) {
    const list = accounts.accounts;
    // www's own account is always shown as current, even if auth's active one differs
    // (the sync above re-signs in once; if that failed, the header still tells the truth)
    const current = me.sub && list.some((a) => a.userId === me.sub) ? me.sub : list.find((a) => a.isActive)?.userId;
    return { accounts: list.map((a) => ({ ...a, isActive: a.userId === current })).sort((a, b) => Number(b.isActive) - Number(a.isActive)), fromAuth: true };
  }
  return {
    accounts: [{ userId: me.sub || 'me', name: me.name ?? null, email: me.email ?? null, isActive: true }],
    fromAuth: false,
  };
}

export interface MeProfileView {
  displayName?: string | null;
  displayNameLocalized?: Partial<Record<string, string>> | null;
}

/**
 * The header's name for the signed-in account (owner's order, 2026-11-12): the profile's display
 * name in the page language, its plain display name (already first + last when that is all the
 * profile has), a name in the other language, auth's name for the user, and only then the email. Handles belong to channels, never to the user's name.
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

/**
 * Names of the accounts this browser signed in to www with, so the switcher can name the other
 * accounts too (www holds only the current account's session; auth's list has just emails).
 * localStorage `aun_www_names`: { [userId]: { en?, ar? } }, newest last, at most NAMES_MAX.
 */
export const NAMES_KEY = 'aun_www_names';
const NAMES_MAX = 10;
export type KnownNames = Record<string, Partial<Record<'en' | 'ar', string>>>;

export function parseKnownNames(raw: string | null): KnownNames {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: KnownNames = {};
    for (const [id, n] of Object.entries(v as Record<string, unknown>)) {
      if (!n || typeof n !== 'object') continue;
      const e: Partial<Record<'en' | 'ar', string>> = {};
      for (const l of ['en', 'ar'] as const) {
        const s = (n as Record<string, unknown>)[l];
        if (typeof s === 'string' && s.trim()) e[l] = s.trim().slice(0, 120);
      }
      if (e.en || e.ar) out[id] = e;
    }
    return out;
  } catch {
    return {};
  }
}

/** The signed-in account's names (only real names: never its email) merged into the store. */
export function rememberNames(known: KnownNames, me: Parameters<typeof displayLabel>[0]): KnownNames {
  if (!me.sub) return known;
  const entry: Partial<Record<'en' | 'ar', string>> = {};
  for (const l of ['en', 'ar'] as const) {
    const n = displayLabel(me, l);
    if (n && n !== me.email && n !== me.sub) entry[l] = n;
  }
  const rest = Object.entries(known).filter(([id]) => id !== me.sub);
  if (entry.en || entry.ar) rest.push([me.sub, entry]);
  return Object.fromEntries(rest.slice(-NAMES_MAX));
}

/** A switcher row's name: the remembered profile name in the page language, auth's name, else the email. */
export function rowLabel(a: Pick<AuthAccount, 'name' | 'email' | 'userId'>, known: KnownNames, locale: string): string {
  return known[a.userId]?.[locale as 'en' | 'ar'] || accountLabel(a);
}
