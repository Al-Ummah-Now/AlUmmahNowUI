/**
 * Every page: the Light/Dark toggle (saved per device, as on www) and the header's account state.
 * HTML is cached and identical for everyone, so the header asks /auth/me (which also re-checks a
 * session older than 5 minutes with auth: a sign-out elsewhere ends it here).
 */
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
  btn.setAttribute('aria-label', (mode === 'dark' ? btn.dataset.labelLight : btn.dataset.labelDark) ?? '');
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

async function account(): Promise<void> {
  try {
    const res = await fetch('/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const body = (await res.json()) as { signedIn?: boolean; name?: string | null };
    if (body.signedIn) {
      root.setAttribute('data-signed-in', '');
      const label = document.querySelector<HTMLElement>('[data-account-name]');
      if (label) label.textContent = (label.dataset.template ?? '{name}').replace('{name}', body.name ?? '');
    } else {
      root.removeAttribute('data-signed-in');
    }
  } catch {
    // offline: leave the header as the cookie hint drew it
  }
}
void account();
