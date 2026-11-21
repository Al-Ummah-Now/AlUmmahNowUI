import { describe, expect, it } from 'vitest';
import { CSP, headersFile, robotsTxt } from '../scripts/env-files';
import { verdict } from '../scripts/release/zone-check';
import { checkDevConfig } from '../scripts/check-wrangler-config';
import { readFileSync } from 'node:fs';
import { parseJsonc } from '../../www/scripts/jsonc';
import { headLinks } from '../src/lib/seo';

describe('env files', () => {
  it('only production is indexable', () => {
    expect(robotsTxt('production')).toContain('Sitemap: https://alummahnow.dev/sitemap.xml');
    for (const env of ['qa', 'stage', 'local'] as const) {
      expect(robotsTxt(env)).toBe('User-agent: *\nDisallow: /\n');
      expect(headersFile(env)).toContain('X-Robots-Tag: noindex, nofollow');
    }
    expect(headersFile('production')).not.toContain('X-Robots-Tag');
  });
  it('CSP allows nothing inline, and no third party but Cloudflare Web Analytics (as www)', () => {
    expect(CSP).toContain("default-src 'none'");
    expect(CSP).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(CSP).toContain("script-src 'self' https://static.cloudflareinsights.com;");
    expect(CSP).toContain("connect-src 'self' https://cloudflareinsights.com;");
    // no other origin anywhere
    expect(CSP.replace(/https:\/\/(static\.)?cloudflareinsights\.com/g, '')).not.toMatch(/https?:/);
    expect(headersFile('production')).toContain(`Content-Security-Policy: ${CSP}`);
  });
});

describe('zone check', () => {
  const acct = 'a1';
  it('ready only for an active zone on this account', () => {
    expect(verdict({ success: true, result: [{ id: 'z', name: 'alummahnow.dev', status: 'active', account: { id: acct } }] }, acct).ready).toBe(true);
    expect(verdict({ success: true, result: [] }, acct).ready).toBe(false);
    expect(verdict({ success: true, result: [{ id: 'z', name: 'alummahnow.dev', status: 'pending', account: { id: acct } }] }, acct).ready).toBe(false);
    expect(verdict({ success: true, result: [{ id: 'z', name: 'alummahnow.dev', status: 'active', account: { id: 'other' } }] }, acct).ready).toBe(false);
    expect(verdict({ success: false, errors: [{ code: 9109, message: 'Invalid access token' }] }, acct).ready).toBe(false);
  });
});

describe('wrangler config', () => {
  it('passes the check', () => {
    const cfg = parseJsonc(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
    expect(checkDevConfig(cfg as never)).toEqual([]);
  });
  it('refuses a Worker script or a binding', () => {
    expect(checkDevConfig({ main: 'x.js', assets: { directory: './dist', not_found_handling: '404-page' } } as never)).toContain('main must not be set: the site is static assets only');
  });
});

describe('seo', () => {
  it('canonical is production; hreflang en, ar and x-default', () => {
    const l = headLinks('ar', 'contact');
    expect(l.canonical).toBe('https://alummahnow.dev/ar/contact/');
    expect(l.alternates.map((a) => a.hreflang)).toEqual(['en', 'ar', 'x-default']);
    expect(l.alternates[2]?.href).toBe('https://alummahnow.dev/en/contact/');
  });
});
