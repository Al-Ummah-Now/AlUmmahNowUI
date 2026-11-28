/**
 * Injection security audit regression tests for apps/sites (scholar sites).
 * Covers pathRedirect backslash/CRLF defense, lookupSite redirectTo validation,
 * JSON-LD escaping, sameAs URL validation, CSP invariants, and community post URL sanitization.
 */
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, pathRedirect } from '../src/lib/edge';
import { lookupSite, resetSiteMemo } from '../src/lib/site';
import { jsonLdText, siteJsonLd } from '../src/lib/seo';
import { toSitePost } from '../src/lib/data';
import type { Config } from '../src/lib/env';
import type { PublicSite } from '../src/lib/site-types';

const cfg: Config = {
  appEnv: 'production',
  isProduction: true,
  wwwUrl: 'https://www.alummahnow.net',
  videosApiUrl: 'https://api-videos.alummahnow.net',
  videosWebUrl: 'https://videos.alummahnow.net',
  authUrl: 'https://auth.alummahnow.net',
  profileUrl: 'https://profile.alummahnow.net',
  clientId: 'sites-client',
  version: 'test',
  signIn: true,
};

const makeSite = (overrides: Partial<PublicSite['site']> = {}, channelLinks: { title: string; url: string }[] = []): PublicSite => ({
  host: 'scholar.alummahnow.org',
  redirectTo: null,
  preview: false,
  site: {
    channelId: 'ch-1',
    slug: 'scholar',
    primaryHost: 'scholar.alummahnow.org',
    primaryKind: 'subdomain',
    status: 'live',
    themeRef: 'fanous:classic',
    configVersion: 1,
    locales: ['en', 'ar'],
    name: { en: 'Scholar', ar: 'عالم' },
    logoUrl: null,
    faviconUrl: null,
    about: {},
    navigation: [],
    platformMark: 'required',
    redirects: [],
    ...overrides,
  },
  channel: {
    id: 'ch-1',
    name: 'Scholar',
    handle: 'scholar',
    avatarUrl: null,
    description: null,
    links: channelLinks,
  },
});

describe('Sites injection audit: redirects, JSON-LD, community posts, and CSP', () => {
  it('pathRedirect blocks backslash open redirects, protocol-relative URLs, and CRLF', () => {
    const site = makeSite({
      redirects: [
        { from: '/ok-rel', to: '/en/about/' },
        { from: '/ok-https', to: 'https://alummahnow.net/en/' },
        { from: '/bad-bs', to: '/\\evil.example' },
        { from: '/bad-proto', to: '//evil.example' },
        { from: '/bad-crlf', to: '/en/ok\r\nSet-Cookie: evil=1' },
        { from: '/bad-js', to: 'javascript:alert(1)' },
      ],
    });
    expect(pathRedirect(new URL('https://scholar.alummahnow.org/ok-rel'), site)?.headers.get('Location')).toBe('/en/about/');
    expect(pathRedirect(new URL('https://scholar.alummahnow.org/ok-https'), site)?.headers.get('Location')).toBe('https://alummahnow.net/en/');
    expect(pathRedirect(new URL('https://scholar.alummahnow.org/bad-bs'), site)).toBeNull();
    expect(pathRedirect(new URL('https://scholar.alummahnow.org/bad-proto'), site)).toBeNull();
    expect(pathRedirect(new URL('https://scholar.alummahnow.org/bad-crlf'), site)).toBeNull();
    expect(pathRedirect(new URL('https://scholar.alummahnow.org/bad-js'), site)).toBeNull();
  });

  it('lookupSite rejects redirectTo values containing control characters or non-http(s) schemes', async () => {
    resetSiteMemo();
    const res = await lookupSite('bad-redir.alummahnow.org', null, {
      apiUrl: cfg.videosApiUrl,
      waitUntil: () => undefined,
      fetchImpl: async () => new Response(JSON.stringify({ redirectTo: 'https://evil.example/\r\nX-Inject: 1' }), { status: 200 }),
    });
    expect(res.kind).toBe('unavailable');
  });

  it('jsonLdText and siteJsonLd escape dangerous script sequences and filter unsafe sameAs links', () => {
    const out = jsonLdText({ name: '</script><script>alert(1)</script>&\u2028\u2029' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>&\u2028\u2029' });

    const site = makeSite({}, [
      { title: 'Good', url: 'https://youtube.com/@scholar' },
      { title: 'CRLF', url: 'https://youtube.com/@bad\r\nX' },
      { title: 'JS', url: 'javascript:alert(1)' },
    ]);
    const ld = siteJsonLd(site, 'en', 'https://videos.alummahnow.net/en/@scholar') as { sameAs?: string[] }[];
    expect(ld[1]?.sameAs).toEqual(['https://videos.alummahnow.net/en/@scholar', 'https://youtube.com/@scholar']);
  });

  it('toSitePost drops unsafe link, image, and gif URLs', () => {
    const post = toSitePost({
      id: 'p-1',
      type: 'link',
      status: 'published',
      visibility: 'public',
      content: '<b>Hello</b> <script>alert(1)</script>',
      link: { url: 'javascript:alert(1)', title: 'Bad' },
      images: [{ url: 'javascript:alert(2)', alt: 'x' }, { url: 'https://images.alummahnow.net/ok.jpg', alt: 'ok' }],
      gif: { url: 'data:text/html,<script>' },
      createdAt: '2026-11-01T00:00:00Z',
    });
    expect(post).not.toBeNull();
    expect(post!.link).toBeNull();
    expect(post!.gif).toBeNull();
    expect(post!.images.map((i) => i.url)).toEqual(['https://images.alummahnow.net/ok.jpg']);
  });

  it('sites CSP forbids unsafe-inline, unsafe-eval, object embeds, and framing', () => {
    const csp = contentSecurityPolicy(cfg, { preview: false, https: true });
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });
});
