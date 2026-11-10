/**
 * Home timeline behaviour (src/components/Timeline.astro). Without it the page is complete: the
 * days are labelled in UTC and "Load more" is a link to the next page.
 *  - Load more: fetches the link's page (the same, edge-cached HTML), appends its items, moves the
 *    link on, announces how many were added (aria-live) and moves focus to the first new item.
 *  - Days: re-grouped and re-labelled in the reader's time zone (Today / Yesterday / weekday /
 *    date); a day that continues from the previous page keeps a single heading.
 *  - Times: relative ("3 hours ago") and absolute in the reader's zone, kept current.
 */
import { dayKey, dayLabel, relativeTime } from '../lib/feed';
import type { Locale } from '../lib/locale';
import { absoluteTime } from '../lib/timeline';
import { initCards } from './cards';
import { initFacades } from './facade';

const zone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

function regroup(root: HTMLElement, locale: Locale) {
  const days = root.querySelector<HTMLElement>('[data-days]');
  if (!days) return;
  const words = { today: root.dataset.tToday ?? 'Today', yesterday: root.dataset.tYesterday ?? 'Yesterday' };
  const items = [...days.querySelectorAll<HTMLLIElement>('li.tl-item')];
  const now = new Date();
  const sections: HTMLElement[] = [];
  let current: { day: string; list: HTMLOListElement } | null = null;
  for (const li of items) {
    const date = li.dataset.date ?? '';
    const day = dayKey(date, zone);
    if (!current || current.day !== day) {
      const section = document.createElement('section');
      section.className = 'tl-day';
      section.dataset.day = day;
      const h = document.createElement('h3');
      h.className = 'tl-date';
      h.id = `tl-d-${day}`;
      h.textContent = dayLabel(day, now, locale, words, zone);
      section.setAttribute('aria-labelledby', h.id);
      const list = document.createElement('ol');
      list.className = 'tl-list';
      section.append(h, list);
      sections.push(section);
      current = { day, list };
    }
    current.list.append(li);
  }
  days.replaceChildren(...sections);
}

function refreshTimes(root: HTMLElement, locale: Locale) {
  const now = new Date();
  for (const time of root.querySelectorAll<HTMLTimeElement>('time[data-rel]')) {
    const iso = time.dateTime;
    time.textContent = relativeTime(iso, now, locale);
    const abs = absoluteTime(iso, locale, zone);
    time.title = abs;
    const absEl = time.parentElement?.querySelector<HTMLElement>('[data-abs]');
    if (absEl) absEl.textContent = abs;
  }
}

async function loadMore(root: HTMLElement, link: HTMLAnchorElement, locale: Locale) {
  const live = root.querySelector<HTMLElement>('[data-live]');
  const label = link.textContent ?? '';
  link.setAttribute('aria-disabled', 'true');
  link.classList.add('is-loading');
  link.textContent = root.dataset.tLoading ?? label;
  try {
    const res = await fetch(link.href, { headers: { Accept: 'text/html' }, credentials: 'same-origin' });
    if (!res.ok) throw new Error(String(res.status));
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const incoming = doc.querySelector<HTMLElement>('[data-timeline]');
    if (!incoming) throw new Error('no timeline');
    const fresh = [...incoming.querySelectorAll<HTMLLIElement>('[data-days] li.tl-item')];
    const days = root.querySelector<HTMLElement>('[data-days]')!;
    const have = new Set([...days.querySelectorAll<HTMLLIElement>('li.tl-item')].map((li) => li.dataset.key));
    const added = fresh.filter((li) => !have.has(li.dataset.key));
    // Into the last day list; regroup() then splits them into days.
    let tail = days.querySelector<HTMLOListElement>('.tl-day:last-child .tl-list');
    if (!tail) {
      const section = document.createElement('section');
      section.className = 'tl-day';
      tail = document.createElement('ol');
      tail.className = 'tl-list';
      section.append(tail);
      days.append(section);
    }
    const adopted = added.map((li) => document.importNode(li, true));
    tail.append(...adopted);
    regroup(root, locale);
    refreshTimes(root, locale);
    for (const li of adopted) {
      initFacades(li);
      initCards(li);
    }
    const next = incoming.querySelector<HTMLAnchorElement>('[data-more]');
    const msg = adopted.length === 1 ? (root.dataset.tAddedOne ?? '') : (root.dataset.tAdded ?? '').replace('{count}', String(adopted.length));
    if (next) {
      link.href = next.href;
      link.textContent = label;
      link.removeAttribute('aria-disabled');
      link.classList.remove('is-loading');
    } else {
      const end = document.createElement('p');
      end.className = 'tl-end';
      end.textContent = root.dataset.tEnd ?? '';
      link.replaceWith(end);
    }
    if (live) live.textContent = msg;
    // Focus the first new item's title link, so keyboard and screen reader users continue there.
    const target = adopted[0]?.querySelector<HTMLElement>('.tl-title a') ?? (next ? link : null);
    target?.focus();
  } catch {
    link.textContent = label;
    link.removeAttribute('aria-disabled');
    link.classList.remove('is-loading');
    if (live) live.textContent = root.dataset.tFailed ?? '';
    link.focus();
  }
}

export function initTimeline() {
  for (const root of document.querySelectorAll<HTMLElement>('[data-timeline]')) {
    if (root.dataset.ready) continue;
    root.dataset.ready = '1';
    const locale = (root.dataset.locale === 'ar' ? 'ar' : 'en') as Locale;
    regroup(root, locale);
    refreshTimes(root, locale);
    setInterval(() => refreshTimes(root, locale), 60_000);
    root.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-more]');
      if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (link.getAttribute('aria-disabled') === 'true') return;
      void loadMore(root, link, locale);
    });
  }
}
