import { en, type Strings } from './en.ts';
import { ar } from './ar.ts';
import type { Locale } from '../lib/pages.ts';

export type { Strings, Item, Link, Status } from './en.ts';
export const strings = (locale: Locale): Strings => (locale === 'ar' ? ar : en);
