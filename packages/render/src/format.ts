/**
 * The one display formatter for www, the scholar sites and alummahnow.dev (server pages and the
 * browser scripts alike).
 *
 * Arabic pages show Eastern Arabic (Hindi) numerals ٠–٩ for every formatted value: numbers, counts,
 * dates, times, durations, percentages and money. English pages show Arabic numerals 0–9. The
 * numbering system is always explicit (`ar-u-nu-arab`): plain `ar` gives 0–9 in Node and Chromium
 * but ٠–٩ in WebKit, so the Worker and the reader's browser would disagree.
 *
 * Arabic numbers are never grouped (owner's number rule, 2026-11-21): «٤٨٨٧», «١٢٣٤٫٥», «٫» is the only
 * mark. ICU's Arabic group mark «٬» is drawn in the same comma shape as «٫» by most Arabic fonts, so
 * «١٬٢٣٤٫٥» reads as three numbers. Counts from 1,000 on are compact and cut, never rounded
 * (`formatCompact`): «٤٫٨ ألف», «١٫٢ م», «١٫٢ مليار»; tables, money and sizes stay exact
 * (`formatNumber`), ungrouped in Arabic. English keeps its grouping ("4,887") and K/M/B for counts.
 * Arabic meta lines join with «،» (`joinMeta`), never «•» or «·». The same rules and words as
 * AlUmmahNow shared-types locale-format and AlUmmahNowAuth packages/ui/src/format.ts.
 *
 * Every `Intl.*` / `toLocale*String` display call goes through this module (tests/format-guard in
 * each app fails on new ones elsewhere). Ids, URLs, slugs, codes and inputs keep what was typed;
 * inputs accept ٠–٩ and `toAsciiDigits` turns them into 0–9. Same API as AlUmmahNowCMS
 * src/lib/format.ts and AlUmmahNowAuth's formatter.
 */
export type Lang = 'en' | 'ar';

/** The Intl locale for a UI language: Arabic always with Eastern Arabic (Hindi) numerals. */
export const intlLocale = (lang: Lang | string): string => (lang === 'ar' ? 'ar-u-nu-arab' : 'en-GB');

const isAr = (lang: Lang | string) => lang === 'ar';

/** An exact number: 1234.5 → "1,234.5" / «١٢٣٤٫٥» (Arabic never grouped, whatever the options say). */
export function formatNumber(n: number, lang: Lang | string, opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(lang), isAr(lang) ? { ...opts, useGrouping: false } : opts).format(n);
}

/** A value for a {placeholder}: numbers are formatted for the language, anything else passes through. */
export const num = (v: unknown, lang: Lang | string): string =>
  typeof v === 'number' && Number.isFinite(v) ? formatNumber(v, lang) : String(v);

/** Fills "{name}" placeholders; numbers are formatted for the language, unknown keys stay as they are. */
export function fill(template: string, values: Record<string, unknown>, lang: Lang | string): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (values[k] === undefined || values[k] === null ? m : num(values[k], lang)));
}

/** `value` cut (never rounded) to one decimal: 1.29 → 1.2, 2.999 → 2.9. */
const cut = (value: number): number => Math.floor(value * 10 + 1e-9) / 10;

interface ArabicScale { size: number; one: string; dual: string; construct: string; few: string; accusative: string }

/**
 * Arabic scale words. Thousands and billions agree with the number shown: exactly one is the word
 * alone («ألف»), exactly two the dual alone («ألفان»; «ألفا» before a noun), whole 3–10 the plural
 * («٣ آلاف»), decimals and 11+ the singular («١٫٣ ألف», «١١٠ ألف»), and a whole number ending in 11–99
 * standing alone the accusative («٢٥ ألفًا»). Millions are always the digit and «م» («١ م», «١٫٢ م»).
 */
const AR_SCALES: readonly ArabicScale[] = [
  { size: 1e9, one: 'مليار', dual: 'ملياران', construct: 'مليارا', few: 'مليارات', accusative: 'مليارًا' },
  { size: 1e6, one: 'م', dual: 'م', construct: 'م', few: 'م', accusative: 'م' },
  { size: 1e3, one: 'ألف', dual: 'ألفان', construct: 'ألفا', few: 'آلاف', accusative: 'ألفًا' },
];

/** English scales, written here rather than Intl's compact notation: ICU builds disagree on the suffix (Node "1.2K", Chromium "1.2k"). */
const EN_SCALES: readonly (readonly [number, string])[] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

export interface CompactOptions {
  /** A noun follows («ألفا مشاهدة», «١٢ ألف مشاهدة»): the construct dual and no accusative. Alone: «ألفان», «١٢ ألفًا». */
  beforeNoun?: boolean;
}

