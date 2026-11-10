import { defineConfig, devices } from '@playwright/test';

/**
 * WWW_URL: the site under test (default: local `wrangler dev`, started here).
 * In CI: ci.yml runs locally, deploy-qa.yml against https://www.qa.alummahnow.net,
 * release.yml against stage.
 */
const WWW_URL = (process.env.WWW_URL || 'http://localhost:4321').replace(/\/+$/, '');
const local = !process.env.WWW_URL;

export default defineConfig({
  testDir: './e2e',
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
          command: 'npm run build && npm run preview',
          url: `${WWW_URL}/healthz`,
          timeout: 180_000,
          reuseExistingServer: !process.env.CI,
          stdout: 'ignore',
          stderr: 'ignore',
        },
        {
          // The CMS preview API stand-in (e2e/stub-cms.ts); everything else it answers 503.
          command: 'node --experimental-strip-types --no-warnings e2e/stub-cms.ts',
          url: 'http://localhost:8585/api/preview/v1/pages/0',
          timeout: 30_000,
          reuseExistingServer: !process.env.CI,
        },
      ]
    : undefined,
});
