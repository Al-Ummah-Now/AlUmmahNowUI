import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildOutputs, parseThemes, usedTokens } from '../scripts/sync-fanous';
import { htmlCacheKey, isCacheableResponse } from '../src/lib/edge';
import { config } from '../src/lib/env';
import {
  DEFAULT_THEME,
  THEME_FRESH_MS,
  THEME_HEADER,
  THEME_IDS,
  resetSiteThemeCache,
  resolveTheme,
  siteTheme,
  themeFromRequest,
  withThemeHeader,
} from '../src/lib/site-theme';

const GENERATED = readFileSync('src/styles/fanous-themes.generated.css', 'utf8');
const GLOBAL = readFileSync('src/styles/global.css', 'utf8');

/** A small stand-in for the videos app's site-themes.css, in its shape. */
const SOURCE = `/* Generated. */
html[data-theme='lantern'] {
  --fanous-brand-night: #093041;
  --fanous-type-latin-display-size: 34px;
}
@media (prefers-reduced-motion: reduce) {
  :root { --fanous-duration-fast: 0ms; }
}
:root,
html[data-theme='lantern'].dark {
  --fanous-color-background: #093041;
  --fanous-c-nav-bg: #07425a;
}
html[data-theme='lantern']:not(.dark) {
  --fanous-color-background: #efe2cc;
  --fanous-c-nav-bg: #093041;
}
:root, html[data-theme='fawanees'] {
  --fanous-brand-night: #09151e;
}
:root,
.dark, html[data-theme='fawanees'].dark {
  --fanous-color-background: #09151e;
  --fanous-c-nav-bg: #0b1d2a;
}
html:not(.dark), html[data-theme='fawanees']:not(.dark) {
  --fanous-color-background: #fff1c4;
  --fanous-c-nav-bg: #0e2b3d;
}
`;

