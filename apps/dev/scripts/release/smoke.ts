/**
 * Post-deploy smoke of alummahnow.dev:
 *   node --experimental-strip-types scripts/release/smoke.ts --env qa|stage|production
 *
 * Every page in both languages answers 200 with the right lang/dir and a production canonical, the
 * security headers are on, QA and stage say noindex (and production doesn't), / redirects to /en/,
 * an unknown path is a real 404, and robots.txt matches the environment. While the zone is not set
 * up (apps/dev/docs/DOMAIN.md) the host doesn't resolve: the smoke SKIPS with a notice.
 *
 * The smoke starts seconds after `wrangler deploy` returns, while the edge may still be picking up
 * pages the deploy just uploaded: v2026.11.19.5's production smoke got one 404 on a page that was
 * in the upload (its Arabic twin and every other new page answered 200). So a page that doesn't
 * answer 200 is asked again until SETTLE_MS after the smoke began; a page that is really missing
 * still fails, and scripts/check-dist.ts already proved the build has every page before deploy.
 */
import { resolve4 } from 'node:dns/promises';
import { ENVIRONMENTS, PRODUCTION_ORIGIN, parseEnvArg, type EnvName } from '../environments.ts';
import { LOCALES, PAGES, dir, pagePath } from '../../src/lib/pages.ts';

const env = parseEnvArg(process.argv.slice(2)) as EnvName;
const host = ENVIRONMENTS[env].host;
const origin = `https://${host}`;
const UA = { 'User-Agent': 'al-ummah-now-dev-smoke' };

try {
  await resolve4(host);
} catch {
  process.stdout.write(`::notice::SKIP dev smoke: ${host} does not resolve yet (apps/dev/docs/DOMAIN.md)\n`);
  process.exit(0);
}

const SETTLE_MS = 90_000;
const RETRY_MS = 5_000;
const startedAt = Date.now();

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${what}\n`);
  if (!ok) failures.push(what);
};

async function get(path: string, redirect: RequestRedirect = 'follow') {
  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fetch(`${origin}${path}`, { headers: UA, redirect, signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
  throw last;
}

for (const locale of LOCALES) {
  for (const slug of PAGES) {
    const path = pagePath(locale, slug);
    let res = await get(path);
    while (res.status !== 200 && Date.now() - startedAt < SETTLE_MS) {
      process.stdout.write(`wait  ${path} answered ${res.status}; asking again in ${RETRY_MS / 1000} s (new deploy still reaching the edge?)\n`);
      await res.body?.cancel();
      await new Promise((r) => setTimeout(r, RETRY_MS));
      res = await get(path);
    }
    const html = await res.text();
    check(res.status === 200, `${path} 200 (got ${res.status})`);
    check(html.includes(`<html lang="${locale}" dir="${dir(locale)}"`), `${path} lang=${locale} dir=${dir(locale)}`);
    check(html.includes(`<link rel="canonical" href="${PRODUCTION_ORIGIN}${path}">`), `${path} canonical is ${PRODUCTION_ORIGIN}${path}`);
    check(!!res.headers.get('content-security-policy'), `${path} has a CSP`);
    check(!res.headers.get('set-cookie'), `${path} sets no cookie`);
    const robots = res.headers.get('x-robots-tag') ?? '';
    check(ENVIRONMENTS[env].indexable ? !robots.includes('noindex') : robots.includes('noindex'), `${path} X-Robots-Tag fits ${env} ("${robots}")`);
  }
}

const root = await get('/', 'manual');
check(root.status === 302 && (root.headers.get('location') ?? '').endsWith('/en/'), `/ → /en/ (got ${root.status} ${root.headers.get('location')})`);
const missing = await get('/en/no-such-page-smoke/');
check(missing.status === 404, `unknown path is 404 (got ${missing.status})`);
const robotsTxt = await (await get('/robots.txt')).text();
check(ENVIRONMENTS[env].indexable ? robotsTxt.includes('Sitemap:') : robotsTxt.includes('Disallow: /'), `robots.txt fits ${env}`);
if (ENVIRONMENTS[env].indexable) check((await get('/sitemap.xml')).status === 200, '/sitemap.xml 200');

if (failures.length) {
  process.stderr.write(`${failures.length} smoke check(s) failed on ${origin}\n`);
  process.exit(1);
}
process.stdout.write(`smoke passed on ${origin}\n`);
