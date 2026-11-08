import type { Locale } from '../../lib/locale';
import { ar } from './ar';
import { en } from './en';
import type { Builtin } from './types';

export type { Builtin, Pillar } from './types';
export const builtinContent = (l: Locale): Builtin => (l === 'ar' ? ar : en);
