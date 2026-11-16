/**
 * Newsletter (AlUmmahNowUI#6): www's server side of the sign-up form and the confirm and
 * unsubscribe pages. Everything is stored and sent by the videos admin API
 * (AlUmmahNow apps/admin-api /internal/newsletter, docs/features/newsletter.md): this module only
 * forwards, with the internal API key (Secrets Store binding INTERNAL_API_KEY) and the visitor's IP
 * (rate limit there). Double opt-in, the confirmation and issue emails and the queue live there.
 *
 * Links in the emails open /{l}/newsletter/confirm?token= and /{l}/newsletter/unsubscribe?token=;
 * those pages change nothing on GET (mail scanners open links) and act on the button's POST. The
 * unsubscribe URL also takes the RFC 8058 one-click POST (`List-Unsubscribe=One-Click`).
 *
 * Off (src/lib/features.ts says no, or the admin API answers 404 feature_off): the sign-up page and
 * confirm page are 404 and the footer form is left out. Unsubscribe keeps working while the admin API
 * can still be reached, so people can always leave.
 */
import type { Config, WwwEnv } from './env';
import type { Locale } from './locale';

export type SecretBinding = string | { get(): Promise<string> } | undefined;

export interface NewsletterDeps {
  adminApiUrl: string;
  key: SecretBinding;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type SubscribeOutcome =
  | { status: 'check_email' }
  | { status: 'invalid' }
  | { status: 'rate_limited' }
  /** Turnstile is enforced and the token was missing or failed: render the widget with this key. */
  | { status: 'human_check'; siteKey: string | null }
  /** The newsletter is switched off or can't send (admin API 404 feature_off): the page is a 404. */
  | { status: 'off' }
  | { status: 'unavailable' };

export type ConfirmOutcome = 'confirmed' | 'expired' | 'invalid' | 'off' | 'unavailable';
export type UnsubscribeOutcome = 'unsubscribed' | 'invalid' | 'off' | 'unavailable';

export interface SignupInput {
  email: string;
  locale: Locale;
  /** Hidden field: people never fill it */
  website: string;
  turnstileToken: string | null;
}

export const EMAIL_MAX = 254;
/** Same shape the admin API checks; it validates again. */
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
export const TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

export const isEmail = (v: string) => v.length <= EMAIL_MAX && EMAIL.test(v);

/**
 * Deps from the Worker env. Local dev and local E2E have no Secrets Store: their admin API is the
 * stub (e2e/stub-cms.ts), which takes the key LOCAL_KEY.
 */
export const LOCAL_KEY = 'local-newsletter-key';
export function newsletterDeps(env: WwwEnv, cfg: Config): NewsletterDeps {
  return { adminApiUrl: cfg.adminApiUrl, key: cfg.appEnv === 'local' ? LOCAL_KEY : env.INTERNAL_API_KEY };
}

async function resolveKey(binding: SecretBinding): Promise<string> {
  if (typeof binding === 'string') return binding;
  try {
    return (await binding?.get()) || '';
  } catch {
    return '';
  }
}

/** www can reach the admin API's newsletter endpoints (URL and key set). Without them the pages are 404. */
export async function newsletterReachable(deps: NewsletterDeps): Promise<boolean> {
  return !!deps.adminApiUrl && !!(await resolveKey(deps.key));
}

/** The admin API's answer for a switched-off feature: 404 { success: false, code: 'feature_off' }. */
async function isFeatureOff(res: Response): Promise<boolean> {
  if (res.status !== 404) return false;
  const body = (await res.clone().json().catch(() => null)) as { code?: unknown } | null;
  return body?.code === 'feature_off';
}

async function post(deps: NewsletterDeps, path: string, body: unknown, ip: string | null): Promise<Response | null> {
  const key = await resolveKey(deps.key);
  if (!deps.adminApiUrl || !key) {
    console.warn(JSON.stringify({ msg: 'newsletter: not configured', adminApi: !!deps.adminApiUrl, key: !!key }));
    return null;
  }
  try {
    return await (deps.fetchImpl ?? fetch)(`${deps.adminApiUrl}/internal/newsletter${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-API-Key': key, ...(ip ? { 'X-Client-IP': ip } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 5000),
    });
  } catch (error) {
    console.warn(JSON.stringify({ msg: 'newsletter: admin API unreachable', path, error: String(error) }));
    return null;
  }
}

/** Reads the form (urlencoded or multipart, no JS) or the script's JSON body. */
export async function readSignup(request: Request, locale: Locale): Promise<SignupInput> {
  const type = request.headers.get('Content-Type') ?? '';
  let raw: Record<string, unknown> = {};
  try {
    if (type.includes('application/json')) raw = ((await request.json()) as Record<string, unknown>) ?? {};
    else {
      const form = await request.formData();
      raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
    }
  } catch {
    raw = {};
  }
  const s = (k: string, max: number) => (typeof raw[k] === 'string' ? (raw[k] as string).trim().slice(0, max) : '');
  return {
    email: s('email', EMAIL_MAX + 1).toLowerCase(),
    locale,
    website: s('website', 200),
    // Turnstile's widget names its field cf-turnstile-response
    turnstileToken: s('turnstileToken', 2048) || s('cf-turnstile-response', 2048) || null,
  };
}

export async function subscribe(deps: NewsletterDeps, input: SignupInput, ip: string | null): Promise<SubscribeOutcome> {
  if (!input.website && !isEmail(input.email)) return { status: 'invalid' };
  const res = await post(deps, '/subscribe', { email: input.email, locale: input.locale, website: input.website, turnstileToken: input.turnstileToken }, ip);
  if (!res) return { status: 'unavailable' };
  if (await isFeatureOff(res)) return { status: 'off' };
  if (res.status === 202 || res.status === 200) return { status: 'check_email' };
  if (res.status === 400) return { status: 'invalid' };
  if (res.status === 429) return { status: 'rate_limited' };
  if (res.status === 403) {
    const body = (await res.json().catch(() => null)) as { error?: string; siteKey?: unknown } | null;
    if (body?.error === 'human_check_required') return { status: 'human_check', siteKey: typeof body.siteKey === 'string' && body.siteKey ? body.siteKey : null };
  }
  console.warn(JSON.stringify({ msg: 'newsletter: subscribe failed', status: res.status }));
  return { status: 'unavailable' };
}

async function tokenCall<T extends string>(deps: NewsletterDeps, path: string, token: string, allowed: readonly T[]): Promise<T | 'invalid' | 'off' | 'unavailable'> {
  if (!TOKEN.test(token)) return 'invalid';
  const res = await post(deps, path, { token }, null);
  if (res && (await isFeatureOff(res))) return 'off';
  if (!res?.ok) {
    if (res) console.warn(JSON.stringify({ msg: `newsletter: ${path} failed`, status: res.status }));
    return 'unavailable';
  }
  const body = (await res.json().catch(() => null)) as { result?: { status?: string } } | null;
  const status = body?.result?.status;
  return (allowed as readonly string[]).includes(status ?? '') ? (status as T) : status === 'invalid' ? 'invalid' : 'unavailable';
}

export const confirmSubscription = (deps: NewsletterDeps, token: string) => tokenCall(deps, '/confirm', token, ['confirmed', 'expired'] as const) as Promise<ConfirmOutcome>;
export const unsubscribe = (deps: NewsletterDeps, token: string) => tokenCall(deps, '/unsubscribe', token, ['unsubscribed'] as const) as Promise<UnsubscribeOutcome>;

/** An RFC 8058 one-click POST from a mail client (form body `List-Unsubscribe=One-Click`). */
export async function isOneClick(request: Request): Promise<boolean> {
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.includes('application/x-www-form-urlencoded') && !type.includes('multipart/form-data')) return false;
  try {
    const form = await request.clone().formData();
    return form.get('List-Unsubscribe') === 'One-Click';
  } catch {
    return false;
  }
}

/** The no-JS result messages travel as ?s= on the sign-up page (303 after the POST). */
export const SIGNUP_STATES = ['check_email', 'invalid', 'rate_limited', 'human_check', 'unavailable'] as const;
export type SignupState = (typeof SIGNUP_STATES)[number];
export const isSignupState = (v: string | null): v is SignupState => !!v && (SIGNUP_STATES as readonly string[]).includes(v);
