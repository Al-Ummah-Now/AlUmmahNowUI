/**
 * Stand-in for the CMS in local E2E (playwright.config.ts starts it on :8585 next to `wrangler dev`).
 * /api/preview/v1 answers, plus the block and card-post fixtures in e2e/stub-blocks.ts (two pages,
 * card posts, /cards and their images) and the About page; everything else is 503, so the rest of the suite still
 * renders from built-in content exactly as with no CMS at all. It also answers the videos admin's
 * `/public/site-theme` (STUB_SITE_THEME, default zujaj), and stands in for the videos API (www's
 * VIDEOS_API_URL in local E2E): `/api/sites/by-channel/:id` from e2e/stub-scholar-sites.ts, every
 * other `/api/` path proxied to the QA videos API (VIDEOS_UPSTREAM), as when www read it directly.
 *
 * Tokens are `v1.<base64url {k,id,exp}>.<sig>`: sig `good` is valid, `expired` is what the CMS says
 * for an old token, anything else is invalid. Rows: pages/1 (English draft), posts/2 (Arabic draft),
 * pages/3 (a draft built from blocks), posts/4 (an Arabic card post draft).
 */
import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { PREVIEW_ROWS, publicFixture, stubImage } from './stub-blocks.ts';
import { scholarSitesFixture, siteByChannel } from './stub-scholar-sites.ts';
import { newsletterFixture, publicFeatures } from './stub-newsletter.ts';
import { en as builtinEn } from '../src/content/fallback/en.ts';
import { ar as builtinAr } from '../src/content/fallback/ar.ts';
import { aboutBlocks } from './stub-about.ts';

/**
 * The About page as the CMS serves it (CMS migrations 0021-0023: the owner's copy, en + ar, linked as
 * translations, built from blocks: hero, feature list, note). The SEO description differs from the
 * built-in page, so e2e/about.spec.ts can tell a page rendered from the CMS from the built-in fallback.
 */
const STUB_ABOUT_DESCRIPTION = 'About page served by the stub CMS';
const aboutPage = (locale: string) => {
  const page = (locale === 'ar' ? builtinAr : builtinEn).pages.about!;
  return { ...page, seo_description: STUB_ABOUT_DESCRIPTION, images: [], list_kind: null, blocks: aboutBlocks(locale === 'ar' ? 'ar' : 'en') };
};

