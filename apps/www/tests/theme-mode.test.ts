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

  it('parseMode keeps light/dark and gives null for anything else (no "System" mode)', () => {
    expect(parseMode('light')).toBe('light');
    expect(parseMode('dark')).toBe('dark');
    for (const v of ['system', null, undefined, '', 'DARK', 'sepia', 1]) expect(parseMode(v)).toBeNull();
  });

  it('the head script applies a saved choice, migrates an old "system" once, and survives blocked storage', () => {
    const run = (getItem: () => string | null, prefersDark = false) => {
      const attrs: Record<string, string> = {};
      const saved: Record<string, string> = {};
      const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) }, cookie: '' };
      const localStorage = { getItem, setItem: (k: string, v: string) => (saved[k] = v) };
      const matchMedia = () => ({ matches: prefersDark });
      new Function('document', 'localStorage', 'matchMedia', 'window', MODE_SCRIPT)(document, localStorage, matchMedia, {});
      // Every load picks one of the street tile variants, whatever the mode or storage does
      expect(attrs['data-fanous-street-variant']).toMatch(/^[1-4]$/);
      delete attrs['data-fanous-street-variant'];
      return { attrs, saved };
    };
    expect(run(() => 'dark').attrs).toEqual({ 'data-js': '', 'data-mode': 'dark' });
    expect(run(() => 'light').attrs).toEqual({ 'data-js': '', 'data-mode': 'light' });
    expect(run(() => null).attrs).toEqual({ 'data-js': '' });
    expect(run(() => 'nonsense').attrs).toEqual({ 'data-js': '' });
    expect(run(() => 'system', true)).toEqual({ attrs: { 'data-js': '', 'data-mode': 'dark' }, saved: { aun_mode: 'dark' } });
    expect(run(() => 'system', false)).toEqual({ attrs: { 'data-js': '', 'data-mode': 'light' }, saved: { aun_mode: 'light' } });
    expect(run(() => {
      throw new Error('SecurityError');
    }).attrs).toEqual({ 'data-js': '' });
  });

  it('the head script lets a test pin the street tile variant', () => {
    const attrs: Record<string, string> = {};
    const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) }, cookie: '' };
    new Function('document', 'localStorage', 'matchMedia', 'window', MODE_SCRIPT)(document, { getItem: () => null }, () => ({ matches: false }), { __AUN_STREET_VARIANT__: 3 });
    expect(attrs['data-fanous-street-variant']).toBe('3');
  });
});
