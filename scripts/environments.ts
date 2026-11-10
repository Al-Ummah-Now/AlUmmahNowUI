/** The three www environments: one source of truth for the config check, smoke and release scripts. */
export type EnvName = 'production' | 'stage' | 'qa';

export interface WwwEnvironment {
  env: EnvName;
  worker: string;
  /** wrangler flags selecting the env (production is the top level) */
  envArgs: string[];
  www: string;
  /** Apex that must 301 to www (production only) */
  apex: string | null;
  vars: Record<string, string>;
  cmsService: string;
  kvId: string;
  /** The home timeline feed (written by the CMS feed job; www reads it). */
  feedKvId: string;
}

const vars = (sub: string, clientId: string, env: string) => ({
  APP_ENV: env,
  SITE_URL: `https://www.${sub}alummahnow.net`,
  AUTH_URL: `https://auth.${sub}alummahnow.net`,
  WWW_CLIENT_ID: clientId,
  VIDEOS_WEB_URL: `https://videos.${sub}alummahnow.net`,
  VIDEOS_API_URL: `https://videos.api.${sub}alummahnow.net`,
  PROFILE_URL: `https://profile.auth.${sub}alummahnow.net`,
  CMS_PUBLIC_URL: `https://cms.${sub}alummahnow.net`,
});

const PROD_STAGE_CLIENT = 'd34701ed-03de-43f8-95a8-91cd1e1874bb';
const QA_CLIENT = 'ecda6f18-89cb-415c-b746-7e77184d75a2';

export const ENVIRONMENTS: Record<EnvName, WwwEnvironment> = {
  production: {
    env: 'production',
    worker: 'al-ummah-now-www',
    envArgs: [],
    www: 'https://www.alummahnow.net',
    apex: 'https://alummahnow.net',
    vars: vars('', PROD_STAGE_CLIENT, 'production'),
    cmsService: 'al-ummah-now-cms',
    kvId: 'bb7463036880446abdc652a56f0b6509',
    feedKvId: '5f27cddf86c84bbdbb59445ad867253c',
  },
  stage: {
    env: 'stage',
    worker: 'al-ummah-now-www-stage',
    envArgs: ['--env', 'stage'],
    www: 'https://www.stage.alummahnow.net',
    apex: null,
    vars: vars('stage.', PROD_STAGE_CLIENT, 'stage'),
    cmsService: 'al-ummah-now-cms-stage',
    kvId: '9a4d7ee84d43427dad2e73e5904a21c7',
    feedKvId: '33ddf8bb7eae439c91fcc4af22797f42',
  },
  qa: {
    env: 'qa',
    worker: 'al-ummah-now-www-qa',
    envArgs: ['--env', 'qa'],
    www: 'https://www.qa.alummahnow.net',
    apex: null,
    vars: vars('qa.', QA_CLIENT, 'qa'),
    cmsService: 'al-ummah-now-cms-qa',
    kvId: '2784164e06164e99bb5e837733dd38a2',
    feedKvId: '6e459b34fb954cf4a199cfef57036a8c',
  },
};

export function parseEnvArg(argv: string[], allowed: EnvName[] = ['production', 'stage', 'qa']): EnvName {
  const i = argv.indexOf('--env');
  const v = i >= 0 ? argv[i + 1] : undefined;
  if (!v || !(allowed as string[]).includes(v)) throw new Error(`--env ${allowed.join('|')} is required`);
  return v as EnvName;
}
