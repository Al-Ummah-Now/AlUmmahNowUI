/**
 * Site behaviour (the only JS besides the video facade):
 *  - language switch remembers the choice (aun_locale cookie, read by `/`)
 *  - account: fetch /auth/me; signed in → name + disclosure menu, else keep the "Sign in" link
 *  - video facades: swap in the iframe on click
 * HTML is identical for every visitor (edge-cached); signed-in state is client-side only.
 */
import { initFacades } from './facade';

interface Me {
  signedIn: boolean;
  name?: string | null;
  canEditContent?: boolean;
}

function rememberLocale() {
  document.querySelectorAll<HTMLAnchorElement>('[data-set-locale]').forEach((a) => {
    a.addEventListener('click', () => {
      const l = a.dataset.setLocale;
      if (l === 'en' || l === 'ar') document.cookie = `aun_locale=${l}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
    });
  });
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildMenu(root: HTMLElement, me: Me) {
  const d = root.dataset;
  const name = (me.name || '').trim() || '…';
  const button = el('button', { type: 'button', class: 'account-button', 'aria-expanded': 'false', 'aria-controls': 'account-menu' });
  const label = el('span', {}, name);
  button.append(el('span', { class: 'visually-hidden' }, `${d.labelMenu}: `), label);
  const caret = document.getElementById('caret-icon') as HTMLTemplateElement | null;
  if (caret) button.append(caret.content.cloneNode(true));

  const menu = el('ul', { class: 'account-menu', id: 'account-menu', hidden: '' });
  const who = el('li', { class: 'account-who' }, (d.labelSignedInAs ?? '{name}').replace('{name}', name));
  menu.append(who);
  const link = (href: string | undefined, text: string | undefined) => {
    if (!href || !text) return;
    const li = el('li');
    li.append(el('a', { href }, text));
    menu.append(li);
  };
  link(d.profileUrl, d.labelProfile);
  link(d.videosUrl, d.labelVideos);
  if (me.canEditContent) link(d.cmsUrl, d.labelCms);
  const li = el('li');
  const form = el('form', { method: 'post', action: '/auth/logout' });
  form.append(el('input', { type: 'hidden', name: 'locale', value: d.locale ?? 'en' }));
  form.append(el('button', { type: 'submit' }, d.labelSignOut));
  li.append(form);
  menu.append(li);

  const items = () => Array.from(menu.querySelectorAll<HTMLElement>('a, button'));
  const open = (focusFirst: boolean) => {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    if (focusFirst) items()[0]?.focus();
  };
  const close = (focusButton: boolean) => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
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
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !root.contains(e.target as Node)) close(false);
  });
  root.addEventListener('focusout', (e) => {
    if (!menu.hidden && e.relatedTarget && !root.contains(e.relatedTarget as Node)) close(false);
  });

  root.replaceChildren(button, menu);
}

async function initAccount() {
  const root = document.getElementById('account');
  if (!root?.dataset.me) return;
  try {
    const res = await fetch(root.dataset.me, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const me = (await res.json()) as Me;
    if (me.signedIn) buildMenu(root, me);
  } catch {
    // keep the Sign in link
  }
}

rememberLocale();
initFacades();
void initAccount();
