import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  for (const name of ['WWW_URL', 'WWW_PORT', 'E2E_AUTH_URL', 'E2E_PROFILE_URL', 'QA_SEED_PASSWORD', 'STAGE_SEED_PASSWORD']) {
    vi.stubEnv(name, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it.each([
  { target: 'qa', passwordVar: 'QA_SEED_PASSWORD', emailDomain: 'delivered.resend.dev' },
  { target: 'stage', passwordVar: 'STAGE_SEED_PASSWORD', emailDomain: 'e2e.alummahnow.net' },
])('enables real auth on $target with its seed password', async ({ target, passwordVar, emailDomain }) => {
  const www = `https://www.${target}.alummahnow.net`;
  vi.stubEnv('WWW_URL', www);
  vi.stubEnv('E2E_AUTH_URL', `https://auth.${target}.alummahnow.net`);
  vi.stubEnv(passwordVar, 'target-test-password');

  const { AUTH_ORIGIN, PROFILE_URL, REAL_AUTH, SEED_PASSWORD, WWW_ORIGIN, ssoAccount } = await import('../e2e/real-auth');
  expect(REAL_AUTH).toBe(true);
  expect(SEED_PASSWORD).toBe('target-test-password');
  expect(ssoAccount('qa-sso-ui')).toBe(`qa-sso-ui@${emailDomain}`);
  expect(WWW_ORIGIN).toBe(www);
  expect(AUTH_ORIGIN).toBe(`https://auth.${target}.alummahnow.net`);
  expect(PROFILE_URL).toBe(`https://profile.auth.${target}.alummahnow.net`);
});

it.each([
  { target: 'qa', passwordVar: 'STAGE_SEED_PASSWORD' },
  { target: 'stage', passwordVar: 'QA_SEED_PASSWORD' },
])('skips real auth on $target with only the other environment password', async ({ target, passwordVar }) => {
  vi.stubEnv('WWW_URL', `https://www.${target}.alummahnow.net`);
  vi.stubEnv('E2E_AUTH_URL', `https://auth.${target}.alummahnow.net`);
  vi.stubEnv(passwordVar, 'other-test-password');

  const { REAL_AUTH, SEED_PASSWORD } = await import('../e2e/real-auth');
  expect(REAL_AUTH).toBe(false);
  expect(SEED_PASSWORD).toBeUndefined();
});

it('skips the default local run without seed passwords', async () => {
  const { REAL_AUTH, SEED_PASSWORD, WWW_ORIGIN } = await import('../e2e/real-auth');
  expect(REAL_AUTH).toBe(false);
  expect(SEED_PASSWORD).toBeUndefined();
  expect(WWW_ORIGIN).toBe('http://localhost:4321');
});

it('skips an explicitly configured localhost even with a seed password', async () => {
  vi.stubEnv('WWW_URL', 'http://localhost:1234');
  vi.stubEnv('QA_SEED_PASSWORD', 'local-test-password');

  const { REAL_AUTH } = await import('../e2e/real-auth');
  expect(REAL_AUTH).toBe(false);
});
