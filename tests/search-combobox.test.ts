// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../src/i18n/en';
import { countLabel, initCombobox, type ComboboxLabels } from '../src/scripts/search-combobox';
import { addRecent, readRecent } from '../src/lib/search/recent';
import type { SearchHit } from '../src/lib/search/suggest';
import { hit, memoryStore } from './search-fixtures';

const t = en.search;
const labels: ComboboxLabels = {
  articles: t.articles,
  scholars: t.scholars,
  cards: t.cards,
  recent: t.recent,
  removeRecent: t.removeRecent,
  removeHint: t.removeHint,
  recentCleared: t.recentCleared,
  seeAll: t.seeAll,
  countNone: t.countNone,
  countOne: t.countOne,
  countTwo: t.countTwo,
  countFew: t.countFew,
  countMany: t.countMany,
  recentCount: t.recentCount,
};

/** The markup of src/components/SearchBox.astro. */
function mount(): HTMLFormElement {
  document.body.innerHTML = `
    <form class="search" role="search" action="/en/search" method="get" data-search data-locale="en" data-cms-url="https://cms.test">
      <label for="s-input">${t.label}</label>
      <div class="search-field">
        <input id="s-input" name="q" type="search" dir="auto" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="s-list" aria-haspopup="listbox" />
      </div>
      <div class="search-popup" data-search-popup hidden>
        <ul id="s-list" role="listbox" aria-label="${t.suggestions}"></ul>
        <button type="button" data-search-clear hidden>${t.clearRecent}</button>
      </div>
      <span id="s-hint" data-search-hint>${t.removeHint}</span>
      <p role="status" aria-live="polite" data-search-status></p>
    </form>
    <a href="#" id="outside">outside</a>`;
  const form = document.querySelector('form')!;
  form.dataset.labels = JSON.stringify(labels);
  return form;
}

const HITS: SearchHit[] = [
  hit({ id: 1, title: 'أَحمد شوقي', href: '/en/articles/ahmad/', thumbnailUrl: 'https://cms.test/api/public/v1/media/a.png?w=320&f=webp' }),
  hit({ id: 2, title: 'Ahmad and cards', type: 'cards', href: '/en/articles/cards/' }),
  hit({ id: 3, title: 'More by Ahmad', href: '/en/articles/more/' }),
];

let form: HTMLFormElement;
let input: HTMLInputElement;
let store: ReturnType<typeof memoryStore>;
let fetchHits: ReturnType<typeof vi.fn>;
let fetchScholars: ReturnType<typeof vi.fn>;
let navigate: ReturnType<typeof vi.fn>;
let submit: ReturnType<typeof vi.fn>;
let destroy: () => void;

