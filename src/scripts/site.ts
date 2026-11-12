/**
 * Site behaviour (the only JS besides the video facade):
 *  - Light / Dark / System menu (./theme.ts; the head script applies the saved choice)
 *  - language switch remembers the choice (aun_locale cookie, read by `/`)
 *  - account: fetch /auth/me and auth's account list ({AUTH}/session/accounts);
 *    signed in → name + disclosure menu listing every account in this browser (switch,
 *    add, sign out of one); signing out of one account or of all of them asks first in
 *    the in-app dialog (./confirm.ts); signed in to auth but not to www → silent sign-in
 *    (prompt=none, once per tab); anything failing → keep the "Sign in" link
 *  - video facades: swap in the iframe on click
 *  - search boxes: live suggestions and recent searches (./search-combobox.ts)
 * HTML is identical for every visitor (edge-cached); signed-in state is client-side only.
 */
import { confirmDialog, type ConfirmOptions } from './confirm';
import { initFacades } from './facade';
import { initSearchBoxes } from './search-combobox';
import { initTheme } from './theme';
import {
  PROBE_KEY,
  SYNC_KEY,
  accountLabel,
  accountsResult,
  decide,
  displayLabel,
  loginHref,
  menuAccounts,
  shouldFetchAccounts,
  type AccountsResult,
  type AuthAccount,
  type MeProfileView,
} from '../lib/account-sync';

interface Me {
  signedIn: boolean;
  sub?: string | null;
  name?: string | null;
  authName?: string | null;
  email?: string | null;
  canEditContent?: boolean;
  profile?: (MeProfileView & { avatarUrl?: string | null }) | null;
}

/**
 * The signed-in hint (src/lib/auth.ts SIGNED_IN_HINT): the head script set <html data-signed-in>
 * from it before first paint; /auth/me is the truth, so correct both here.
 */
const HINT = 'aun_www_si';
function setSignedIn(on: boolean) {
  const html = document.documentElement;
  if (on) html.setAttribute('data-signed-in', '');
  else html.removeAttribute('data-signed-in');
  const has = /(?:^|; )aun_www_si=1/.test(document.cookie);
  if (on === has) return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = on ? `${HINT}=1; Path=/; Max-Age=28800; SameSite=Lax${secure}` : `${HINT}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** sessionStorage that never throws (private mode, blocked storage → ok=false). */
const tabStore = (() => {
  let ok = false;
  try {
    sessionStorage.setItem('aun_www_t', '1');
    sessionStorage.removeItem('aun_www_t');
    ok = true;
  } catch {
    ok = false;
  }
  return {
    ok,
    get(key: string): string | null {
      try {
        return ok ? sessionStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        if (ok) sessionStorage.setItem(key, value);
      } catch {
        // ignore
      }
    },
    remove(key: string) {
      try {
        if (ok) sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
})();

const herePath = () => `${location.pathname}${location.search}`;
const fill = (template: string | undefined, name: string) => (template ?? '{name}').replace('{name}', name);

async function fetchAccounts(authUrl: string): Promise<AccountsResult> {
  try {
    const res = await fetch(`${authUrl}/session/accounts`, { credentials: 'include', headers: { Accept: 'application/json' } });
    const body: unknown = res.status === 200 ? await res.json().catch(() => null) : null;
    return accountsResult(res.status, body);
  } catch {
    // CORS (origin not allowed), offline, blocked: behave as before
    return { status: 'unavailable' };
  }
}

async function authCall(authUrl: string, path: string, init: RequestInit): Promise<boolean> {
  try {
    const res = await fetch(`${authUrl}${path}`, { credentials: 'include', ...init });
    return res.ok;
  } catch {
    return false;
  }
}

function rememberLocale() {
  document.querySelectorAll<HTMLAnchorElement>('[data-set-locale]').forEach((a) => {
    a.addEventListener('click', () => {
      const l = a.dataset.setLocale;
      if (l === 'en' || l === 'ar') document.cookie = `aun_locale=${l}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    });
  });
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

let menuAbort: AbortController | null = null;

