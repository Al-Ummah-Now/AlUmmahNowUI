/**
 * The one display formatter for www, the scholar sites and alummahnow.dev (server pages and the
 * browser scripts alike).
 *
 * Arabic pages show Eastern Arabic (Hindi) numerals ٠–٩ for every formatted value: numbers, counts,
 * dates, times, durations, percentages and money. English pages show Arabic numerals 0–9. The
 * numbering system is always explicit (`ar-u-nu-arab`): plain `ar` gives 0–9 in Node and Chromium
 * but ٠–٩ in WebKit, so the Worker and the reader's browser would disagree.
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

export function formatNumber(n: number, lang: Lang | string, opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(lang), opts).format(n);
}

/** A value for a {placeholder}: numbers are formatted for the language, anything else passes through. */
export const num = (v: unknown, lang: Lang | string): string =>
  typeof v === 'number' && Number.isFinite(v) ? formatNumber(v, lang) : String(v);

/** Fills "{name}" placeholders; numbers are formatted for the language, unknown keys stay as they are. */
export function fill(template: string, values: Record<string, unknown>, lang: Lang | string): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (values[k] === undefined || values[k] === null ? m : num(values[k], lang)));
}

/** 12345 → "12K" / «١٢ ألف». */
export const formatCompact = (n: number, lang: Lang | string) => formatNumber(n, lang, { notation: 'compact', maximumFractionDigits: 1 });

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
