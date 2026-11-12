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
  /** CORS, network, 5xx or an unexpected body: behave as before (plain "Sign in" / local menu) */
  | { status: 'unavailable' };

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

/** Maps the accounts fetch outcome (status + body) to an AccountsResult. */
export function accountsResult(status: number, body: unknown): AccountsResult {
  if (status === 401) return { status: 'signed-out' };
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
  handle?: string | null;
}

/**
 * The header's name for the signed-in account, as the videos site shows it: the profile's
 * display name in the page language, its plain display name, the other language's, the name
 * auth has, the @handle, and only then the email.
 */
export function displayLabel(
  me: { authName?: string | null; name?: string | null; email?: string | null; sub?: string | null; profile?: MeProfileView | null },
  locale: string,
): string {
  const p = me.profile ?? {};
  const loc = p.displayNameLocalized ?? {};
  const other = locale === 'ar' ? 'en' : 'ar';
  const authName = me.authName !== undefined ? me.authName : me.name && me.name !== me.email ? me.name : null;
  const pick = [loc[locale], p.displayName, loc[other], authName, p.handle ? `@${p.handle}` : null, me.email, me.name, me.sub];
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

/** A switcher row's name: a remembered profile name in the page language, auth's name, the email. */
export function rowLabel(a: Pick<AuthAccount, 'name' | 'email' | 'userId'>, known: KnownNames, locale: string): string {
  const k = known[a.userId];
  const other = locale === 'ar' ? 'en' : 'ar';
  return k?.[locale as 'en' | 'ar'] || k?.[other] || accountLabel(a);
}
