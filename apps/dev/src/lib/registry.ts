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
