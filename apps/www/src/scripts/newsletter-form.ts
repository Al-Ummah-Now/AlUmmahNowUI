/**
 * Newsletter sign-up forms (components/NewsletterForm.astro): posts JSON to the form's action and
 * shows the answer in the form's live region. When the admin API enforces Turnstile and asks for a
 * check, the widget is loaded (challenges.cloudflare.com, explicit render) into the form and the
 * sign-up is sent again with its token. Without this script the form still works (POST → 303).
 */
type State = 'check_email' | 'invalid' | 'rate_limited' | 'human_check' | 'unavailable';

interface Turnstile {
  render(el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void; language?: string; theme?: string }): string;
  reset(id?: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileLoading: Promise<Turnstile | null> | null = null;

function loadTurnstile(): Promise<Turnstile | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  turnstileLoading ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.onload = () => resolve(window.turnstile ?? null);
    s.onerror = () => {
      turnstileLoading = null;
      resolve(null);
    };
    document.head.append(s);
  });
  return turnstileLoading;
}

export async function postSignup(action: string, body: Record<string, string | null>, fetchImpl: typeof fetch = fetch): Promise<{ status: State; siteKey?: string | null }> {
  try {
    const res = await fetchImpl(action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as { status?: State; siteKey?: string | null } | null;
    return data?.status ? { status: data.status, siteKey: data.siteKey } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

export function initNewsletterForm(form: HTMLFormElement, fetchImpl: typeof fetch = fetch) {
  if (form.dataset.enhanced === 'true') return;
  form.dataset.enhanced = 'true';
  const input = form.querySelector<HTMLInputElement>('input[name="email"]')!;
  const trap = form.querySelector<HTMLInputElement>('input[name="website"]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const status = form.querySelector<HTMLElement>('[data-nl-status]')!;
  const widget = form.querySelector<HTMLElement>('[data-turnstile]')!;
  const msg = (s: State | 'sending') => form.dataset[`msg-${s}`.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] ?? '';
  let token: string | null = null;
  let widgetId: string | null = null;

  const show = (s: State | 'sending') => {
    status.textContent = msg(s);
    status.classList.toggle('nl-status-error', s !== 'sending' && s !== 'check_email');
    input.setAttribute('aria-invalid', s === 'invalid' ? 'true' : 'false');
  };

  async function send() {
    button.disabled = true;
    show('sending');
    const result = await postSignup(form.action, { email: input.value.trim(), website: trap?.value ?? '', turnstileToken: token }, fetchImpl);
    button.disabled = false;
    if (result.status === 'human_check') {
      const key = result.siteKey || form.dataset.siteKey;
      const ts = key ? await loadTurnstile() : null;
      if (!ts || !key) return show('unavailable');
      widget.hidden = false;
      show('human_check');
      if (widgetId !== null) ts.reset(widgetId);
      else
        widgetId = ts.render(widget, {
          sitekey: key,
          language: form.dataset.locale,
          callback: (t) => {
            token = t;
            void send();
          },
          'error-callback': () => show('unavailable'),
        });
      return;
    }
    token = null;
    show(result.status);
    if (result.status === 'check_email') {
      widget.hidden = true;
      form.reset();
    } else if (result.status === 'invalid') input.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim() || !input.checkValidity()) {
      show('invalid');
      input.focus();
      return;
    }
    void send();
  });
}

export function initNewsletterForms(root: ParentNode = document) {
  root.querySelectorAll<HTMLFormElement>('form[data-newsletter]').forEach((f) => initNewsletterForm(f));
}
