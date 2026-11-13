#!/usr/bin/env node
/**
 * Release check (wiki AUN-SCHOLAR-SITES §9.3): every cookie stays host-only. Fails when any tracked
 * source of www or the sites Worker sets a cookie Domain, above all `.alummahnow.net` (would reach
 * every platform app) or `.alummahnow.org` (would reach every scholar site). Session cookies use the
 * `__Host-` prefix, which browsers refuse with a Domain anyway; this catches the other cookies too.
 *   node scripts/check-cookie-domains.mjs [--self-test]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** A cookie Domain attribute in a Set-Cookie string or a cookie options object. */
const PATTERNS = [
  /;\s*domain\s*=/i, // "...; Domain=.alummahnow.org"
  /\bdomain\s*:\s*['"`]\.?[a-z0-9-]+\.[a-z]/i, // { domain: '.alummahnow.net' }
  /['"`]\s*Domain=/, // `Domain=${...}`
];

export function findCookieDomains(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments explain the rule
    if (PATTERNS.some((p) => p.test(line))) hits.push({ line: i + 1, text: line.trim().slice(0, 160) });
  });
  return hits;
}

if (process.argv.includes('--self-test')) {
  const bad = ['h.set("Set-Cookie", `a=1; Path=/; Domain=.alummahnow.org`);', "cookies.set('a', '1', { domain: '.alummahnow.net' })", 'return `x=${v}; Path=/; HttpOnly; domain=example.com`;'];
  const good = ['return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;', '// never set Domain=.alummahnow.org', 'const domain = new URL(u).hostname;'];
  for (const b of bad) if (!findCookieDomains(b).length) throw new Error(`missed: ${b}`);
  for (const g of good) if (findCookieDomains(g).length) throw new Error(`false alarm: ${g}`);
  console.log('cookie-domains self-test: OK');
  process.exit(0);
}

const files = execFileSync('git', ['ls-files', 'apps/*/src/**', 'packages/*/src/**'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(ts|tsx|js|mjs|astro)$/.test(f) && !f.includes('.generated.'));
let failed = 0;
for (const f of files) {
  for (const hit of findCookieDomains(readFileSync(f, 'utf8'))) {
    failed++;
    console.error(`${f}:${hit.line}: cookie Domain attribute (cookies must be host-only): ${hit.text}`);
  }
}
if (failed) process.exit(1);
console.log(`cookie-domains: OK (${files.length} source files, every cookie host-only)`);
