/** The reference page: filter as you type, pick a sample language, open the endpoint the address names. */
import { fill, formatNumber } from '../../../../packages/render/src/format.ts';

const root = document.querySelector<HTMLElement>('[data-ref]');
if (root) {
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const tools = root.querySelector<HTMLElement>('[data-ref-tools]')!;
  const find = root.querySelector<HTMLInputElement>('#ref-find')!;
  const count = root.querySelector<HTMLElement>('#ref-count')!;
  const none = root.querySelector<HTMLElement>('[data-ref-none]')!;
  const ops = [...root.querySelectorAll<HTMLElement>('[data-ref-op]')];
  const groups = [...root.querySelectorAll<HTMLElement>('[data-ref-group]')];
  tools.hidden = false;

  const filter = () => {
    const words = find.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const op of ops) {
      op.hidden = !words.every((w) => op.dataset.find!.includes(w));
      if (!op.hidden) shown++;
    }
    for (const g of groups) g.hidden = !g.querySelector('[data-ref-op]:not([hidden])');
    none.hidden = shown > 0;
    count.textContent = fill(tools.dataset.found!, { n: formatNumber(shown, locale) }, locale);
  };
  find.addEventListener('input', filter);
  filter();

  for (const radio of root.querySelectorAll<HTMLInputElement>('input[name="ref-lang"]')) {
    const pick = () => {
      if (radio.checked) root.dataset.lang = radio.value;
    };
    radio.addEventListener('change', pick);
    // a browser may have brought back another choice
    pick();
    window.addEventListener('pageshow', pick);
  }

  const open = () => {
    const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    const details = target?.matches('[data-ref-op]') ? target.querySelector('details') : null;
    if (!target || !details) return;
    if (target.hidden) {
      find.value = '';
      filter();
    }
    details.open = true;
    target.scrollIntoView();
  };
  window.addEventListener('hashchange', open);
  open();
}
