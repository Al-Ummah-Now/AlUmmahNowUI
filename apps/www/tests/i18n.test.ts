import { describe, expect, it } from 'vitest';
import { ar } from '../src/i18n/ar';
import { en } from '../src/i18n/en';
import { fmt } from '../src/i18n';
import { ar as arBuiltin } from '../src/content/fallback/ar';
import { en as enBuiltin } from '../src/content/fallback/en';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}
const leaves = (obj: object): string[] => Object.values(obj).flatMap((v) => (typeof v === 'object' && v !== null ? leaves(v) : [v as string]));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  it('en and ar have exactly the same keys', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it('no string is empty', () => {
    for (const s of [...leaves(en), ...leaves(ar)]) expect(s.trim()).not.toBe('');
  });

  it('placeholders match between locales', () => {
    const enMap = Object.fromEntries(keys(en).map((k, i) => [k, leaves(en)[i]!]));
    const arMap = Object.fromEntries(keys(ar).map((k, i) => [k, leaves(ar)[i]!]));
    // Arabic's singular and dual forms carry no number («بطاقة واحدة», «بطاقتان»); English keeps {count}
    const arabicWordsOnly = new Set(['scholars.articleCountOne', 'cards.oneSlide', 'cards.twoSlides', 'timeline.addedOne', 'search.countOne', 'search.countTwo', 'search.totalOne']);
    for (const k of Object.keys(enMap)) {
      const want = placeholders(enMap[k]!).filter((p) => !(arabicWordsOnly.has(k) && p === 'count'));
      expect(placeholders(arMap[k]!), k).toEqual(want);
    }
  });

  it('Arabic strings are actually Arabic (except the Latin wordmark)', () => {
    const latinAllowed = new Set(['home.wordmarkLatin']);
    keys(ar).forEach((k, i) => {
      if (!latinAllowed.has(k)) expect(leaves(ar)[i], k).toMatch(/[؀-ۿ]/);
    });
  });

  it('fmt fills placeholders and leaves unknown ones', () => {
    expect(fmt('Page {page} of {pages}', { page: 2, pages: 5 }, 'en')).toBe('Page 2 of 5');
    expect(fmt('الصفحة {page} من {pages}', { page: 2, pages: 15 }, 'ar')).toBe('الصفحة ٢ من ١٥');
    expect(fmt('Hi {name}', {}, 'en')).toBe('Hi {name}');
  });

  it('built-in content has the same shape in both locales', () => {
    expect(arBuiltin.pillars).toHaveLength(enBuiltin.pillars.length);
    expect(Object.keys(arBuiltin.pages)).toEqual(Object.keys(enBuiltin.pages));
    expect(arBuiltin.headerNav.map((n) => n.url)).toEqual(enBuiltin.headerNav.map((n) => n.url));
  });
});
