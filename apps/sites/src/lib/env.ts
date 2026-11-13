/** Worker bindings and vars (wrangler.jsonc), typed and with local defaults. */

export interface KVNamespace {
  get(key: string, type: 'json'): Promise<unknown>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

export interface SitesEnv {
  APP_ENV?: string;
  AUTH_URL?: string;
  SITES_CLIENT_ID?: string;
  VIDEOS_WEB_URL?: string;
  VIDEOS_API_URL?: string;
  WWW_URL?: string;
  /** www's KV, shared: `site-config:<host>` holds the last good config of each host. */
  CONTENT_SNAPSHOT?: KVNamespace;
  ASSETS?: ServiceBinding;
  /** 64 hex chars; encrypts the site session and sign-in cookies. */
  SESSION_SECRET?: string;
  CF_VERSION_METADATA?: { id: string; tag?: string; timestamp?: string };
}

export type AppEnv = 'production' | 'stage' | 'qa' | 'local';

export interface Config {
  appEnv: AppEnv;
  authUrl: string;
  clientId: string;
  videosWebUrl: string;
  videosApiUrl: string;
  wwwUrl: string;
  isProduction: boolean;
  version: string;
}

const trim = (url: string) => url.replace(/\/+$/, '');

export function config(env: SitesEnv): Config {
  const appEnv = (['production', 'stage', 'qa'].includes(env.APP_ENV ?? '') ? env.APP_ENV : 'local') as AppEnv;
  return {
    appEnv,
    authUrl: trim(env.AUTH_URL || 'http://localhost:8686'),
    clientId: env.SITES_CLIENT_ID || '0abd9eac-e47e-4a1a-90bd-18cffec0303c',
    videosWebUrl: trim(env.VIDEOS_WEB_URL || 'https://videos.qa.alummahnow.net'),
    videosApiUrl: trim(env.VIDEOS_API_URL || 'http://localhost:8686'),
    wwwUrl: trim(env.WWW_URL || 'https://www.qa.alummahnow.net'),
    isProduction: appEnv === 'production',
    version: env.CF_VERSION_METADATA?.id || 'dev',
  };
}

/** The zone every platform subdomain lives under, per environment (AlUmmahNow shared-types SITE_HOST_SUFFIX). */
export const HOST_SUFFIX: Record<AppEnv, string> = {
  production: 'alummahnow.org',
  stage: 'stage.alummahnow.org',
  qa: 'qa.alummahnow.org',
  local: 'sites.localhost',
};
