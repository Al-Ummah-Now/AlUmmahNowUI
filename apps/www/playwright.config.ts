import { defineConfig, devices } from '@playwright/test';

/**
 * WWW_URL: the site under test (default: local `wrangler dev`, started here).
 * In CI: ci.yml runs locally, deploy-qa.yml against https://www.qa.alummahnow.net,
 * release.yml against stage.
 */
/** Local port (WWW_PORT) when another dev server already holds 4321. */
const PORT = process.env.WWW_PORT || '4321';
const WWW_URL = (process.env.WWW_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const local = !process.env.WWW_URL;
/** The stub CMS's port (STUB_CMS_PORT) when another checkout's stub already holds 8585. */
const STUB = `http://localhost:${process.env.STUB_CMS_PORT || '8585'}`;
/**
 * E2E_FEATURES_OFF=1: the "switched off / not configured" run (e2e/off-features.spec.ts only): the
 * stub admin API says the newsletter is off (STUB_NEWSLETTER=off) and wrangler dev runs without a
 * valid SESSION_SECRET. Its servers are never reused: they must be started in that state.
 */
const OFF = process.env.E2E_FEATURES_OFF === '1';

export default defineConfig({
  testDir: './e2e',
  ...(OFF ? { testMatch: 'off-features.spec.ts' } : { testIgnore: 'off-features.spec.ts' }),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: WWW_URL,
    trace: 'retain-on-failure',
    extraHTTPHeaders: { 'User-Agent': 'al-ummah-now-www-e2e' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
  webServer: local
    ? [
        {
          command: `npm run build && node --experimental-strip-types --no-warnings e2e/seed-feed.ts && npm run preview${OFF ? ' -- --var SESSION_SECRET:off' : ''}`,
          // The videos API through the stub CMS, which answers /api/sites/by-channel (scholar sites) and proxies the rest to QA
          env: { VIDEOS_API_URL: STUB, CMS_PUBLIC_URL: STUB, ADMIN_API_URL: STUB },
          url: `${WWW_URL}/healthz`,
          timeout: 180_000,
          reuseExistingServer: !process.env.CI && !OFF,
          stdout: 'ignore',
          stderr: 'ignore',
        },
        {
          // The CMS preview API stand-in (e2e/stub-cms.ts); everything else it answers 503.
          command: 'node --experimental-strip-types --no-warnings e2e/stub-cms.ts',
          env: OFF ? { STUB_NEWSLETTER: 'off' } : {},
          url: `${STUB}/api/preview/v1/pages/0`,
          timeout: 30_000,
          reuseExistingServer: !process.env.CI && !OFF,
        },
      ]
    : undefined,
});