const PORT = Number(process.env.STUB_CMS_PORT || 8585);
const STUB_SITE_THEME = process.env.STUB_SITE_THEME || 'zujaj';
const VIDEOS_UPSTREAM = process.env.VIDEOS_UPSTREAM || 'https://videos.api.qa.alummahnow.net';
const now = '2026-11-08T10:00:00.000Z';
const ROWS: Record<string, unknown> = {
  'pages/1': {
    slug: 'preview-draft', locale: 'en', title: 'Draft page for preview', summary: 'A summary only editors have seen.',
    body: '## Draft heading\n\nThis text is **not published** yet.', seo_title: null, seo_description: null, cover: null,
    published_at: now, updated_at: now, alternates: [],
  },
  'posts/2': {
    slug: 'khabar', locale: 'ar', title: 'خبر لم يُنشر بعد', excerpt: 'ملخص المسودة.', cover: null, author_name: 'فريق التحرير', tags: ['أخبار'],
    published_at: now, updated_at: now, body: 'نص **المسودة**.', seo_title: null, seo_description: null, alternates: [],
  },
  ...PREVIEW_ROWS,
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
    res.end(JSON.stringify(body));
  };
  const img = /^\/media\/(\d+)\.png$/.exec(url.pathname);
  if (img) {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=600', 'Access-Control-Allow-Origin': '*' });
    return res.end(stubImage(Number(img[1])));
  }
  // The videos admin's site theme (www reads it through ADMIN_API_URL, scripts/dev-vars.ts points it
  // here). Not the default theme, so the suite proves www renders what the admin chose.
  if (url.pathname === '/public/site-theme') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' });
    return res.end(JSON.stringify({ theme: STUB_SITE_THEME }));
  }
  // Which optional features can work (www src/lib/features.ts): STUB_NEWSLETTER=off switches the newsletter off
  if (url.pathname === '/public/features') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' });
    return res.end(JSON.stringify(publicFeatures()));
  }
  // The videos admin's newsletter endpoints (www's sign-up form, confirm and unsubscribe pages)
  if (url.pathname.startsWith('/internal/newsletter/')) {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch {
        body = {};
      }
      const key = req.headers['x-api-key'];
      const out = newsletterFixture(url.pathname, req.method ?? 'GET', typeof key === 'string' ? key : undefined, body)!;
      send(out.status, out.body);
    });
    return;
  }
  const sites = scholarSitesFixture(url.pathname.replace(/^\/api\/public\/v1/, ''), url.searchParams.get('locale') ?? 'en');
  if (sites && url.pathname.startsWith('/api/public/v1/')) return send(sites.status, sites.body);
  if (url.pathname === '/api/public/v1/pages/about') return send(200, aboutPage(url.searchParams.get('locale') === 'ar' ? 'ar' : 'en'));
  const fixture = publicFixture(url);
  if (fixture) return send(fixture.status, fixture.body);
  const site = siteByChannel(url.pathname);
  if (site) {
    res.writeHead(site.status, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' });
    return res.end(JSON.stringify(site.body));
  }
  // The rest of the videos API: passed through to QA unchanged (method, body, Origin, and its CORS
  // answer), as when www and the browser read it directly
  if (url.pathname.startsWith('/api/') && !/^\/api\/(public|preview)\//.test(url.pathname)) {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const headers: Record<string, string> = {};
      for (const h of ['accept', 'content-type', 'origin', 'access-control-request-method', 'access-control-request-headers']) {
        const v = req.headers[h];
        if (typeof v === 'string') headers[h] = v;
      }
      const method = req.method ?? 'GET';
      fetch(`${VIDEOS_UPSTREAM}${url.pathname}${url.search}`, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks), signal: AbortSignal.timeout(10_000) })
        .then(async (up) => {
          const out: Record<string, string> = {};
          up.headers.forEach((v, k) => {
            if (k === 'content-type' || k === 'cache-control' || k === 'vary' || k.startsWith('access-control-')) out[k] = v;
          });
          res.writeHead(up.status, out);
          res.end(Buffer.from(await up.arrayBuffer()));
        })
        .catch(() => send(502, { error: 'upstream' }));
    });
    return;
  }
  const m = /^\/api\/preview\/v1\/(pages|posts)\/(\d+)$/.exec(url.pathname);
  if (!m) return send(503, { error: 'stub' });
  const auth = /^Bearer (v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+))$/.exec(req.headers.authorization ?? '');
  if (!auth) return send(401, { error: 'invalid_token' });
  let claims: { k?: string; id?: number; exp?: number } = {};
  try {
    claims = JSON.parse(Buffer.from(auth[2] ?? '', 'base64url').toString('utf8'));
  } catch {
    return send(401, { error: 'invalid_token' });
  }
  if (auth[3] === 'expired') return send(401, { error: 'expired_token' });
  if (auth[3] !== 'good' || claims.k !== m[1] || claims.id !== Number(m[2])) return send(401, { error: 'invalid_token' });
  const row = ROWS[`${m[1]}/${m[2]}`];
  if (!row) return send(404, { error: 'not_found' });
  send(200, {
    kind: m[1] === 'pages' ? 'page' : 'post',
    id: Number(m[2]),
    status: 'draft',
    expires_at: new Date((claims.exp ?? 0) * 1000).toISOString(),
    edit_url: `http://localhost:${PORT}/${m[1]}/${m[2]}`,
    content: row,
  });
}).listen(PORT, () => console.log(`stub CMS on :${PORT}`));
