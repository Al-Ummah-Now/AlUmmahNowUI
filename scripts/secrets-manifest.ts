/**
 * Secrets each deployed www Worker needs (names and purposes only, never values).
 * Checked before every promote by scripts/release/check-secrets.ts; documented in README.
 * When code starts reading a new secret, add it here in the same PR.
 */
import { ENVIRONMENTS, type EnvName } from './environments.ts';

export interface RequiredSecret {
  name: string;
  purpose: string;
}

export interface WorkerSecrets {
  env: EnvName;
  worker: string;
  required: RequiredSecret[];
}

export const SESSION_SECRET: RequiredSecret = {
  name: 'SESSION_SECRET',
  purpose: 'worker secret, 64 hex chars (openssl rand -hex 32); AES-GCM key of the __Host-aun_www session and sign-in cookies',
};

export const SECRETS_MANIFEST: WorkerSecrets[] = (Object.keys(ENVIRONMENTS) as EnvName[]).map((env) => ({
  env,
  worker: ENVIRONMENTS[env].worker,
  required: [SESSION_SECRET],
}));

/** GitHub Actions secrets the workflows reference. */
export const GITHUB_SECRETS: RequiredSecret[] = [
  { name: 'CLOUDFLARE_API_TOKEN', purpose: 'deploys, version uploads, rollbacks, secrets check (Workers Scripts edit)' },
  { name: 'CLOUDFLARE_ACCOUNT_ID', purpose: 'Al Ummah Now account (0e4b6e7f9faf280c3c9bf95995edc64f)' },
  { name: 'QA_SEED_PASSWORD', purpose: 'optional QA E2E sign-in (qa-admin / qa-viewer)' },
  { name: 'STAGE_SEED_PASSWORD', purpose: 'optional stage E2E sign-in' },
];
