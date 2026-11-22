/**
 * The owner's number rule (2026-11-21), for www, the scholar sites and alummahnow.dev through
 * packages/render/src/format.ts:
 *  - Arabic numbers are never grouped; «٫» is the only mark.
 *  - Counts of 1,000 and up are compact and cut, never rounded: 4,887 → «٤٫٨ ألف» / "4.8K". Millions
 *    are always «م», billions «مليار»; a standalone whole 11–99 takes the accusative («٢٥ ألفًا»).
 *  - Exact values (tables, money, sizes) stay exact, ungrouped in Arabic; English stays grouped.
 *  - Arabic meta lines join with «،», never «•» or «·».
 * Same outputs as AlUmmahNow shared-types formatCompact and AlUmmahNowAuth packages/ui formatCompact.
 */
import { describe, expect, it } from 'vitest';
import * as f from '../../../packages/render/src/format';
import { formatCountNoun } from '../../../packages/render/src/count-nouns';

const NB = ' ';

describe('formatCompact: counts at the boundaries', () => {
  const cases: [number, string, string][] = [
    [999, '999', '٩٩٩'],
    [1000, '1K', 'ألف'],
    [4887, '4.8K', `٤٫٨${NB}ألف`],
    [11_000, '11K', `١١${NB}ألفًا`],
    [25_000_000, '25M', `٢٥${NB}م`],
    [1.2e9, '1.2B', `١٫٢${NB}مليار`],
  ];
  for (const [n, en, ar] of cases) {
    it(`${n} → "${en}" / «${ar}»`, () => {
      expect(f.formatCompact(n, 'en')).toBe(en);
      expect(f.formatCompact(n, 'ar')).toBe(ar);
    });
  }

  it('cuts, never rounds: 1,299 → 1.2K, 2,999 → 2.9K, 999,999 → 999.9K, 1,999,999 → 1.9M', () => {
    expect([1299, 2999, 999_999, 1_999_999].map((n) => f.formatCompact(n, 'en'))).toEqual(['1.2K', '2.9K', '999.9K', '1.9M']);
    expect([1299, 2999, 999_999, 1_999_999].map((n) => f.formatCompact(n, 'ar'))).toEqual([`١٫٢${NB}ألف`, `٢٫٩${NB}ألف`, `٩٩٩٫٩${NB}ألف`, `١٫٩${NB}م`]);
  });

  it('Arabic scale words agree with the number', () => {
    expect([2000, 3000, 10_000, 25_000, 100_000, 111_000, 1_000_000, 2e9, 3e9, 12e9].map((n) => f.formatCompact(n, 'ar'))).toEqual([
      'ألفان', `٣${NB}آلاف`, `١٠${NB}آلاف`, `٢٥${NB}ألفًا`, `١٠٠${NB}ألف`, `١١١${NB}ألفًا`, `١${NB}م`, 'ملياران', `٣${NB}مليارات`, `١٢${NB}مليارًا`,
    ]);
  });

  it('before a noun: the construct dual and no accusative', () => {
    expect([1000, 2000, 11_000, 25_000].map((n) => f.formatCompact(n, 'ar', { beforeNoun: true }))).toEqual(['ألف', 'ألفا', `١١${NB}ألف`, `٢٥${NB}ألف`]);
  });

  it('negatives and non-finite values', () => {
    expect(f.formatCompact(-4887, 'en')).toBe('-4.8K');
    expect(f.formatCompact(-4887, 'ar')).toBe(`-٤٫٨${NB}ألف`);
    expect(f.formatCompact(Number.NaN, 'ar')).toBe('٠');
  });
});

describe('exact values: English grouped, Arabic never grouped', () => {
  it('numbers, money and percentages', () => {
    expect(f.formatNumber(4887, 'en')).toBe('4,887');
    expect(f.formatNumber(4887, 'ar')).toBe('٤٨٨٧');
    expect(f.formatNumber(1234567.5, 'ar')).toBe('١٢٣٤٥٦٧٫٥');
    // a caller can't turn grouping back on in Arabic
    expect(f.formatNumber(1234567, 'ar', { useGrouping: true })).toBe('١٢٣٤٥٦٧');
    expect(f.formatMoney(1234.5, 'USD', 'ar')).toBe('١٢٣٤٫٥٠ دولار أمريكي');
    expect(f.formatMoney(1234.5, 'USD', 'en')).toBe('US$1,234.50');
    expect(f.formatPercent(12.345, 'ar').replace(/\u061c/g, '')).toBe('١٢٣٤٫٥٪');
  });

  it('placeholders fill exact numbers', () => {
    expect(f.fill('الصفحة {page}', { page: 1234 }, 'ar')).toBe('الصفحة ١٢٣٤');
    expect(f.fill('Page {page}', { page: 1234 }, 'en')).toBe('Page 1,234');
  });
});

describe('formatCount: a figure in prose (alummahnow.dev)', () => {
  it('English exact and grouped, Arabic compact', () => {
    expect(f.formatCount(4887, 'en')).toBe('4,887');
    expect(f.formatCount(4887, 'ar')).toBe(`٤٫٨${NB}ألف`);
    expect(f.formatCount(12_000, 'ar', { beforeNoun: true })).toBe(`١٢${NB}ألف`);
  });
});

describe('counts with their nouns', () => {
  it('compact from 1,000: the scale word, then the singular noun', () => {
    expect([999, 1000, 2000, 4887, 11_000, 25_000_000, 1.2e9].map((n) => formatCountNoun('ar', n, 'like', { compact: true }))).toEqual([
      '٩٩٩ إعجابًا', 'ألف إعجاب', 'ألفا إعجاب', `٤٫٨${NB}ألف إعجاب`, `١١${NB}ألف إعجاب`, `٢٥${NB}م إعجاب`, `١٫٢${NB}مليار إعجاب`,
    ]);
    expect([999, 1000, 4887, 25_000_000].map((n) => formatCountNoun('en', n, 'comment', { compact: true }))).toEqual(['999 comments', '1K comments', '4.8K comments', '25M comments']);
  });

  it('exact counts are ungrouped in Arabic', () => {
    expect(formatCountNoun('ar', 12_840, 'comment')).toBe('١٢٨٤٠ تعليقًا');
    expect(formatCountNoun('ar', 12_800, 'comment')).toBe('١٢٨٠٠ تعليق');
    expect(formatCountNoun('en', 12_840, 'comment')).toBe('12,840 comments');
  });
});

describe('meta lines', () => {
  it('Arabic joins with «،», English with a dot', () => {
    expect(f.joinMeta(['٣ إعجابات', null, '', 'تعليقان'], 'ar')).toBe('٣ إعجابات، تعليقان');
    expect(f.joinMeta(['3 likes', false, '2 comments'], 'en')).toBe('3 likes · 2 comments');
    expect(f.metaSeparator('ar')).toBe('، ');
    expect(f.metaMark('ar')).toBe('،');
    expect(f.metaMark('en', '•')).toBe('•');
  });
});
