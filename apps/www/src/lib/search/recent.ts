/**
 * Recent searches, per viewer, in localStorage. Every access is guarded: private mode or blocked
 * storage just means no recent searches. Newest first, at most RECENT_MAX, one entry per
 * normalised text ("أحمد" and "احمد" are the same search).
 */
import { normalizeSearchText } from './normalize';

export const RECENT_KEY = 'aun_recent_searches';
export const RECENT_MAX = 10;
/** Longest search kept (the box takes 100 characters). */
const RECENT_TEXT_MAX = 100;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** window.localStorage, or null when the browser refuses it. */
export function localStore(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readRecent(store: StorageLike | null): string[] {
  if (!store) return [];
  try {
    const raw: unknown = JSON.parse(store.getItem(RECENT_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of raw) {
      if (typeof v !== 'string') continue;
      const key = normalizeSearchText(v);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(v.slice(0, RECENT_TEXT_MAX));
      if (out.length === RECENT_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

function write(store: StorageLike | null, list: string[]): string[] {
  if (!store) return list;
  try {
    if (list.length) store.setItem(RECENT_KEY, JSON.stringify(list));
    else store.removeItem(RECENT_KEY);
  } catch {
    // storage full or blocked: keep going without it
  }
  return list;
}

/** Puts `text` first (replacing an entry that normalises the same); returns the new list. */
export function addRecent(store: StorageLike | null, text: string): string[] {
  const value = text.trim().replace(/\s+/g, ' ').slice(0, RECENT_TEXT_MAX);
  const key = normalizeSearchText(value);
  if (!key) return readRecent(store);
  const rest = readRecent(store).filter((r) => normalizeSearchText(r) !== key);
  return write(store, [value, ...rest].slice(0, RECENT_MAX));
}

export function removeRecent(store: StorageLike | null, text: string): string[] {
  const key = normalizeSearchText(text);
  return write(store, readRecent(store).filter((r) => normalizeSearchText(r) !== key));
}

export function clearRecent(store: StorageLike | null): string[] {
  return write(store, []);
}
