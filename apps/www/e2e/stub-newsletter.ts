/**
 * The videos admin's /internal/newsletter endpoints as local E2E sees them (stub-cms.ts serves them
 * on ADMIN_API_URL). The real ones are in AlUmmahNow apps/admin-api (docs/features/newsletter.md).
 * The key must be LOCAL_KEY (src/lib/newsletter.ts). Addresses pick the answer: `limit@` → 429,
 * `human@` → 403 until a Turnstile token comes. Tokens: `confirm-ok…` confirms, `confirm-old…` has
 * expired, `unsub-ok…` unsubscribes, anything else is unknown.
 */
import { LOCAL_KEY } from '../src/lib/newsletter.ts';

export const NL_SITE_KEY = '1x00000000000000000000AA';
export const NL_TOKENS = {
  confirm: 'confirm-ok-aaaaaaaaaaaaaaaaaaaa',
  expired: 'confirm-old-aaaaaaaaaaaaaaaaaaa',
  unsubscribe: 'unsub-ok-aaaaaaaaaaaaaaaaaaaaaa',
  unknown: 'nothing-aaaaaaaaaaaaaaaaaaaaaaaa',
};

export function newsletterFixture(path: string, method: string, key: string | undefined, body: Record<string, unknown>): { status: number; body: unknown } | null {
  if (!path.startsWith('/internal/newsletter/')) return null;
  if (method !== 'POST') return { status: 405, body: { error: 'method' } };
  if (key !== LOCAL_KEY) return { status: 401, body: { error: 'unauthorized' } };
  const op = path.slice('/internal/newsletter/'.length);
  if (op === 'subscribe') {
    const email = typeof body.email === 'string' ? body.email : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return { status: 400, body: { error: 'invalid_email' } };
    if (email.startsWith('limit@')) return { status: 429, body: { error: 'rate_limited' } };
    if (email.startsWith('human@') && !body.turnstileToken) return { status: 403, body: { error: 'human_check_required', siteKey: NL_SITE_KEY } };
    return { status: 202, body: { success: true, result: { status: 'check_email' } } };
  }
  const token = typeof body.token === 'string' ? body.token : '';
  if (op === 'confirm') return { status: 200, body: { success: true, result: { status: token === NL_TOKENS.confirm ? 'confirmed' : token === NL_TOKENS.expired ? 'expired' : 'invalid' } } };
  if (op === 'unsubscribe') return { status: 200, body: { success: true, result: { status: token === NL_TOKENS.unsubscribe ? 'unsubscribed' : 'invalid' } } };
  return { status: 404, body: { error: 'not_found' } };
}
