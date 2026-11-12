import { describe, expect, it } from 'vitest';
import {
  displayLabel,
  parseKnownNames,
  rememberNames,
  rowLabel,
  PROBE_KEY,
  SYNC_KEY,
  accountLabel,
  accountsResult,
  decide,
  loginHref,
  menuAccounts,
  parseAccounts,
  shouldFetchAccounts,
  type AccountsResult,
  type DecisionInput,
} from '../src/lib/account-sync';

const body = {
  accounts: [
    { userId: 'u2', isActive: false, email: 'b@x', name: 'Bilal', lastUsed: 1, authenticatedAt: 1 },
    { userId: 'u1', isActive: true, email: 'a@x', name: 'Amina', lastUsed: 2, authenticatedAt: 2 },
  ],
};
const ok = accountsResult(200, body);

describe('accounts mapping', () => {
  it('maps auth /session/accounts to name/email/active, active first', () => {
    expect(parseAccounts(body)).toEqual([
      { userId: 'u1', name: 'Amina', email: 'a@x', isActive: true },
      { userId: 'u2', name: 'Bilal', email: 'b@x', isActive: false },
    ]);
  });
  it('drops malformed entries and duplicates, keeps one active, tolerates missing name/email', () => {
    expect(
      parseAccounts({ accounts: [null, { userId: '' }, { userId: 'u1', isActive: true, name: '  ' }, { userId: 'u1' }, { userId: 'u3', isActive: true, email: 'c@x' }, 'x'] }),
    ).toEqual([
      { userId: 'u1', name: null, email: null, isActive: true },
      { userId: 'u3', name: null, email: 'c@x', isActive: false },
    ]);
  });
  it('a non-list body is null', () => {
    expect(parseAccounts(null)).toBeNull();
    expect(parseAccounts({ error: 'x' })).toBeNull();
    expect(parseAccounts([])).toBeNull();
  });
  it('status mapping: 200 ok, 401 signed-out, anything else unavailable', () => {
    expect(ok.status).toBe('ok');
    expect(accountsResult(401, null)).toEqual({ status: 'signed-out' });
    expect(accountsResult(500, null)).toEqual({ status: 'unavailable' });
    expect(accountsResult(200, 'garbage')).toEqual({ status: 'unavailable' });
  });
  it('label falls back name → email → id', () => {
    expect(accountLabel({ userId: 'u', name: 'N', email: 'e' })).toBe('N');
    expect(accountLabel({ userId: 'u', name: null, email: 'e' })).toBe('e');
    expect(accountLabel({ userId: 'u', name: null, email: null })).toBe('u');
  });
  it('menu: every account from auth, www session marked current', () => {
    expect(menuAccounts(ok, { sub: 'u1' })).toEqual({
      fromAuth: true,
      accounts: [
        { userId: 'u1', name: 'Amina', email: 'a@x', isActive: true },
        { userId: 'u2', name: 'Bilal', email: 'b@x', isActive: false },
      ],
    });
    // www still holds u2 (silent follow failed): the header shows what www is signed in as
    expect(menuAccounts(ok, { sub: 'u2' }).accounts.map((a) => [a.userId, a.isActive])).toEqual([
      ['u2', true],
      ['u1', false],
    ]);
  });
  it('menu: accounts unavailable (CORS/401/network) → the www session alone', () => {
    for (const r of [{ status: 'unavailable' }, { status: 'signed-out' }, { status: 'ok', accounts: [] }] as AccountsResult[]) {
      expect(menuAccounts(r, { sub: 'u1', name: 'Amina', email: 'a@x' })).toEqual({
        fromAuth: false,
        accounts: [{ userId: 'u1', name: 'Amina', email: 'a@x', isActive: true }],
      });
    }
  });
});

