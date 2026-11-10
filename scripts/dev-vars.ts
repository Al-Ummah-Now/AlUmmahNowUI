/**
 * Creates .dev.vars for `wrangler dev` if missing: a random SESSION_SECRET and local
 * overrides of the production vars (wrangler's top-level config is production).
 * Local dev signs in against QA auth with the QA client (redirect http://localhost:4321/auth/callback)
 * and reads the CMS at CMS_PUBLIC_URL (default http://localhost:8585; none running → built-in content).
 */
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(new URL('..', import.meta.url).pathname, '.dev.vars');
if (existsSync(path)) {
  process.stdout.write('.dev.vars exists, leaving it as is\n');
} else {
  const vars: Record<string, string> = {
    SESSION_SECRET: randomBytes(32).toString('hex'),
    APP_ENV: 'local',
    SITE_URL: `http://localhost:${process.env.WWW_PORT || '4321'}`,
    AUTH_URL: 'https://auth.qa.alummahnow.net',
    WWW_CLIENT_ID: 'ecda6f18-89cb-415c-b746-7e77184d75a2',
    VIDEOS_WEB_URL: 'https://videos.qa.alummahnow.net',
    VIDEOS_API_URL: 'https://videos.api.qa.alummahnow.net',
    PROFILE_URL: 'https://profile.auth.qa.alummahnow.net',
    CMS_PUBLIC_URL: process.env.CMS_PUBLIC_URL || 'http://localhost:8585',
  };
  writeFileSync(path, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
  process.stdout.write('wrote .dev.vars (local vars and a random SESSION_SECRET)\n');
}
