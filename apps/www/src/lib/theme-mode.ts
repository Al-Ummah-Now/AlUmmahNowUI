/**
 * Light / Dark for www (owner decision 2026-11-13: no "System" option anywhere).
 *
 * This is the mode only; the theme (Fawanees, Lantern, Zujaj, Nahas) is the admin's choice for the
 * whole site, rendered by the server as <html data-theme> (src/lib/site-theme.ts).
 *
 * HTML is edge-cached and identical for every visitor, so the choice lives in the browser
 * (localStorage `aun_mode`, per device) and is applied client-side:
 *  - First visit (nothing saved): CSS follows `prefers-color-scheme` (src/styles/global.css), so the
 *    page opens in the device's mode with no JS at all.
 *  - From the first click on: the toggle saves "light" or "dark" and `<html data-mode>` forces it.
 *  - MODE_SCRIPT runs in <head> before first paint and sets data-mode from the saved choice,
 *    so there is no flash of the wrong mode. A "system" left by an older release is resolved once to
 *    the device's mode and saved as that. CSP allows exactly this script by its hash
 *    (MODE_SCRIPT_HASH, checked against the script in tests/theme-mode.test.ts).
 *
 * No other app shares a mode across subdomains today (videos web: next-themes localStorage on
 * its own origin; CMS: a host-only `cms_mode` cookie; sign-in pages: the system setting), so
 * www keeps its own choice the same way.
 */
export const MODES = ['light', 'dark'] as const;
export type Mode = (typeof MODES)[number];

export const MODE_KEY = 'aun_mode';

export const isMode = (v: unknown): v is Mode => typeof v === 'string' && (MODES as readonly string[]).includes(v);

/** A stored value → the saved choice, or null when there is none (the device's mode applies). */
export const parseMode = (v: unknown): Mode | null => (isMode(v) ? v : null);

/**
 * Inline <head> script. Also marks the page as scripted (data-js) so the mode toggle,
 * which needs JS, only shows when it can work, and marks a signed-in browser (data-signed-in,
 * from the `aun_www_si` hint cookie, src/lib/auth.ts) so the cached HTML shows the signed-in
 * hero and header from the first paint. It also picks this load's Fawanees street tile variant
 * (data-fanous-street-variant, 1-4; fanous-street.css shows it) before first paint, so the street never
 * swaps (tests may pin it with window.__AUN_STREET_VARIANT__). Keep it tiny and ES5; any change needs a
 * new MODE_SCRIPT_HASH (the unit test prints it).
 */
export const MODE_SCRIPT =
  '(function(){var d=document.documentElement;d.setAttribute("data-js","");d.setAttribute("data-fanous-street-variant",String(window.__AUN_STREET_VARIANT__||1+Math.floor(Math.random()*4)));try{var m=localStorage.getItem("aun_mode");if(m==="system"){m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";localStorage.setItem("aun_mode",m)}if(m==="light"||m==="dark")d.setAttribute("data-mode",m)}catch(e){}if(/(?:^|; )aun_www_si=1/.test(document.cookie))d.setAttribute("data-signed-in","")})();';

/** CSP source for MODE_SCRIPT: 'sha256-<base64>'. */
export const MODE_SCRIPT_HASH = "'sha256-mt3wv4AFwu4xEZdx1D7nMMSntNAU6pTdQn/4cUbknxw='";
