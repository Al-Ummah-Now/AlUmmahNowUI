/**
 * The optional-features flag (src/lib/features.ts): one server-side source, GET
 * <ADMIN_API_URL>/public/features, cached per isolate like the site theme; anything but a clear
 * "on" reads as off (owner rule: off or unconfigured = invisible).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  adminFeatures,
  FEATURES_FRESH_MS,
  FEATURES_HEADER,
  featuresFromRequest,
  featuresToken,
  resetFeaturesCache,
  resolveFeatures,
  withFeaturesHeader,
} from '../src/lib/features';
import { config, type WwwEnv } from '../src/lib/env';
import { htmlCacheKey } from '../src/lib/edge';

afterEach(() => resetFeaturesCache());

const answer = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const noWait = () => undefined;
const ADMIN = 'https://admin.api.qa.alummahnow.net';

describe('adminFeatures', () => {
  it('on: the admin API says newsletter true', async () => {
    let asked = '';
    const f = await adminFeatures(ADMIN, noWait, async (url) => ((asked = url), new Response('{"newsletter":true}')));
    expect(f).toEqual({ newsletter: true });
    expect(asked).toBe(`${ADMIN}/public/features`);
  });
  it('off: newsletter false, missing, or not a boolean', async () => {
    for (const body of [{ newsletter: false }, {}, { newsletter: 'yes' }, null]) {
      resetFeaturesCache();
      expect(await adminFeatures(ADMIN, noWait, answer(body))).toEqual({ newsletter: false });
    }
  });
  it('off: the admin API answers 404 (route missing or feature_off), 5xx, or nothing', async () => {
    expect(await adminFeatures(ADMIN, noWait, answer({ success: false, code: 'feature_off' }, 404))).toEqual({ newsletter: false });
    resetFeaturesCache();
    expect(await adminFeatures(ADMIN, noWait, answer({}, 503))).toEqual({ newsletter: false });
    resetFeaturesCache();
    expect(await adminFeatures(ADMIN, noWait, async () => { throw new Error('timeout'); })).toEqual({ newsletter: false });
  });
  it('off without ADMIN_API_URL, and the admin API is not asked', async () => {
    let calls = 0;
    expect(await adminFeatures('', noWait, async () => (calls++, new Response('{"newsletter":true}')))).toEqual({ newsletter: false });
    expect(calls).toBe(0);
  });
  it('keeps a real answer per isolate, refreshes it in the background after FRESH, and keeps it when the refresh fails', async () => {
    let t = 0;
    let calls = 0;
    let body: unknown = { newsletter: true };
    let fail = false;
    const fetcher = async () => {
      calls++;
      if (fail) throw new Error('down');
      return new Response(JSON.stringify(body));
    };
    const pending: Promise<unknown>[] = [];
    const wait = (p: Promise<unknown>) => void pending.push(p);
    expect(await adminFeatures(ADMIN, wait, fetcher, () => t)).toEqual({ newsletter: true });
    expect(await adminFeatures(ADMIN, wait, fetcher, () => t)).toEqual({ newsletter: true });
    expect(calls).toBe(1);
    // stale: served at once, one refresh in the background
    t = FEATURES_FRESH_MS;
    body = { newsletter: false };
    expect(await adminFeatures(ADMIN, wait, fetcher, () => t)).toEqual({ newsletter: true });
    await Promise.all(pending);
    expect(await adminFeatures(ADMIN, wait, fetcher, () => t)).toEqual({ newsletter: false });
    // a failed refresh keeps the last real answer
    t += FEATURES_FRESH_MS;
    fail = true;
    await adminFeatures(ADMIN, wait, fetcher, () => t);
    await Promise.all(pending);
    expect(await adminFeatures(ADMIN, wait, fetcher, () => t)).toEqual({ newsletter: false });
  });
  it('a failure is not kept: the next request asks again', async () => {
    let calls = 0;
    const fetcher = async () => (calls++ === 0 ? new Response('', { status: 502 }) : new Response('{"newsletter":true}'));
    expect(await adminFeatures(ADMIN, noWait, fetcher)).toEqual({ newsletter: false });
    expect(await adminFeatures(ADMIN, noWait, fetcher)).toEqual({ newsletter: true });
  });
});

describe('resolveFeatures (www env)', () => {
  const on = answer({ newsletter: true });
  it('off when ADMIN_API_URL is missing', async () => {
    const env: WwwEnv = { APP_ENV: 'qa', INTERNAL_API_KEY: 'k' };
    expect(await resolveFeatures(env, config(env), noWait, on)).toEqual({ newsletter: false });
  });
  it('off when INTERNAL_API_KEY is missing or its Secrets Store binding fails (deployed envs)', async () => {
    for (const key of [undefined, '', { get: async () => '' }, { get: async () => { throw new Error('store'); } }]) {
      resetFeaturesCache();
      const env: WwwEnv = { APP_ENV: 'production', ADMIN_API_URL: ADMIN, INTERNAL_API_KEY: key as WwwEnv['INTERNAL_API_KEY'] };
      expect(await resolveFeatures(env, config(env), noWait, on)).toEqual({ newsletter: false });
    }
  });
  it('on when both are set and the admin API says so (a Secrets Store binding too)', async () => {
    const env: WwwEnv = { APP_ENV: 'qa', ADMIN_API_URL: ADMIN, INTERNAL_API_KEY: { get: async () => 'k' } };
    expect(await resolveFeatures(env, config(env), noWait, on)).toEqual({ newsletter: true });
  });
  it('local dev needs no key (the stub admin API takes the fixed local key)', async () => {
    const env: WwwEnv = { ADMIN_API_URL: 'http://localhost:8585' };
    expect(await resolveFeatures(env, config(env), noWait, on)).toEqual({ newsletter: true });
  });
});

describe('the flags on the request and in the HTML cache key', () => {
  it('travel to Astro in one internal header; a missing or foreign value is off', () => {
    const req = withFeaturesHeader(new Request('https://w/en/'), { newsletter: true });
    expect(req.headers.get(FEATURES_HEADER)).toBe('n1');
    expect(featuresFromRequest(req)).toEqual({ newsletter: true });
    expect(featuresFromRequest(new Request('https://w/en/'))).toEqual({ newsletter: false });
    expect(featuresFromRequest(new Request('https://w/en/', { headers: { [FEATURES_HEADER]: 'yes' } }))).toEqual({ newsletter: false });
  });
  it('pages with and without the newsletter are different cache entries', () => {
    const onKey = htmlCacheKey('https://w/en/', 'v1', 'zujaj', featuresToken({ newsletter: true }));
    const offKey = htmlCacheKey('https://w/en/', 'v1', 'zujaj', featuresToken({ newsletter: false }));
    expect(onKey).toBe('https://w/en/?__v=v1&__t=zujaj&__f=n1');
    expect(offKey).not.toBe(onKey);
    // keys without flags (assets, older callers) are unchanged
    expect(htmlCacheKey('https://w/en/', 'v1', 'lantern')).toBe('https://w/en/?__v=v1&__t=lantern');
  });
});
