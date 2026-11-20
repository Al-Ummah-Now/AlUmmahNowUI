/**
 * The reference architecture (style sample 5): clients left, the Cloudflare account boundary with
 * front end / APIs / background services, data on the right, operations along the bottom, bunny.net
 * and the providers outside. Facts: docs/SOURCES.md §1.
 */
import { stack, type ArchEdge, type ArchLayout, type ArchSpec } from '../arch.ts';
import type { diagramsEn } from '../../../i18n/diagrams.en.ts';
import { aiChecksUsd, aiRateLine } from './costs.ts';

type Copy = typeof diagramsEn.overview;

export function overview(c: Copy, cc: typeof diagramsEn.costs, locale: 'en' | 'ar'): { spec: ArchSpec; wide: ArchLayout; narrow: ArchLayout } {
  const n = c.node;
  const node = (id: keyof Copy['node'], icon: string, at: [number, number]) => ({ id, icon, name: n[id].name, role: n[id].role, at });
  const spec: ArchSpec = {
    id: 'overview',
    title: c.title,
    desc: c.desc,
    motion: 'pulses',
    nodes: [
      node('browsers', 'lucide/browser', [0, 0]),
      node('apps', 'lucide/smartphone', [0, 1]),
      node('cdn', 'cloudflare/cache', [1.15, 0]),
      node('turnstile', 'cloudflare/turnstile', [1.15, 1]),
      node('www', 'simple-icons/astro', [2.3, 0]),
      node('videos', 'simple-icons/nextjs', [3.3, 0]),
      node('adminWeb', 'simple-icons/nextjs', [4.3, 0]),
      node('cms', 'cloudflare/workers', [5.3, 0]),
      node('apiVideos', 'cloudflare/workers', [2.3, 1]),
      node('adminApi', 'cloudflare/workers', [3.3, 1]),
      node('auth', 'cloudflare/workers', [4.3, 1]),
      node('realtime', 'cloudflare/durable-objects', [5.3, 1]),
      node('processor', 'cloudflare/workers', [2.3, 2]),
      node('scheduler', 'cloudflare/workers', [3.3, 2]),
      node('costMonitor', 'cloudflare/workers', [4.3, 2]),
      node('media', 'cloudflare/workers', [2.3, 3]),
      node('container', 'cloudflare/containers', [3.3, 3]),
      node('slots', 'cloudflare/durable-objects', [4.3, 3]),
      { ...node('workersAi', 'cloudflare/workers-ai', [5.85, 2.5]), rate: [aiRateLine(cc, locale)], meter: { lane: 'ai', usd: aiChecksUsd() } },
      node('r2', 'cloudflare/r2', [7.15, 0]),
      node('d1', 'cloudflare/d1', [7.15, 1]),
      node('kv', 'cloudflare/kv', [7.15, 2]),
      node('queues', 'cloudflare/queues', [7.15, 3]),
      node('logs', 'cloudflare/logs', [2.3, 4.15]),
      node('analytics', 'cloudflare/analytics', [3.3, 4.15]),
      node('secrets', 'cloudflare/secrets-store', [4.3, 4.15]),
      node('status', 'cloudflare/workers', [5.3, 4.15]),
      node('bunnyCdn', 'brand/bunny-cdn', [0, 2.35]),
      node('bunnyStream', 'brand/bunny-stream', [0, 3.35]),
      node('ci', 'simple-icons/githubactions', [0, 4.5]),
      node('qf', 'lucide/book-open', [8.45, 0.5]),
      node('resend', 'simple-icons/resend', [8.45, 1.5]),
      node('push', 'lucide/bell', [8.45, 2.5]),
      node('google', 'simple-icons/google', [8.45, 3.5]),
    ],
    groups: [
      { id: 'clients', label: c.group.clients, members: ['browsers', 'apps'] },
      { id: 'edge', label: c.group.edge, members: ['cdn', 'turnstile'] },
      { id: 'front', label: c.group.front, caption: c.caption.front, members: ['www', 'videos', 'adminWeb', 'cms'] },
      { id: 'apis', label: c.group.apis, caption: c.caption.apis, members: ['apiVideos', 'adminApi', 'auth', 'realtime'] },
      { id: 'async', label: c.group.async, caption: c.caption.async, members: ['processor', 'scheduler', 'costMonitor', 'media', 'container', 'slots'] },
      { id: 'ai', label: c.group.ai, members: ['workersAi'] },
      { id: 'data', label: c.group.data, members: ['r2', 'd1', 'kv', 'queues'] },
      { id: 'ops', label: c.group.ops, members: ['logs', 'analytics', 'secrets', 'status'] },
      { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', members: ['edge', 'front', 'apis', 'async', 'ai', 'data', 'ops'] },
      { id: 'bunny', label: c.group.bunny, kind: 'platform', tagEnd: true, tagLogo: { id: 'brand/bunnynet-logo-dark', w: 66, h: 19 }, accent: '#f29b1d', members: ['bunnyCdn', 'bunnyStream'] },
      { id: 'providers', label: c.group.providers, members: ['qf', 'resend', 'push', 'google'] },
      { id: 'cicd', label: c.group.cicd, members: ['ci'] },
    ],
    edges: [],
  };
  const e = c.edge;
  spec.edges = [
    { from: 'browsers', to: 'cdn', flow: 'request', label: e.https, fromSide: 'e', toSide: 'w' },
    { from: 'apps', to: 'cdn', flow: 'request', fromSide: 'e', toSide: 'w' },
    { from: 'cdn', to: 'front', flow: 'request', label: e.routes, fromSide: 'e', toSide: 'w' },
    { from: 'front', to: 'apis', flow: 'request', label: e.bindings, fromSide: 's', toSide: 'n' },
    { from: 'apis', to: 'data', flow: 'request', label: e.data, fromSide: 'e', toSide: 'w' },
    { from: 'apiVideos', to: 'bunny', flow: 'media', label: e.upload, fromSide: 'w', toSide: 'e' },
    { from: 'bunnyCdn', to: 'clients', flow: 'delivery', label: e.signedHls, fromSide: 'n', toSide: 's' },
    { from: 'r2', to: 'cdn', flow: 'delivery', label: e.publicHls, fromSide: 'n', toSide: 'n' },
    { from: 'queues', to: 'async', flow: 'async', label: e.consume, fromSide: 'w', toSide: 'e' },
    { from: 'async', to: 'ai', flow: 'request', label: e.ai, fromSide: 'e', toSide: 'w' },
    { from: 'media', to: 'container', flow: 'media', fromSide: 'e', toSide: 'w' },
    { from: 'media', to: 'slots', flow: 'control', label: e.slot, fromSide: 'n', toSide: 'n' },
    { from: 'cf', to: 'providers', flow: 'request', label: e.providers, fromSide: 'e', toSide: 'w' },
    { from: 'ci', to: 'cf', flow: 'control', label: e.deploy, fromSide: 'e', toSide: 'w' },
    { from: 'async', to: 'ops', flow: 'control', label: e.logs, fromSide: 's', toSide: 'n' },
  ] satisfies ArchEdge[];

  // Arabic group titles take a taller line: more room between stacked groups, so the wire between them reads
  const wide: ArchLayout = { colW: 168, rowH: locale === 'ar' ? 200 : 186 };

  // phone: two columns, the same groups stacked in reading order
  const at = stack([
    [['browsers', 'apps'], 0],
    [['cdn', 'turnstile'], 2.05],
    [['www', 'videos'], 1.8],
    [['adminWeb', 'cms'], 1.05],
    [['apiVideos', 'adminApi'], 1.95],
    [['auth', 'realtime'], 1.05],
    [['processor', 'scheduler'], 1.95],
    [['costMonitor', 'media'], 1.05],
    [['container', 'slots'], 1.05],
    [['workersAi'], 2.5],
    [['r2', 'd1'], 2.4],
    [['kv', 'queues'], 1.05],
    [['logs', 'analytics'], 1.8],
    [['secrets', 'status'], 1.05],
    [['bunnyCdn', 'bunnyStream'], 2.3],
    [['qf', 'resend'], 2.05],
    [['push', 'google'], 1.05],
    [['ci'], 1.8],
  ]);
  const narrow: ArchLayout = {
    colW: 172,
    rowH: 100,
    at,
    iconSize: 36,
    nameSize: 13,
    roleSize: 11.5,
    edges: [
      { from: 'clients', to: 'edge', flow: 'request', label: e.https, fromSide: 's', toSide: 'n' },
      { from: 'edge', to: 'front', flow: 'request', label: e.routes, fromSide: 's', toSide: 'n' },
      { from: 'front', to: 'apis', flow: 'request', label: e.bindings, fromSide: 's', toSide: 'n' },
      { from: 'apis', to: 'async', flow: 'async', label: e.consume, fromSide: 's', toSide: 'n' },
      { from: 'async', to: 'ai', flow: 'request', label: e.ai, fromSide: 's', toSide: 'n' },
      { from: 'ai', to: 'data', flow: 'request', label: e.data, fromSide: 's', toSide: 'n' },
      { from: 'data', to: 'ops', flow: 'control', label: e.logs, fromSide: 's', toSide: 'n' },
      { from: 'cf', to: 'bunny', flow: 'media', label: e.upload, fromSide: 's', toSide: 'n' },
      { from: 'cf', to: 'providers', flow: 'request', label: e.providers, fromSide: ['e', 'w'], toSide: ['e', 'w'] },
      { from: 'ci', to: 'cf', flow: 'control', label: e.deploy, fromSide: ['e', 'w'], toSide: ['e', 'w'] },
    ],
  };
  return { spec, wide, narrow };
}
