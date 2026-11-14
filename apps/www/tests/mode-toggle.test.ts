/**
 * The Light / Dark control shared by www, the scholar sites and apps/dev: AlUmmahNow
 * packages/fanous-tokens/nav/mode-toggle.js, vendored byte for byte into packages/render/src/nav
 * (check:fanous), whose markup the videos site checks against lucide-react 0.487.
 * packages/render/src/mode-toggle.ts only re-exports it (one copy). The expected markup is pinned
 * here as well, so an upstream change shows up in this repo's review, not only in the lock.
 */
import { describe, expect, it } from 'vitest';
import * as reexport from '../../../packages/render/src/mode-toggle';
import * as vendored from '../../../packages/render/src/nav/mode-toggle.js';
import { modeButtonHtml } from '../../../packages/render/src/nav/header.js';

const { MODE_TOGGLE_LABELS, modeIconSvg, modeToggleLabel } = reexport;

const ATTRS = 'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

describe('mode toggle (the videos site\'s)', () => {
  it('draws Lucide sun and moon exactly', () => {
    expect(modeIconSvg('sun')).toBe(
      `<svg ${ATTRS} class="lucide lucide-sun" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`,
    );
    expect(modeIconSvg('moon', 'theme-icon mode-moon')).toBe(
      `<svg ${ATTRS} class="lucide lucide-moon theme-icon mode-moon" aria-hidden="true" focusable="false"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`,
    );
  });

  it('is named for the mode it switches to, in English and Arabic', () => {
    expect(MODE_TOGGLE_LABELS).toEqual({
      en: { toLight: 'Switch to light mode', toDark: 'Switch to dark mode' },
      ar: { toLight: 'التبديل إلى الوضع الفاتح', toDark: 'التبديل إلى الوضع الداكن' },
    });
    expect(modeToggleLabel('en', false)).toBe('Switch to dark mode');
    expect(modeToggleLabel('ar', true)).toBe('التبديل إلى الوضع الفاتح');
  });

  it('has one copy: packages/render/src/mode-toggle.ts is the vendored module', () => {
    for (const k of Object.keys(vendored) as (keyof typeof vendored)[]) expect(reexport[k], k).toBe(vendored[k]);
    expect(Object.keys(reexport).sort()).toEqual(Object.keys(vendored).sort());
  });

  it('the header button is the contract\'s (nav/header.js modeButtonHtml)', () => {
    expect(modeButtonHtml({ lang: 'en', dark: true })).toBe(
      `<button type="button" class="aun-icon-btn aun-mode" id="mode-toggle" data-testid="theme-toggle" aria-label="Switch to light mode" title="Switch to light mode">${modeIconSvg('sun')}</button>`,
    );
  });
});
