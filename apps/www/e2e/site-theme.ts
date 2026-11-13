/**
 * The site theme in E2E: which theme the environment is configured with, and that theme's colours
 * from the vendored tokens (src/styles/fanous-themes.generated.css), so no test hard-codes a colour.
 */
import { readFileSync } from 'node:fs';
import { THEME_IDS, type ThemeId } from '../../../packages/render/src/themes/site-themes.generated.ts';
import { WWW_URL } from './env';

export { THEME_IDS, type ThemeId };
export const SCHEMES = ['light', 'dark'] as const;
export type Scheme = (typeof SCHEMES)[number];

const LOCAL = !process.env.WWW_URL;
/** Production ignores ?theme= previews. */
export const IS_PRODUCTION = /^https:\/\/www\.alummahnow\.net$/.test(WWW_URL);

/** The videos admin API of the site under test: www.<env>.alummahnow.net → admin.api.<env>.alummahnow.net. */
export const ADMIN_API_URL = (
  process.env.E2E_ADMIN_API_URL || (LOCAL ? 'http://localhost:8585' : WWW_URL.replace('://www.', '://admin.api.'))
).replace(/\/+$/, '');

/** The theme the admin chose for this environment (local: e2e/stub-cms.ts). */
export async function configuredTheme(): Promise<string> {
  const res = await fetch(`${ADMIN_API_URL}/public/site-theme`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${ADMIN_API_URL}/public/site-theme: ${res.status}`);
  return ((await res.json()) as { theme: string }).theme;
}

const CSS = readFileSync(new URL('../../../packages/render/src/styles/fanous-themes.generated.css', import.meta.url), 'utf8');

/** A token's value for a theme and scheme, as the browser reports colours: `rgb(r, g, b)`. */
export function token(theme: ThemeId, scheme: Scheme, name: string): string {
  const selector = scheme === 'dark' ? `html[data-theme='${theme}'][data-mode='dark']{` : `html[data-theme='${theme}']{`;
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`no ${scheme} block for ${theme}`);
  const block = CSS.slice(start + selector.length, CSS.indexOf('}', start));
  const hit = new RegExp(`(?:^|;)${name}:#([0-9a-f]{6})(?:;|$)`).exec(block);
  if (!hit) throw new Error(`${name} is not a 6-digit hex in ${theme} ${scheme}`);
  const n = parseInt(hit[1]!, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** The first HTML's data-theme (server-rendered: no client state involved). */
export async function renderedTheme(path: string): Promise<string | undefined> {
  const html = await (await fetch(`${WWW_URL}${path}`, { cache: 'no-store', headers: { 'User-Agent': 'al-ummah-now-www-e2e' } })).text();
  return /<html[^>]*\sdata-theme="([a-z][a-z0-9-]*)"/.exec(html)?.[1];
}
