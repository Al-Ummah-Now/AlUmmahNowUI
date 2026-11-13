import { describe, expect, it } from 'vitest';
import { normalizeSearchText, stripArabicArticle, tokenizeSearchText } from '../src/lib/search/normalize';
import { highlightParts, highlightRanges, normalizeWithMap } from '../src/lib/search/highlight';

describe('normalizeSearchText (port of the monorepo packages/shared-types/src/search/normalize.ts)', () => {
  it('strips tashkeel, Quranic marks and tatweel; folds alef, yeh, taa marbuta, hamza carriers; drops ء', () => {
    expect(normalizeSearchText('أَحْمَد')).toBe('احمد');
    expect(normalizeSearchText('إ آ ٱ')).toBe('ا ا ا');
    expect(normalizeSearchText('مـــحـــمـــد')).toBe('محمد');
    expect(normalizeSearchText('مصطفى یوم')).toBe('مصطفي يوم');
    expect(normalizeSearchText('مدرسة مؤمن مسائل سماء')).toBe('مدرسه مومن مسايل سما');
    expect(normalizeSearchText('لَا رَيْبَۛ')).toBe('لا ريب');
  });
  it('digits, NFKC, case, accents, punctuation, invisibles', () => {
    expect(normalizeSearchText('٢٠٢٦ ۱۲۳')).toBe('2026 123');
    expect(normalizeSearchText('Café, RÉSUMÉ!')).toBe('cafe resume');
    expect(normalizeSearchText('ﬁle Ｆｕｌｌ')).toBe('file full');
    expect(normalizeSearchText('a​b')).toBe('ab');
    expect(normalizeSearchText(null)).toBe('');
    expect(tokenizeSearchText('الحديث، النبوي')).toEqual(['الحديث', 'النبوي']);
  });
  it('stripArabicArticle keeps exceptions and short words', () => {
    expect(stripArabicArticle('الحديث')).toBe('حديث');
    expect(stripArabicArticle('والكتاب')).toBe('كتاب');
    expect(stripArabicArticle('الله')).toBe('الله');
    expect(stripArabicArticle('الم')).toBe('الم');
  });
});

describe('highlight (normalisation-aware)', () => {
  it('normalizeWithMap equals normalizeSearchText for ordinary text', () => {
    for (const s of ['أَحمد شوقي', 'Café — RÉSUMÉ!', '  الحديث، النبوي  ', 'ﬁle ٢٠٢٦', 'مـــحمد']) {
      expect(normalizeWithMap(s).norm).toBe(normalizeSearchText(s));
    }
  });
  it('"احمد" marks all of "أَحمد", harakat included', () => {
    const title = 'أَحمد شوقي';
    const ranges = highlightRanges(title, 'احمد');
    expect(ranges).toEqual([[0, 5]]);
    expect(title.slice(0, 5)).toBe('أَحمد');
  });
  it('a trailing haraka stays inside the mark', () => {
    const title = 'مُحَمَّدٌ رسول';
    const [[s, e]] = highlightRanges(title, 'محمد') as [[number, number]];
    expect(title.slice(s, e)).toBe('مُحَمَّدٌ');
  });
  it('accents and case; several words; article-stripped words', () => {
    expect(highlightParts('Café Résumé', 'cafe')).toEqual([{ text: 'Café', mark: true }, { text: ' Résumé', mark: false }]);
    expect(highlightRanges('Times of prayer', 'pray times')).toEqual([[0, 5], [9, 13]]);
    const parts = highlightParts('الحديث النبوي', 'الحديث');
    expect(parts.filter((p) => p.mark).map((p) => p.text).join('')).toBe('الحديث');
    expect(highlightParts('حديث اليوم', 'الحديث').find((p) => p.mark)?.text).toBe('حديث');
  });
  it('no query, no match → the text unmarked', () => {
    expect(highlightParts('Prayer', '')).toEqual([{ text: 'Prayer', mark: false }]);
    expect(highlightParts('Prayer', 'zzz')).toEqual([{ text: 'Prayer', mark: false }]);
    expect(highlightParts('', 'x')).toEqual([{ text: '', mark: false }]);
  });
});
