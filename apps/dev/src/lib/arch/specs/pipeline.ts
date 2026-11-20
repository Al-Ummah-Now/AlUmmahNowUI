/**
 * The video pipeline as numbered hops (styles 3 + 5): upload, the tee to Bunny and to our R2
 * originals, the transcode queue, the slot gate, the FFmpeg container, the R2 renditions, and the
 * two delivery rails. Facts: docs/SOURCES.md §2.
 */
import { stack, type ArchEdge, type ArchLayout, type ArchSpec } from '../arch.ts';
import type { diagramsEn } from '../../../i18n/diagrams.en.ts';
import { aiChecksUsd, aiRateLine } from './costs.ts';

type Copy = typeof diagramsEn.pipeline;

export function pipeline(c: Copy, cc: typeof diagramsEn.costs, locale: 'en' | 'ar'): { spec: ArchSpec; wide: ArchLayout; narrow: ArchLayout } {
  const n = c.node;
  const node = (id: keyof Copy['node'], icon: string, at: [number, number]) => ({ id, icon, name: n[id].name, role: n[id].role, at });
  const e = c.edge;
  const edges: ArchEdge[] = [
    { from: 'creator', to: 'apiVideos', flow: 'media', label: e.upload, step: 1, fromSide: 'e', toSide: 'w' },
    { from: 'apiVideos', to: 'bunny', flow: 'media', label: e.encode, step: 2, fromSide: 'n', toSide: ['w', 's'] },
    { from: 'apiVideos', to: 'originals', flow: 'media', label: e.tee, step: 3, fromSide: 'e', toSide: 'w' },
    { from: 'apiVideos', to: 'queue', flow: 'async', label: e.enqueue, step: 6, fromSide: 's', toSide: 'w' },
    { from: 'apiVideos', to: 'processor', flow: 'async', label: e.events, step: 4, fromSide: 's', toSide: 'n' },
    { from: 'processor', to: 'workersAi', flow: 'request', label: e.ai, step: 5, fromSide: 'e', toSide: 'w' },
    { from: 'queue', to: 'dlq', flow: 'async', label: e.dlq, fromSide: 's', toSide: 'n' },
    { from: 'queue', to: 'media', flow: 'async', label: e.consume, step: 7, fromSide: 'e', toSide: 'w' },
    { from: 'media', to: 'slots', flow: 'control', label: e.slot, step: 8, fromSide: 's', toSide: 'n' },
    { from: 'media', to: 'container', flow: 'media', label: e.start, step: 9, fromSide: 'e', toSide: 'w' },
    { from: 'originals', to: 'container', flow: 'media', label: e.read, step: 10, fromSide: 'e', toSide: 'n' },
    { from: 'container', to: 'renditions', flow: 'media', label: e.write, step: 11, fromSide: 'e', toSide: 'w' },
    { from: 'player', to: 'apiVideos', flow: 'request', label: e.ask, step: 12, fromSide: 's', toSide: 's' },
    { from: 'renditions', to: 'cdn', flow: 'delivery', label: e.cdnOut, fromSide: 'n', toSide: 's' },
    { from: 'bunny', to: 'bunnyCdn', flow: 'delivery', label: e.bunnyOut, fromSide: 'e', toSide: 'w' },
    { from: 'cdn', to: 'player', flow: 'delivery', label: e.r2, step: 13, fromSide: 'e', toSide: 'w' },
    { from: 'bunnyCdn', to: 'player', flow: 'delivery', label: e.bunnyHls, step: 14, fromSide: 'e', toSide: 'n' },
  ];
  const spec: ArchSpec = {
    id: 'pipeline',
    title: c.title,
    desc: c.desc,
    motion: 'steps',
    hop: 0.85,
    nodes: [
      node('creator', 'lucide/user', [0, 1]),
      node('apiVideos', 'cloudflare/workers', [1.15, 1]),
      node('bunny', 'brand/bunny-stream', [2.4, -0.32]),
      node('bunnyCdn', 'brand/bunny-cdn', [5.8, -0.32]),
      node('originals', 'cloudflare/r2', [2.4, 1]),
      node('queue', 'cloudflare/queues', [2.4, 2.15]),
      node('media', 'cloudflare/workers', [3.55, 2.15]),
      node('slots', 'cloudflare/durable-objects', [3.55, 3.2]),
      node('container', 'cloudflare/containers', [4.7, 2.15]),
      node('renditions', 'cloudflare/r2', [5.8, 2.15]),
      node('cdn', 'cloudflare/cache', [5.8, 1.05]),
      node('player', 'lucide/play', [7.05, 1.05]),
      node('processor', 'cloudflare/workers', [1.15, 4.45]),
      { ...node('workersAi', 'cloudflare/workers-ai', [2.4, 4.45]), rate: [aiRateLine(cc, locale)], meter: { lane: 'ai', usd: aiChecksUsd() } },
      node('dlq', 'cloudflare/queues', [2.4, 3.3]),
    ],
    groups: [
      { id: 'transcode', label: c.lane.transcode, members: ['media', 'slots', 'container'] },
      { id: 'cf', label: c.lane.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', tagEnd: true, members: ['apiVideos', 'originals', 'queue', 'transcode', 'renditions', 'cdn', 'processor', 'workersAi', 'dlq'] },
      { id: 'bunnyNet', label: c.lane.bunny, kind: 'platform', tagEnd: true, tagLogo: { id: 'brand/bunnynet-logo-dark', w: 66, h: 19 }, accent: '#f29b1d', members: ['bunny', 'bunnyCdn'] },
    ],
    edges,
  };
  const wide: ArchLayout = { colW: 190, rowH: 160 };
  const narrow: ArchLayout = {
    colW: 180,
    rowH: 100,
    iconSize: 36,
    at: stack([
      [['creator'], 0],
      [['apiVideos', 'originals'], 2.25],
      [['processor', 'workersAi'], 1.6],
      [['queue', 'dlq'], 1.6],
      [['media', 'slots'], 2.4],
      [['container'], 1.05],
      [['renditions', 'cdn'], 1.75],
      [['player'], 1.9],
      [['bunny', 'bunnyCdn'], 2.2],
    ]),
    edges: [
      { from: 'creator', to: 'apiVideos', flow: 'media', label: e.upload, step: 1, fromSide: 's', toSide: 'n' },
      { from: 'apiVideos', to: 'bunny', flow: 'media', label: e.encode, step: 2, fromSide: 'n', toSide: 's' },
      { from: 'apiVideos', to: 'originals', flow: 'media', label: e.tee, step: 3, fromSide: 'e', toSide: 'w' },
      { from: 'apiVideos', to: 'processor', flow: 'async', step: 4, fromSide: 's', toSide: 'n' },
      { from: 'processor', to: 'workersAi', flow: 'request', label: e.ai, step: 5, fromSide: 'e', toSide: 'w' },
      { from: 'apiVideos', to: 'queue', flow: 'async', label: e.enqueue, step: 6, fromSide: 'w', toSide: 'w' },
      { from: 'queue', to: 'dlq', flow: 'async', fromSide: 'e', toSide: 'w' },
      { from: 'queue', to: 'media', flow: 'async', label: e.consume, step: 7, fromSide: 'w', toSide: 'w' },
      { from: 'media', to: 'slots', flow: 'control', label: e.slot, step: 8, fromSide: 'e', toSide: 'w' },
      { from: 'media', to: 'container', flow: 'media', label: e.start, step: 9, fromSide: 's', toSide: 'w' },
      { from: 'originals', to: 'container', flow: 'media', label: e.read, step: 10, fromSide: 'e', toSide: 'e' },
      { from: 'container', to: 'renditions', flow: 'media', label: e.write, step: 11, fromSide: 's', toSide: 'n' },
      { from: 'player', to: 'apiVideos', flow: 'request', step: 12, fromSide: 'w', toSide: 'w' },
      { from: 'renditions', to: 'cdn', flow: 'delivery', fromSide: 'e', toSide: 'w' },
      { from: 'cdn', to: 'player', flow: 'delivery', label: e.r2, step: 13, fromSide: 's', toSide: 'e' },
      { from: 'bunnyCdn', to: 'player', flow: 'delivery', label: e.bunnyHls, step: 14, fromSide: 'n', toSide: 's' },
    ],
  };
  return { spec, wide, narrow };
}
