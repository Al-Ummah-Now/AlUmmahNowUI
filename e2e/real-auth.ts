/**
 * Helpers for the specs that sign in to real QA auth with the shared seed password.
 *
 * E2E output is uploaded as a public workflow artifact, and Playwright puts action arguments
 * in traces and in step titles (`Fill "<value>"`, embedded in the HTML report even with
 * tracing off). Specs using these helpers turn tracing off, and the password goes in through
 * fillSecret (an "Evaluate" step, no value in the title). deploy-qa.yml also scans the output
 * for the secret before uploading (scripts/scan-artifacts-for-secrets.py).
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { AUTH_URL, WWW_URL } from './env';

export const WWW_ORIGIN = new URL(WWW_URL).origin;
export const AUTH_ORIGIN = new URL(AUTH_URL).origin;
/** auth.qa.alummahnow.net → profile.auth.qa.alummahnow.net (an app of the same auth, not www). */
export const PROFILE_URL = (process.env.E2E_PROFILE_URL || AUTH_ORIGIN.replace('://', '://profile.')).replace(/\/+$/, '');
export const SEED_PASSWORD = process.env.QA_SEED_PASSWORD;
/** Real auth runs only against a deployed www with the seed password (deploy-qa.yml). */
export const REAL_AUTH = !!SEED_PASSWORD && !!process.env.WWW_URL && !WWW_URL.startsWith('http://localhost');

/**
 * A dedicated seed account for a spec that ends sessions (sign-out, revoke, password or role
 * change). Signing out goes through auth's /logout, which ends that account's sign-in in every
 * app and every browser, so it must never be a shared seed account (qa-admin, qa-creator, ...)
 * that other suites (CMS, videos, ...) are signed in as at the same time. Each spec file gets
 * its own qa-sso-* account, seeded by AlUmmahNow's seed-qa workflow (profile only, no role);
 * tests/session-ending-specs.test.ts fails CI if a session-ending spec names a shared account.
 * Seed domain per environment: QA @delivered.resend.dev, stage @e2e.alummahnow.net.
 */
export function ssoAccount(local: `qa-sso-${string}`): string {
  if (!/^qa-sso-[a-z0-9-]+$/.test(local)) throw new Error(`not a dedicated qa-sso-* account: ${local}`);
  const stage = new URL(AUTH_URL).hostname.includes('.stage.');
  return `${local}@${stage ? 'e2e.alummahnow.net' : 'delivered.resend.dev'}`;
}

/**
 * Dedicated accounts not seeded on QA yet (an AlUmmahNow seed PR is pending): their tests skip
 * until the account is in seed-qa, then drop it from this list.
 */
const NOT_SEEDED_YET = new Set<string>(); // qa-sso-ui-chain, -multi-a, -multi-b: seeded (AlUmmahNow #749)
export const notSeededYet = (...emails: string[]) => emails.some((e) => NOT_SEEDED_YET.has(e.split('@')[0]!));

/** Types a secret without it appearing in the report's step titles (keep tracing off too). */
export async function fillSecret(field: Locator, value: string) {
  await field.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

/** On auth's password form: signs `email` in and waits until the browser has left auth for `backTo`. */
export async function authForm(page: Page, email: string, backTo = WWW_ORIGIN) {
  await page.waitForURL((u) => u.origin === AUTH_ORIGIN);
  await page.fill('input[name=email]', email);
  await fillSecret(page.locator('input[name=password]'), SEED_PASSWORD!);
  await page.click('button[data-component="button"]');
  await page.waitForURL((u) => u.origin === backTo, { timeout: 30_000 });
}

export const accountButton = (page: Page) => page.locator('#account .account-button');

export async function openMenu(page: Page) {
  await accountButton(page).click();
  await expect(page.locator('#account-menu')).toBeVisible();
}

/**
 * How many accounts auth lists for this browser, as the page sees it (credentialed CORS).
 * 0 = no session: auth answers 200 {"accounts":[]} (older auth: 401, also readable through CORS).
 * -1 = the page could not read the answer (CORS refused, network, unexpected status).
 */
export function authAccountCount(page: Page): Promise<number> {
  return page.evaluate(async (auth) => {
    try {
      const res = await fetch(`${auth}/session/accounts`, { credentials: 'include' });
      if (res.status === 401) return 0;
      if (res.status !== 200) return -1;
      const body = (await res.json()) as { accounts?: unknown };
      return Array.isArray(body.accounts) ? body.accounts.length : -1;
    } catch {
      return -1;
    }
  }, AUTH_ORIGIN);
}
