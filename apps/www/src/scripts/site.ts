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
 *  - the lantern street when the site theme switches it on (Fawanees; the shared module,
 *    vendored by scripts/sync-fanous.ts into ../lib/fanous-street.generated.js)
 * HTML is identical for every visitor (edge-cached); signed-in state is client-side only.
 */
import { confirmDialog, type ConfirmOptions } from './confirm';
import { initFacades } from './facade';
import { initSearchBoxes } from './search-combobox';
import { fitToViewport } from './menu-fit';
import { initTheme } from './theme';
import { startStreet } from '../../../../packages/render/src/themes/fanous-street.generated.js';
import {
  PROBE_KEY,
  SYNC_KEY,
  accountLabel,
  accountsResult,
  decide,
  mayTrySilent,
  probeOutcome,
  PROBE_BACKOFF_MS,
  PROBE_RECHECKS_MAX,
  PROBE_RETRY_COOKIE,
  PROBE_TIMEOUT_MS,
  SILENT_ATTEMPTS_KEY,
  type MeCheck,
  displayLabel,
  NAMES_KEY,
  parseKnownNames,
  rememberNames,
  rowLabel,
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

/** Remembered account names (../lib/account-sync.ts NAMES_KEY); storage may be blocked. */
function readKnownNames() {
  try {
    return parseKnownNames(localStorage.getItem(NAMES_KEY));
  } catch {
    return {};
  }
}
function writeKnownNames(v: ReturnType<typeof parseKnownNames>) {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}

const herePath = () => `${location.pathname}${location.search}`;
const fill = (template: string | undefined, name: string) => (template ?? '{name}').replace('{name}', name);

async function fetchAccounts(authUrl: string): Promise<AccountsResult> {
  try {
    const res = await fetch(`${authUrl}/session/accounts`, { credentials: 'include', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const body: unknown = res.status === 200 ? await res.json().catch(() => null) : null;
    return accountsResult(res.status, body);
  } catch {
    // Offline, timeout, blocked or CORS: no answer (status 0), asked again (account-sync.ts)
    return accountsResult(0, null);
  }
}

/** www's own session: signed in or out, or 'error' when there was no answer (network, timeout, 5xx). */
async function fetchMe(url: string): Promise<{ me: Me; check: MeCheck }> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!res.ok) return { me: { signedIn: false }, check: 'error' };
    const me = (await res.json()) as Me;
    return { me, check: { signedIn: !!me.signedIn } };
  } catch {
    return { me: { signedIn: false }, check: 'error' };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readCookie = (name: string) => document.cookie.split('; ').some((c) => c.startsWith(`${name}=`));
const clearCookie = (name: string) => {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
};

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

/**
 * An email that keeps its domain when it does not fit (AlUmmahNow docs/design/NAV.md): the local
 * part shrinks with an ellipsis, "@domain" stays whole, and the full address is the tooltip.
 */
function emailText(email: string, cls: string): HTMLSpanElement {
  const at = email.lastIndexOf('@');
  if (at <= 0) return el('span', { class: cls, dir: 'ltr', title: email }, email);
  const box = el('span', { class: `${cls} aun-email`, dir: 'ltr', title: email });
  box.append(el('span', { class: 'aun-email-local' }, email.slice(0, at)), el('span', { class: 'aun-email-domain' }, email.slice(at)));
  return box;
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
  const known = readKnownNames();
  const labelOf = (a: AuthAccount) => (a.isActive && (!me.sub || a.userId === me.sub) ? name : rowLabel(a, known, d.locale ?? 'en'));
  const button = el('button', { type: 'button', class: 'account-button aun-acct-btn', 'aria-expanded': 'false', 'aria-haspopup': 'menu', 'aria-controls': 'account-menu' });
  const avatar = me.profile?.avatarUrl;
  // Avatar: the photo, else the name's first letter (docs/design/NAV.md in AlUmmahNow)
  const avatarEl = (src: string | null | undefined, text: string, size = '') => {
    const letter = el('span', { class: `account-avatar aun-avatar ${size}`.trim(), 'aria-hidden': 'true' }, (Array.from(text.trim())[0] ?? '?').toUpperCase());
    if (!src) return letter;
    const img = el('img', { class: `account-avatar aun-avatar ${size}`.trim(), src, alt: '', width: '24', height: '24', decoding: 'async', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.replaceWith(letter), { once: true });
    return img;
  };
  button.append(avatarEl(avatar, name));
  const label = el('span', { class: 'account-label aun-acct-name', dir: 'auto' }, name);
  button.append(el('span', { class: 'visually-hidden' }, `${d.labelMenu}: `), label);
  const caret = document.getElementById('caret-icon') as HTMLTemplateElement | null;
  if (caret) {
    const svg = caret.content.cloneNode(true) as DocumentFragment;
    svg.querySelector('svg')?.classList.add('aun-caret');
    button.append(svg);
  }

  const menu = el('ul', { class: 'account-menu aun-menu', id: 'account-menu', hidden: '' });
  // Who: avatar, name and (when it differs) the email
  const whoLi = el('li', { class: 'account-who aun-menu-who' });
  const whoText = el('span', { class: 'aun-menu-who-text' });
  whoText.append(el('span', { class: 'aun-menu-who-name', dir: 'auto' }, name), el('span', { class: 'visually-hidden' }, fill(d.labelSignedInAs, name)));
  const email = me.email ?? current.email;
  if (email && email !== name) whoText.append(emailText(email, 'aun-menu-who-sub'));
  whoLi.append(avatarEl(avatar, name, 'aun-avatar--lg'), whoText);
  menu.append(whoLi);
  const sep = () => menu.append(el('li', { class: 'aun-menu-sep', role: 'separator' }));
  sep();

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

  const icon = (id: string) => (document.getElementById(id) as HTMLTemplateElement | null)?.content.cloneNode(true) ?? null;
  // More accounts (the Google pattern): the current account is the top of the menu; the others are
  // listed here, each with a sign-out icon button (AlUmmahNow docs/design/NAV.md)
  const others = fromAuth ? accounts.filter((a) => !(a.isActive && (!me.sub || a.userId === me.sub))) : [];
  if (others.length) {
    const group = el('li', { class: 'account-group' });
    group.append(el('span', { class: 'account-group-label aun-menu-label', id: 'account-list-label' }, d.labelMoreAccounts ?? d.labelAccounts ?? ''));
    const list = el('ul', { class: 'account-list', 'aria-labelledby': 'account-list-label' });
    for (const a of others) {
      const row = el('li', { class: 'account-row aun-acct-row' });
      const text = labelOf(a);
      const who = el('button', { type: 'button', class: 'account-entry aun-menu-item', 'aria-label': fill(d.labelSwitchTo, text) });
      const lines = el('span', { class: 'aun-acct-text' });
      lines.append(el('span', { class: 'account-name aun-acct-label', dir: 'auto' }, text));
      if (a.email && a.email !== text) lines.append(emailText(a.email, 'account-email aun-acct-email'));
      who.append(avatarEl(null, text), lines);
      who.addEventListener('click', () => void switchTo(a));
      row.append(who);
      const out = el('button', { type: 'button', class: 'account-signout aun-acct-signout', 'aria-label': fill(d.labelSignOutOf, text), title: fill(d.labelSignOutOf, text) });
      const svg = icon('signout-icon');
      if (svg) out.append(svg);
      out.addEventListener('click', () => void signOutOf(a));
      row.append(out);
      list.append(row);
    }
    group.append(list);
    menu.append(group);
  }

  const link = (href: string | undefined, text: string | undefined, cls?: string, parent: HTMLElement = menu, lead?: Node | null) => {
    if (!href || !text) return;
    const li = el('li', cls ? { class: cls } : {});
    const a = el('a', { href, class: 'aun-menu-item' });
    if (lead) a.append(lead);
    a.append(el('span', { class: 'aun-menu-text' }, text));
    li.append(a);
    parent.append(li);
  };
  /** An icon template as a menu-row icon (the shared .aun-menu-icon size and colour) */
  const menuIcon = (id: string) => {
    const frag = icon(id) as DocumentFragment | null;
    frag?.querySelector('svg')?.classList.add('aun-menu-icon');
    return frag;
  };
  // Each app's own favicon: a separate static file (never inlined in the CSS), loaded when the menu shows it
  const appIcon = (id: string) =>
    el('img', { class: 'aun-app-icon', 'data-app': id, src: `/aun-nav/icons/${id}.webp`, width: '32', height: '32', alt: '', loading: 'lazy', decoding: 'async' });
  link(loginHref(herePath(), 'login'), d.labelAddAccount, 'account-add', menu, icon('signin-icon'));
  // The other Al Ummah Now apps, in the shared order and labels (AlUmmahNow docs/design/NAV.md)
  sep();
  const apps = el('li', { class: 'account-apps' });
  apps.append(el('span', { class: 'aun-menu-label', id: 'account-apps-label' }, d.labelApps ?? ''));
  const appList = el('ul', { 'aria-labelledby': 'account-apps-label' });
  link(d.videosUrl, d.labelVideos, undefined, appList, appIcon('videos'));
  link(d.profileUrl, d.labelProfile, undefined, appList, appIcon('profile'));
  if (me.canEditContent) link(d.cmsUrl, d.labelCms, undefined, appList, appIcon('cms'));
  apps.append(appList);
  menu.append(apps);
  sep();
  // Sign out of this account; with several, "Sign out of all accounts" follows it
  const several = accounts.length > 1;
  if (several) {
    const one = el('li');
    const btn = el('button', { type: 'button', class: 'aun-menu-item' });
    btn.append(menuIcon('signout-icon') ?? '', el('span', { class: 'aun-menu-text' }, d.labelSignOut ?? ''));
    btn.addEventListener('click', () => void signOutOf(current));
    one.append(btn);
    menu.append(one);
  }
  const li = el('li');
  signOutForm.append(el('input', { type: 'hidden', name: 'locale', value: d.locale ?? 'en' }));
  const outAll = el('button', { type: 'submit', class: several ? 'aun-menu-item aun-menu-item--danger' : 'aun-menu-item' });
  outAll.append(menuIcon('signout-icon') ?? '', el('span', { class: 'aun-menu-text' }, (several ? d.labelSignOutAll : d.labelSignOut) ?? ''));
  signOutForm.append(outAll);
  // Signing out of every account asks first; signing out of the only account does not
  if (several) {
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
    fitToViewport(menu);
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

/** One check: www's session, then auth's accounts. 'retry' when either gave no answer. */
async function checkAccount(root: HTMLElement): Promise<'done' | 'retry'> {
  const { me, check } = await fetchMe(root.dataset.me!);
  // No answer from www itself: keep the page as it is (the head script's hint), ask again
  if (check === 'error') return 'retry';
  setSignedIn(me.signedIn);
  if (me.signedIn) writeKnownNames(rememberNames(readKnownNames(), me));
  // Signed in now: if this session later ends (8 h), the next page may probe again
  if (me.signedIn) {
    tabStore.remove(PROBE_KEY);
    tabStore.remove(SILENT_ATTEMPTS_KEY);
  }
  const probed = tabStore.get(PROBE_KEY);
  const authUrl = root.dataset.authUrl;
  const accounts: AccountsResult =
    authUrl && shouldFetchAccounts(me.signedIn, probed, tabStore.ok) ? await fetchAccounts(authUrl) : { status: 'unavailable' };

  if (me.signedIn) {
    // The menu shows now; a hiccup on auth's list only means the local account alone
    if (accounts.status === 'ok' && accounts.accounts.some((a) => a.isActive && a.userId === me.sub)) tabStore.remove(SYNC_KEY);
  }
  const decision = decide({ signedIn: me.signedIn, sub: me.sub ?? null, accounts, probed, synced: tabStore.get(SYNC_KEY), storageOk: tabStore.ok });
  if (decision.action === 'silent-login' && mayTrySilent(tabStore.get(SILENT_ATTEMPTS_KEY))) {
    tabStore.set(decision.guard.key, decision.guard.value);
    tabStore.set(SILENT_ATTEMPTS_KEY, String((Number(tabStore.get(SILENT_ATTEMPTS_KEY)) || 0) + 1));
    location.assign(loginHref(herePath(), 'none'));
    return 'done';
  }
  if (me.signedIn) {
    buildMenu(root, me, accounts);
    return 'done';
  }
  // Signed out on www, and auth gave no answer: not checked yet, ask again (never mark the tab)
  if (probeOutcome(check, accounts) === 'retry') return 'retry';
  // A definitive answer (signed out per auth, or auth's list without an active account): checked
  tabStore.set(PROBE_KEY, '1');
  return 'done';
}

let rechecks = 0;
let listening = false;
let checking = false;
async function initAccount(): Promise<void> {
  const root = document.getElementById('account');
  if (!root?.dataset.me || checking) return;
  checking = true;
  try {
    // A silent sign-in that failed on auth's side (callback): this tab has not really been checked
    if (readCookie(PROBE_RETRY_COOKIE)) {
      clearCookie(PROBE_RETRY_COOKIE);
      tabStore.remove(PROBE_KEY);
    }
    for (let attempt = 0; ; attempt++) {
      if ((await checkAccount(root)) === 'done') return;
      if (attempt >= PROBE_BACKOFF_MS.length) break;
      await sleep(PROBE_BACKOFF_MS[attempt]!);
    }
    // Still no answer: check again when the tab is back in view or the network returns
    if (!listening) {
      listening = true;
      const again = () => {
        if (document.visibilityState !== 'visible' || rechecks >= PROBE_RECHECKS_MAX) return;
        rechecks++;
        void initAccount();
      };
      addEventListener('online', again);
      addEventListener('focus', again);
      document.addEventListener('visibilitychange', again);
    }
  } finally {
    checking = false;
  }
}

rememberLocale();
initTheme();
initFacades();
initSearchBoxes();
startStreet();
void initAccount();
