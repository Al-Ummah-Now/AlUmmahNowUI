/** What every page reads: config, the site (from the Worker), language, strings and data deps. */
import type { AstroGlobal } from 'astro';
import { isLocale, type Locale } from '../../../../packages/render/src/locale';
import { channelUrl } from '../../../../packages/render/src/embeds';
import { config, type Config } from './env';
import { waitUntilFor, workerBindings } from './runtime';
import { siteFromRequest } from './site';
import { strings } from './i18n';
import type { DataDeps } from './data';
import type { PublicSite } from './site-types';

export interface PageContext {
  cfg: Config;
  site: PublicSite;
  locale: Locale;
  t: ReturnType<typeof strings>;
  data: DataDeps;
  /** http on a local run, https everywhere else */
  scheme: string;
  channelHref: string;
}

/** null: no site (rendered outside the Worker) or a language the site doesn't serve → the page 404s. */
export function pageContext(Astro: AstroGlobal): PageContext | null {
  return pageContextFor(Astro, Astro.params.locale);
}

/** The same for a page whose language isn't a route param (404.astro). */
export function pageContextFor(Astro: AstroGlobal, locale: unknown): PageContext | null {
  const cfg = config(workerBindings());
  const site = siteFromRequest(Astro.request);
  if (!site || !isLocale(locale) || !site.site.locales.includes(locale)) return null;
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
  return {
    cfg,
    site,
    locale,
    t: strings(locale),
    scheme: cfg.appEnv === 'local' ? 'http' : 'https',
    channelHref: channelUrl(cfg.videosWebUrl, { id: site.channel.id, handle: site.channel.handle, lang: locale }),
    data: {
      apiUrl: cfg.videosApiUrl,
      cache,
      waitUntil: waitUntilFor(Astro.locals),
      log: (message, d) => console.warn(JSON.stringify({ msg: message, ...d })),
    },
  };
}
