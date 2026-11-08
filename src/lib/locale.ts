export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'aun_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export const dir = (l: Locale): 'rtl' | 'ltr' => (l === 'ar' ? 'rtl' : 'ltr');
export const otherLocale = (l: Locale): Locale => (l === 'ar' ? 'en' : 'ar');

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** Locale for `/`: the aun_locale cookie, then Accept-Language (by q), then en. */
export function negotiateLocale(cookieHeader: string | null, acceptLanguage: string | null): Locale {
  const fromCookie = readCookie(cookieHeader, LOCALE_COOKIE);
  if (isLocale(fromCookie)) return fromCookie;
  const ranked = (acceptLanguage ?? '')
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const quality = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split('-')[0] ?? '', q: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { lang } of ranked) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}

/** The locale prefix of a path (`/ar/news/` → ar), or null. */
export function localeFromPath(pathname: string): Locale | null {
  const seg = pathname.split('/')[1];
  return isLocale(seg) ? seg : null;
}

/** Same path in another locale: `/en/news/?page=2` → `/ar/news/?page=2`. */
export function swapLocale(pathname: string, to: Locale): string {
  const rest = localeFromPath(pathname) ? pathname.split('/').slice(2).join('/') : pathname.replace(/^\//, '');
  return `/${to}/${rest}`;
}