describe('scripts/sync-fanous.ts', () => {
  it('rescopes the videos app selectors to data-theme and www modes, colour tokens only', () => {
    const out = buildOutputs(SOURCE, 'a'.repeat(40), new Set(['--fanous-color-background', '--fanous-c-nav-bg']));
    expect(out.css).toContain("html[data-theme='lantern']{--fanous-color-background:#efe2cc;--fanous-c-nav-bg:#093041}");
    expect(out.css).toContain("html[data-theme='lantern'][data-mode='dark']{--fanous-color-background:#093041;--fanous-c-nav-bg:#07425a}");
    expect(out.css).toContain("@media (prefers-color-scheme: dark){\nhtml[data-theme='lantern']:not([data-mode='light']){--fanous-color-background:#093041");
    expect(out.css).not.toMatch(/:root|\.dark|type-latin|duration|brand-night/);
    expect(out.ts).toContain('export const THEME_IDS = ["lantern","fawanees"] as const;');
    expect(out.ts).toContain('"light": "#0e2b3d"');
    expect(out.ts).toContain('export const DEFAULT_THEME: ThemeId = "fawanees";');
  });

  it('refuses what it does not understand, and tokens a theme lacks', () => {
    expect(() => parseThemes(`${SOURCE}\n.other { --fanous-color-x: #fff; }`)).toThrow(/unexpected selector/);
    expect(() => parseThemes(`html[data-theme='x'] { --fanous-color-x: url(evil); }`)).toThrow(/unexpected value/);
    expect(() => buildOutputs(SOURCE, 'a'.repeat(40), new Set(['--fanous-color-missing']))).toThrow(/does not define/);
  });

  it('keeps the lantern street tokens for the street module, and only a data: SVG for its lights', () => {
    const lights = 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E")';
    const src = `html[data-theme='fawanees'] { --fanous-color-background: #f3eee5; --fanous-c-nav-bg: #0e2b3d; }
html[data-theme='fawanees']:not(.dark) { --fanous-color-background: #f3eee5; --fanous-c-nav-bg: #0e2b3d; --fanous-street-on: 1; --fanous-street-lights: ${lights}; }
html[data-theme='fawanees'].dark { --fanous-color-background: #09151e; --fanous-c-nav-bg: #0b1d2a; --fanous-street-on: 1; --fanous-street-lights: ${lights}; }`;
    const out = buildOutputs(src, 'a'.repeat(40), new Set(['--fanous-color-background', '--fanous-c-nav-bg']));
    expect(out.css).toContain('--fanous-street-on:1');
    expect(out.css).toContain(`--fanous-street-lights:${lights}`);
    expect(() => parseThemes(`html[data-theme='x'] { --fanous-street-lights: url("https://evil.test/x.svg"); }`)).toThrow(/unexpected value/);
    expect(() => parseThemes(`html[data-theme='x'] { --fanous-street-line: url("data:image/svg+xml,x"); }`)).toThrow(/unexpected value/);
  });

  it('the vendored street module is the one the lock names', () => {
    const lock = JSON.parse(readFileSync('fanous.lock.json', 'utf8')) as { ref: string; street: Record<string, string>; outputs: Record<string, string> };
    expect(Object.keys(lock.street)).toEqual(['packages/fanous-tokens/street/fanous-street.js', 'packages/fanous-tokens/street/fanous-street.d.ts', 'packages/fanous-tokens/street/fanous-street.css']);
    for (const file of ['src/lib/fanous-street.generated.js', 'src/lib/fanous-street.generated.d.ts', 'src/styles/fanous-street.generated.css']) {
      expect(lock.outputs[file], file).toBeTruthy();
      expect(readFileSync(file, 'utf8')).toContain(`Al-Ummah-Now/AlUmmahNow@${lock.ref}`);
    }
  });

  it('the vendored file defines every token global.css reads, for all four themes in both modes', () => {
    const used = usedTokens(GLOBAL);
    expect(used.size).toBeGreaterThan(10);
    expect([...THEME_IDS].sort()).toEqual(['fawanees', 'lantern', 'nahas', 'zujaj']);
    for (const id of THEME_IDS) {
      for (const sel of [`html[data-theme='${id}']{`, `html[data-theme='${id}'][data-mode='dark']{`, `html[data-theme='${id}']:not([data-mode='light']){`]) {
        const start = GENERATED.indexOf(sel);
        expect(start, sel).toBeGreaterThanOrEqual(0);
        const block = GENERATED.slice(start, GENERATED.indexOf('}', start));
        for (const name of used) expect(block, `${sel} ${name} (run npm run sync:fanous)`).toContain(`${name}:`);
      }
    }
  });

  it('the shared nav stylesheet is vendored, and every token it reads is defined for every theme', () => {
    const nav = readFileSync('src/styles/aun-nav.generated.css', 'utf8');
    expect(nav).toMatch(/^\/\* Generated by scripts\/sync-fanous\.ts from Al-Ummah-Now\/AlUmmahNow@[0-9a-f]{40}:packages\/fanous-tokens\/nav\/aun-nav\.css/);
    expect(GLOBAL).toContain("@import './aun-nav.generated.css';");
    const used = usedTokens(nav);
    // Owner review 2026-11-12 (rev 3): light mode on the page background, dark mode on the menu tokens
    expect(used).toContain('--fanous-color-background');
    expect(used).toContain('--fanous-c-menu-bg');
    for (const id of THEME_IDS) {
      const sel = `html[data-theme='${id}']{`;
      const start = GENERATED.indexOf(sel);
      const light = GENERATED.slice(start, GENERATED.indexOf('}', start));
      // Colours switch with the mode; the scales (radius, spacing, elevation) are the theme's own
      for (const name of used) expect(light, `${sel} ${name} (run npm run sync:fanous)`).toContain(`${name}:`);
      const dsel = `html[data-theme='${id}'][data-mode='dark']{`;
      const dstart = GENERATED.indexOf(dsel);
      const dark = GENERATED.slice(dstart, GENERATED.indexOf('}', dstart));
      for (const name of [...used].filter((n) => /^--fanous-(color|c)-/.test(n))) expect(dark, `${dsel} ${name}`).toContain(`${name}:`);
    }
  });

  it('global.css writes no colour of its own for the theme roles', () => {
    const roles = GLOBAL.slice(GLOBAL.indexOf('html[data-theme] {'), GLOBAL.indexOf('/* Dark: the viewer'));
    expect(roles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('the site theme from the videos admin', () => {
  const ADMIN = 'https://admin.api.example';
  let calls: string[];
  const answer = (body: unknown, status = 200) => async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  const never = () => undefined;

  beforeEach(() => {
    resetSiteThemeCache();
    calls = [];
  });

  it('reads /public/site-theme', async () => {
    expect(await siteTheme(ADMIN, never, answer({ theme: 'lantern' }))).toEqual({ id: 'lantern', source: 'admin' });
    expect(calls).toEqual([`${ADMIN}/public/site-theme`]);
  });

  it('falls back to the default on errors, unknown or custom themes, and no URL', async () => {
    expect(await siteTheme(ADMIN, never, answer({ error: 'x' }, 500))).toEqual({ id: DEFAULT_THEME, source: 'fallback' });
    expect(await siteTheme(ADMIN, never, answer({ theme: 'my-pkg', package: { id: 'my-pkg', css: 'https://x/theme.css' } }))).toEqual({ id: DEFAULT_THEME, source: 'fallback' });
    expect(await siteTheme(ADMIN, never, async () => { throw new Error('down'); })).toEqual({ id: DEFAULT_THEME, source: 'fallback' });
    expect(await siteTheme('', never, answer({ theme: 'nahas' }))).toEqual({ id: DEFAULT_THEME, source: 'fallback' });
  });

  it('caches an answer, then serves it stale while one background refresh runs', async () => {
    let t = 0;
    const now = () => t;
    const jobs: Promise<unknown>[] = [];
    const wait = (p: Promise<unknown>) => void jobs.push(p);
    expect((await siteTheme(ADMIN, wait, answer({ theme: 'lantern' }), now)).id).toBe('lantern');
    t = THEME_FRESH_MS - 1;
    expect((await siteTheme(ADMIN, wait, answer({ theme: 'zujaj' }), now)).id).toBe('lantern');
    expect(calls.length).toBe(1);
    // Stale: the old answer now, the new one after the refresh; only one refresh at a time
    t = THEME_FRESH_MS + 1;
    expect((await siteTheme(ADMIN, wait, answer({ theme: 'zujaj' }), now)).id).toBe('lantern');
    expect((await siteTheme(ADMIN, wait, answer({ theme: 'zujaj' }), now)).id).toBe('lantern');
    expect(jobs.length).toBe(1);
    await Promise.all(jobs);
    expect((await siteTheme(ADMIN, wait, answer({ theme: 'nahas' }), now)).id).toBe('zujaj');
    expect(calls.length).toBe(2);
  });

  it('a failed refresh keeps the last real answer', async () => {
    let t = 0;
    const jobs: Promise<unknown>[] = [];
    await siteTheme(ADMIN, never, answer({ theme: 'nahas' }), () => t);
    t = THEME_FRESH_MS + 1;
    await siteTheme(ADMIN, (p) => void jobs.push(p), answer({}, 503), () => t);
    await Promise.all(jobs);
    expect(await siteTheme(ADMIN, never, answer({}, 503), () => t)).toEqual({ id: 'nahas', source: 'admin' });
  });

  it('a fallback is not cached: the next request asks again', async () => {
    await siteTheme(ADMIN, never, answer({}, 503));
    expect(await siteTheme(ADMIN, never, answer({ theme: 'zujaj' }))).toEqual({ id: 'zujaj', source: 'admin' });
  });

  it('?theme= previews a built-in theme outside production only', async () => {
    const qa = config({ APP_ENV: 'qa', ADMIN_API_URL: ADMIN });
    const prod = config({ APP_ENV: 'production', ADMIN_API_URL: ADMIN });
    const req = new Request('https://www.example/en/?theme=nahas');
    expect(await resolveTheme(req, qa, never, answer({ theme: 'lantern' }))).toEqual({ id: 'nahas', source: 'preview' });
    expect(await resolveTheme(req, prod, never, answer({ theme: 'lantern' }))).toEqual({ id: 'lantern', source: 'admin' });
    resetSiteThemeCache();
    expect(await resolveTheme(new Request('https://www.example/en/?theme=nope'), qa, never, answer({ theme: 'lantern' }))).toEqual({ id: 'lantern', source: 'admin' });
  });

  it('hands the theme to Astro in a header the client cannot set', () => {
    const forged = new Request('https://www.example/en/', { headers: { [THEME_HEADER]: 'nahas;admin' } });
    expect(themeFromRequest(withThemeHeader(forged, { id: 'lantern', source: 'admin' }))).toEqual({ id: 'lantern', source: 'admin' });
    expect(themeFromRequest(new Request('https://www.example/en/'))).toEqual({ id: DEFAULT_THEME, source: 'fallback' });
    expect(themeFromRequest(new Request('https://www.example/en/', { headers: { [THEME_HEADER]: 'evil";x;admin' } })).id).toBe(DEFAULT_THEME);
  });
});

describe('the HTML cache and the theme', () => {
  it('keys pages by theme, so a switch in the admin starts a fresh entry', () => {
    expect(htmlCacheKey('https://w/en/', 'v1', 'lantern')).toBe('https://w/en/?__v=v1&__t=lantern');
    expect(htmlCacheKey('https://w/en/', '', 'nahas')).toBe('https://w/en/?__t=nahas');
    expect(htmlCacheKey('https://w/en/', 'v1')).toBe('https://w/en/?__v=v1');
  });

  it('never stores a page rendered without the admin theme', () => {
    const page = (source?: string) =>
      new Response('<html></html>', { headers: { 'Content-Type': 'text/html', ...(source ? { 'X-Site-Theme-Source': source } : {}) } });
    expect(isCacheableResponse(page('admin'))).toBe(true);
    expect(isCacheableResponse(page())).toBe(true);
    expect(isCacheableResponse(page('fallback'))).toBe(false);
    expect(isCacheableResponse(page('preview'))).toBe(false);
  });
});
