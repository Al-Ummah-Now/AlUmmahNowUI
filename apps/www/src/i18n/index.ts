import type { Locale } from '../lib/locale';
import { ar } from './ar';
import { en, type Messages } from './en';

export const messages: Record<Locale, Messages> = { en, ar };
export const strings = (l: Locale): Messages => messages[l];

/** "Page {page} of {pages}" + { page: 2, pages: 5 } */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function formatDate(iso: string, l: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(l === 'ar' ? 'ar' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d);
}
