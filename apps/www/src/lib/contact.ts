import type { Locale } from './locale';
import { libraryUrl } from './embeds';

/**
 * Contact us lives on the videos site (/{locale}/contact): one form and one
 * admin inbox for the whole platform. www's /{locale}/contact sends visitors there.
 */
export function contactUrl(videosWebUrl: string, locale: Locale): string {
  return `${libraryUrl(videosWebUrl, locale)}/contact`;
}
