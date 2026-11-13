import type { Locale } from './locale';
import { libraryUrl } from './embeds';

/**
 * Contact us lives on the videos site (/{locale}/contact): one form and one
 * admin inbox for the whole platform. www's /{locale}/contact sends visitors there.
 */
export function contactUrl(videosWebUrl: string, locale: Locale): string {
  return `${libraryUrl(videosWebUrl, locale)}/contact`;
}

/**
 * Help (how to watch, take part and share, as yourself or as a channel) lives on the videos site
 * too (/{locale}/help, AlUmmahNow docs/features/HELP-AND-TOUR.md); the footer links there.
 */
export function helpUrl(videosWebUrl: string, locale: Locale): string {
  return `${libraryUrl(videosWebUrl, locale)}/help`;
}
