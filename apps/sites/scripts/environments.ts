/** The three sites environments: one source of truth for the config check, secrets check and smoke. */
export type EnvName = 'production' | 'stage' | 'qa';

export const ZONE_ID = 'c3cbc1b54070d957cdcef91444b746a9';

export interface SitesEnvironment {
  env: EnvName;
  worker: string;
  envArgs: string[];
  /** Zone host suffix of the platform subdomains */
  suffix: string;
  /**
   * Routes the Worker must have (and only these). Own domains (Cloudflare for SaaS custom hostnames)
   * reach production through the catch-all route (star slash star); QA and stage test domains live
   * under <env>-sites.alummahnow.com and win over it by being more specific (docs/DOMAINS.md §3).
   */
  routes: string[];
  /** Answers /healthz on any host: the SaaS fallback origin (production) or its test twin */
  smokeHost: string;
  vars: Record<string, string>;
  kvId: string;
}

const vars = (sub: string, clientId: string, env: string) => ({
  APP_ENV: env,
  AUTH_URL: `https://auth.${sub}alummahnow.net`,
  SITES_CLIENT_ID: clientId,
  VIDEOS_WEB_URL: `https://videos.${sub}alummahnow.net`,
  VIDEOS_API_URL: `https://videos.api.${sub}alummahnow.net`,
  WWW_URL: `https://www.${sub}alummahnow.net`,
});

/** OAuth clients registered in AlUmmahNowAuth (migration 0034, "Al Ummah Now (sites)"). */
export const PROD_STAGE_CLIENT = '81f2bb95-15c6-4896-b414-be2c24155a74';
export const QA_CLIENT = '0abd9eac-e47e-4a1a-90bd-18cffec0303c';

export const ENVIRONMENTS: Record<EnvName, SitesEnvironment> = {
  production: {
    env: 'production',
    worker: 'al-ummah-now-sites',
    envArgs: [],
    suffix: 'alummahnow.org',
    routes: ['*.alummahnow.org/*', 'alummahnow.org/*', '*/*'],
    smokeHost: 'sites.alummahnow.org',
    vars: vars('', PROD_STAGE_CLIENT, 'production'),
    kvId: 'bb7463036880446abdc652a56f0b6509',
  },
  stage: {
    env: 'stage',
    worker: 'al-ummah-now-sites-stage',
    envArgs: ['--env', 'stage'],
    suffix: 'stage.alummahnow.org',
    routes: ['*.stage.alummahnow.org/*', '*.stage-sites.alummahnow.com/*'],
    smokeHost: 'sites.stage.alummahnow.org',
    vars: vars('stage.', PROD_STAGE_CLIENT, 'stage'),
    kvId: '9a4d7ee84d43427dad2e73e5904a21c7',
  },
  qa: {
    env: 'qa',
    worker: 'al-ummah-now-sites-qa',
    envArgs: ['--env', 'qa'],
    suffix: 'qa.alummahnow.org',
    routes: ['*.qa.alummahnow.org/*', '*.qa-sites.alummahnow.com/*'],
    smokeHost: 'sites.qa.alummahnow.org',
    vars: vars('qa.', QA_CLIENT, 'qa'),
    kvId: '2784164e06164e99bb5e837733dd38a2',
  },
};

export function parseEnvArg(argv: string[], allowed: EnvName[] = ['production', 'stage', 'qa']): EnvName {
  const i = argv.indexOf('--env');
  const v = i >= 0 ? argv[i + 1] : undefined;
  if (!v || !(allowed as string[]).includes(v)) throw new Error(`--env ${allowed.join('|')} is required`);
  return v as EnvName;
}
