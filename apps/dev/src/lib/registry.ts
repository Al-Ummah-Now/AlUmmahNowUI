/**
 * Feature statuses, only from the wiki's feature registry (scripts/registry.ts writes
 * src/data/registry.json before every build). An unknown id fails the build: the site never shows
 * a status the registry doesn't hold.
 */
import data from '../data/registry.json';
import type { Feature, FeatureStatus, PinnedRegistry } from '../../scripts/registry.ts';

export type { Feature, FeatureStatus };
export const REGISTRY = data as PinnedRegistry;
export const FEATURES: Feature[] = REGISTRY.features;

export function feature(id: string): Feature {
  const f = FEATURES.find((x) => x.id === id);
  if (!f) throw new Error(`Feature "${id}" is not in the wiki's feature registry (${REGISTRY.source.sha.slice(0, 7)})`);
  return f;
}

/** Where a live feature shipped, for display: a release tag, "Auth <commit>" (Auth has no tags) or "before <first tag>". */
export function releaseLabel(f: Feature, before: string): string | null {
  const r = f.release;
  if (!r) return null;
  if ('tag' in r) return r.tag;
  if ('run' in r) return `Auth ${r.sha.slice(0, 7)}`;
  return before.replace('{tag}', r.before);
}

export function releaseHref(f: Feature): string | null {
  const r = f.release;
  if (!r) return null;
  const repo = `https://github.com/Al-Ummah-Now/${r.repo}`;
  if ('tag' in r) return `${repo}/releases/tag/${r.tag}`;
  if ('run' in r) return `${repo}/actions/runs/${r.run}`;
  return null;
}

export const registrySourceHref = () =>
  REGISTRY.source.sha === 'local'
    ? `https://github.com/${REGISTRY.source.repo}/blob/main/${REGISTRY.source.path}`
    : `https://github.com/${REGISTRY.source.repo}/blob/${REGISTRY.source.sha}/${REGISTRY.source.path}`;

/**
 * Splits items that name a registry feature into those in use in production (`live`) and those shipped
 * but not in use yet (`ready`), so a page never says "live today" for a ready feature. Any other status
 * fails the build: such an item has no place in a list of what runs in production.
 */
export function byUse<T extends { feature: string }>(items: readonly T[]): { live: T[]; ready: T[] } {
  const live: T[] = [];
  const ready: T[] = [];
  for (const item of items) {
    const { status } = feature(item.feature);
    if (status === 'live') live.push(item);
    else if (status === 'ready') ready.push(item);
    else throw new Error(`"${item.feature}" is ${status} in the feature registry (${REGISTRY.source.sha.slice(0, 7)}), so it cannot be listed as running in production`);
  }
  return { live, ready };
}