const key = (k: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const listbox = () => document.getElementById('s-list')!;
const options = () => [...listbox().querySelectorAll<HTMLElement>('[role="option"]')];
const status = () => document.querySelector('[data-search-status]')!.textContent;
const popupHidden = () => document.querySelector<HTMLElement>('[data-search-popup]')!.hidden;
async function type(text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await vi.advanceTimersByTimeAsync(250);
}

beforeEach(() => {
  vi.useFakeTimers();
  form = mount();
  input = form.querySelector('input')!;
  store = memoryStore();
  fetchHits = vi.fn(async () => HITS);
  fetchScholars = vi.fn(async () => []);
  navigate = vi.fn();
  submit = vi.fn();
  ({ destroy } = initCombobox(form, { store, fetchHits, fetchScholars, navigate, submit, debounceMs: 200 }));
});
afterEach(() => {
  destroy();
  vi.useRealTimers();
});

describe('search combobox', () => {
  it('lists matching scholars first, in their own group, linking to their pages', async () => {
    fetchScholars.mockResolvedValueOnce([
      { id: -1, type: 'scholar', title: 'Aisha Rahman', slug: 'aisha-rahman', locale: 'en', href: '/en/scholars/aisha-rahman/', thumbnailUrl: null, excerpt: null, publishedAt: '' },
    ]);
    input.value = 'aisha';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(250);
    expect(fetchScholars.mock.calls[0]![0]).toBe('https://cms.test/api/public/v1/search/scholars?locale=en&q=aisha&limit=3');
    const groups = [...listbox().querySelectorAll('[role="group"]')];
    expect(groups.map((g) => document.getElementById(g.getAttribute('aria-labelledby')!)!.textContent)[0]).toBe(t.scholars);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(navigate).toHaveBeenCalledWith('/en/scholars/aisha-rahman/');
  });

  it('debounces, then shows grouped suggestions with the ARIA wiring and a count announcement', async () => {
    input.value = 'احمد';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchHits).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(150);
    expect(fetchHits).toHaveBeenCalledTimes(1);
    expect(fetchHits.mock.calls[0]![0]).toBe('https://cms.test/api/public/v1/search/suggest?locale=en&q=%D8%A7%D8%AD%D9%85%D8%AF&limit=6');

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(popupHidden()).toBe(false);
    const groups = [...listbox().querySelectorAll('[role="group"]')];
    expect(groups.map((g) => document.getElementById(g.getAttribute('aria-labelledby')!)!.textContent)).toEqual([t.articles, t.cards]);
    expect(options()).toHaveLength(4); // 3 hits + "See all results"
    expect(options().every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(options()[3]!.textContent).toBe('See all results for “احمد”');
    // normalisation-aware mark: "احمد" marks "أَحمد"
    expect(options()[0]!.querySelector('mark')!.textContent).toBe('أَحمد');
    expect(options()[0]!.querySelector('img')!.getAttribute('alt')).toBe('');
    expect(options()[0]!.querySelector('[dir="auto"]')).not.toBeNull();
    expect(status()).toBe('3 suggestions');
  });

  it('ArrowDown/ArrowUp wrap, Home/End jump, aria-activedescendant follows', async () => {
    await type('ahmad');
    key('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0]!.id);
    expect(options()[0]!.getAttribute('aria-selected')).toBe('true');
    key('ArrowUp');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[3]!.id);
    key('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0]!.id);
    key('End');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[3]!.id);
    key('Home');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0]!.id);
    expect(options().filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('Enter on an option navigates to it and remembers the search; Enter without one submits as before', async () => {
    await type('ahmad');
    key('ArrowDown');
    key('ArrowDown');
    expect(key('Enter')).toBe(false); // default prevented
    expect(navigate).toHaveBeenCalledWith('/en/articles/cards/');
    expect(readRecent(store)).toEqual(['ahmad']);
    expect(input.getAttribute('aria-expanded')).toBe('false');

    await type('prayer');
    expect(key('Enter')).toBe(true); // not prevented: the form submits to /en/search
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('the "See all results" option submits the full search', async () => {
    await type('ahmad');
    key('ArrowUp');
    key('Enter');
    expect(submit).toHaveBeenCalledWith(form);
  });

  it('Escape closes, a second Escape clears the box', async () => {
    await type('ahmad');
    key('Escape');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(input.value).toBe('ahmad');
    key('Escape');
    expect(input.value).toBe('');
  });

  it('aborts the stale request; a late answer for old text is ignored', async () => {
    const signals: AbortSignal[] = [];
    let release: (v: SearchHit[]) => void = () => undefined;
    fetchHits.mockImplementationOnce((_url: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<SearchHit[]>((r) => (release = r));
    });
    await type('ah');
    fetchHits.mockImplementationOnce(async (_url: string, signal: AbortSignal) => {
      signals.push(signal);
      return [HITS[2]!];
    });
    await type('ahmad');
    expect(signals[0]!.aborted).toBe(true);
    release(HITS);
    await vi.advanceTimersByTimeAsync(0);
    expect(options()).toHaveLength(2);
    expect(status()).toBe('1 suggestion');
  });

  it('no answer from the CMS (error/404): no suggestions, nothing breaks', async () => {
    fetchHits.mockResolvedValueOnce(null);
    await type('ahmad');
    expect(popupHidden()).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(key('Enter')).toBe(true);
  });

  it('no matches: "No suggestions" announced, the full search still offered', async () => {
    fetchHits.mockResolvedValueOnce([]);
    await type('zzz');
    expect(status()).toBe('No suggestions');
    expect(options().map((o) => o.textContent)).toEqual(['See all results for “zzz”']);
  });

  it('empty box on focus shows recent searches; Delete removes one; Clear removes all', async () => {
    addRecent(store, 'first');
    addRecent(store, 'second');
    input.dispatchEvent(new Event('focus'));
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options().map((o) => o.querySelector('.search-option-title')!.textContent)).toEqual(['second', 'first']);
    expect(options()[0]!.getAttribute('aria-describedby')).toBe('s-hint');
    expect(status()).toBe('2 recent searches');
    const clear = document.querySelector<HTMLButtonElement>('[data-search-clear]')!;
    expect(clear.hidden).toBe(false);

    key('ArrowDown');
    key('Delete');
    expect(readRecent(store)).toEqual(['first']);
    expect(options()).toHaveLength(1);
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0]!.id);

    addRecent(store, 'third');
    clear.click();
    expect(readRecent(store)).toEqual([]);
    expect(popupHidden()).toBe(true);
    expect(status()).toBe(t.recentCleared);
  });

  it('the × on a recent search removes it with a pointer; picking one searches it', async () => {
    addRecent(store, 'one');
    addRecent(store, 'two');
    input.dispatchEvent(new Event('focus'));
    options()[0]!.querySelector<HTMLElement>('[data-remove]')!.click();
    expect(readRecent(store)).toEqual(['one']);
    options()[0]!.click();
    expect(input.value).toBe('one');
    expect(submit).toHaveBeenCalledWith(form);
  });

  it('typing hides recent searches; clearing the box shows them again', async () => {
    addRecent(store, 'old');
    await type('ahmad');
    expect(options().some((o) => o.classList.contains('search-option-recent'))).toBe(false);
    await type('');
    expect(options().map((o) => o.textContent)).toEqual(['old×']);
  });

  it('submitting records the search; storage that throws never breaks the box', async () => {
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(readRecent(store)).toEqual([]);
    input.value = 'Prayer';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(readRecent(store)).toEqual(['Prayer']);

    destroy();
    form = mount();
    input = form.querySelector('input')!;
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    ({ destroy } = initCombobox(form, { store: broken, fetchHits, navigate, submit }));
    input.dispatchEvent(new Event('focus'));
    expect(popupHidden()).toBe(true);
    input.value = 'x';
    expect(() => form.dispatchEvent(new Event('submit', { cancelable: true }))).not.toThrow();
  });

  it('a box already focused when the script starts shows recent searches', () => {
    destroy();
    form = mount();
    input = form.querySelector('input')!;
    addRecent(store, 'early');
    input.focus();
    ({ destroy } = initCombobox(form, { store, fetchHits, navigate, submit }));
    expect(options().map((o) => o.querySelector('.search-option-title')!.textContent)).toEqual(['early']);
  });

  it('closes when focus leaves the form', async () => {
    await type('ahmad');
    form.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.querySelector('[data-search-clear]') }));
    expect(popupHidden()).toBe(false);
    form.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.getElementById('outside') }));
    expect(popupHidden()).toBe(true);
  });

  it('countLabel: Arabic-style plural forms', () => {
    expect([0, 1, 2, 3, 10, 11].map((n) => countLabel(labels, n))).toEqual(['No suggestions', '1 suggestion', '2 suggestions', '3 suggestions', '10 suggestions', '11 suggestions']);
  });
});
