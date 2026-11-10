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

/** Auth's session list as the page sees it (credentialed CORS); 401 = no session. */
export function authAccountsStatus(page: Page): Promise<number> {
  return page.evaluate(async (auth) => {
    try {
      return (await fetch(`${auth}/session/accounts`, { credentials: 'include' })).status;
    } catch {
      return -1;
    }
  }, AUTH_ORIGIN);
}
