/**
 * The Light / Dark toggle in the header (src/components/Header.astro). One button, "Dark mode",
 * aria-pressed when the page is dark. There is no "System" option (owner decision 2026-11-13):
 * until the visitor clicks, the page follows the device (CSS prefers-color-scheme) and the
 * button shows that; a click saves the opposite of what is showing (localStorage, never throwing).
 * The head script (MODE_SCRIPT, src/lib/theme-mode.ts) already applied a saved choice before paint.
 */
import { MODE_KEY, parseMode, type Mode } from '../lib/theme-mode';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function savedMode(): Mode | null {
  try {
    return parseMode(localStorage.getItem(MODE_KEY));
  } catch {
    return null;
  }
}

/** The mode on screen: the saved choice, else the device's. */
export function currentMode(): Mode {
  return parseMode(document.documentElement.getAttribute('data-mode')) ?? (darkQuery().matches ? 'dark' : 'light');
}

function saveMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // private mode or blocked storage: the choice lasts for this page only
  }
}

function applyMode(mode: Mode | null) {
  const html = document.documentElement;
  if (mode) html.setAttribute('data-mode', mode);
  else html.removeAttribute('data-mode');
  // Browser chrome follows a forced choice too (each meta carries the site theme's light and dark colour)
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    const colour = meta.dataset[mode ?? scheme];
    if (colour) meta.content = colour;
  });
}

export function initTheme() {
  const button = document.querySelector<HTMLButtonElement>('#theme .theme-button');
  if (!button) return;
  const show = () => {
    const mode = currentMode();
    button.dataset.current = mode;
    button.setAttribute('aria-pressed', String(mode === 'dark'));
  };

  button.addEventListener('click', () => {
    const mode: Mode = currentMode() === 'dark' ? 'light' : 'dark';
    saveMode(mode);
    applyMode(mode);
    show();
  });
  // No choice yet: the device's setting changed
  darkQuery().addEventListener('change', show);
  // Another tab changed it
  window.addEventListener('storage', (e) => {
    if (e.key !== MODE_KEY && e.key !== null) return;
    applyMode(savedMode());
    show();
  });
  // A saved mode from the head script: bring the browser chrome in line
  const initial = savedMode();
  if (initial) applyMode(initial);
  show();
}
