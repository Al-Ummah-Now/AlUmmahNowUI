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

/**
 * Technical names that contain digits (model ids, socket shard names, HLS rungs). They are code, not
 * numbers to format: filled as written, Latin in both languages.
 */
export const TOKENS = {
  tkGuard: 'Llama Guard 3 8B',
  tkGuardShort: 'Llama Guard 3',
  tkGemma: 'Gemma 4 26B',
  tkGemmaShort: 'Gemma 4',
  tkScout: 'Llama 4 Scout',
  tkSocketsZero: 'sockets:0',
  tkSocketsOne: 'sockets:1',
  tkRungLow: '360p',
  tkRungSd: '480p',
  tkRungHd: '720p',
  tkRungFull: '1080p',
  tkRfcDevice: 'RFC 8628',
  tkWinUi: 'WinUI 3',
  tkGtk: 'GTK 4',
} as const;

/** Quality rungs read as numbers: «٣٦٠p» in Arabic (the shared formatter's digits), 360p in English. */
const rungs = (locale: Locale) =>
  Object.fromEntries(Object.entries(TOKENS).filter(([k]) => k.startsWith('tkRung')).map(([k, v]) => [k, v.replace(/\d+/g, (d) => formatIn(Number(d), locale, { useGrouping: false }))]));

const values = (locale: Locale): Record<string, string | number> => ({
  ...NUMBERS,
  ...TOKENS,
  ...rungs(locale),
  rolloutStart: formatPercent(0, locale),
  rolloutFull: formatPercent(1, locale),
});

function filled<T>(v: T, vars: Record<string, string | number>, locale: Locale): T {
  // {N<value>}: a number the copy states once, written in the page's numerals by the formatter
  if (typeof v === 'string') return fill(v.replace(/\{N(\d+(?:\.\d+)?)\}/g, (_m, n: string) => formatIn(Number(n), locale)), vars, locale) as T;
  if (Array.isArray(v)) return v.map((x) => filled(x, vars, locale)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, filled(x, vars, locale)])) as T;
  return v;
}

const cache: Partial<Record<Locale, Strings>> = {};
export const strings = (locale: Locale): Strings => (cache[locale] ??= filled(locale === 'ar' ? (ar as Strings) : en, values(locale), locale));

/** A number as the page's language writes it, no grouping (one formatter: packages/render/src/format.ts). */
export const formatNumber = (locale: Locale, n: number): string => formatIn(n, locale, { useGrouping: false });
