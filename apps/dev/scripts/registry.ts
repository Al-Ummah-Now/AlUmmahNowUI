/**
 * The wiki's feature registry (AlUmmahNowWiki features/registry.json, features/README.md) is the only
 * place this site's feature statuses come from. Before every build this fetches it from the wiki at
 * one commit and writes src/data/registry.json and public/feature-registry.json (both git-ignored)
 * with that commit, so a build is reproducible and the site names the commit it shows.
 *
 *   node --experimental-strip-types scripts/registry.ts
 *
 * REGISTRY_REF   a branch or a 40-hex commit of the wiki (default main)
 * REGISTRY_FILE  a local registry.json instead (a wiki checkout, offline work); recorded as "local"
 *
 * The wiki's CI (scripts/check-registry.mjs) is the full rule set; validateRegistry below checks what
 * this site relies on, and the build fails rather than show a status the registry doesn't hold.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

export const WIKI_REPO = 'Al-Ummah-Now/AlUmmahNowWiki';
export const REGISTRY_PATH = 'features/registry.json';
export const STATUSES = ['live', 'rolling', 'building', 'planned'] as const;
export type FeatureStatus = (typeof STATUSES)[number];

export type Release = { repo: string; tag: string } | { repo: string; run: number; sha: string } | { repo: string; before: string };
export interface Feature {
  id: string;
  name: { en: string; ar: string };
  status: FeatureStatus;
  apps: string[];
  wiki: string;
  release?: Release;
  prs?: string[];
  note?: string;
}
export interface Registry {
  version: 1;
  features: Feature[];
}
export interface PinnedRegistry extends Registry {
  /** The wiki commit it was read from, or "local". */
  source: { repo: string; path: string; sha: string };
}

const TAG = /^v\d{4}\.\d{2}\.\d{2}(\.\d+)?$/;

export function validateRegistry(reg: unknown): string[] {
  const r = reg as Registry;
  if (!r || r.version !== 1 || !Array.isArray(r.features)) return ['registry: needs { "version": 1, "features": [...] }'];
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const [i, f] of r.features.entries()) {
    const at = `features[${i}]${f?.id ? ` (${f.id})` : ''}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f?.id ?? '')) errs.push(`${at}: id`);
    else if (ids.has(f.id)) errs.push(`${at}: duplicate id`);
    else ids.add(f.id);
    if (!f?.name?.en?.trim() || !f?.name?.ar?.trim()) errs.push(`${at}: name.en and name.ar`);
    if (!STATUSES.includes(f?.status)) errs.push(`${at}: status`);
    if (!Array.isArray(f?.apps) || !f.apps.length) errs.push(`${at}: apps`);
    if (typeof f?.wiki !== 'string' || !/^(epics|guides|repos)\/[\w./#-]+$/.test(f.wiki)) errs.push(`${at}: wiki`);
    const rel = f?.release as Record<string, unknown> | undefined;
    if (f?.status === 'live') {
      const ok = rel && typeof rel.repo === 'string' && ((typeof rel.tag === 'string' && TAG.test(rel.tag)) || (Number.isInteger(rel.run) && typeof rel.sha === 'string') || (typeof rel.before === 'string' && TAG.test(rel.before)));
      if (!ok) errs.push(`${at}: live needs its release`);
    } else if (rel) errs.push(`${at}: only live features have a release`);
  }
  return errs;
}

/** The wiki commit a ref points at (a commit passes through). */
export function resolveRef(ref: string): string {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref;
  const out = execFileSync('git', ['ls-remote', `https://github.com/${WIKI_REPO}.git`, `refs/heads/${ref}`], { encoding: 'utf8' });
  const sha = out.split(/\s/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error(`wiki branch ${ref} not found`);
  return sha;
}

export async function fetchRegistry(env: NodeJS.ProcessEnv = process.env): Promise<PinnedRegistry> {
  let text: string;
  let sha: string;
  if (env.REGISTRY_FILE) {
    text = readFileSync(env.REGISTRY_FILE, 'utf8');
    sha = 'local';
  } else {
    sha = resolveRef(env.REGISTRY_REF || 'main');
    const url = `https://raw.githubusercontent.com/${WIKI_REPO}/${sha}/${REGISTRY_PATH}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    text = await res.text();
  }
  const reg = JSON.parse(text) as Registry;
  const errs = validateRegistry(reg);
  if (errs.length) throw new Error(`feature registry at ${sha}:\n  ${errs.join('\n  ')}`);
  return { version: 1, features: reg.features, source: { repo: WIKI_REPO, path: REGISTRY_PATH, sha } };
}

if (argv[1] && resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const pinned = await fetchRegistry();
    const here = dirname(fileURLToPath(import.meta.url));
    // src/data for the pages; public/ so anyone (and dev-registry.yml) can see which commit a site shows
    for (const out of [resolve(here, '../src/data/registry.json'), resolve(here, '../public/feature-registry.json')]) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify(pinned, null, 2)}\n`);
    }
    console.log(`feature registry: ${pinned.features.length} features from ${pinned.source.repo}@${pinned.source.sha.slice(0, 7)}`);
  } catch (e) {
    console.error(`::error::${(e as Error).message}`);
    process.exit(1);
  }
}