function compactArabic(n: number, beforeNoun: boolean): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const scale = AR_SCALES.find((s) => abs >= s.size);
  if (!scale) return formatNumber(n, 'ar', { maximumFractionDigits: 1 });
  const shown = cut(abs / scale.size);
  const digits = formatNumber(shown, 'ar', { maximumFractionDigits: 1 });
  // U+00A0 keeps the number and its scale word on one line, as Intl writes it
  if (scale.size === 1e6) return `${sign}${digits}\u00a0م`;
  if (!sign && shown === 1) return scale.one;
  if (!sign && shown === 2) return beforeNoun ? scale.construct : scale.dual;
  if (!Number.isInteger(shown)) return `${sign}${digits}\u00a0${scale.one}`;
  if (shown >= 3 && shown <= 10) return `${sign}${digits}\u00a0${scale.few}`;
  if (!beforeNoun && shown % 100 >= 11) return `${sign}${digits}\u00a0${scale.accusative}`;
  return `${sign}${digits}\u00a0${scale.one}`;
}

/**
 * A count (views, likes, results, subscribers): exact under 1,000, compact from 1,000, cut to one
 * decimal and never rounded up: 999 → "999" / «٩٩٩», 4,887 → "4.8K" / «٤٫٨ ألف», 25,000,000 →
 * "25M" / «٢٥ م», 1,200,000,000 → "1.2B" / «١٫٢ مليار». Tables, money and sizes use `formatNumber`.
 */
export function formatCompact(n: number, lang: Lang | string, options: CompactOptions = {}): string {
  const safe = Number.isFinite(n) ? n : 0;
  if (isAr(lang)) return compactArabic(safe, options.beforeNoun === true);
  const abs = Math.abs(safe);
  const scale = EN_SCALES.find(([size]) => abs >= size);
  if (!scale) return formatNumber(safe, lang, { maximumFractionDigits: 1 });
  return `${formatNumber(Math.sign(safe) * cut(abs / scale[0]), lang, { maximumFractionDigits: 1 })}${scale[1]}`;
}

/**
 * A figure in running prose (alummahnow.dev's copy): English exact and grouped ("1,000"), Arabic
 * compact by the same words as `formatCompact` («ألف», «١٢ ألفًا», «١٫٢ م»).
 */
export function formatCount(n: number, lang: Lang | string, options: CompactOptions = {}): string {
  return isAr(lang) ? formatCompact(n, lang, options) : formatNumber(n, lang);
}

/** The meta-line mark alone, for rows that space their parts themselves: «،» in Arabic, else `en`. */
export const metaMark = (lang: Lang | string, en: '•' | '·' = '·'): string => (isAr(lang) ? '،' : en);

/**
 * The meta-line mark with its spacing: " · " in English, «، » in Arabic (attached to the part before
 * it). A dot next to Arabic digits reads as zero: «عام · ١٢ ألف» reads as «١٢٠ ألف».
 */
export const metaSeparator = (lang: Lang | string, en: '•' | '·' = '·'): string => (isAr(lang) ? '، ' : ` ${en} `);

/** The parts that are there, joined: joinMeta(['٣ إعجابات', null, 'تعليقان'], 'ar') → «٣ إعجابات، تعليقان». */
export function joinMeta(parts: ReadonlyArray<string | null | undefined | false>, lang: Lang | string, en: '•' | '·' = '·'): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(metaSeparator(lang, en));
}

/**
 * A count in running text, by the owner's number rule (2026-11-21): English as usual ("1,000"); Arabic never
 * grouped, and from a thousand in words, cut (never rounded up) to one decimal: «ألف», «ألفان» («ألفا» before a
 * noun), «٣ آلاف»…«١٠ آلاف», «١٢ ألفًا» standing alone, «١٫٣ ألف»; millions «١٫٢ م»; «مليار / ملياران /
 * ٣ مليارات». `beforeNoun`: the count is followed by what it counts («ألف مشاهدة», «١٢ ألف نيورون»).
 */
export function formatCount(n: number, lang: Lang | string, opts: { beforeNoun?: boolean } = {}): string {
  if (!isAr(lang)) return formatNumber(n, lang);
  const plain = (v: number) => formatNumber(v, lang, { useGrouping: false, maximumFractionDigits: 1 });
  if (Math.abs(n) < 1000) return plain(n);
  const cut = (v: number) => Math.trunc(v * 10) / 10;
  // one, two, three to ten, and whole numbers ending in 11–99 standing alone each take their own form
  const words = (v: number, one: string, two: string, few: string, many: string) => {
    if (v === 1) return one;
    if (v === 2) return opts.beforeNoun ? two.replace(/ن$/, '') : two;
    if (Number.isInteger(v) && v >= 3 && v <= 10) return `${plain(v)} ${few}`;
    if (!opts.beforeNoun && Number.isInteger(v) && v % 100 >= 11) return `${plain(v)} ${many}ًا`;
    return `${plain(v)} ${many}`;
  };
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a < 1e6) return sign + words(cut(a / 1e3), 'ألف', 'ألفان', 'آلاف', 'ألف');
  if (a < 1e9) return `${sign}${plain(cut(a / 1e6))} م`;
  return sign + words(cut(a / 1e9), 'مليار', 'ملياران', 'مليارات', 'مليار');
}

