/**
 * Fills the home page's Continue watching row (src/components/ContinueWatching.astro) for a signed-in
 * browser: GET /auth/continue-watching (same origin, the session cookie), then one card per video
 * (thumbnail, a progress bar, duration, title, channel). Signed out, nothing to continue, or any
 * failure: the row stays hidden. Built with DOM APIs only (no innerHTML).
 */
import type { ContinueItem } from '../lib/continue-watching';
import { clockDuration } from '../lib/videos';

interface Labels { watched: string }

const fill = (template: string, vars: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

export function renderCard(item: ContinueItem, labels: Labels, doc: Document = document): HTMLLIElement {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };
  const li = el('li', 'cw-item');
  const a = el('a', 'cw-link');
  a.href = item.href;
  const thumb = el('span', 'cw-thumb');
  if (item.thumbnailUrl) {
    const img = el('img');
    img.src = item.thumbnailUrl;
    img.alt = '';
    img.width = 320;
    img.height = 180;
    img.loading = 'lazy';
    img.decoding = 'async';
    thumb.append(img);
  }
  const time = clockDuration(item.durationSeconds);
  if (time) {
    const badge = el('span', 'cw-badge');
    badge.dir = 'ltr';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = time;
    thumb.append(badge);
  }
  const bar = el('span', 'cw-progress');
  bar.setAttribute('aria-hidden', 'true');
  const done = el('span');
  done.style.inlineSize = `${item.percent}%`;
  bar.append(done);
  thumb.append(bar);
  const title = el('span', 'cw-title');
  title.dir = 'auto';
  title.textContent = item.title;
  const progress = el('span', 'visually-hidden');
  progress.textContent = fill(labels.watched, { percent: item.percent });
  a.append(thumb, title, progress);
  li.append(a);
  if (item.channelName) {
    const ch = el('p', 'cw-channel');
    ch.dir = 'auto';
    ch.textContent = item.channelName;
    li.append(ch);
  }
  return li;
}

const isItem = (v: unknown): v is ContinueItem =>
  typeof v === 'object' && v !== null && typeof (v as ContinueItem).href === 'string' && /^https:\/\//.test((v as ContinueItem).href) && typeof (v as ContinueItem).title === 'string';

export async function initContinueWatching(root: ParentNode = document, fetchImpl: typeof fetch = fetch): Promise<void> {
  const section = root.querySelector<HTMLElement>('[data-continue]');
  const list = section?.querySelector<HTMLElement>('[data-continue-list]');
  if (!section || !list) return;
  // The head script's signed-in hint (src/lib/theme-mode.ts): signed-out visitors make no request
  if (!document.documentElement.hasAttribute('data-signed-in')) return;
  let labels: Labels;
  try {
    labels = JSON.parse(section.dataset.labels ?? '{}') as Labels;
  } catch {
    return;
  }
  try {
    const res = await fetchImpl(`/auth/continue-watching?locale=${section.dataset.locale === 'ar' ? 'ar' : 'en'}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) return;
    const body = (await res.json()) as { items?: unknown };
    const items = Array.isArray(body.items) ? body.items.filter(isItem) : [];
    if (!items.length) return;
    list.replaceChildren(...items.map((it) => renderCard(it, labels)));
    section.hidden = false;
  } catch {
    // an optional row: no error on the page
  }
}
