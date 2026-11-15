// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import {
  confirmSubscription,
  isEmail,
  isOneClick,
  isSignupState,
  LOCAL_KEY,
  newsletterDeps,
  readSignup,
  subscribe,
  unsubscribe,
  type NewsletterDeps,
} from '../src/lib/newsletter';
import { initNewsletterForm, postSignup } from '../src/scripts/newsletter-form';
import type { Config, WwwEnv } from '../src/lib/env';

const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz';

function fakeApi(status: number, body: unknown = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  const deps: NewsletterDeps = { adminApiUrl: 'https://admin.example', key: 'k1', fetchImpl };
  return { deps, calls };
}

const input = (email: string, extra: Partial<{ website: string; turnstileToken: string | null }> = {}) => ({ email, locale: 'en' as const, website: '', turnstileToken: null, ...extra });

describe('newsletter server calls', () => {
  it('forwards a sign-up with the key, the visitor IP and the locale; 202 means check your email', async () => {
    const { deps, calls } = fakeApi(202, { success: true, result: { status: 'check_email' } });
    expect(await subscribe(deps, { ...input('a@example.com'), locale: 'ar' }, '203.0.113.5')).toEqual({ status: 'check_email' });
    expect(calls[0]!.url).toBe('https://admin.example/internal/newsletter/subscribe');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('k1');
    expect(headers['X-Client-IP']).toBe('203.0.113.5');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ email: 'a@example.com', locale: 'ar', website: '', turnstileToken: null });
  });

  it('maps the admin API answers', async () => {
    expect(await subscribe(fakeApi(400).deps, input('a@example.com'), null)).toEqual({ status: 'invalid' });
    expect(await subscribe(fakeApi(429).deps, input('a@example.com'), null)).toEqual({ status: 'rate_limited' });
    expect(await subscribe(fakeApi(403, { error: 'human_check_required', siteKey: 'sk' }).deps, input('a@example.com'), null)).toEqual({ status: 'human_check', siteKey: 'sk' });
    expect(await subscribe(fakeApi(403, { error: 'forbidden' }).deps, input('a@example.com'), null)).toEqual({ status: 'unavailable' });
    expect(await subscribe(fakeApi(500).deps, input('a@example.com'), null)).toEqual({ status: 'unavailable' });
  });

  it('refuses a bad address without calling, but passes honeypot hits on (the API answers them the same)', async () => {
    const bad = fakeApi(202);
    expect(await subscribe(bad.deps, input('not-an-email'), null)).toEqual({ status: 'invalid' });
    expect(bad.calls).toHaveLength(0);
    const bot = fakeApi(202);
    expect(await subscribe(bot.deps, input('x', { website: 'http://spam' }), null)).toEqual({ status: 'check_email' });
    expect(bot.calls).toHaveLength(1);
  });

  it('is unavailable with no key or when the API is unreachable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await subscribe({ adminApiUrl: 'https://admin.example', key: undefined }, input('a@example.com'), null)).toEqual({ status: 'unavailable' });
    const down = { adminApiUrl: 'https://admin.example', key: 'k', fetchImpl: (async () => { throw new Error('down'); }) as unknown as typeof fetch };
    expect(await subscribe(down, input('a@example.com'), null)).toEqual({ status: 'unavailable' });
    warn.mockRestore();
  });

  it('reads a Secrets Store binding, and the stub key locally', async () => {
    const { deps, calls } = fakeApi(202);
    await subscribe({ ...deps, key: { get: async () => 'from-store' } }, input('a@example.com'), null);
    expect((calls[0]!.init.headers as Record<string, string>)['X-API-Key']).toBe('from-store');
    const cfg = { adminApiUrl: 'http://localhost:8585', appEnv: 'local' } as Config;
    expect(newsletterDeps({ INTERNAL_API_KEY: 'real' } as WwwEnv, cfg).key).toBe(LOCAL_KEY);
    expect(newsletterDeps({ INTERNAL_API_KEY: 'real' } as WwwEnv, { ...cfg, appEnv: 'production' }).key).toBe('real');
  });

  it('confirms and unsubscribes by token; a malformed token never reaches the API', async () => {
    expect(await confirmSubscription(fakeApi(200, { result: { status: 'confirmed' } }).deps, TOKEN)).toBe('confirmed');
    expect(await confirmSubscription(fakeApi(200, { result: { status: 'expired' } }).deps, TOKEN)).toBe('expired');
    expect(await confirmSubscription(fakeApi(200, { result: { status: 'invalid' } }).deps, TOKEN)).toBe('invalid');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await confirmSubscription(fakeApi(500).deps, TOKEN)).toBe('unavailable');
    warn.mockRestore();
    const short = fakeApi(200, { result: { status: 'confirmed' } });
    expect(await confirmSubscription(short.deps, 'abc')).toBe('invalid');
    expect(short.calls).toHaveLength(0);
    const u = fakeApi(200, { result: { status: 'unsubscribed' } });
    expect(await unsubscribe(u.deps, TOKEN)).toBe('unsubscribed');
    expect(JSON.parse(String(u.calls[0]!.init.body))).toEqual({ token: TOKEN });
  });
});

