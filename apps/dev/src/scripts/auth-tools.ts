/** The Sign-in tools' page (src/pages/[lang]/auth/tools): reads the fields, shows what src/lib/auth/tools.ts answers. */
import { fill, formatNumber } from '../../../../packages/render/src/format.ts';
import { buildRequest, inspectToken, requestErrors, type RequestError } from '../lib/auth/tools.ts';
import type { Strings } from '../i18n';

type Copy = Strings['auth']['tools'];
const root = document.querySelector<HTMLElement>('[data-auth-tools]');
const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

if (root) {
  const copy = JSON.parse(root.dataset.authTools ?? '{}') as Copy;
  root.hidden = false;

  const fields: [RequestError | null, string][] = [
    ['errIssuer', 'rq-issuer'],
    ['errClient', 'rq-client'],
    ['errRedirect', 'rq-redirect'],
  ];
  const status = el('rq-status');
  const make = el<HTMLButtonElement>('rq-make');
  make.addEventListener('click', async () => {
    const input = { issuer: el<HTMLInputElement>('rq-issuer').value, clientId: el<HTMLInputElement>('rq-client').value, redirectUri: el<HTMLInputElement>('rq-redirect').value, prompt: el<HTMLSelectElement>('rq-prompt').value };
    const errors = requestErrors(input);
    for (const [key, id] of fields) {
      const bad = key !== null && errors.includes(key);
      const message = el(`${id}-err`);
      message.textContent = bad ? copy.request[key] : '';
      message.hidden = !bad;
      el(id).setAttribute('aria-invalid', String(bad));
    }
    el('rq-out').hidden = errors.length > 0;
    status.textContent = '';
    if (errors.length) {
      el(fields.find(([key]) => key === errors[0])![1]).focus();
      return;
    }
    const built = await buildRequest(input);
    el('rq-url').textContent = built.url;
    el('rq-verifier').textContent = built.verifier;
    el('rq-exchange').textContent = built.exchange;
    make.textContent = copy.request.again;
    status.textContent = copy.request.ready;
  });

  const text = el<HTMLTextAreaElement>('tk-text');
  const show = () => {
    const result = inspectToken(text.value);
    const note = el('tk-note');
    note.hidden = result.kind === 'empty' || result.kind === 'token';
    note.textContent = result.kind === 'refresh' || result.kind === 'notToken' ? copy.token[result.kind] : '';
    el('tk-out').hidden = result.kind !== 'token';
    const list = el('tk-checks');
    list.replaceChildren();
    if (result.kind !== 'token') return;
    el('tk-header').textContent = result.header;
    el('tk-payload').textContent = result.payload;
    for (const check of result.checks) {
      const item = document.createElement('li');
      item.className = check.ok ? 'tool-ok' : 'tool-bad';
      const template = check.ok ? copy.token.ok[check.key] : copy.token.bad[check.key];
      item.textContent = fill(template, { n: check.ok ? formatNumber(check.n ?? 0, locale) : '', alg: check.ok ? '' : (check.alg ?? ''), list: check.ok ? '' : (check.list ?? '') }, locale);
      list.append(item);
    }
  };
  text.addEventListener('input', show);
  el('tk-clear').addEventListener('click', () => {
    text.value = '';
    show();
    text.focus();
  });
  // A page restored from the back-forward cache, or a form the browser refilled, keeps no token and no request
  window.addEventListener('pageshow', () => {
    text.value = '';
    show();
    el('rq-out').hidden = true;
    status.textContent = '';
  });
}
