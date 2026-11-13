/**
 * Local E2E stand-in for api-videos (the site registry, videos, community posts) and the auth
 * server (authorize, token, jwks, logout) on one port. It behaves like the real ones where the
 * tests look: /authorize only returns to an exact /auth/callback of a site it knows (as auth's
 * registry check does), refresh tokens are revoked by /logout.
 *   node --experimental-strip-types e2e/stub-api.ts
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { STUB_PORT, stubSites, VIDEOS, POSTS, CHANNEL_ID } from './stub-data.ts';

const ORIGIN = `http://localhost:${STUB_PORT}`;
const { privateKey, publicKey } = await generateKeyPair('ES256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'stub', alg: 'ES256', use: 'sig' };
const codes = new Map<string, string>();
const liveRefresh = new Set<string>();
let counter = 0;

const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(body === null ? '' : JSON.stringify(body));
};
const redirect = (res: ServerResponse, location: string) => {
  res.writeHead(302, { Location: location });
  res.end();
};
const readBody = (req: IncomingMessage) => new Promise<string>((ok) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => ok(data));
});

async function accessToken(): Promise<string> {
  return new SignJWT({ mode: 'access', type: 'user', properties: { id: 'usr_viewer', name: 'Test Viewer', email: 'viewer@example.com' } })
    .setProtectedHeader({ alg: 'ES256', kid: 'stub' })
    .setIssuer(ORIGIN)
    .setSubject('user:usr_viewer')
    .setExpirationTime('15m')
    .sign(privateKey);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', ORIGIN);
  const p = url.pathname;
  try {
    // ---- api-videos ----
    let m = /^\/api\/sites\/by-host\/([^/]+)$/.exec(p);
    if (m) {
      const host = decodeURIComponent(m[1] as string);
      const entry = stubSites()[host];
      if (!entry) return send(res, 404, { error: 'site_not_found' });
      return send(res, 200, entry, { 'Cache-Control': 'no-store' });
    }
    m = /^\/api\/channels\/([^/]+)\/videos$/.exec(p);
    if (m) return send(res, 200, { data: m[1] === CHANNEL_ID ? VIDEOS : [], cursor: '' });
    m = /^\/api\/videos\/([^/]+)$/.exec(p);
    if (m) {
      const v = VIDEOS.find((x) => x.id === m?.[1]);
      return v ? send(res, 200, v) : send(res, 404, { error: 'not_found' });
    }
    m = /^\/api\/community\/channels\/([^/]+)\/posts(?:\/([^/]+))?$/.exec(p);
    if (m) {
      if (m[1] !== CHANNEL_ID) return send(res, 200, { posts: [], pagination: { hasNext: false } });
      if (m[2]) {
        const post = POSTS.find((x) => x.id === m?.[2]);
        return post ? send(res, 200, post) : send(res, 404, { error: 'Post not found' });
      }
      return send(res, 200, { posts: POSTS, pagination: { page: 1, limit: 10, total: POSTS.length, hasNext: false } });
    }
    // ---- auth ----
    if (p === '/.well-known/jwks.json') return send(res, 200, { keys: [jwk] });
    if (p === '/authorize') {
      const redirectUri = url.searchParams.get('redirect_uri') ?? '';
      const callback = /^https?:\/\/([^/]+)\/auth\/callback$/.exec(redirectUri);
      const host = callback?.[1]?.replace(/:\d+$/, '');
      // As auth: only the exact callback of a known, live site (never a pattern)
      if (!host || stubSites()[host]?.site?.status !== 'live' || stubSites()[host]?.site?.primaryHost !== callback?.[1]) return send(res, 400, { error: 'invalid_redirect_uri' });
      if (url.searchParams.get('code_challenge_method') !== 'S256') return send(res, 400, { error: 'pkce_required' });
      const code = `code-${++counter}`;
      codes.set(code, redirectUri);
      return redirect(res, `http://${stubSites()[host]?.site?.primaryHost}/auth/callback?code=${code}&state=${encodeURIComponent(url.searchParams.get('state') ?? '')}`);
    }
    if (p === '/token' && req.method === 'POST') {
      const form = new URLSearchParams(await readBody(req));
      if (form.get('grant_type') === 'authorization_code') {
        const code = form.get('code') ?? '';
        if (codes.get(code) !== form.get('redirect_uri') || !form.get('code_verifier')) return send(res, 400, { error: 'invalid_grant' });
        codes.delete(code);
        const rt = `rt-${++counter}`;
        liveRefresh.add(rt);
        return send(res, 200, { access_token: await accessToken(), refresh_token: rt });
      }
      if (form.get('grant_type') === 'refresh_token') {
        const rt = form.get('refresh_token') ?? '';
        if (!liveRefresh.has(rt)) return send(res, 400, { error: 'invalid_grant' });
        liveRefresh.delete(rt);
        const next = `rt-${++counter}`;
        liveRefresh.add(next);
        return send(res, 200, { access_token: await accessToken(), refresh_token: next });
      }
      return send(res, 400, { error: 'unsupported_grant_type' });
    }
    if (p === '/logout') {
      liveRefresh.clear();
      // As auth: only back to a site this stub knows
      const back = new URL(url.searchParams.get('return') ?? '/', ORIGIN);
      const site = stubSites()[back.hostname]?.site;
      return site?.primaryHost ? redirect(res, `http://${site.primaryHost}${back.pathname.replace(/[^\w/-]/g, '')}`) : send(res, 400, { error: 'invalid_return' });
    }
    if (p === '/healthz') return send(res, 200, { ok: true });
    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'internal_error' });
  }
}).listen(STUB_PORT, () => console.log(`stub api + auth on ${ORIGIN}`));
