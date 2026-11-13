/** What every page reads: config, the site (from the Worker), language, strings and data deps. */
import type { AstroGlobal } from 'astro';
import { isLocale, type Locale } from '../../../../packages/render/src/locale';
import { channelUrl } from '../../../../packages/render/src/embeds';
import { config, type Config, type SitesEnv } from './env';
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
  const runtime = (Astro.locals as { runtime?: { env?: SitesEnv; ctx?: { waitUntil(p: Promise<unknown>): void } } }).runtime;
  const env = runtime?.env ?? {};
  const cfg = config(env);
  const site = siteFromRequest(Astro.request);
  const locale = Astro.params.locale;
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
      waitUntil: (p) => runtime?.ctx?.waitUntil(p),
      log: (message, d) => console.warn(JSON.stringify({ msg: message, ...d })),
    },
  };
}
