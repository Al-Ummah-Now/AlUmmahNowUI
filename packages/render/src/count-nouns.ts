/**
 * A count with its noun: "1 like", "12 comments", «٣ تعليقات», «١٤ إعجابًا», «تعليقان».
 *
 * The same rules and words as AlUmmahNow's @al-ummah/shared-types formatCountNoun (AlUmmahNow #1586),
 * which UI can't import: Arabic follows the CLDR plural category of the count. One and two are words
 * of their own («إعجاب واحد», «إعجابان»), 3–10 take the plural, 11–99 the accusative singular, 100+
 * the genitive singular, and zero is a phrase («لا توجد تعليقات»), never «٠ تعليق». Arabic digits are
 * ٠–٩ through the explicit numbering system (ar-u-nu-arab), never the implicit 'ar' default.
 * Keep the tables in step with shared-types; add a noun here rather than writing another helper.
 */
import { formatNumber } from './format';

export type CountNoun = 'view' | 'like' | 'comment';

type ArabicForms = { zero: string; one: string; two: string; few: string; many: string; other: string };

const AR: Record<CountNoun, ArabicForms> = {
  view: { zero: 'لا توجد مشاهدات', one: 'مشاهدة واحدة', two: 'مشاهدتان', few: 'مشاهدات', many: 'مشاهدة', other: 'مشاهدة' },
  like: { zero: 'لا توجد إعجابات', one: 'إعجاب واحد', two: 'إعجابان', few: 'إعجابات', many: 'إعجابًا', other: 'إعجاب' },
  comment: { zero: 'لا توجد تعليقات', one: 'تعليق واحد', two: 'تعليقان', few: 'تعليقات', many: 'تعليقًا', other: 'تعليق' },
};

const EN: Record<CountNoun, { zero: string; one: string; other: string }> = {
  view: { zero: 'No views', one: 'view', other: 'views' },
  like: { zero: 'No likes', one: 'like', other: 'likes' },
  comment: { zero: 'No comments', one: 'comment', other: 'comments' },
};

const isArabic = (locale: string) => String(locale).toLowerCase().startsWith('ar');

/** A whole number in the locale's digits: ٠–٩ with Arabic grouping in Arabic, 0–9 in English. */
export function formatInteger(locale: string, n: number): string {
  return formatNumber(n, isArabic(locale) ? 'ar' : 'en', { maximumFractionDigits: 0 });
}

/** Any 0–9 in a formatted string (a duration "2:05") as ٠–٩ in Arabic; English unchanged. */
export function localDigits(locale: string, text: string): string {
  return isArabic(locale) ? text.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d))) : text;
}

/** A count with its noun in the locale's language and digits; see the module note. */
export function formatCountNoun(locale: string, count: number | string | null | undefined, noun: CountNoun): string {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const shown = formatInteger(locale, n);
  if (isArabic(locale)) {
    const forms = AR[noun];
    if (n === 0) return forms.zero;
    const category = new Intl.PluralRules('ar').select(n);
    if (category === 'one') return forms.one;
    if (category === 'two') return forms.two;
    return `${shown} ${category === 'few' ? forms.few : category === 'many' ? forms.many : forms.other}`;
  }
  const forms = EN[noun];
  if (n === 0) return forms.zero;
  return `${shown} ${n === 1 ? forms.one : forms.other}`;
}
