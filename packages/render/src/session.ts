/**
 * Encrypted cookies (SPEC §7): AES-256-GCM with SESSION_SECRET (64 hex chars).
 * Format: base64url(iv[12] || ciphertext+tag). The payload carries its own `exp`
 * (seconds); expired or tampered values decrypt to null.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(value: string): Uint8Array {
  const s = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function isValidSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && /^[0-9a-fA-F]{64}$/.test(secret);
}

const keys = new Map<string, Promise<CryptoKey>>();
function key(secret: string): Promise<CryptoKey> {
  if (!isValidSecret(secret)) throw new Error('SESSION_SECRET must be 64 hex characters');
  let k = keys.get(secret);
  if (!k) {
    const raw = new Uint8Array(32);
    for (let i = 0; i < 32; i++) raw[i] = parseInt(secret.slice(i * 2, i * 2 + 2), 16);
    k = crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    keys.set(secret, k);
  }
  return k;
}

export async function seal(secret: string, payload: { exp: number } & Record<string, unknown>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), enc.encode(JSON.stringify(payload))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64url(out);
}

export async function unseal<T extends { exp: number }>(secret: string, value: string | null | undefined, nowSec = Math.floor(Date.now() / 1000)): Promise<T | null> {
  if (!value || value.length > 4096) return null;
  try {
    const bytes = fromB64url(value);
    if (bytes.length < 12 + 16) return null;
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await key(secret), bytes.slice(12));
    const payload = JSON.parse(dec.decode(pt)) as T;
    if (typeof payload?.exp !== 'number' || payload.exp <= nowSec) return null;
    return payload;
  } catch {
    return null;
  }
}
