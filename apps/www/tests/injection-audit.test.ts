/**
 * Injection security audit regression tests for www and packages/render (UI-1 through UI-10).
 * Covers Markdown link/image protocol allowlists, community post URL validation, preview editUrl &
 * pictureHtml src validation, open-redirect / backslash / CRLF guards, JSON-LD escaping,
 * stableImageUrl scheme validation, newsletter X-Client-IP CRLF defense, log sanitization,
 * search suggest safety, timeline playable URL validation, and CSP invariants.
 */
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/lib/markdown';
import { stableImageUrl } from '../src/lib/images';
import { pictureHtml } from '../src/lib/picture';
import { parsePreview } from '../src/lib/preview';
import { navHref } from '../src/lib/context';
import { jsonLdText } from '../src/lib/seo';
import { callback, logout } from '../src/lib/auth-routes';
import { LOGIN_COOKIE, safeReturnPath } from '../src/lib/auth';
import { seal } from '../src/lib/session';
import { subscribe } from '../src/lib/newsletter';
import { hitsOf, isSafeHref, scholarHitsOf } from '../src/lib/search/suggest';
import { contentSecurityPolicy } from '../src/lib/edge';
import { playable } from '../src/scripts/timeline-media';
import { safeOutsideUrl } from '../../../packages/render/src/posts/post-kinds';
import {
  isSafeRelativePath,
  safeHttpsUrl,
  safeHttpUrl,
  safeJsonLd,
  safeMarkdownHref,
  safeMarkdownImgSrc,
  sanitizeLogError,
  sanitizeLogText,
} from '../../../packages/render/src/urls';
import type { Config } from '../src/lib/env';

const cfg: Config = {
  appEnv: 'production',
  isProduction: true,
  siteUrl: 'https://www.alummahnow.net',
  cmsPublicUrl: 'https://cms.alummahnow.net',
  videosApiUrl: 'https://api-videos.alummahnow.net',
  videosWebUrl: 'https://videos.alummahnow.net',
  authUrl: 'https://auth.alummahnow.net',
  profileUrl: 'https://profile.alummahnow.net',
  adminApiUrl: 'https://admin-api.alummahnow.net',
  clientId: 'www-client',
  version: 'test',
  signIn: true,
};

