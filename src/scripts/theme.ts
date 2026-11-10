/**
 * The Light / Dark / System control in the header (src/components/Header.astro).
 * The head script (MODE_SCRIPT) already applied the saved choice before paint; this wires
 * the menu, saves changes (localStorage, never throwing) and keeps other tabs in step.
 */
import { MODE_KEY, THEME_COLOR, parseMode, type Mode } from '../lib/theme-mode';

function readMode(): Mode {
  try {
    return parseMode(localStorage.getItem(MODE_KEY));
  } catch {
    return 'system';
  }
}

function saveMode(mode: Mode) {
  try {
    if (mode === 'system') localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, mode);
  } catch {
    // private mode or blocked storage: the choice lasts for this page only
  }
}

function applyMode(mode: Mode) {
  const html = document.documentElement;
  if (mode === 'system') html.removeAttribute('data-mode');
  else html.setAttribute('data-mode', mode);
  // Browser chrome follows a forced choice too
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLOR[mode === 'system' ? scheme : mode];
  });
}

export function initTheme() {
  const root = document.getElementById('theme');
  const button = root?.querySelector<HTMLButtonElement>('.theme-button');
  const menu = root?.querySelector<HTMLUListElement>('.theme-menu');
  if (!root || !button || !menu) return;
  const d = root.dataset;
  const name = button.querySelector<HTMLElement>('[data-theme-name]');
  const options = Array.from(menu.querySelectorAll<HTMLButtonElement>('button[data-set-mode]'));

  const show = (mode: Mode) => {
    button.dataset.current = mode;
    const label = d[`label${mode[0]!.toUpperCase()}${mode.slice(1)}`] ?? mode;
    if (name) name.textContent = (d.labelCurrent ?? '{mode}').replace('{mode}', label);
    for (const o of options) o.setAttribute('aria-pressed', String(o.dataset.setMode === mode));
  };

  const open = (focusSelected: boolean) => {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    if (focusSelected) (options.find((o) => o.getAttribute('aria-pressed') === 'true') ?? options[0])?.focus();
  };
  const close = (focus: boolean) => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  };

  show(readMode());

  button.addEventListener('click', () => (menu.hidden ? open(false) : close(false)));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open(true);
    } else if (e.key === 'Escape' && !menu.hidden) {
      e.preventDefault();
      close(true);
    }
  });
  for (const o of options) {
    o.addEventListener('click', () => {
      const mode = parseMode(o.dataset.setMode);
      saveMode(mode);
      applyMode(mode);
      show(mode);
      close(true);
    });
  }
  menu.addEventListener('keydown', (e) => {
    const i = options.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      options[(i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      options[e.key === 'Home' ? 0 : options.length - 1]?.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !root.contains(e.target as Node)) close(false);
  });
  root.addEventListener('focusout', (e) => {
    if (!menu.hidden && e.relatedTarget && !root.contains(e.relatedTarget as Node)) close(false);
  });
  // Another tab changed it
  window.addEventListener('storage', (e) => {
    if (e.key !== MODE_KEY && e.key !== null) return;
    const mode = readMode();
    applyMode(mode);
    show(mode);
  });
  // A forced mode from the head script: bring the browser chrome in line
  const initial = readMode();
  if (initial !== 'system') applyMode(initial);
}
