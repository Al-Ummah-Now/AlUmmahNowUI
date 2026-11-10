/**
 * Guard: an E2E spec that ends sessions never signs in as a shared seed account.
 *
 * Any sign-out goes through auth's /logout, which ends that account's sign-in in every app and
 * every browser. A spec that signs out as a shared seed account (qa-admin, qa-creator, ...)
 * signs out every other suite running as it at the same time (CMS, videos, ...). Such specs use
 * their own qa-sso-* account (ssoAccount in e2e/real-auth.ts) instead.
 *
 * Per spec file: if it contains a session-ending action (sign out / log out, /logout, revoke,
 * password change or reset, role change, ending or terminating a session), it must not name a
 * shared seed account: qa-superadmin/admin/moderator/creator/viewer, or any address on a seed
 * domain that is not qa-sso-*.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const E2E = join(import.meta.dirname, '..', 'e2e');

const SESSION_ENDING = [
  /sign[\s_-]?out/i,
  /log[\s_-]?out/i,
  /تسجيل الخروج/,
  /\brevoke/i,
  /(change|reset|update)[\s_-]?password|password[\s_-]?(change|reset|update)/i,
  /(change|update|set|assign)[\s_-]?roles?\b|\broles?[\s_-]?(change|update)/i,
  /(end|terminate|kill|delete)[\s_-]?(all[\s_-]?)?sessions?|sessions?[\s_-]?(end|terminat)/i,
];

const SHARED_ACCOUNT = [
  // The shared seed accounts, by name (an address, a local part or an env default)
  /\bqa-(superadmin|admin|moderator|creator|viewer)\b/i,
  // Any other address on a seed domain that is not a dedicated qa-sso-* account
  /(?<![\w.+-])(?!qa-sso-)[\w.+-]+@(delivered\.resend\.dev|e2e\.alummahnow\.net)\b/i,
  // Env overrides that used to name shared accounts
  /\bQA_(ADMIN|NONADMIN|SUPERADMIN|MODERATOR|CREATOR|VIEWER|CHAIN|SSO)_EMAIL\b/,
];

/** Why `source` breaks the rule ([] = fine). */
export function sharedAccountInSessionEndingSpec(source: string): string[] {
  const ends = SESSION_ENDING.find((re) => re.test(source));
  if (!ends) return [];
  return SHARED_ACCOUNT.flatMap((re) => {
    const m = source.match(re);
    return m ? [`ends sessions (${source.match(ends)![0]}) and names a shared account: ${m[0]}`] : [];
  });
}

function specs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return specs(path);
    return e.name.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('session-ending E2E specs use dedicated accounts', () => {
  it('no spec in e2e/ that ends sessions names a shared seed account', () => {
    const offenders = specs(E2E).flatMap((file) => sharedAccountInSessionEndingSpec(readFileSync(file, 'utf8')).map((why) => `${file}: ${why}`));
    expect(offenders).toEqual([]);
  });

  it('flags a spec that signs out as a shared seed account', () => {
    const bad = `
      const email = process.env.QA_SSO_EMAIL || 'qa-creator@delivered.resend.dev';
      await authForm(page, email);
      await page.goto(\`\${WWW_ORIGIN}/auth/logout\`);`;
    expect(sharedAccountInSessionEndingSpec(bad).length).toBeGreaterThan(0);
    expect(sharedAccountInSessionEndingSpec(`await page.getByRole('button', { name: 'Sign out' }).click(); signIn('qa-admin');`)).not.toEqual([]);
    expect(sharedAccountInSessionEndingSpec(`revokeRefreshToken(); login('someone@e2e.alummahnow.net');`)).not.toEqual([]);
    expect(sharedAccountInSessionEndingSpec(`await changePassword('qa-viewer@delivered.resend.dev');`)).not.toEqual([]);
  });

  it('allows dedicated qa-sso-* accounts, and shared accounts in specs that do not end sessions', () => {
    expect(sharedAccountInSessionEndingSpec(`const email = ssoAccount('qa-sso-ui'); await page.goto('/auth/logout');`)).toEqual([]);
    expect(sharedAccountInSessionEndingSpec(`await page.goto('/auth/logout'); const e = 'qa-sso-ui@delivered.resend.dev';`)).toEqual([]);
    expect(sharedAccountInSessionEndingSpec(`await authForm(page, 'qa-viewer@delivered.resend.dev');`)).toEqual([]);
  });
});
