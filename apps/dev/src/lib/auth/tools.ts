/**
 * The Sign-in tools (/auth/tools/): pure functions, run in the reader's browser. No network, no storage.
 * The PKCE proof follows RFC 7636; the checks are the ones on the Tokens page.
 */

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export interface RequestInput {
  issuer: string;
  clientId: string;
  redirectUri: string;
  prompt: string;
}
export type RequestError = 'errIssuer' | 'errClient' | 'errRedirect';
export interface BuiltRequest {
  url: string;
  state: string;
  verifier: string;
  exchange: string;
}

function parse(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

/** What is wrong with the fields, in their order. */
export function requestErrors(input: RequestInput): RequestError[] {
  const errors: RequestError[] = [];
  const issuer = parse(input.issuer);
  const local = issuer && ['localhost', '127.0.0.1'].includes(issuer.hostname);
  if (!issuer || issuer.username || issuer.password || !(issuer.protocol === 'https:' || (issuer.protocol === 'http:' && local))) errors.push('errIssuer');
  if (!input.clientId.trim()) errors.push('errClient');
  const redirect = parse(input.redirectUri);
  if (!redirect || redirect.hash || /^(javascript|data|vbscript):$/.test(redirect.protocol)) errors.push('errRedirect');
  return errors;
}

/** One argument of a shell command, quoted so nothing in it is read as shell. */
const shell = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/** A sign-in request; fields must have no requestErrors. */
export async function buildRequest(input: RequestInput, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): Promise<BuiltRequest> {
  const issuer = new URL(input.issuer.trim()).origin;
  const state = base64url(random(32));
  const verifier = base64url(random(32));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const url = new URL('/authorize', issuer);
  const set = { client_id: input.clientId.trim(), redirect_uri: input.redirectUri.trim(), response_type: 'code', state, code_challenge: challenge, code_challenge_method: 'S256', ...(input.prompt ? { prompt: input.prompt } : {}) };
  for (const [k, v] of Object.entries(set)) url.searchParams.set(k, v);
  const fields = { grant_type: 'authorization_code', code: 'CODE', redirect_uri: set.redirect_uri, client_id: set.client_id, code_verifier: verifier };
  const exchange = [`curl ${shell(`${issuer}/token`)}`, ...Object.entries(fields).map(([k, v]) => `  --data-urlencode ${shell(`${k}=${v}`)}`)].join(' \\\n');
  return { url: url.toString(), state, verifier, exchange };
}

export type Check = { ok: true; key: 'alg' | 'kind' | 'live' | 'fields'; n?: number } | { ok: false; key: 'alg' | 'signature' | 'kind' | 'expired' | 'noExpiry' | 'notYet' | 'fields'; alg?: string; list?: string };
export type Inspected = { kind: 'empty' } | { kind: 'refresh' } | { kind: 'notToken' } | { kind: 'token'; header: string; payload: string; checks: Check[] };

function part(value: string): Record<string, unknown> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    const json: unknown = JSON.parse(text);
    return json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Seconds of clock difference an API tolerates. */
const SKEW = 60;

export function inspectToken(text: string, now = Date.now() / 1000): Inspected {
  const token = text.trim().replace(/^Bearer\s+/i, '');
  if (!token) return { kind: 'empty' };
  // Our refresh tokens are «subject:random»
  if (/^[\w-]+:[\w:-]+$/.test(token)) return { kind: 'refresh' };
  const parts = token.split('.');
  const header = part(parts[0] ?? '');
  const payload = part(parts[1] ?? '');
  if (parts.length > 3 || !header || !payload) return { kind: 'notToken' };
  const checks: Check[] = [];
  checks.push(header.alg === 'ES256' ? { ok: true, key: 'alg' } : { ok: false, key: 'alg', alg: (typeof header.alg === 'string' && header.alg ? header.alg : '?').slice(0, 20) });
  // Present or not: no key is read here, so whether it is right isn't known
  if (!/^[A-Za-z0-9_-]+$/.test(parts[2] ?? '')) checks.push({ ok: false, key: 'signature' });
  checks.push(payload.mode === 'access' && payload.type === 'user' ? { ok: true, key: 'kind' } : { ok: false, key: 'kind' });
  const missing = ['iss', 'aud', 'sub'].filter((c) => typeof payload[c] !== 'string' || !payload[c]);
  checks.push(missing.length ? { ok: false, key: 'fields', list: missing.join(', ') } : { ok: true, key: 'fields' });
  if (typeof payload.iat === 'number' && payload.iat > now + SKEW) checks.push({ ok: false, key: 'notYet' });
  if (typeof payload.exp !== 'number') checks.push({ ok: false, key: 'noExpiry' });
  else if (payload.exp <= now) checks.push({ ok: false, key: 'expired' });
  else checks.push({ ok: true, key: 'live', n: Math.max(1, Math.round((payload.exp - now) / 60)) });
  return { kind: 'token', header: JSON.stringify(header, null, 2), payload: JSON.stringify(payload, null, 2), checks };
}
