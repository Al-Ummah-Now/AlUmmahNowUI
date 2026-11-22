/** Release & quality page diagrams (docs/SOURCES.md §12). */
import { stack, type ArchNode } from '../arch.ts';
import type { SketchSpec } from '../sketch.ts';
import type { Builder } from './types.ts';

const node = (id: string, icon: string, c: { name: string; role: string }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

const train: Builder = (d) => {
  const c = d.pages.release.train;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'release-train',
      title: c.title,
      desc: c.desc,
      motion: 'steps',
      hop: 1.2,
      nodes: [
        node('tag', 'lucide/git-branch', n.tag, [0, 0]),
        node('build', 'simple-icons/githubactions', n.build, [1.2, 0]),
        node('stage', 'cloudflare/workers', n.stage, [2.4, 0]),
        node('localE2E', 'lucide/laptop', n.localE2E, [0, 1.4]),
        node('secrets', 'cloudflare/secrets-store', n.secrets, [1.2, 1.4]),
        node('stageE2E', 'lucide/list-ordered', n.stageE2E, [2.4, 1.4]),
        node('zero', 'cloudflare/workers', n.zero, [0, 2.85]),
        node('full', 'cloudflare/workers', n.full, [1.2, 2.85]),
        node('media', 'cloudflare/containers', n.media, [2.4, 2.85]),
        node('rollback', 'lucide/shield-check', n.rollback, [1.8, 4.05]),
      ],
      groups: [
        { id: 'gates', label: c.group.gates, members: ['localE2E', 'secrets', 'stageE2E'] },
        { id: 'prod', label: c.group.prod, members: ['zero', 'full', 'media', 'rollback'] },
      ],
      // the train runs left to right in three bands: build and stage, the gates, production
      edges: [
        { from: 'tag', to: 'build', flow: 'request', label: e.build, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'tag', to: 'localE2E', flow: 'request', label: e.local, step: 1, fromSide: 'w', toSide: 'w' },
        { from: 'build', to: 'stage', flow: 'request', label: e.deploy, step: 2, fromSide: 'e', toSide: 'w' },
        { from: 'stage', to: 'stageE2E', flow: 'request', label: e.test, step: 3, fromSide: 's', toSide: 'n' },
        { from: 'stage', to: 'secrets', flow: 'request', label: e.check, step: 3, fromSide: 's', toSide: 'n' },
        // straight down from the gates into the candidate: down the start margin it would continue the local tests'
        // wire on the same line and read as one
        { from: 'gates', to: 'zero', flow: 'request', label: e.pass, step: 4, fromSide: 's', toSide: 'n' },
        { from: 'zero', to: 'full', flow: 'request', label: e.promote, step: 5, fromSide: 'e', toSide: 'w' },
        { from: 'full', to: 'media', flow: 'media', label: e.media, step: 6, fromSide: 'e', toSide: 'w' },
        { from: 'full', to: 'rollback', flow: 'control', label: e.fail, step: 7, fromSide: 's', toSide: 'w' },
        { from: 'media', to: 'rollback', flow: 'control', fromSide: 's', toSide: 'e' },
      ],
    },
    wide: { colW: 240, rowH: 160, pad: 56, iconSize: 46, nameSize: 14.5, roleSize: 12.5 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      // the local tests wire down the start margin alone; the stage tests wire drops into its tile from above, past
      // the gates' title, which stands at the far end
      pad: 48,
      titleEnd: ['gates'],
      at: stack([
        [['tag', 'build'], 0],
        [['stage'], 1.25],
        [['stageE2E', 'secrets'], 1.95],
        [['localE2E'], 1.05],
        [['zero', 'full'], 2.05],
        [['media', 'rollback'], 1.9],
      ]),
      edges: [
        { from: 'tag', to: 'build', flow: 'request', label: e.build, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'build', to: 'stage', flow: 'request', label: e.deploy, step: 2, fromSide: 's', toSide: 'e' },
        { from: 'tag', to: 'localE2E', flow: 'request', label: e.local, step: 1, fromSide: 'w', toSide: 'w' },
        { from: 'stage', to: 'stageE2E', flow: 'request', label: e.test, step: 3, fromSide: 'w', toSide: 'n' },
        { from: 'stage', to: 'secrets', flow: 'request', label: e.check, step: 3, fromSide: 'e', toSide: 'e' },
        { from: 'gates', to: 'zero', flow: 'request', label: e.pass, step: 4, fromSide: 's', toSide: 'n' },
        { from: 'zero', to: 'full', flow: 'request', label: e.promote, step: 5, fromSide: 'e', toSide: 'w' },
        { from: 'full', to: 'media', flow: 'media', label: e.media, step: 6, fromSide: 's', toSide: 'n' },
        { from: 'full', to: 'rollback', flow: 'control', label: e.fail, step: 7, fromSide: 's', toSide: 'n' },
        { from: 'media', to: 'rollback', flow: 'control', fromSide: 'e', toSide: 'w' },
      ],
    },
  };
};

