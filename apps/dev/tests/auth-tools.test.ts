import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { strings } from '../src/i18n';
import { buildRequest, inspectToken, requestErrors, type Check } from '../src/lib/auth/tools.ts';

const input = { issuer: 'https://auth.example.com', clientId: 'app', redirectUri: 'https://app.example.com/callback', prompt: '' };

describe('the request builder', () => {
  it('makes a challenge the verifier answers (RFC 7636), and a new state and verifier each time', async () => {
    const one = await buildRequest(input);
    const two = await buildRequest(input);
    const q = new URL(one.url).searchParams;
    expect(q.get('code_challenge')).toBe(createHash('sha256').update(one.verifier).digest('base64url'));
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('state')).toBe(one.state);
    expect(one.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(one.verifier).not.toBe(two.verifier);
    expect(one.state).not.toBe(two.state);
    expect(one.url).not.toContain(one.verifier);
    expect(q.has('prompt')).toBe(false);
  });
  it('carries every field, and the issuer’s own path only', async () => {
    const r = await buildRequest({ ...input, issuer: 'https://auth.example.com/x?y#z', redirectUri: 'alummahnow-studio://auth/callback?a=1&b=2', prompt: 'login' });
    const url = new URL(r.url);
    expect(url.origin + url.pathname).toBe('https://auth.example.com/authorize');
    expect(url.searchParams.get('redirect_uri')).toBe('alummahnow-studio://auth/callback?a=1&b=2');
    expect(url.searchParams.get('prompt')).toBe('login');
    expect(r.exchange).toContain(`code_verifier=${r.verifier}`);
  });
  it('quotes the command, so nothing typed runs when it is pasted', async () => {
    const r = await buildRequest({ ...input, clientId: `x'; rm -rf ~; echo '$(id)` });
    expect(r.exchange).toContain(`'client_id=x'\\''; rm -rf ~; echo '\\''$(id)'`);
  });
  it.each([
    [{ issuer: '' }, ['errIssuer']],
    [{ issuer: 'http://auth.example.com' }, ['errIssuer']],
    [{ issuer: 'javascript:alert(1)' }, ['errIssuer']],
    [{ issuer: 'https://me:pw@auth.example.com' }, ['errIssuer']],
    [{ issuer: 'http://localhost:3301' }, []],
    [{ clientId: ' ' }, ['errClient']],
    [{ redirectUri: '/callback' }, ['errRedirect']],
    [{ redirectUri: 'https://a.example.com/#x' }, ['errRedirect']],
    [{ redirectUri: 'javascript:alert(1)' }, ['errRedirect']],
    [{ redirectUri: 'alummahnow://auth/callback' }, []],
    [{ issuer: 'x', clientId: '', redirectUri: 'x' }, ['errIssuer', 'errClient', 'errRedirect']],
  ])('%j → %j', (change, errors) => {
    expect(requestErrors({ ...input, ...change })).toEqual(errors);
  });
});

describe('the token inspector', () => {
  const NOW = 1_800_000_000;
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const claims = { mode: 'access', type: 'user', iss: 'https://auth.example.com', aud: 'app', sub: 'user:1', iat: NOW - 60, exp: NOW + 840, properties: { id: 'usr_1', email: 'شخص@example.com' } };
  const token = (c: object = {}, h: object = {}) => `${enc({ alg: 'ES256', kid: 'k', ...h })}.${enc({ ...claims, ...c })}.sig`;
  const failed = (text: string) => {
    const r = inspectToken(text, NOW);
    if (r.kind !== 'token') throw new Error(r.kind);
    return r.checks.filter((c): c is Extract<Check, { ok: false }> => !c.ok).map((c) => c.key);
  };
  it('reads a good token, Arabic included', () => {
    const r = inspectToken(`Bearer ${token()}`, NOW);
    expect(r).toMatchObject({ kind: 'token', checks: [{ ok: true }, { ok: true }, { ok: true }, { ok: true, key: 'live', n: 14 }] });
    expect(r.kind === 'token' && r.payload).toContain('شخص@example.com');
  });
  it('says what an API would question', () => {
    expect(failed(token({}, { alg: 'none' }))).toEqual(['alg']);
    expect(failed(token({ mode: 'm2m' }))).toEqual(['kind']);
    expect(failed(token({ exp: NOW }))).toEqual(['expired']);
    expect(failed(token({ exp: undefined }))).toEqual(['noExpiry']);
    expect(failed(token({ iat: NOW + 3600 }))).toEqual(['notYet']);
    expect(failed(token({ aud: undefined, sub: '' }))).toEqual(['fields']);
  });
  it('names what is missing, and never more of a header than fits', () => {
    const r = inspectToken(token({ iss: 1 }, { alg: 'x'.repeat(500) }), NOW);
    expect(r.kind === 'token' && r.checks).toMatchObject([{ key: 'alg', alg: 'x'.repeat(20) }, {}, { key: 'fields', list: 'iss' }, {}]);
  });
  it('a missing or empty signature is a failed check, and no algorithm name stands for a checked one', () => {
    const [h, p] = token().split('.');
    for (const text of [`${h}.${p}.`, `${h}.${p}`, `${h}.${p}.!!`]) expect(failed(text), text).toEqual(['signature']);
    const { tools } = strings('en').auth;
    expect(tools.token.ok.alg).toContain('not checked');
    expect(strings('ar').auth.tools.token.ok.alg).toContain('لا يُفحص');
  });
  it.each<{ alg: unknown }>([{ alg: { toString: 1 } }, { alg: { valueOf: 1, toString: 1 } }, { alg: ['ES256'] }, { alg: 7 }, { alg: null }, { alg: true }, { alg: '' }])('an alg that is no name (%j) fails its check and never throws', ({ alg }) => {
    const r = inspectToken(token({}, { alg }), NOW);
    expect(r.kind === 'token' && r.checks[0]).toEqual({ ok: false, key: 'alg', alg: '?' });
  });
  it('knows a refresh token, and what is no token at all', () => {
    expect(inspectToken('user:usr_1:6f1f0a52-0000-4000-8000-000000000000').kind).toBe('refresh');
    for (const text of ['nonsense', 'a.b.c', 'a.b', `${enc([])}.${enc({})}.x`, `${enc({})}.!!.x`]) expect(inspectToken(text).kind, text).toBe('notToken');
    for (const text of ['', '  ', '\n']) expect(inspectToken(text).kind).toBe('empty');
  });
});
