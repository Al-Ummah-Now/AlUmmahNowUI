import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';

/** Same shape: every key and array length in en exists in ar, and no string is empty. */
function shape(v: unknown, path = ''): string[] {
  if (Array.isArray(v)) return [`${path}[${v.length}]`, ...v.flatMap((x, i) => shape(x, `${path}[${i}]`))];
  if (v && typeof v === 'object') return Object.keys(v).sort().flatMap((k) => [`${path}.${k}`, ...shape((v as Record<string, unknown>)[k], `${path}.${k}`)]);
  return [];
}
function strings(v: unknown, path = ''): [string, string][] {
  if (typeof v === 'string') return [[path, v]];
  if (Array.isArray(v)) return v.flatMap((x, i) => strings(x, `${path}[${i}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => strings(x, `${path}.${k}`));
  return [];
}

describe('copy', () => {
  it('ar has exactly the keys of en', () => {
    expect(shape(ar)).toEqual(shape(en));
  });
  it('no empty strings (repo licences excepted)', () => {
    for (const t of [en, ar]) for (const [p, s] of strings(t)) if (!p.endsWith('.licence')) expect(s.trim(), p).not.toBe('');
  });
  it('links and statuses are the same in both languages', () => {
    const pick = (t: unknown) => strings(t).filter(([p]) => p.endsWith('.href') || (p.endsWith('.status') && !p.startsWith('.footer')) || p.endsWith('.topic') || p.endsWith('.licence'));
    // Links into our own sites point at the page's own language
    const norm = (t: unknown) => pick(t).map(([p, v]) => [p, v.replace('/ar/', '/en/')]);
    expect(norm(ar)).toEqual(norm(en));
  });
  it('Arabic uses «مرئي» for video, never «فيديو» (wiki glossary)', () => {
    for (const [p, s] of strings(ar)) expect(s, p).not.toMatch(/فيديو/);
  });
  it('waqf is a direction, never a claim (wiki AUN-DEV-SITE wording rules)', () => {
    const all = strings(en).map(([, s]) => s).join('\n');
    expect(all).not.toMatch(/\bis a (registered )?(waqf|charity)\b/i);
    expect(all).not.toMatch(/tax[- ]deductible|donate now/i);
  });
  it('no user, view or money figures', () => {
    const all = strings(en).map(([, s]) => s).join('\n');
    expect(all).not.toMatch(/\$\s?\d|\d+\s?(k|m)?\s?(users|viewers|subscribers|views)\b/i);
  });
});