describe('probe decision', () => {
  const base: DecisionInput = { signedIn: false, sub: null, accounts: ok, probed: null, synced: null, storageOk: true };

  it('fetches accounts when signed in (menu) or not yet probed; never without sessionStorage while anonymous', () => {
    expect(shouldFetchAccounts(true, '1', false)).toBe(true);
    expect(shouldFetchAccounts(false, null, true)).toBe(true);
    expect(shouldFetchAccounts(false, '1', true)).toBe(false);
    expect(shouldFetchAccounts(false, null, false)).toBe(false);
  });
  it('anonymous + active account in auth → silent sign-in, guarded by the probe flag', () => {
    expect(decide(base)).toEqual({ action: 'silent-login', guard: { key: PROBE_KEY, value: '1' } });
  });
  it('loop guard: already probed in this tab → stay', () => {
    expect(decide({ ...base, probed: '1' })).toEqual({ action: 'stay' });
  });
  it('no auth session (401), no active account, or accounts unavailable → stay anonymous', () => {
    expect(decide({ ...base, accounts: { status: 'signed-out' } })).toEqual({ action: 'stay' });
    expect(decide({ ...base, accounts: { status: 'unavailable' } })).toEqual({ action: 'stay' });
    // Auth answers an anonymous browser 200 {"accounts":[]} (no failed request in the console)
    expect(decide({ ...base, accounts: accountsResult(200, { accounts: [] }) })).toEqual({ action: 'stay' });
    expect(decide({ ...base, accounts: accountsResult(200, { accounts: [{ userId: 'u1', isActive: false }] }) })).toEqual({ action: 'stay' });
  });
  it('no sessionStorage → never navigates (guard could not persist)', () => {
    expect(decide({ ...base, storageOk: false })).toEqual({ action: 'stay' });
  });
  it('signed in as auth active account → stay', () => {
    expect(decide({ ...base, signedIn: true, sub: 'u1' })).toEqual({ action: 'stay' });
  });
  it('signed in as someone else (switched in another app) → follow once, then stay', () => {
    expect(decide({ ...base, signedIn: true, sub: 'u2' })).toEqual({ action: 'silent-login', guard: { key: SYNC_KEY, value: 'u1' } });
    expect(decide({ ...base, signedIn: true, sub: 'u2', synced: 'u1' })).toEqual({ action: 'stay' });
  });
  it('signed in but auth has no session (front channel will sign www out) → stay', () => {
    expect(decide({ ...base, signedIn: true, sub: 'u1', accounts: { status: 'signed-out' } })).toEqual({ action: 'stay' });
  });
});

describe('login links', () => {
  it('silent, add-account and plain', () => {
    expect(loginHref('/ar/articles/?page=2', 'none')).toBe('/auth/login?prompt=none&return=%2Far%2Farticles%2F%3Fpage%3D2');
    expect(loginHref('/en/', 'login')).toBe('/auth/login?prompt=login&return=%2Fen%2F');
    expect(loginHref('/en/')).toBe('/auth/login?return=%2Fen%2F');
  });
});

describe('header name', () => {
  const email = 'meywd@msn.com';
  it('the display name in the page language, then the plain one, then the other language', () => {
    const profile = { displayName: 'Mahmoud', displayNameLocalized: { en: 'Mahmoud', ar: 'محمود' } };
    expect(displayLabel({ email, name: email, profile }, 'ar')).toBe('محمود');
    expect(displayLabel({ email, name: email, profile }, 'en')).toBe('Mahmoud');
    expect(displayLabel({ email, profile: { displayName: 'Plain', displayNameLocalized: { en: 'English' } } }, 'ar')).toBe('Plain');
    expect(displayLabel({ email, profile: { displayNameLocalized: { en: 'Mahmoud' } } }, 'ar')).toBe('Mahmoud');
  });
  it('the email only when the profile has no name; never a handle', () => {
    expect(displayLabel({ email, name: email, profile: { displayName: '' } }, 'ar')).toBe(email);
    expect(displayLabel({ email, name: email, profile: null }, 'en')).toBe(email);
    expect(displayLabel({ email, name: email, profile: { handle: 'meywd' } as never }, 'en')).toBe(email);
  });
});

describe('switcher names', () => {
  const owner = { sub: 'u1', email: 'meywd@msn.com', profile: { displayName: 'Mahmoud Darwish', displayNameLocalized: { en: 'Mahmoud Darwish' } } };
  it('remembers real names only, never the email', () => {
    const k = rememberNames({}, owner);
    expect(k).toEqual({ u1: { en: 'Mahmoud Darwish', ar: 'Mahmoud Darwish' } });
    expect(rememberNames({}, { sub: 'u2', email: 'x@y', name: 'x@y', profile: null })).toEqual({});
  });
  it('rows: the remembered name in the page language, else the email', () => {
    const k = { u2: { en: 'Test', ar: 'تجربة' } };
    expect(rowLabel({ userId: 'u2', email: 't@x' }, k, 'ar')).toBe('تجربة');
    expect(rowLabel({ userId: 'u4', email: 't@x' }, k, 'en')).toBe('t@x');
  });
  it('a bad or oversized store is safe', () => {
    expect(parseKnownNames('nope')).toEqual({});
    expect(parseKnownNames('[1]')).toEqual({});
    let k = {};
    for (let i = 0; i < 15; i++) k = rememberNames(k, { sub: `u${i}`, email: 'e', profile: { displayName: `N${i}` } });
    expect(Object.keys(k)).toHaveLength(10);
    expect(Object.keys(k).at(-1)).toBe('u14');
  });
});
