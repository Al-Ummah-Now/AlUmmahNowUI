import { en, type Strings } from './en.ts';
import { ar } from './ar.ts';
import type { Locale } from '../lib/pages.ts';

export type { Strings, Item, Link, Status } from './en.ts';
export const strings = (locale: Locale): Strings => (locale === 'ar' ? ar : en);

/** A number as the page's language writes it: ٠–٩ in Arabic (explicit numbering system), 0–9 in English. No grouping. */
export const formatNumber = (locale: Locale, n: number): string =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-arab' : 'en', { useGrouping: false }).format(n);
