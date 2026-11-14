/**
 * The three deployed environments of alummahnow.dev (wiki AUN-DEV-SITE §Hosting), plus `local`
 * for builds that are never deployed. Only robots.txt and _headers depend on the environment
 * (scripts/env-files.ts); the HTML is identical everywhere and its canonical links always name
 * production, so QA and stage are exact previews that search engines are told to skip.
 */
export const ZONE = 'alummahnow.dev';
export const PRODUCTION_ORIGIN = `https://${ZONE}`;

export const ENVIRONMENTS = {
  qa: { worker: 'al-ummah-now-dev-qa', host: `qa.${ZONE}`, indexable: false },
  stage: { worker: 'al-ummah-now-dev-stage', host: `stage.${ZONE}`, indexable: false },
  production: { worker: 'al-ummah-now-dev', host: ZONE, indexable: true },
} as const;

export type EnvName = keyof typeof ENVIRONMENTS;
export type BuildEnv = EnvName | 'local';

export function isEnvName(v: unknown): v is EnvName {
  return typeof v === 'string' && Object.hasOwn(ENVIRONMENTS, v);
}

/** `--env <name>` from argv; `local` allowed only when `allowLocal`. Exits on anything else. */
export function parseEnvArg(argv: string[], allowLocal = false): BuildEnv {
  const i = argv.indexOf('--env');
  const v = i >= 0 ? argv[i + 1] : undefined;
  if (isEnvName(v) || (allowLocal && v === 'local')) return v as BuildEnv;
  process.stderr.write(`--env must be one of ${Object.keys(ENVIRONMENTS).join(', ')}${allowLocal ? ', local' : ''} (got ${v ?? 'nothing'})\n`);
  process.exit(2);
}