/** 0.25 → "25%" / «٢٥٪». */
export const formatPercent = (ratio: number, lang: Lang | string, opts: Intl.NumberFormatOptions = {}) =>
  formatNumber(ratio, lang, { style: 'percent', maximumFractionDigits: 1, ...opts });

/** Money: Arabic uses the currency's Arabic name («١٫٥٠ دولار أمريكي»), never «US$» inside Arabic text. */
export function formatMoney(amount: number, currency: string, lang: Lang | string, opts: Intl.NumberFormatOptions = {}): string {
  return formatNumber(amount, lang, { style: 'currency', currency, currencyDisplay: isAr(lang) ? 'name' : 'symbol', ...opts });
}

export function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : typeof v === 'number' ? new Date(v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A date (any Intl options; default "15 Nov 2026" / «١٥ نوفمبر ٢٠٢٦»). Invalid → "". */
export function formatDate(v: unknown, lang: Lang | string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const d = toDate(v);
  return d ? new Intl.DateTimeFormat(intlLocale(lang), opts).format(d) : '';
}

export const formatTime = (v: unknown, lang: Lang | string, opts: Intl.DateTimeFormatOptions = {}) => formatDate(v, lang, { timeStyle: 'short', ...opts });

export const formatDateTime = (v: unknown, lang: Lang | string, opts: Intl.DateTimeFormatOptions = {}) =>
  formatDate(v, lang, { dateStyle: 'medium', timeStyle: 'short', ...opts });

/**
 * "5 minutes ago" / «قبل ٥ دقائق». Under a minute is "now"; then minutes, hours, days, months
 * (30 days) and years (365 days).
 */
export function formatRelative(v: unknown, lang: Lang | string, now: number | Date = Date.now()): string {
  const d = toDate(v);
  if (!d) return '';
  const sec = Math.round((d.getTime() - (typeof now === 'number' ? now : now.getTime())) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: 'auto' });
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 30 * 86_400) return rtf.format(Math.round(sec / 86_400), 'day');
  if (abs < 365 * 86_400) return rtf.format(Math.round(sec / (30 * 86_400)), 'month');
  return rtf.format(Math.round(sec / (365 * 86_400)), 'year');
}

/** Seconds → "m:ss" or "h:mm:ss" (3725 → "1:02:05" / «١:٠٢:٠٥»). Empty for 0 or null. */
export function formatDuration(seconds: number | null | undefined, lang: Lang | string): string {
  if (!seconds) return '';
  const t = Math.max(0, Math.round(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const two = (n: number) => formatNumber(n, lang, { minimumIntegerDigits: 2, useGrouping: false });
  return h > 0 ? `${formatNumber(h, lang)}:${two(m)}:${two(s)}` : `${formatNumber(m, lang)}:${two(s)}`;
}

/** A year for "© {year}": no grouping (2026, not 2,026). */
export const formatYear = (year: number, lang: Lang | string) => formatNumber(year, lang, { useGrouping: false });

/** Joins names: "a, b and c" / «a وb وc». */
export const formatList = (items: string[], lang: Lang | string) =>
  new Intl.ListFormat(isAr(lang) ? 'ar' : 'en', { style: 'long', type: 'conjunction' }).format(items);

/** The reader's IANA time zone (not a display value). */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/**
 * The calendar day YYYY-MM-DD of an instant in a time zone: a machine key (grouping, comparisons),
 * never shown, so it stays in Arabic numerals 0–9.
 */
export function dayKey(v: unknown, timeZone = 'UTC'): string {
  const d = toDate(v);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', numberingSystem: 'latn' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Input normalisation: Eastern Arabic (Hindi) ٠–٩ and Persian ۰–۹ numerals → Arabic numerals 0–9. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (c) => String((c.charCodeAt(0) & 0xf) % 10));
}

/** A typed number → Arabic numerals 0–9 with "." as the decimal mark (٫ → ., the ٬ group mark dropped). */
export const toAsciiNumber = (s: string): string => toAsciiDigits(s).replace(/٫/g, '.').replace(/٬/g, '');

/** The page language in a browser (`<html lang>`): "ar" or "en" ("en" outside a browser). */
export const pageLang = (): Lang =>
  (globalThis as { document?: { documentElement?: { lang?: string } } }).document?.documentElement?.lang?.startsWith('ar') ? 'ar' : 'en';

/** A count's text in each plural form the language has (Arabic: zero, one, two, few, many, other). */
export type PluralForms = Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many', string>> & { other: string };

/**
 * "3 likes" / «٣ إعجابات», «١١ إعجابًا», «إعجاب واحد»: picks the language's plural form for `n`
 * (Intl.PluralRules) and fills `{count}` with the formatted number.
 */
/** The language's CLDR plural category for `n`: zero, one, two, few, many or other. */
export const pluralCategory = (n: number, lang: Lang | string): Intl.LDMLPluralRule => new Intl.PluralRules(isAr(lang) ? 'ar' : 'en').select(n);

export function plural(n: number, forms: PluralForms, lang: Lang | string): string {
  const cat = pluralCategory(n, lang) as keyof PluralForms;
  return fill(forms[cat] ?? forms.other, { count: n }, lang);
}
