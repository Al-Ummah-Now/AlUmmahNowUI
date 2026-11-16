import { en, type Strings } from './en.ts';
import { ar } from './ar.ts';
import type { Locale } from '../lib/pages.ts';
import { fill, formatNumber as formatIn, formatPercent } from '../../../../packages/render/src/format.ts';

export type { Strings, Item, Link, Status } from './en.ts';

/**
 * The numbers the copy quotes, kept out of the strings so both languages say the same thing and
 * each shows its own numerals (Eastern Arabic (Hindi) ٠–٩ in Arabic, packages/render/src/format.ts).
 */
export const NUMBERS = { accessTokenMinutes: 15, undoDays: 30, stallSeconds: 15, reportDays: 3 } as const;

const values = (locale: Locale): Record<string, string | number> => ({
  ...NUMBERS,
  rolloutStart: formatPercent(0, locale),
  rolloutFull: formatPercent(1, locale),
});

function filled<T>(v: T, vars: Record<string, string | number>, locale: Locale): T {
  if (typeof v === 'string') return fill(v, vars, locale) as T;
  if (Array.isArray(v)) return v.map((x) => filled(x, vars, locale)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, filled(x, vars, locale)])) as T;
  return v;
}

const cache: Partial<Record<Locale, Strings>> = {};
export const strings = (locale: Locale): Strings => (cache[locale] ??= filled(locale === 'ar' ? (ar as Strings) : en, values(locale), locale));

/** A number as the page's language writes it, no grouping (one formatter: packages/render/src/format.ts). */
export const formatNumber = (locale: Locale, n: number): string => formatIn(n, locale, { useGrouping: false });
