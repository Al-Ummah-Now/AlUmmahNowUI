/**
 * Worker bindings and vars (wrangler.jsonc). `config()` turns them into a typed,
 * validated config with local-dev defaults, so pages never read raw env.
 */
import type { KVNamespace } from './cf';

/** Service binding (only fetch is used; typed with the DOM Request/Response). */
export interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

export interface WwwEnv {
  APP_ENV?: string;
  SITE_URL?: string;
  AUTH_URL?: string;
  WWW_CLIENT_ID?: string;
  VIDEOS_WEB_URL?: string;
  VIDEOS_API_URL?: string;
  PROFILE_URL?: string;
  CMS_PUBLIC_URL?: string;
  /** Service binding to the env's CMS Worker (absent in local dev). */
  CMS?: ServiceBinding;
  /** Last-known-good CMS JSON. */
  CONTENT_SNAPSHOT?: KVNamespace;
  /** The home timeline, published by the CMS feed job (src/lib/feed.ts). Read only. */
  FEED?: KVNamespace;
  ASSETS?: ServiceBinding;
  /** 64 hex chars; encrypts the session and sign-in cookies. */
  SESSION_SECRET?: string;
  CF_VERSION_METADATA?: { id: string; tag?: string; timestamp?: string };
}

export type AppEnv = 'production' | 'stage' | 'qa' | 'local';

export interface Config {
  appEnv: AppEnv;
  /** Canonical origin, no trailing slash, e.g. https://www.alummahnow.net */
  siteUrl: string;
  authUrl: string;
  clientId: string;
  videosWebUrl: string;
  videosApiUrl: string;
  profileUrl: string;
  cmsPublicUrl: string;
  isProduction: boolean;
  version: string;
}

const trim = (url: string) => url.replace(/\/+$/, '');

export function config(env: WwwEnv): Config {
  const appEnv = (['production', 'stage', 'qa'].includes(env.APP_ENV ?? '') ? env.APP_ENV : 'local') as AppEnv;
  return {
    appEnv,
    siteUrl: trim(env.SITE_URL || 'http://localhost:4321'),
    authUrl: trim(env.AUTH_URL || 'https://auth.qa.alummahnow.net'),
    clientId: env.WWW_CLIENT_ID || 'ecda6f18-89cb-415c-b746-7e77184d75a2',
    videosWebUrl: trim(env.VIDEOS_WEB_URL || 'https://videos.qa.alummahnow.net'),
    videosApiUrl: trim(env.VIDEOS_API_URL || 'https://videos.api.qa.alummahnow.net'),
    profileUrl: trim(env.PROFILE_URL || 'https://profile.auth.qa.alummahnow.net'),
    cmsPublicUrl: trim(env.CMS_PUBLIC_URL || 'http://localhost:8585'),
    isProduction: appEnv === 'production',
    version: env.CF_VERSION_METADATA?.id || 'dev',
  };
}