function buildMenu(root: HTMLElement, me: Me, result: AccountsResult, focusButton = false) {
  menuAbort?.abort();
  menuAbort = new AbortController();
  const { signal } = menuAbort;
  const d = root.dataset;
  const authUrl = d.authUrl ?? '';
  const { accounts, fromAuth } = menuAccounts(result, me);
  const current = accounts.find((a) => a.isActive) ?? accounts[0]!;
  const name = displayLabel(me, d.locale ?? 'en') || accountLabel(current);
  const labelOf = (a: AuthAccount) => (a.isActive && (!me.sub || a.userId === me.sub) ? name : accountLabel(a));
  const button = el('button', { type: 'button', class: 'account-button', 'aria-expanded': 'false', 'aria-controls': 'account-menu' });
  const avatar = me.profile?.avatarUrl;
  if (avatar) {
    const img = el('img', { class: 'account-avatar', src: avatar, alt: '', width: '24', height: '24', decoding: 'async', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.remove(), { once: true });
    button.append(img);
  }
  const label = el('span', { class: 'account-label', dir: 'auto' }, name);
  button.append(el('span', { class: 'visually-hidden' }, `${d.labelMenu}: `), label);
  const caret = document.getElementById('caret-icon') as HTMLTemplateElement | null;
  if (caret) button.append(caret.content.cloneNode(true));

  const menu = el('ul', { class: 'account-menu', id: 'account-menu', hidden: '' });
  menu.append(el('li', { class: 'account-who' }, fill(d.labelSignedInAs, name)));

  const busy = (on: boolean) => menu.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = on));
  const silentSignIn = () => location.assign(loginHref(herePath(), 'none'));
  const signOutForm = el('form', { method: 'post', action: '/auth/logout' });

  const switchTo = async (a: AuthAccount) => {
    busy(true);
    const ok = await authCall(authUrl, '/session/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ userId: a.userId }),
    });
    if (!ok) return busy(false);
    // Guard: if the silent sign-in comes back without this account, do not retry on load
    tabStore.set(SYNC_KEY, a.userId);
    silentSignIn();
  };

  // The menu closes while the dialog is up; cancelling returns focus to the menu button
  const ask = async (options: ConfirmOptions) => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    const ok = await confirmDialog(options);
    if (!ok) button.focus();
    return ok;
  };

  const signOutOf = async (a: AuthAccount) => {
    const text = labelOf(a);
    const confirmed = await ask({
      title: fill(d.labelConfirmSignOutOfTitle, text),
      body: fill(d.labelConfirmSignOutOfBody, text),
      confirmLabel: d.labelSignOut ?? '',
    });
    if (!confirmed) return;
    // Last account: the normal single sign-out (auth /logout, every app's front channel)
    if (accounts.length <= 1) return signOutForm.submit();
    busy(true);
    const ok = await authCall(authUrl, `/session/accounts/${encodeURIComponent(a.userId)}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
    if (!ok) return busy(false);
    // www's own account went away: sign in silently as auth's new active account
    if (a.isActive) return silentSignIn();
    buildMenu(root, me, await fetchAccounts(authUrl), true);
    const btn = root.querySelector<HTMLButtonElement>('.account-button');
    btn?.click();
  };

  if (fromAuth) {
    const group = el('li', { class: 'account-group' });
    group.append(el('span', { class: 'account-group-label', id: 'account-list-label' }, d.labelAccounts ?? ''));
    const list = el('ul', { class: 'account-list', 'aria-labelledby': 'account-list-label' });
    for (const a of accounts) {
      const row = el('li', { class: 'account-row' });
      const text = labelOf(a);
      const who = el(a.isActive ? 'div' : 'button', a.isActive ? { class: 'account-entry', 'aria-current': 'true' } : { type: 'button', class: 'account-entry', 'aria-label': fill(d.labelSwitchTo, text) });
      who.append(el('span', { class: 'account-name', dir: 'auto' }, text));
      if (a.email && a.email !== text) who.append(el('span', { class: 'account-email', dir: 'auto' }, a.email));
      if (a.isActive) who.append(el('span', { class: 'account-current' }, d.labelCurrent ?? ''));
      else who.addEventListener('click', () => void switchTo(a));
      row.append(who);
      if (accounts.length > 1) {
        const out = el('button', { type: 'button', class: 'account-signout', 'aria-label': fill(d.labelSignOutOf, text) }, d.labelSignOut);
        out.addEventListener('click', () => void signOutOf(a));
        row.append(out);
      }
      list.append(row);
    }
    group.append(list);
    menu.append(group);
  }

  const link = (href: string | undefined, text: string | undefined, cls?: string) => {
    if (!href || !text) return;
    const li = el('li', cls ? { class: cls } : {});
    li.append(el('a', { href }, text));
    menu.append(li);
  };
  link(loginHref(herePath(), 'login'), d.labelAddAccount, 'account-add');
  link(d.profileUrl, d.labelProfile);
  link(d.videosUrl, d.labelVideos);
  if (me.canEditContent) link(d.cmsUrl, d.labelCms);
  const li = el('li');
  signOutForm.append(el('input', { type: 'hidden', name: 'locale', value: d.locale ?? 'en' }));
  signOutForm.append(el('button', { type: 'submit' }, accounts.length > 1 ? d.labelSignOutAll : d.labelSignOut));
  // Signing out of every account asks first; signing out of the only account does not
  if (accounts.length > 1) {
    signOutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      void ask({ title: d.labelConfirmSignOutAllTitle ?? '', body: d.labelConfirmSignOutAllBody ?? '', confirmLabel: d.labelSignOutAll ?? '' }).then((ok) => {
        if (ok) signOutForm.submit();
      });
    });
  }
  li.append(signOutForm);
  menu.append(li);

  const items = () => Array.from(menu.querySelectorAll<HTMLElement>('a, button:not([disabled])'));
  const open = (focusFirst: boolean) => {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    if (focusFirst) items()[0]?.focus();
  };
  const close = (focus: boolean) => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  };
  button.addEventListener('click', () => (menu.hidden ? open(false) : close(false)));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      open(true);
    }
  });
  menu.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      list[next]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      list[e.key === 'Home' ? 0 : list.length - 1]?.focus();
    }
  });
  document.addEventListener(
    'click',
    (e) => {
      if (!menu.hidden && !root.contains(e.target as Node)) close(false);
    },
    { signal },
  );
  root.addEventListener(
    'focusout',
    (e) => {
      if (!menu.hidden && e.relatedTarget && !root.contains(e.relatedTarget as Node)) close(false);
    },
    { signal },
  );

  root.replaceChildren(button, menu);
  if (focusButton) button.focus();
}

async function initAccount() {
  const root = document.getElementById('account');
  if (!root?.dataset.me) return;
  let me: Me = { signedIn: false };
  try {
    const res = await fetch(root.dataset.me, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (res.ok) me = (await res.json()) as Me;
  } catch {
    // treat as signed out
  }
  setSignedIn(me.signedIn);
  // Signed in now: if this session later ends (8 h), the next page may probe again
  if (me.signedIn) tabStore.remove(PROBE_KEY);
  const probed = tabStore.get(PROBE_KEY);
  const authUrl = root.dataset.authUrl;
  const accounts: AccountsResult =
    authUrl && shouldFetchAccounts(me.signedIn, probed, tabStore.ok) ? await fetchAccounts(authUrl) : { status: 'unavailable' };

  const decision = decide({ signedIn: me.signedIn, sub: me.sub ?? null, accounts, probed, synced: tabStore.get(SYNC_KEY), storageOk: tabStore.ok });
  if (decision.action === 'silent-login') {
    tabStore.set(decision.guard.key, decision.guard.value);
    location.assign(loginHref(herePath(), 'none'));
    return;
  }
  if (!me.signedIn) {
    // Probed (401, no active account, or unavailable): do not ask auth again in this tab
    tabStore.set(PROBE_KEY, '1');
    return;
  }
  if (accounts.status === 'ok' && accounts.accounts.some((a) => a.isActive && a.userId === me.sub)) tabStore.remove(SYNC_KEY);
  buildMenu(root, me, accounts);
}

rememberLocale();
initTheme();
initFacades();
initSearchBoxes();
void initAccount();
