import type { Locale } from './locale';

/** The account page where people delete their account themselves (AlUmmahNowAuth apps/profile), in the page's language. */
export function deleteAccountUrl(profileUrl: string, locale: Locale): string {
  return `${profileUrl}/delete-account${locale === 'ar' ? '?lang=ar' : ''}`;
}