describe('UI-1: Markdown link & image strict allowlist (http/https/mailto only; no raw HTML)', () => {
  it('allows http, https, mailto, safe relative paths and fragments; blocks data:, tel:, ftp:, blob:, protocol-relative, and backslashes', () => {
    const md = [
      '[ok-https](https://alummahnow.net/en/)',
      '[ok-http](http://example.com)',
      '[ok-mail](mailto:hello@alummahnow.net)',
      '[ok-rel](/en/about/)',
      '[ok-hash](#section-1)',
      '[bad-js](javascript:alert(1))',
      '[bad-vb](vbscript:msgbox(1))',
      '[bad-data-html](data:text/html,<script>alert(1)</script>)',
      '[bad-data-img](data:image/png;base64,AAAA)',
      '[bad-tel](tel:+123456789)',
      '[bad-ftp](ftp://evil.example/file)',
      '[bad-blob](blob:https://evil.example/1)',
      '[bad-proto-rel](//evil.example/phish)',
      '[bad-backslash](/\\evil.example/phish)',
    ].join(' ');
    const html = renderMarkdown(md, { renderVideo: () => '' });
    expect(html).toContain('href="https://alummahnow.net/en/"');
    expect(html).toContain('href="http://example.com"');
    expect(html).toContain('href="mailto:hello@alummahnow.net"');
    expect(html).toContain('href="/en/about/"');
    expect(html).toContain('href="#section-1"');
    // Only the 5 allowed links (+ linkified https:// inside inert blob text) become <a>; none of the disallowed schemes or bypasses become hrefs
    expect(html).not.toMatch(/href="(?:javascript|vbscript|data|tel|ftp|blob):/i);
    expect(html).not.toMatch(/href="(?:\/\/|\/\\|\/%5c)/i);
    expect(safeMarkdownHref('https://example.com/\r\n')).toBe(false);
    expect(safeMarkdownHref('/\\evil.example')).toBe(false);
    expect(safeMarkdownHref('/%5Cevil.example')).toBe(false);
  });

  it('drops images with non-http(s)/non-relative schemes (data:, mailto:, javascript:, //evil)', () => {
    const md = [
      '![ok](https://images.alummahnow.net/a.jpg)',
      '![ok-rel](/brand/logo-192.webp)',
      '![bad-data](data:image/svg+xml,<svg onload=alert(1)>)',
      '![bad-png-data](data:image/png;base64,iVBORw0KGgo=)',
      '![bad-mail](mailto:x@y.com)',
      '![bad-js](javascript:alert(1))',
      '![bad-proto](//evil.example/x.png)',
    ].join('\n\n');
    const html = renderMarkdown(md, { renderVideo: () => '' });
    expect(html).toContain('src="https://images.alummahnow.net/a.jpg"');
    expect(html).toContain('src="/brand/logo-192.webp"');
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).not.toMatch(/src="(?:data|mailto|javascript):/i);
    expect(html).not.toMatch(/src="\/\//i);
    expect(safeMarkdownImgSrc('mailto:a@b.com')).toBe(false);
    expect(safeMarkdownImgSrc('data:image/png;base64,AAA')).toBe(false);
  });
});

describe('UI-2 & UI-3: Community post links, preview editUrl, pictureHtml, and timeline media', () => {
  it('safeOutsideUrl rejects javascript:, data:, and control characters', () => {
    expect(safeOutsideUrl('https://videos.alummahnow.net/en/channels/1?tab=community')).toBe('https://videos.alummahnow.net/en/channels/1?tab=community');
    expect(safeOutsideUrl('javascript:alert(1)')).toBeNull();
    expect(safeOutsideUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeOutsideUrl('https://example.com/\r\nX-Test: 1')).toBeNull();
  });

  it('parsePreview rejects non-http(s) edit_url', () => {
    const base = {
      kind: 'page',
      status: 'draft',
      expires_at: '2026-12-01T00:00:00Z',
      edit_url: 'javascript:alert(1)',
      content: { id: 1, slug: 'p', locale: 'en', title: 'T', body: 'B', updated_at: '2026-11-01T00:00:00Z', alternates: [] },
    };
    expect(parsePreview('pages', base)).toBeNull();
    expect(parsePreview('pages', { ...base, edit_url: 'https://cms.alummahnow.net/pages/1' })).not.toBeNull();
  });

  it('pictureHtml refuses javascript: and data: URLs', () => {
    expect(pictureHtml({ url: 'javascript:alert(1)', alt: 'x', width: 100, height: 100 }, 'https://cms.alummahnow.net', { sizes: '100vw' })).toBe('');
    expect(pictureHtml({ url: 'data:text/html,<script>', alt: 'x', width: 100, height: 100 }, 'https://cms.alummahnow.net', { sizes: '100vw' })).toBe('');
    expect(pictureHtml({ url: 'https://cms.alummahnow.net/api/public/v1/media/a.png', alt: 'ok', width: 100, height: 100 }, 'https://cms.alummahnow.net', { sizes: '100vw' })).toContain(
      'src="https://cms.alummahnow.net/api/public/v1/media/a.png"',
    );
  });

  it('playable rejects non-https mp4 URLs and control characters', () => {
    expect(playable({ id: 'v1', title: 'T', mp4: { url: 'javascript:alert(1)' } })).toBe(false);
    expect(playable({ id: 'v1', title: 'T', mp4: { url: 'https://media.alummahnow.net/a.mp4\r\n' } })).toBe(false);
    expect(playable({ id: 'v1', title: 'T', mp4: { url: 'https://media.alummahnow.net/a.mp4' } })).toBe(true);
  });
});

describe('UI-4, UI-5, UI-6, UI-7, UI-8, UI-9, UI-10: Redirects, JSON-LD, images, headers, logs, search, CSP', () => {
  it('navHref and isSafeRelativePath block backslashes, protocol-relative URLs, and control chars', () => {
    expect(navHref('/about/', 'en')).toBe('/en/about/');
    expect(navHref('https://videos.alummahnow.net/en', 'en')).toBe('https://videos.alummahnow.net/en');
    for (const bad of ['//evil.example', '/\\evil.example', '/about\r\nSet-Cookie: a=1', 'javascript:alert(1)', 'https://evil.example/\r\n']) {
      expect(navHref(bad, 'en'), bad).toBeNull();
    }
    expect(isSafeRelativePath('/..//evil.example')).toBe(false);
  });

  it('auth callback and logout reject tampered returnTo and CRLF next URLs', async () => {
    const secret = 'a'.repeat(64);
    const badLoginCookie = await seal(secret, { state: 'st1', verifier: 'v'.repeat(48), returnTo: 'https://evil.example/phish', exp: Math.floor(Date.now() / 1000) + 600 });
    const req = new Request('https://www.alummahnow.net/auth/callback?error=access_denied', {
      headers: { Cookie: `${LOGIN_COOKIE}=${badLoginCookie}` },
    });
    const res = await callback(req, { cfg, secret });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');

    const badLogout = await logout(new Request('https://www.alummahnow.net/auth/logout?next=https%3A%2F%2Fauth.alummahnow.net%2Flogout%0D%0AX-Evil%3A1'), { cfg, secret });
    expect(badLogout.status).toBe(302);
    expect(badLogout.headers.get('Location')).toContain('https://auth.alummahnow.net/logout?return=');
    expect(badLogout.headers.get('Location')).not.toContain('X-Evil');
    expect(safeReturnPath('/\\evil.example')).toBe('/');
  });

  it('jsonLdText escapes <, >, &, U+2028, and U+2029 while staying valid JSON', () => {
    const payload = { headline: '</script><img src=x>&\u2028\u2029-->' };
    const out = jsonLdText(payload);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
    expect(JSON.parse(out)).toEqual(payload);
    expect(safeJsonLd(payload)).toBe(out);
  });

  it('stableImageUrl rejects javascript: and data: URLs while preserving valid https/relative URLs', () => {
    expect(stableImageUrl('https://videos.alummahnow.net', 'javascript:alert(1)')).toBeNull();
    expect(stableImageUrl('https://videos.alummahnow.net', 'data:text/html,<script>')).toBeNull();
    expect(stableImageUrl('https://videos.alummahnow.net', 'https://images.alummahnow.net/a.jpg')).toBe('https://images.alummahnow.net/a.jpg');
    expect(stableImageUrl('https://videos.alummahnow.net', '/brand/og-card.jpg')).toBe('/brand/og-card.jpg');
  });

  it('newsletter subscribe drops invalid/CRLF X-Client-IP values before forwarding', async () => {
    let forwardedIp: string | null = 'unset';
    const fakeFetch = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      forwardedIp = h.get('X-Client-IP');
      return new Response(JSON.stringify({ ok: true }), { status: 202 });
    }) as typeof fetch;
    await subscribe({ adminApiUrl: 'https://admin-api.test', key: 'k', fetchImpl: fakeFetch }, { email: 'user@example.com', locale: 'en', website: '', turnstileToken: null }, '1.2.3.4\r\nX-Injected: yes');
    expect(forwardedIp).toBeNull();
    await subscribe({ adminApiUrl: 'https://admin-api.test', key: 'k', fetchImpl: fakeFetch }, { email: 'user@example.com', locale: 'en', website: '', turnstileToken: null }, '203.0.113.5');
    expect(forwardedIp).toBe('203.0.113.5');
  });

  it('sanitizes control chars in logs, search hits, and URL helpers', () => {
    // eslint-disable-next-line no-control-regex
    expect(sanitizeLogText('bad\r\n{"msg":"forged"}\u0000')).not.toMatch(/[\r\n\u0000-\u001f\u007f]/);
    expect(sanitizeLogError(new Error('fail\nforged'))).toBe('Error: fail forged');
    expect(isSafeHref('/en/articles/ok')).toBe(true);
    expect(isSafeHref('/en/articles/ok\r\n')).toBe(false);
    expect(hitsOf([{ id: 1, type: 'article', title: 'T', slug: 's', locale: 'en', href: '/en/articles/s', thumbnailUrl: 'https://cdn.example/\r\n', excerpt: null, publishedAt: '' }])).toEqual([]);
    expect(scholarHitsOf([{ type: 'scholar', slug: 's', title: 'T', href: '/en/scholars/s', thumbnailUrl: 'https://cdn.example/\r\n' }], 'en')?.[0]?.thumbnailUrl).toBeNull();
    expect(safeHttpsUrl('https://example.com/ok')).toBe('https://example.com/ok');
    expect(safeHttpsUrl('http://example.com/no')).toBeNull();
    expect(safeHttpUrl('http://localhost:8788/ok')).toBe('http://localhost:8788/ok');
  });

  it('www CSP forbids unsafe-inline, unsafe-eval, object embeds, and framing', () => {
    const csp = contentSecurityPolicy(cfg);
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });
});
