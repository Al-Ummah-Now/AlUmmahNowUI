/**
 * Vendors the site themes of the videos app (AlUmmahNow `apps/web/src/theme/site-themes.css`,
 * generated there from the built-in Fanous theme packages) into www at a pinned commit, so www
 * uses the same design tokens as the videos app and never hand-copies a colour.
 *
 *   node --experimental-strip-types scripts/sync-fanous.ts --ref <40-char sha>   (fetch, rewrite)
 *   node --experimental-strip-types scripts/sync-fanous.ts                       (re-fetch the locked ref)
 *   node --experimental-strip-types scripts/sync-fanous.ts --check               (offline: outputs == lock)
 *
 * The monorepo is public: files come from raw.githubusercontent.com with no token.
 *
 * The videos app marks dark with `html.dark`; www follows the system setting with no JS and
 * forces a choice with `html[data-mode]` (src/lib/theme-mode.ts). So for each theme:
 *   - the base and light blocks become `html[data-theme='<id>']`
 *   - the dark block becomes `html[data-theme='<id>'][data-mode='dark']` and, inside
 *     `@media (prefers-color-scheme: dark)`, `html[data-theme='<id>']:not([data-mode='light'])`
 * (both one attribute more specific than the light block, so order does not matter).
 * Only the colour tokens www uses are kept: those named in USED_IN (src/styles/global.css), plus the
 * header colour for meta theme-color. tests/site-theme.test.ts fails when global.css uses a token
 * the generated file lacks (run the sync again).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPO = 'Al-Ummah-Now/AlUmmahNow';
const SOURCE = 'apps/web/src/theme/site-themes.css';
const LOCK = 'fanous.lock.json';
export const CSS_OUT = 'src/styles/fanous-themes.generated.css';
export const TS_OUT = 'src/lib/site-themes.generated.ts';
export const USED_IN = 'src/styles/global.css';
/** The videos app's default (shared-types DEFAULT_SITE_THEME): rendered when the admin's answer cannot be used. */
const DEFAULT_THEME = 'fawanees';

