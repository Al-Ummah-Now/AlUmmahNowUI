import { fill, formatDate as formatDateFor } from '../../../../packages/render/src/format';
import type { Locale } from '../lib/locale';
import { ar } from './ar';
import { en, type Messages } from './en';

export const messages: Record<Locale, Messages> = { en, ar };
export const strings = (l: Locale): Messages => messages[l];

/**
 * "Page {page} of {pages}" + { page: 2, pages: 5 }: numbers are formatted for the page language
 * (Eastern Arabic (Hindi) numerals ٠–٩ in Arabic, packages/render/src/format.ts).
 */
export function fmt(template: string, vars: Record<string, string | number>, l: Locale): string {
  return fill(template, vars, l);
}

/** "15 November 2026" / «١٥ نوفمبر ٢٠٢٦» (UTC). */
export function formatDate(iso: string, l: Locale): string {
  return formatDateFor(iso, l, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
