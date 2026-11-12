/**
 * Light / Dark / System for www.
 *
 * This is the mode only; the theme (Fawanees, Lantern, Zujaj, Nahas) is the admin's choice for the
 * whole site, rendered by the server as <html data-theme> (src/lib/site-theme.ts).
 *
 * HTML is edge-cached and identical for every visitor, so the choice lives in the browser
 * (localStorage `aun_mode`) and is applied client-side:
 *  - CSS follows `prefers-color-scheme` unless `<html data-mode="light|dark">` forces one
 *    (src/styles/global.css), so "System" needs no JS at all.
 *  - MODE_SCRIPT runs in <head> before first paint and sets data-mode from the saved choice,
 *    so there is no flash of the wrong theme. CSP allows exactly this script by its hash
 *    (MODE_SCRIPT_HASH, checked against the script in tests/theme-mode.test.ts).
 *
 * No other app shares a mode across subdomains today (videos web: next-themes localStorage on
 * its own origin; CMS: a host-only `cms_mode` cookie; sign-in pages: the system setting), so
 * www keeps its own choice the same way.
 */
export const MODES = ['system', 'light', 'dark'] as const;
export type Mode = (typeof MODES)[number];

export const MODE_KEY = 'aun_mode';

export const isMode = (v: unknown): v is Mode => typeof v === 'string' && (MODES as readonly string[]).includes(v);

/** A stored value → the mode to apply ("system" for anything unknown or missing). */
export const parseMode = (v: unknown): Mode => (isMode(v) ? v : 'system');

/**
 * Inline <head> script. Also marks the page as scripted (data-js) so the theme control,
 * which needs JS, only shows when it can work. Keep it tiny and ES5; any change needs a
 * new MODE_SCRIPT_HASH (the unit test prints it).
 */
export const MODE_SCRIPT =
  '(function(){var d=document.documentElement;d.setAttribute("data-js","");try{var m=localStorage.getItem("aun_mode");if(m==="light"||m==="dark")d.setAttribute("data-mode",m)}catch(e){}})();';

/** CSP source for MODE_SCRIPT: 'sha256-<base64>'. */
export const MODE_SCRIPT_HASH = "'sha256-G9ckqte957DoMW1eHPIgDRmq0td7ikw4uMApZmt2XZs='";
