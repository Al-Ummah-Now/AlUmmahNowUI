/**
 * Search-as-you-type for every search box on the site (src/components/SearchBox.astro): an ARIA 1.2
 * combobox (input role=combobox + a listbox popup with grouped options and aria-activedescendant).
 *
 *  - typing: suggestions from the CMS (debounced, the previous request aborted), grouped by kind,
 *    the matched text marked (normalisation-aware), a polite live region says how many
 *  - empty box on focus: the viewer's recent searches (localStorage), each removable (Delete key,
 *    or the × with a pointer), plus "Clear recent searches"
 *  - ArrowDown/ArrowUp move (and wrap), Home/End jump while an option is active, Enter picks the
 *    active option or else submits the form (the full search, as without JS), Escape closes, then
 *    clears
 *  - no answer from the CMS (error, 404, offline): no suggestions; the form still works
 */
import { normalizeSearchText } from '../lib/search/normalize';
import { highlightParts } from '../lib/search/highlight';
import { addRecent, clearRecent, localStore, readRecent, removeRecent, type StorageLike } from '../lib/search/recent';
import { fetchScholarSuggestions, fetchSuggestions, isSafeHref, scholarSuggestUrl, suggestUrl, type SearchHit } from '../lib/search/suggest';
import type { Locale } from '../lib/locale';
import { stableImageUrl } from '../lib/images';

export interface ComboboxLabels {
  articles: string;
  /** Scholars' pages (shown before the articles). Older pages may not send it. */
  scholars?: string;
  cards: string;
  recent: string;
  removeRecent: string;
  removeHint: string;
  recentCleared: string;
  seeAll: string;
  countNone: string;
  countOne: string;
  countTwo: string;
  countFew: string;
  countMany: string;
  recentCount: string;
}

export interface ComboboxOptions {
  fetchHits?: (url: string, signal: AbortSignal) => Promise<SearchHit[] | null>;
  /** Scholar suggestions (the CMS /search/scholars); null = none. */
  fetchScholars?: (url: string, signal: AbortSignal) => Promise<SearchHit[] | null>;
  store?: StorageLike | null;
  debounceMs?: number;
  navigate?: (href: string) => void;
  submit?: (form: HTMLFormElement) => void;
}

type Item = { kind: 'hit'; hit: SearchHit } | { kind: 'recent'; text: string } | { kind: 'all'; q: string };

export const DEBOUNCE_MS = 200;

const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** "No suggestions" / "1 suggestion" / … (Arabic has two, few and many forms). */
export function countLabel(labels: ComboboxLabels, n: number): string {
  if (n === 0) return labels.countNone;
  if (n === 1) return labels.countOne;
  if (n === 2) return labels.countTwo;
  return fill(n >= 3 && n <= 10 ? labels.countFew : labels.countMany, { count: n });
}

