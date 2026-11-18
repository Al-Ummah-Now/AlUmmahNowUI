/**
 * Every page: the Light/Dark toggle (saved per device, as on www) and the header's account state.
 * HTML is cached and identical for everyone, so the header asks /auth/me (which also re-checks a
 * session older than 5 minutes with auth: a sign-out elsewhere ends it here). Signed in, the account
 * button (avatar, name, caret) opens the account menu, a disclosure like www's (AlUmmahNow
 * docs/design/NAV.md "Account menu"): who, the Al Ummah Now apps, Sign out.
 */
import { fitToViewport } from '../../../../packages/render/src/menu-fit';
import { displayLabel, type MeProfileView } from '../../../../packages/render/src/profile-name';

const root = document.documentElement;

function currentMode(): 'light' | 'dark' {
  const set = root.getAttribute('data-mode');
  if (set === 'light' || set === 'dark') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncToggle(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-mode-toggle]');
  if (!btn) return;
  const mode = currentMode();
  const label = (mode === 'dark' ? btn.dataset.labelLight : btn.dataset.labelDark) ?? '';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.dataset.current = mode;
}

document.querySelector('[data-mode-toggle]')?.addEventListener('click', () => {
  const next = currentMode() === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-mode', next);
  try {
    localStorage.setItem('aun_mode', next);
  } catch {
    // private mode: the choice lasts for this page
  }
  syncToggle();
});
syncToggle();

/**
 * The site's name is never shown cut ("الشي…"): when the wordmark doesn't fit whole beside the tools
 * (a phone with Sign in, or a long name), the bar shows the logo alone, as the shared header does
 * below 400px, and the name stays the link's accessible name. Re-checked when the bar or its tools
 * change size (the account button replacing Sign in, a rotation) and once the fonts are in.
 */
function fitBrand(): void {
  const brand = document.querySelector<HTMLElement>('.site-header .aun-brand');
  const name = brand?.querySelector<HTMLElement>('.aun-brand-name');
  if (!brand || !name) return;
  const check = () => {
    brand.classList.remove('site-brand-mark-only');
    brand.classList.toggle('site-brand-mark-only', name.scrollWidth > name.clientWidth + 1);
  };
  check();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(check);
    for (const el of document.querySelectorAll<HTMLElement>('.site-header .aun-header-row, .site-header .aun-header-tools')) ro.observe(el);
  }
  void document.fonts?.ready.then(check);
}
fitBrand();

/** Name and email of this browser's session, on the button and in the menu's "who" row. */
function fillAccount(name: string, email: string | null): void {
  const shown = name || email || '';
  document.querySelectorAll<HTMLElement>('[data-account-name]').forEach((el) => (el.textContent = shown));
  document.querySelectorAll<HTMLElement>('[data-account-initial]').forEach((el) => (el.textContent = (Array.from(shown.trim())[0] ?? '?').toUpperCase()));
  const signedInAs = document.querySelector<HTMLElement>('[data-account-signed-in-as]');
  if (signedInAs) signedInAs.textContent = (signedInAs.dataset.template ?? '{name}').replace('{name}', shown);
  const mail = document.querySelector<HTMLElement>('[data-account-email]');
  if (!mail) return;
  const at = email ? email.lastIndexOf('@') : -1;
  mail.hidden = !email || at <= 0 || email === shown;
  if (email && at > 0) {
    mail.title = email;
    const [local, domain] = [mail.querySelector('.aun-email-local'), mail.querySelector('.aun-email-domain')];
    if (local) local.textContent = email.slice(0, at);
    if (domain) domain.textContent = email.slice(at);
  }
}

function accountMenu(): void {
  const box = document.getElementById('account');
  const button = box?.querySelector<HTMLButtonElement>('.aun-acct-btn');
  const menu = box?.querySelector<HTMLElement>('.aun-menu');
  if (!box || !button || !menu) return;
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
  // Escape closes it from the button too (focus stays on the button after a click)
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      e.preventDefault();
      close(true);
    }
  });
  menu.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      list[e.key === 'Home' ? 0 : list.length - 1]?.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !box.contains(e.target as Node)) close(false);
  });
  box.addEventListener('focusout', (e) => {
    if (!menu.hidden && e.relatedTarget && !box.contains(e.relatedTarget as Node)) close(false);
  });
}
accountMenu();

async function account(): Promise<void> {
  // No account box: sign-in isn't configured on this deployment (SiteHeader.astro), nothing to ask
  if (!document.getElementById('account')) return;
  try {
    const res = await fetch('/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const body = (await res.json()) as { signedIn?: boolean; sub?: string | null; name?: string | null; email?: string | null; profile?: MeProfileView | null };
    if (body.signedIn) {
      root.setAttribute('data-signed-in', '');
      // the name in the page's language, from the videos profile (www's rule: displayLabel)
      fillAccount(displayLabel(body, root.lang === 'ar' ? 'ar' : 'en'), body.email ?? null);
    } else {
      root.removeAttribute('data-signed-in');
    }
  } catch {
    // offline: leave the header as the cookie hint drew it
  }
}
void account();
