/**
 * Likes and comments on post rows (and the shared PostEngagement): AlUmmahNow's formatCountNoun rules
 * (#1586). Arabic agrees with the count, has duals and a zero phrase, and uses ٠–٩; English has
 * "No …", "1 comment", then the plural.
 */
import { describe, expect, it } from 'vitest';
import { formatCountNoun } from '../../../packages/render/src/count-nouns';

describe('formatCountNoun', () => {
  it('ar: zero phrase, one and two as words, plural 3–10, accusative 11–99, singular 100+', () => {
    expect([0, 1, 2, 3, 10, 11, 14, 99, 100, 102, 1520].map((n) => formatCountNoun('ar', n, 'comment'))).toEqual([
      'لا توجد تعليقات', 'تعليق واحد', 'تعليقان', '٣ تعليقات', '١٠ تعليقات', '١١ تعليقًا', '١٤ تعليقًا', '٩٩ تعليقًا', '١٠٠ تعليق', '١٠٢ تعليق', '١٥٢٠ تعليقًا',
    ]);
    expect([0, 1, 2, 3, 10, 11, 100].map((n) => formatCountNoun('ar', n, 'like'))).toEqual([
      'لا توجد إعجابات', 'إعجاب واحد', 'إعجابان', '٣ إعجابات', '١٠ إعجابات', '١١ إعجابًا', '١٠٠ إعجاب',
    ]);
    expect([0, 1, 2, 3, 14].map((n) => formatCountNoun('ar', n, 'view'))).toEqual(['لا توجد مشاهدات', 'مشاهدة واحدة', 'مشاهدتان', '٣ مشاهدات', '١٤ مشاهدة']);
  });

  it('ar: never a 0–9 digit', () => {
    for (const n of [3, 11, 250, 12840]) for (const noun of ['like', 'comment', 'view'] as const) expect(formatCountNoun('ar', n, noun)).not.toMatch(/[0-9]/);
  });

  it('en: "No …", "1 …", then the plural', () => {
    expect([0, 1, 2, 3, 10, 11, 12840].map((n) => formatCountNoun('en', n, 'comment'))).toEqual([
      'No comments', '1 comment', '2 comments', '3 comments', '10 comments', '11 comments', '12,840 comments',
    ]);
    expect([0, 1, 2].map((n) => formatCountNoun('en', n, 'like'))).toEqual(['No likes', '1 like', '2 likes']);
  });

  it('missing, invalid and negative counts are zero', () => {
    expect(formatCountNoun('en', undefined, 'like')).toBe('No likes');
    expect(formatCountNoun('ar', 'x', 'comment')).toBe('لا توجد تعليقات');
    expect(formatCountNoun('en', -4, 'comment')).toBe('No comments');
  });
});

describe('Arabic digits in sites formatting', () => {
  it('durations: ٠–٩ in Arabic, 0–9 in English', async () => {
    const { formatDuration } = await import('../src/lib/data');
    expect(formatDuration(125, 'ar')).toBe('٢:٠٥');
    expect(formatDuration(3600, 'ar')).toBe('١:٠٠:٠٠');
    expect(formatDuration(125, 'en')).toBe('2:05');
    expect(formatDuration(null, 'ar')).toBe('');
  });
  it('localDigits leaves English alone', async () => {
    const { localDigits } = await import('../../../packages/render/src/count-nouns');
    expect(localDigits('ar', '2026')).toBe('٢٠٢٦');
    expect(localDigits('en', '2026')).toBe('2026');
  });
});