export function initCombobox(form: HTMLFormElement, opts: ComboboxOptions = {}): { destroy: () => void } {
  const found = {
    input: form.querySelector<HTMLInputElement>('input[role="combobox"]'),
    popup: form.querySelector<HTMLElement>('[data-search-popup]'),
    listbox: form.querySelector<HTMLElement>('[role="listbox"]'),
    clearButton: form.querySelector<HTMLButtonElement>('[data-search-clear]'),
    status: form.querySelector<HTMLElement>('[data-search-status]'),
  };
  const hint = form.querySelector<HTMLElement>('[data-search-hint]');
  if (!found.input || !found.popup || !found.listbox || !found.clearButton || !found.status) return { destroy: () => undefined };
  const input: HTMLInputElement = found.input;
  const popup: HTMLElement = found.popup;
  const listbox: HTMLElement = found.listbox;
  const clearButton: HTMLButtonElement = found.clearButton;
  const status: HTMLElement = found.status;

  let labels: ComboboxLabels;
  try {
    labels = JSON.parse(form.dataset.labels ?? '{}') as ComboboxLabels;
  } catch {
    return { destroy: () => undefined };
  }
  const locale = (form.dataset.locale === 'ar' ? 'ar' : 'en') as Locale;
  const cmsUrl = form.dataset.cmsUrl ?? '';
  const videosWebUrl = form.dataset.videosWebUrl ?? '';
  const store = opts.store === undefined ? localStore() : opts.store;
  const fetchHits = opts.fetchHits ?? ((url: string, signal: AbortSignal) => fetchSuggestions(url, signal));
  const fetchScholars = opts.fetchScholars ?? ((url: string, signal: AbortSignal) => fetchScholarSuggestions(url, locale, signal));
  const navigate = opts.navigate ?? ((href: string) => location.assign(href));
  const submit = opts.submit ?? ((f: HTMLFormElement) => (typeof f.requestSubmit === 'function' ? f.requestSubmit() : f.submit()));
  const debounceMs = opts.debounceMs ?? DEBOUNCE_MS;
  const listId = listbox.id;

  let items: Item[] = [];
  let active = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;
  let seq = 0;

  const announce = (text: string) => {
    status.textContent = text;
  };
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const isOpen = () => !popup.hidden;

  function close() {
    popup.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function open() {
    popup.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function setActive(i: number) {
    active = i;
    listbox.querySelectorAll('[role="option"]').forEach((el) => el.setAttribute('aria-selected', String(el.id === optionId(i))));
    if (i < 0) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    input.setAttribute('aria-activedescendant', optionId(i));
    const el = listbox.querySelector<HTMLElement>(`#${CSS.escape(optionId(i))}`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }

  function textWithMarks(el: HTMLElement, text: string, query: string) {
    for (const part of highlightParts(text, query)) {
      if (part.mark) {
        const mark = document.createElement('mark');
        mark.textContent = part.text;
        el.append(mark);
      } else el.append(document.createTextNode(part.text));
    }
  }

  function group(label: string, key: string): HTMLElement {
    const g = document.createElement('ul');
    g.setAttribute('role', 'group');
    const head = document.createElement('li');
    head.setAttribute('role', 'presentation');
    head.className = 'search-group-label';
    head.id = `${listId}-group-${key}`;
    head.textContent = label;
    g.setAttribute('aria-labelledby', head.id);
    g.append(head);
    listbox.append(g);
    return g;
  }

  function option(parent: HTMLElement, i: number): HTMLLIElement {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.id = optionId(i);
    li.setAttribute('aria-selected', 'false');
    li.dataset.index = String(i);
    li.className = 'search-option';
    parent.append(li);
    return li;
  }

  function render(next: Item[], query: string) {
    items = next;
    active = -1;
    input.removeAttribute('aria-activedescendant');
    listbox.replaceChildren();
    const recents = next.some((it) => it.kind === 'recent');
    clearButton.hidden = !recents;
    const groups = new Map<string, HTMLElement>();
    const target = (key: string, label: string) => {
      if (!groups.has(key)) groups.set(key, group(label, key));
      return groups.get(key)!;
    };
    next.forEach((it, i) => {
      if (it.kind === 'recent') {
        const li = option(target('recent', labels.recent), i);
        li.classList.add('search-option-recent');
        if (hint) li.setAttribute('aria-describedby', hint.id);
        const text = document.createElement('span');
        text.className = 'search-option-title';
        text.dir = 'auto';
        text.textContent = it.text;
        const remove = document.createElement('span');
        remove.className = 'search-remove';
        remove.dataset.remove = '';
        remove.setAttribute('aria-hidden', 'true');
        remove.title = fill(labels.removeRecent, { query: it.text });
        remove.textContent = '×';
        li.append(text, remove);
      } else if (it.kind === 'hit') {
        const groupLabel = it.hit.type === 'scholar' ? (labels.scholars ?? labels.articles) : it.hit.type === 'cards' ? labels.cards : labels.articles;
        const li = option(target(it.hit.type, groupLabel), i);
        // a signed (expiring) thumbnail is shown as the videos web app's stable one
        const thumb = videosWebUrl ? stableImageUrl(videosWebUrl, it.hit.thumbnailUrl) : it.hit.thumbnailUrl;
        if (thumb) {
          const img = document.createElement('img');
          img.src = thumb;
          img.alt = '';
          img.width = 48;
          img.height = 48;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.className = 'search-thumb';
          li.append(img);
        } else {
          const blank = document.createElement('span');
          blank.className = 'search-thumb search-thumb-blank';
          blank.setAttribute('aria-hidden', 'true');
          li.append(blank);
        }
        const text = document.createElement('span');
        text.className = 'search-option-title';
        text.dir = 'auto';
        textWithMarks(text, it.hit.title, query);
        li.append(text);
      } else {
        const li = option(listbox, i);
        li.classList.add('search-option-all');
        const text = document.createElement('span');
        text.className = 'search-option-title';
        text.dir = 'auto';
        text.textContent = fill(labels.seeAll, { query: it.q });
        li.append(text);
      }
    });
    if (next.length) open();
    else close();
  }

  function showRecent() {
    const recents = readRecent(store);
    render(
      recents.map((text) => ({ kind: 'recent' as const, text })),
      '',
    );
    if (recents.length) announce(fill(labels.recentCount, { count: recents.length }));
  }

  function cancelPending() {
    clearTimeout(timer);
    controller?.abort();
    controller = null;
    seq++;
  }

  async function load(q: string) {
    controller?.abort();
    const mine = new AbortController();
    controller = mine;
    const n = ++seq;
    const [posts, scholars] = await Promise.all([fetchHits(suggestUrl(cmsUrl, locale, q), mine.signal), fetchScholars(scholarSuggestUrl(cmsUrl, locale, q), mine.signal)]);
    if (n !== seq || mine.signal.aborted || input.value !== q) return;
    const hits = posts === null && !scholars?.length ? null : [...(scholars ?? []), ...(posts ?? [])];
    if (hits === null) {
      // No answer: no suggestions, the form still submits to the full search.
      render([], q);
      return;
    }
    render([...hits.map((hit) => ({ kind: 'hit' as const, hit })), { kind: 'all' as const, q: q.trim() }], q);
    announce(countLabel(labels, hits.length));
  }

  function onInput() {
    cancelPending();
    const q = input.value;
    if (!normalizeSearchText(q)) {
      showRecent();
      return;
    }
    timer = setTimeout(() => void load(q), debounceMs);
  }

  function remember(text: string) {
    addRecent(store, text);
  }

  function pick(i: number) {
    const it = items[i];
    if (!it) return;
    if (it.kind === 'hit') {
      remember(input.value);
      close();
      if (isSafeHref(it.hit.href)) navigate(it.hit.href);
    } else if (it.kind === 'recent') {
      input.value = it.text;
      remember(it.text);
      close();
      submit(form);
    } else {
      remember(input.value);
      close();
      submit(form);
    }
  }

  function removeAt(i: number) {
    const it = items[i];
    if (!it || it.kind !== 'recent') return;
    removeRecent(store, it.text);
    const was = active;
    showRecent();
    if (!items.length) {
      announce(labels.recentCleared);
      return;
    }
    if (was >= 0) setActive(Math.min(was, items.length - 1));
  }

  function onKeyDown(e: KeyboardEvent) {
    const count = items.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen()) {
          if (normalizeSearchText(input.value)) void load(input.value);
          else showRecent();
          return;
        }
        if (count) setActive(active >= count - 1 ? 0 : active + 1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen() || !count) return;
        setActive(active <= 0 ? count - 1 : active - 1);
        return;
      case 'Home':
      case 'End':
        if (!isOpen() || active < 0 || !count) return;
        e.preventDefault();
        setActive(e.key === 'Home' ? 0 : count - 1);
        return;
      case 'Enter':
        if (isOpen() && active >= 0) {
          e.preventDefault();
          pick(active);
        }
        return;
      case 'Escape':
        if (isOpen()) {
          e.preventDefault();
          cancelPending();
          close();
        } else if (input.value) {
          e.preventDefault();
          input.value = '';
        }
        return;
      case 'Delete':
        if (isOpen() && active >= 0 && items[active]?.kind === 'recent') {
          e.preventDefault();
          removeAt(active);
        }
        return;
      default:
        return;
    }
  }

  function onFocus() {
    if (!normalizeSearchText(input.value) && !isOpen()) showRecent();
  }

  function onFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && form.contains(next)) return;
    cancelPending();
    close();
  }

  // Keep focus in the box while using the popup with a pointer (the clear button excepted).
  function onPointerDown(e: Event) {
    if (!(e.target as Element).closest('[data-search-clear]')) e.preventDefault();
  }

  function onClick(e: Event) {
    const el = (e.target as Element).closest<HTMLElement>('[role="option"]');
    if (!el) return;
    const i = Number(el.dataset.index);
    if ((e.target as Element).closest('[data-remove]')) removeAt(i);
    else pick(i);
  }

  function onClear() {
    clearRecent(store);
    render([], '');
    announce(labels.recentCleared);
    input.focus();
  }

  function onSubmit() {
    cancelPending();
    if (normalizeSearchText(input.value)) remember(input.value);
    close();
  }

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('focus', onFocus);
  form.addEventListener('focusout', onFocusOut);
  form.addEventListener('submit', onSubmit);
  popup.addEventListener('mousedown', onPointerDown);
  listbox.addEventListener('click', onClick);
  clearButton.addEventListener('click', onClear);
  form.dataset.enhanced = 'true';
  // Focused before this script ran (a fast tap on a slow connection): act as if focused now.
  if (document.activeElement === input) onFocus();

  return {
    destroy() {
      cancelPending();
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('focus', onFocus);
      form.removeEventListener('focusout', onFocusOut);
      form.removeEventListener('submit', onSubmit);
      popup.removeEventListener('mousedown', onPointerDown);
      listbox.removeEventListener('click', onClick);
      clearButton.removeEventListener('click', onClear);
    },
  };
}

/** Enhances every search box on the page. */
export function initSearchBoxes(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>('form[data-search]').forEach((form) => initCombobox(form));
}