describe('newsletter request parsing', () => {
  it('reads the no-JS form and the script JSON, with Turnstile under either name', async () => {
    const form = new URLSearchParams({ email: '  A@Example.COM ', website: '', 'cf-turnstile-response': 'tt' });
    const fromForm = await readSignup(new Request('https://w/en/newsletter/', { method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }), 'en');
    expect(fromForm).toEqual({ email: 'a@example.com', locale: 'en', website: '', turnstileToken: 'tt' });
    const fromJson = await readSignup(new Request('https://w/ar/newsletter/', { method: 'POST', body: JSON.stringify({ email: 'b@example.com', turnstileToken: 'x' }), headers: { 'Content-Type': 'application/json' } }), 'ar');
    expect(fromJson).toEqual({ email: 'b@example.com', locale: 'ar', website: '', turnstileToken: 'x' });
    const broken = await readSignup(new Request('https://w/en/newsletter/', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } }), 'en');
    expect(broken.email).toBe('');
  });

  it('recognises an RFC 8058 one-click unsubscribe', async () => {
    const post = (body: string, type = 'application/x-www-form-urlencoded') => new Request('https://w/en/newsletter/unsubscribe?token=x', { method: 'POST', body, headers: { 'Content-Type': type } });
    expect(await isOneClick(post('List-Unsubscribe=One-Click'))).toBe(true);
    expect(await isOneClick(post('token=abc'))).toBe(false);
    expect(await isOneClick(post('{}', 'application/json'))).toBe(false);
  });

  it('checks addresses and result states', () => {
    expect(isEmail('a@example.com')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
    expect(isSignupState('check_email')).toBe(true);
    expect(isSignupState('hacked')).toBe(false);
    expect(isSignupState(null)).toBe(false);
  });

  it('has every string in both languages', () => {
    expect(Object.keys(ar.newsletter).sort()).toEqual(Object.keys(en.newsletter).sort());
    for (const v of Object.values(ar.newsletter)) expect(v).toMatch(/[؀-ۿ]/);
  });
});

describe('newsletter form script', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mount() {
    document.body.innerHTML = `
      <form data-newsletter action="/en/newsletter/" data-locale="en" data-msg-sending="Sending" data-msg-check_email="Check" data-msg-invalid="Bad"
        data-msg-rate_limited="Slow" data-msg-human_check="Human" data-msg-unavailable="Down" data-site-key="">
        <input name="email" type="email" required />
        <input name="website" />
        <button type="submit">Subscribe</button>
        <div data-turnstile hidden></div>
        <p data-nl-status></p>
      </form>`;
    return document.querySelector('form')!;
  }

  it('posts JSON and shows the answer in the live region, then clears the field', async () => {
    const form = mount();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: 'check_email' }), { status: 202 })) as unknown as typeof fetch;
    initNewsletterForm(form, fetchImpl);
    form.querySelector<HTMLInputElement>('input[name="email"]')!.value = 'a@example.com';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(form.querySelector('[data-nl-status]')!.textContent).toBe('Check'));
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]! as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ email: 'a@example.com', website: '', turnstileToken: null });
    expect(form.querySelector<HTMLInputElement>('input[name="email"]')!.value).toBe('');
    expect(form.querySelector('[data-nl-status]')!.classList.contains('nl-status-error')).toBe(false);
  });

  it('says an empty address is invalid without posting', () => {
    const form = mount();
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    initNewsletterForm(form, fetchImpl);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(form.querySelector('[data-nl-status]')!.textContent).toBe('Bad');
    expect(form.querySelector('input[name="email"]')!.getAttribute('aria-invalid')).toBe('true');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('shows rate limits as an error and treats a broken answer as unavailable', async () => {
    const form = mount();
    initNewsletterForm(form, (async () => new Response(JSON.stringify({ status: 'rate_limited' }), { status: 429 })) as unknown as typeof fetch);
    form.querySelector<HTMLInputElement>('input[name="email"]')!.value = 'a@example.com';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(form.querySelector('[data-nl-status]')!.textContent).toBe('Slow'));
    expect(form.querySelector('[data-nl-status]')!.classList.contains('nl-status-error')).toBe(true);
    expect(await postSignup('/x', {}, (async () => new Response('<html>', { status: 500 })) as unknown as typeof fetch)).toEqual({ status: 'unavailable' });
  });

  it('renders Turnstile when asked and sends again with its token', async () => {
    const form = mount();
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      return new Response(JSON.stringify(body.turnstileToken ? { status: 'check_email' } : { status: 'human_check', siteKey: 'sk-test' }));
    }) as unknown as typeof fetch;
    let callback: ((t: string) => void) | undefined;
    window.turnstile = { render: (_el, opts) => { callback = opts.callback; expect(opts.sitekey).toBe('sk-test'); return 'w1'; }, reset: () => {} };
    initNewsletterForm(form, fetchImpl);
    form.querySelector<HTMLInputElement>('input[name="email"]')!.value = 'a@example.com';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(form.querySelector('[data-nl-status]')!.textContent).toBe('Human'));
    expect(form.querySelector<HTMLElement>('[data-turnstile]')!.hidden).toBe(false);
    callback!('ts-token');
    await vi.waitFor(() => expect(form.querySelector('[data-nl-status]')!.textContent).toBe('Check'));
    expect(bodies[1]!.turnstileToken).toBe('ts-token');
    expect(form.querySelector<HTMLElement>('[data-turnstile]')!.hidden).toBe(true);
    delete window.turnstile;
  });
});
