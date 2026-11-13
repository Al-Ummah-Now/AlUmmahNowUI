/**
 * Stand-in for the CMS in local E2E (playwright.config.ts starts it on :8585 next to `wrangler dev`).
 * /api/preview/v1 answers, plus the block and card-post fixtures in e2e/stub-blocks.ts (two pages,
 * card posts, /cards and their images); everything else is 503, so the rest of the suite still
 * renders from built-in content exactly as with no CMS at all. It also answers the videos admin's
 * `/public/site-theme` (STUB_SITE_THEME, default zujaj).
 *
 * Tokens are `v1.<base64url {k,id,exp}>.<sig>`: sig `good` is valid, `expired` is what the CMS says
 * for an old token, anything else is invalid. Rows: pages/1 (English draft), posts/2 (Arabic draft),
 * pages/3 (a draft built from blocks), posts/4 (an Arabic card post draft).
 */
import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { PREVIEW_ROWS, publicFixture, stubImage } from './stub-blocks.ts';

const PORT = Number(process.env.STUB_CMS_PORT || 8585);
const STUB_SITE_THEME = process.env.STUB_SITE_THEME || 'zujaj';
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
  const fixture = publicFixture(url);
  if (fixture) return send(fixture.status, fixture.body);
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
