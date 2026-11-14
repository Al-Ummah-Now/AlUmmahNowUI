/**
 * The Light / Dark control, the same in every Al Ummah Now app (AlUmmahNow docs/design/NAV.md
 * "Header", Light/dark). One copy only: AlUmmahNow packages/fanous-tokens/nav/mode-toggle.js,
 * vendored byte for byte into ./nav by apps/www/scripts/sync-fanous.ts (`check:fanous` fails on any
 * difference). This module keeps the import path www, the scholar sites and apps/dev already use.
 */
export { MODE_ICON_ATTRS, MODE_TOGGLE_LABELS, MOON_ICON_BODY, SUN_ICON_BODY, modeIconSvg, modeToggleLabel } from './nav/mode-toggle.js';
