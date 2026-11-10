/** Per-request helpers for pages and endpoints. */
import type { AstroGlobal, APIContext } from 'astro';
import { builtinContent } from '../content/fallback';
import { strings } from '../i18n';
import { cmsClient, createCmsDeps } from './cms';
import type { NavItem, SiteResponse } from './cms-types';
import { config, type WwwEnv } from './env';
import { articlesPath, isLocale, type Locale } from './locale';
import type { VideosDeps } from './videos';

type Ctx = AstroGlobal | APIContext;

export function runtime(ctx: Ctx) {
  const rt = ctx.locals.runtime;
  const env = (rt?.env ?? {}) as WwwEnv;
  const waitUntil = (p: Promise<unknown>) => {
    try {
      rt?.ctx?.waitUntil(p);
    } catch {
      void p;
    }
  };
  const cache = typeof caches !== 'undefined' && 'default' in caches ? (caches as unknown as { default: Cache }).default : null;
  return { env, cfg: config(env), waitUntil, cache };
}

export function requestContext(ctx: Ctx, locale: Locale) {
  const { env, cfg, waitUntil, cache } = runtime(ctx);
  const cms = cmsClient(createCmsDeps(env, cfg, waitUntil, cache));
  const videos: VideosDeps = {
    apiUrl: cfg.videosApiUrl,
    cache,
    cacheKeyBase: `${cfg.siteUrl}/__videos/v1`,
    waitUntil,
    log: (message, data) => console.warn(JSON.stringify({ msg: message, ...data })),
  };
  return { env, cfg, locale, t: strings(locale), cms, videos };
}
export type RequestContext = ReturnType<typeof requestContext>;

/** The `locale` route param, or null (→ 404). */
export function routeLocale(ctx: Ctx): Locale | null {
  const l = ctx.params.locale;
  return isLocale(l) ? l : null;
}

/** Header/footer navigation: CMS when it has items, built-in otherwise. */
export function navigation(site: SiteResponse | null, locale: Locale): { header: NavItem[]; footer: NavItem[] } {
  const b = builtinContent(locale);
  return {
    header: site?.nav.header.length ? site.nav.header : b.headerNav,
    footer: site?.nav.footer.length ? site.nav.footer : b.footerNav,
  };
}

/** CMS nav urls are www-relative without the locale ("/about/"); absolute https passes through. */
export function navHref(url: string, locale: Locale): string | null {
  if (/^https:\/\//i.test(url)) return url;
  if (!url.startsWith('/') || url.startsWith('//')) return null;
  // menus saved before News became Articles link "/news/": go straight to /articles/, no 301 hop
  const path = articlesPath(url) ?? url;
  if (/^\/(en|ar)(\/|$)/.test(path)) return path;
  return `/${locale}${path === '/' ? '/' : path}`;
}

/** Site settings and navigation every page needs. */
export async function loadChrome(rc: RequestContext) {
  const site = await rc.cms.site(rc.locale);
  const data = site.status === 'ok' ? site.data : null;
  return {
    settings: data?.settings ?? builtinContent(rc.locale).site.settings,
    nav: navigation(data, rc.locale),
  };
}

/** Sets X-Content-Source (cms|cache|snapshot|builtin) from every CMS load of the request. */
export function markSource(ctx: AstroGlobal, rc: RequestContext) {
  ctx.response.headers.set('X-Content-Source', rc.cms.source());
}

export function authDeps(ctx: APIContext) {
  const { env, cfg } = runtime(ctx);
  return { cfg, secret: env.SESSION_SECRET };
}
