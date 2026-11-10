import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../src/lib/edge';
import { MODE_KEY, MODE_SCRIPT, MODE_SCRIPT_HASH, parseMode } from '../src/lib/theme-mode';
import { config } from '../src/lib/env';

describe('theme mode', () => {
  it('MODE_SCRIPT_HASH is the sha256 of the inline head script', () => {
    const hash = `'sha256-${createHash('sha256').update(MODE_SCRIPT, 'utf8').digest('base64')}'`;
    expect(MODE_SCRIPT_HASH, `update MODE_SCRIPT_HASH to ${hash}`).toBe(hash);
  });

  it('CSP allows the head script by hash and still no unsafe-inline', () => {
    const csp = contentSecurityPolicy(config({ APP_ENV: 'production', SITE_URL: 'https://www.alummahnow.net' }));
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src '))!;
    expect(scriptSrc).toContain(MODE_SCRIPT_HASH);
    expect(csp).not.toContain('unsafe-inline');
  });

  it('the head script reads the same key the toggle writes', () => {
    expect(MODE_SCRIPT).toContain(`"${MODE_KEY}"`);
  });

  it('parseMode keeps light/dark/system and falls back to system', () => {
    expect(parseMode('light')).toBe('light');
    expect(parseMode('dark')).toBe('dark');
    expect(parseMode('system')).toBe('system');
    for (const v of [null, undefined, '', 'DARK', 'sepia', 1]) expect(parseMode(v)).toBe('system');
  });

  it('the head script applies a saved choice and survives blocked storage', () => {
    const run = (getItem: () => string | null) => {
      const attrs: Record<string, string> = {};
      const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
      const localStorage = { getItem };
      new Function('document', 'localStorage', MODE_SCRIPT)(document, localStorage);
      return attrs;
    };
    expect(run(() => 'dark')).toEqual({ 'data-js': '', 'data-mode': 'dark' });
    expect(run(() => 'light')).toEqual({ 'data-js': '', 'data-mode': 'light' });
    expect(run(() => 'nonsense')).toEqual({ 'data-js': '' });
    expect(run(() => {
      throw new Error('SecurityError');
    })).toEqual({ 'data-js': '' });
  });
});
