/**
 * After `npm run build`: dist/ holds every page the release smoke (scripts/release/smoke.ts) will
 * ask for, in both languages, plus the 404 page:
 *   node --experimental-strip-types scripts/check-dist.ts [dist]
 *
 * The release builds once and deploys the same dist/ to stage and production, so a page missing
 * here fails the build job instead of a smoke after production has been touched.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOCALES, PAGES, dir, pagePath } from '../src/lib/pages.ts';

/** dist-relative files the release expects, with the `<html lang dir>` each page must open with. */
export function expectedFiles(): { file: string; html: string | null }[] {
  const out: { file: string; html: string | null }[] = [{ file: '404.html', html: null }];
  for (const locale of LOCALES) {
    for (const slug of PAGES) out.push({ file: `${pagePath(locale, slug).slice(1)}index.html`, html: `<html lang="${locale}" dir="${dir(locale)}"` });
  }
  return out;
}

/** What's wrong with `distDir`, one line per problem (empty = every page is there). */
export function checkDist(distDir: string): string[] {
  const problems: string[] = [];
  for (const { file, html } of expectedFiles()) {
    const path = join(distDir, file);
    if (!existsSync(path)) problems.push(`missing ${file}`);
    else if (html && !readFileSync(path, 'utf8').includes(html)) problems.push(`${file} doesn't open with ${html}>`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = resolve(process.argv[2] ?? 'dist');
  const problems = checkDist(distDir);
  for (const p of problems) process.stdout.write(`::error::${p}\n`);
  if (problems.length) process.exit(1);
  process.stdout.write(`dist has all ${expectedFiles().length} pages the smoke expects\n`);
}
