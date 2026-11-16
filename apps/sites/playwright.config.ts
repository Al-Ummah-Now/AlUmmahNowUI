import { defineConfig, devices } from '@playwright/test';

/**
 * Local E2E only: the built sites Worker under `wrangler dev` (127.0.0.1:SITES_PORT) and the
 * api-videos + auth stub (e2e/stub-api.ts). Sites are opened on *.localhost hosts, which Chromium
 * resolves to 127.0.0.1 and treats as secure (so the __Host- cookies work over http).
 */
const PORT = process.env.SITES_PORT || '4322';
const STUB = process.env.SITES_STUB_PORT || '8686';
/** SITES_FEATURES_OFF=1: sign-in not configured (no valid SESSION_SECRET), e2e/off-features.spec.ts only; servers never reused. */
const OFF = process.env.SITES_FEATURES_OFF === '1';

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
    trace: 'retain-on-failure',
    extraHTTPHeaders: { 'User-Agent': 'al-ummah-now-sites-e2e' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node --experimental-strip-types --no-warnings e2e/stub-api.ts',
      url: `http://localhost:${STUB}/healthz`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI && !OFF,
    },
    {
      command: `npm run build && node --experimental-strip-types --no-warnings scripts/dev-vars.ts && npx wrangler dev -c wrangler.local.jsonc --ip 127.0.0.1 --port ${PORT}${OFF ? ' --var SESSION_SECRET:off' : ''}`,
      url: `http://127.0.0.1:${PORT}/healthz`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI && !OFF,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