interface Lock {
  repo: string;
  ref: string;
  source: string;
  sourceSha256: string;
  outputs: Record<string, string>;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

type Part = 'base' | 'light' | 'dark';
export interface ThemeBlocks {
  base: string[];
  light: string[];
  dark: string[];
}

const KEEP = /^--fanous-(brand|color|c)-[a-z0-9-]+$/;
const THEMED = /^html\[data-theme='([a-z][a-z0-9-]*)'\](\.dark|:not\(\.dark\))?$/;
/** Selectors for an unthemed page (the videos app's fallback); www always sets data-theme. */
const UNTHEMED = new Set([':root', '.dark', 'html:not(.dark)']);

/** The --fanous-* tokens a stylesheet reads. */
export function usedTokens(css: string): Set<string> {
  return new Set([...css.matchAll(/var\((--fanous-[a-z0-9-]+)/g)].map((m) => m[1]!));
}

/** Top-level rules of a stylesheet, comments removed; at-rules (reduced motion) are skipped. */
function rules(css: string): { selector: string; body: string }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selector: string; body: string }[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const selector = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    for (; j < text.length && depth > 0; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
    }
    if (depth !== 0) throw new Error(`unbalanced braces after "${selector}"`);
    if (!selector.startsWith('@')) out.push({ selector, body: text.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}

/** The colour declarations of each theme, by part. Throws on any selector it does not understand. */
export function parseThemes(css: string): Map<string, ThemeBlocks> {
  const themes = new Map<string, ThemeBlocks>();
  for (const { selector, body } of rules(css)) {
    const decls = body
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const colon = d.indexOf(':');
        if (colon < 0) throw new Error(`bad declaration in "${selector}": ${d}`);
        return [d.slice(0, colon).trim(), d.slice(colon + 1).trim()] as const;
      })
      .filter(([name]) => KEEP.test(name))
      .map(([name, value]) => {
        if (/[<>{}]|url\(|expression/i.test(value)) throw new Error(`unexpected value for ${name}: ${value}`);
        return `${name}:${value}`;
      });
    for (const sel of selector.split(',').map((s) => s.trim())) {
      if (UNTHEMED.has(sel)) continue;
      const m = THEMED.exec(sel);
      if (!m) throw new Error(`unexpected selector in ${SOURCE}: ${sel}`);
      const id = m[1]!;
      const part: Part = m[2] === '.dark' ? 'dark' : m[2] ? 'light' : 'base';
      const blocks = themes.get(id) ?? { base: [], light: [], dark: [] };
      blocks[part].push(...decls);
      themes.set(id, blocks);
    }
  }
  for (const [id, b] of themes) {
    for (const part of ['base', 'light', 'dark'] as const) {
      if (!b[part].length) throw new Error(`theme ${id} has no ${part} colours`);
    }
  }
  return themes;
}

/** The last value a block gives a token (blocks are emitted in order, so the last wins). */
function value(decls: string[], name: string): string {
  const hit = decls.filter((d) => d.startsWith(`${name}:`)).pop();
  if (!hit) throw new Error(`missing ${name}`);
  return hit.slice(name.length + 1);
}

export function buildOutputs(css: string, ref: string, used: Set<string>): { css: string; ts: string } {
  const all = parseThemes(css);
  const keep = (decls: string[]) => decls.filter((d) => used.has(d.slice(0, d.indexOf(':'))));
  const themes = new Map([...all].map(([id, b]) => [id, { base: keep(b.base), light: keep(b.light), dark: keep(b.dark) }]));
  for (const name of used) {
    for (const [id, b] of all) {
      if (![...b.base, ...b.light].some((d) => d.startsWith(`${name}:`))) throw new Error(`${USED_IN} uses ${name}, which theme ${id} does not define`);
    }
  }
  const ids = [...themes.keys()];
  if (!ids.includes(DEFAULT_THEME)) throw new Error(`default theme ${DEFAULT_THEME} is not in ${SOURCE}`);
  const header = `Generated by scripts/sync-fanous.ts from ${REPO}@${ref}:${SOURCE}. Do not edit.`;
  let outCss = `/* ${header} */\n`;
  let dark = '';
  for (const [id, b] of themes) {
    const sel = `html[data-theme='${id}']`;
    outCss += `${sel}{${[...b.base, ...b.light].join(';')}}\n`;
    outCss += `${sel}[data-mode='dark']{${b.dark.join(';')}}\n`;
    dark += `${sel}:not([data-mode='light']){${b.dark.join(';')}}\n`;
  }
  outCss += `@media (prefers-color-scheme: dark){\n${dark}}\n`;
  // Browser chrome (meta theme-color): the header's colour, which is dark in every theme
  const chrome = Object.fromEntries(
    [...all].map(([id, b]) => [id, { light: value(b.light, '--fanous-c-nav-bg'), dark: value(b.dark, '--fanous-c-nav-bg') }]),
  );
  const ts =
    `// ${header}\n` +
    `export const THEME_IDS = ${JSON.stringify(ids)} as const;\n` +
    `export type ThemeId = (typeof THEME_IDS)[number];\n` +
    `export const DEFAULT_THEME: ThemeId = ${JSON.stringify(DEFAULT_THEME)};\n` +
    `/** meta theme-color per theme and scheme (the header colour, --fanous-c-nav-bg). */\n` +
    `export const THEME_CHROME: Record<ThemeId, { light: string; dark: string }> = ${JSON.stringify(chrome, null, 2)};\n`;
  return { css: outCss, ts };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  let lock: Lock | undefined;
  try {
    lock = JSON.parse(readFileSync(LOCK, 'utf8')) as Lock;
  } catch {
    lock = undefined;
  }
  if (args.includes('--check')) {
    if (!lock) throw new Error(`${LOCK} is missing`);
    for (const [file, hash] of Object.entries(lock.outputs)) {
      if (sha256(readFileSync(file, 'utf8')) !== hash) {
        console.error(`${file} does not match ${LOCK} (hand edit?). Run: npm run sync:fanous`);
        process.exit(1);
      }
    }
    console.log(`fanous: generated files match the lock (${REPO}@${lock.ref.slice(0, 8)})`);
    return;
  }
  const ref = arg('--ref') ?? lock?.ref;
  if (!ref || !/^[0-9a-f]{40}$/.test(ref)) throw new Error('pin a full commit SHA: --ref <sha>');
  const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${SOURCE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const source = await res.text();
  const out = buildOutputs(source, ref, usedTokens(readFileSync(USED_IN, 'utf8')));
  writeFileSync(CSS_OUT, out.css);
  writeFileSync(TS_OUT, out.ts);
  const next: Lock = { repo: REPO, ref, source: SOURCE, sourceSha256: sha256(source), outputs: { [CSS_OUT]: sha256(out.css), [TS_OUT]: sha256(out.ts) } };
  writeFileSync(LOCK, JSON.stringify(next, null, 2) + '\n');
  console.log(`wrote ${CSS_OUT} (${out.css.length} bytes), ${TS_OUT} and ${LOCK}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
