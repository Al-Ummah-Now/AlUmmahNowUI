/**
 * Creates .dev.vars for `wrangler dev` if missing: a random SESSION_SECRET and local overrides of the
 * production vars. Local runs read sites, videos and posts from VIDEOS_API_URL and sign in against
 * AUTH_URL; the E2E stub (e2e/stub-api.ts) serves both on http://localhost:8686.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const path = resolve(fileURLToPath(new URL('..', import.meta.url)), '.dev.vars');
if (existsSync(path)) {
  process.stdout.write('.dev.vars exists, leaving it as is\n');
} else {
  const stub = process.env.SITES_STUB_URL || 'http://localhost:8686';
  const vars: Record<string, string> = {
    SESSION_SECRET: randomBytes(32).toString('hex'),
    APP_ENV: 'local',
    AUTH_URL: process.env.AUTH_URL || stub,
    SITES_CLIENT_ID: '0abd9eac-e47e-4a1a-90bd-18cffec0303c',
    VIDEOS_WEB_URL: 'https://videos.qa.alummahnow.net',
    VIDEOS_API_URL: process.env.VIDEOS_API_URL || stub,
    WWW_URL: 'https://www.qa.alummahnow.net',
  };
  writeFileSync(path, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
  process.stdout.write('wrote .dev.vars (local vars and a random SESSION_SECRET)\n');
}