const who: Builder = (d) => {
  const c = d.pages.release.who;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'release-who',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('mono', 'lucide/git-branch', n.mono, [0, 0]),
        node('auth', 'lucide/git-branch', n.auth, [1, 0]),
        node('ui', 'lucide/git-branch', n.ui, [2, 0]),
        node('dev', 'simple-icons/astro', n.dev, [3, 0]),
        node('cms', 'lucide/git-branch', n.cms, [4, 0]),
        node('actions', 'simple-icons/githubactions', n.actions, [2, 1.4]),
        node('qa', 'cloudflare/workers', n.qa, [0.5, 3]),
        node('stage', 'cloudflare/workers', n.stage, [2, 3]),
        node('prod', 'cloudflare/workers', n.prod, [3.2, 3]),
        node('status', 'lucide/activity', n.status, [4.4, 3]),
      ],
      groups: [
        { id: 'github', label: c.group.github, kind: 'platform', tag: 'simple-icons/github', members: ['mono', 'auth', 'ui', 'dev', 'cms', 'actions'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', members: ['qa', 'stage', 'prod', 'status'] },
      ],
      // the five release triggers fan in along the top of GitHub Actions (the engine spreads the ports); the outer repo
      // on each side routes first and takes the run nearer Actions, so the inner one's run passes above it, not across
      edges: [
        ...(['mono', 'auth', 'ui', 'cms', 'dev'] as const).map((from) => ({ from, to: 'actions', flow: 'request' as const, fromSide: 's' as const, toSide: 'n' as const })),
        { from: 'actions', to: 'cf', flow: 'control', label: e.release, fromSide: 's', toSide: 'n' },
        { from: 'stage', to: 'prod', flow: 'control', label: e.promote, fromSide: 'e', toSide: 'w' },
        { from: 'status', to: 'prod', flow: 'request', label: e.checks, fromSide: 'w', toSide: 'e' },
      ],
    },
    wide: { colW: 200, rowH: 130, pad: 40 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 64,
      at: stack([
        [['mono', 'auth'], 0],
        [['actions'], 1.9],
        [['ui', 'dev'], 1.9],
        [['cms'], 1.05],
        [['qa', 'status'], 2.2],
        [['stage', 'prod'], 1.25],
      ]),
      edges: [
        // the triggers drop down the channels between the tiles and fan in along the top of Actions
        { from: 'mono', to: 'actions', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'auth', to: 'actions', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'ui', to: 'actions', flow: 'request', fromSide: 'n', toSide: 's' },
        { from: 'dev', to: 'actions', flow: 'request', fromSide: 'n', toSide: 's' },
        { from: 'cms', to: 'actions', flow: 'request', fromSide: 'n', toSide: 's' },
        { from: 'actions', to: 'cf', flow: 'control', label: e.release, fromSide: ['w', 'e'], toSide: ['w', 'e'] },
        { from: 'stage', to: 'prod', flow: 'control', label: e.promote, fromSide: 'e', toSide: 'w' },
        { from: 'status', to: 'prod', flow: 'request', label: e.checks, fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

const gates: Builder = (d) => {
  const c = d.pages.release.gates;
  const n = c.node;
  const sk = (id: keyof typeof n, icon: string, tone: SketchSpec['nodes'][number]['tone'], at: [number, number]) => ({ id, icon, title: n[id].title, note: n[id].note, tone, at });
  const spec: SketchSpec = {
    id: 'release-gates',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      sk('pr', 'lucide/git-branch', 'yellow', [0, 0]),
      sk('qa', 'cloudflare/workers', 'yellow', [1, 0]),
      sk('tag', 'simple-icons/githubactions', 'yellow', [2, 0]),
      sk('stageE2E', 'lucide/list-ordered', 'blue', [0, 1]),
      sk('local', 'lucide/laptop', 'blue', [1, 1]),
      sk('secrets', 'cloudflare/secrets-store', 'blue', [2, 1]),
      // production runs as one row under the tests, start to end: the three tests fan into the rollout, and no row
      // below is left half empty
      sk('smoke', 'cloudflare/workers', 'green', [0, 2]),
      sk('signedIn', 'lucide/user', 'green', [1, 2]),
      sk('media', 'cloudflare/containers', 'green', [2, 2]),
    ],
    foot: [
      { id: 'status', icon: 'lucide/activity', title: c.obs.status },
      { id: 'dry', icon: 'lucide/timer', title: c.obs.dry },
      // under the media smoke: its failure wire drops straight down
      { id: 'rollback', icon: 'lucide/shield-check', title: c.obs.rollback },
    ],
    edges: [
      { from: 'pr', to: 'qa', fromSide: 'e', toSide: 'w' },
      { from: 'qa', to: 'tag', fromSide: 'e', toSide: 'w' },
      { from: 'tag', to: 'stageE2E', fromSide: 's', toSide: 'n', bend: 40 },
      { from: 'tag', to: 'local', fromSide: 's', toSide: 'n', bend: -24 },
      { from: 'tag', to: 'secrets', fromSide: 's', toSide: 'n' },
      { from: 'stageE2E', to: 'smoke', fromSide: 's', toSide: 'n', tag: c.tag.all, tone: 'green', tagAt: 0.5 },
      { from: 'local', to: 'smoke', fromSide: 's', toSide: 'n', bend: 6 },
      { from: 'secrets', to: 'smoke', fromSide: 's', toSide: 'n', bend: 36 },
      { from: 'smoke', to: 'signedIn', fromSide: 'e', toSide: 'w' },
      { from: 'signedIn', to: 'media', fromSide: 'e', toSide: 'w' },
      { from: 'media', to: 'rollback', fromSide: 's', toSide: 'n', dashed: true, tag: c.tag.fail, tone: 'pink', tagAt: 0.5 },
    ],
  };
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 360, rowH: 225, nodeW: 250, cols: 3, footGap: 40 },
    narrow: {
      colW: 300,
      rowH: 160,
      nodeW: 260,
      cols: 1,
      footGap: 50,
      at: { pr: [0, 0], qa: [0, 1], tag: [0, 2], stageE2E: [0, 3], local: [0, 4], secrets: [0, 5], smoke: [0, 6], signedIn: [0, 7], media: [0, 8] },
      edges: [
        { from: 'pr', to: 'qa', fromSide: 's', toSide: 'n' },
        { from: 'qa', to: 'tag', fromSide: 's', toSide: 'n' },
        { from: 'tag', to: 'stageE2E', fromSide: 's', toSide: 'n' },
        // side wires nest down their own lanes (sketch `lane`), the longer one outside
        { from: 'tag', to: 'local', fromSide: 'w', toSide: 'w', lane: 18 },
        { from: 'tag', to: 'secrets', fromSide: 'w', toSide: 'w', lane: 32 },
        { from: 'stageE2E', to: 'smoke', fromSide: 'e', toSide: 'e', lane: 32 },
        { from: 'local', to: 'smoke', fromSide: 'e', toSide: 'e', lane: 18 },
        { from: 'secrets', to: 'smoke', fromSide: 's', toSide: 'n' },
        { from: 'smoke', to: 'signedIn', fromSide: 's', toSide: 'n' },
        { from: 'signedIn', to: 'media', fromSide: 's', toSide: 'n' },
        { from: 'media', to: 'rollback', fromSide: 's', toSide: 'n', dashed: true },
      ],
    },
  };
};

export const builders: Record<string, Builder> = { 'release-train': train, 'release-who': who, 'release-gates': gates };
