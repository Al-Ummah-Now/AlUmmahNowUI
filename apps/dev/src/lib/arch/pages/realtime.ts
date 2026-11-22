/** Realtime page diagrams (docs/SOURCES.md §6). */
import { stack, type ArchNode } from '../arch.ts';
import type { SketchEdge } from '../sketch.ts';
import type { Builder } from './types.ts';

const node = (id: string, icon: string, c: { name: string; role: string }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });
const DO = 'cloudflare/durable-objects';

const map: Builder = (d) => {
  const c = d.pages.realtime.map;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'realtime-map',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('clients', 'lucide/users', n.clients, [0, 1]),
        node('limits', 'lucide/gauge', n.limits, [1.35, 0]),
        node('worker', 'cloudflare/workers', n.worker, [1.35, 1]),
        node('dir', DO, n.dir, [2.75, 0.2]),
        node('coalescer', DO, n.coalescer, [2.75, 1.6]),
        node('s0', DO, n.s0, [4.15, 0]),
        node('s1', DO, n.s1, [4.15, 1]),
        node('sn', DO, n.sn, [4.15, 2]),
        node('apiVideos', 'cloudflare/workers', n.apiVideos, [1.35, 3.1]),
        node('processor', 'cloudflare/workers', n.processor, [1.35, 4.1]),
        node('views', DO, n.views, [4.15, 3.1]),
        node('record', 'cloudflare/r2', n.record, [5.55, 3.1]),
      ],
      groups: [
        { id: 'shards', label: c.group.shards, caption: c.caption.shards, members: ['s0', 's1', 'sn'] },
        { id: 'do', label: c.group.do, members: ['dir', 'coalescer', 'shards', 'views'] },
        { id: 'producers', label: c.group.producers, caption: c.caption.producers, members: ['apiVideos', 'processor'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', pad: 48, members: ['limits', 'worker', 'do', 'producers', 'record'] },
      ],
      edges: [
        { from: 'clients', to: 'worker', flow: 'request', label: e.socket, fromSide: 'e', toSide: 'w' },
        { from: 'worker', to: 'limits', flow: 'control', label: e.limit, fromSide: 'n', toSide: 's' },
        { from: 'worker', to: 'shards', flow: 'request', label: e.shard, fromSide: 'e', toSide: 'w' },
        { from: 'producers', to: 'worker', flow: 'async', label: e.post, fromSide: 'n', toSide: 's' },
        { from: 'worker', to: 'dir', flow: 'async', label: e.broadcast, fromSide: 'e', toSide: 'w' },
        { from: 'worker', to: 'coalescer', flow: 'async', label: e.admin, fromSide: 'e', toSide: 'w' },
        { from: 'coalescer', to: 'dir', flow: 'async', label: e.paced, fromSide: 'n', toSide: 's' },
        { from: 'dir', to: 'shards', flow: 'async', label: e.forward, fromSide: 'e', toSide: 'w' },
        { from: 'apiVideos', to: 'views', flow: 'request', label: e.counter, fromSide: 'e', toSide: 'w' },
        { from: 'views', to: 'record', flow: 'control', label: e.flush, fromSide: 'e', toSide: 'w' },
      ],
    },
    wide: { colW: 240, rowH: 140 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      at: stack([
        [['clients'], 0],
        [['processor', 'apiVideos'], 2.3],
        [['worker', 'limits'], 2.1],
        [['coalescer', 'dir'], 2.2],
        [['s0', 's1'], 1.9],
        [['sn'], 1.05],
        [['views'], 1.75],
        [['record'], 1.9],
      ]),
      edges: [
        { from: 'clients', to: 'worker', flow: 'request', label: e.socket, fromSide: 'w', toSide: 'w' },
        { from: 'producers', to: 'worker', flow: 'async', label: e.post, fromSide: 's', toSide: 'n' },
        { from: 'worker', to: 'limits', flow: 'control', label: e.limit, fromSide: 'e', toSide: 'w' },
        { from: 'worker', to: 'dir', flow: 'async', label: e.broadcast, fromSide: 's', toSide: 'n' },
        { from: 'worker', to: 'coalescer', flow: 'async', label: e.admin, fromSide: 'w', toSide: 'w' },
        { from: 'coalescer', to: 'dir', flow: 'async', label: e.paced, fromSide: 'e', toSide: 'w' },
        { from: 'dir', to: 'shards', flow: 'async', label: e.forward, fromSide: 's', toSide: 'n' },
        { from: 'worker', to: 'shards', flow: 'request', label: e.shard, fromSide: 'w', toSide: 'w' },
        { from: 'apiVideos', to: 'views', flow: 'request', label: e.counter, fromSide: 'e', toSide: 'e' },
        { from: 'views', to: 'record', flow: 'control', label: e.flush, fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

const views: Builder = (d) => {
  const c = d.pages.realtime.views;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'realtime-views',
      title: c.title,
      desc: c.desc,
      motion: 'steps',
      hop: 1.2,
      nodes: [
        node('player', 'lucide/play', n.player, [0, 1.5]),
        node('api', 'cloudflare/workers', n.api, [1.5, 1.5]),
        node('v0', DO, n.v0, [2.9, 1]),
        node('v1', DO, n.v1, [4.0, 1]),
        node('v2', DO, n.v2, [2.9, 2]),
        node('v3', DO, n.v3, [4.0, 2]),
        node('record', 'cloudflare/r2', n.record, [5.45, 1.5]),
      ],
      groups: [
        { id: 'shards', label: c.group.shards, caption: c.caption.shards, members: ['v0', 'v1', 'v2', 'v3'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', members: ['api', 'shards', 'record'] },
      ],
      edges: [
        { from: 'player', to: 'api', flow: 'request', label: e.view, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'shards', flow: 'request', label: e.inc, step: 2, fromSide: 'e', toSide: 'w' },
        { from: 'shards', to: 'record', flow: 'control', label: e.flush, step: 3, fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'player', flow: 'request', label: e.answer, step: 4, fromSide: 's', toSide: 's' },
      ],
    },
    wide: { colW: 250, rowH: 120, pad: 56 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      // the request and its answer run side by side into the account across its top edge: the tag sits below
      tagBottom: ['cf'],
      at: stack([
        [['player'], 0],
        [['api'], 2.4],
        [['v0', 'v1'], 2.2],
        [['v2', 'v3'], 1.05],
        [['record'], 2.2],
      ]),
      edges: [
        { from: 'player', to: 'api', flow: 'request', label: e.view, step: 1, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'shards', flow: 'request', label: e.inc, step: 2, fromSide: 's', toSide: 'n' },
        { from: 'shards', to: 'record', flow: 'control', label: e.flush, step: 3, fromSide: 's', toSide: 'n' },
        // the answer climbs straight back beside the request: the two wires side by side, each with its words outside
        { from: 'api', to: 'player', flow: 'request', label: e.answer, step: 4, fromSide: 'n', toSide: 's' },
      ],
    },
  };
};

const sketch: Builder = (d) => {
  const c = d.pages.realtime.sketch;
  const n = c.node;
  const at = (x: number, y: number) => [x, y] as [number, number];
  const spec = {
    id: 'realtime-sketch',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      { id: 'opens', icon: 'lucide/gauge', title: n.opens.title, note: n.opens.note, tone: 'pink' as const, at: at(0, 0) },
      { id: 'worker', icon: 'cloudflare/workers', title: n.worker.title, note: n.worker.note, tone: 'orange' as const, at: at(1, 0) },
      { id: 'tokens', icon: 'lucide/key-round', title: n.tokens.title, note: n.tokens.note, tone: 'yellow' as const, at: at(2, 0) },
      { id: 'msgs', icon: 'lucide/gauge', title: n.msgs.title, note: n.msgs.note, tone: 'pink' as const, at: at(0, 1) },
      { id: 'shard', icon: DO, title: n.shard.title, note: n.shard.note, tone: 'blue' as const, at: at(1, 1) },
      { id: 'attach', icon: 'lucide/box', title: n.attach.title, note: n.attach.note, tone: 'yellow' as const, at: at(2, 1) },
      { id: 'dir', icon: DO, title: n.dir.title, note: n.dir.note, tone: 'green' as const, at: at(0.5, 2) },
      { id: 'coal', icon: DO, title: n.coal.title, note: n.coal.note, tone: 'green' as const, at: at(1.5, 2) },
    ],
    edges: [
      { from: 'worker', to: 'opens', fromSide: 'w', toSide: 'e' },
      { from: 'worker', to: 'tokens', fromSide: 'e', toSide: 'w' },
      { from: 'worker', to: 'shard', fromSide: 's', toSide: 'n' },
      { from: 'shard', to: 'msgs', fromSide: 'w', toSide: 'e' },
      { from: 'shard', to: 'attach', fromSide: 'e', toSide: 'w' },
      { from: 'shard', to: 'dir', fromSide: 's', toSide: 'n', bend: -30, tag: c.tag.join, tone: 'green', tagAt: 0.45 },
      { from: 'coal', to: 'shard', fromSide: 'n', toSide: 's', bend: -30, dashed: true },
    ] as SketchEdge[],
  };
  const order = ['opens', 'tokens', 'shard', 'msgs', 'attach', 'dir', 'coal'];
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 340, rowH: 250, nodeW: 260, cols: 3 },
    narrow: {
      colW: 300,
      rowH: 160,
      nodeW: 270,
      cols: 1,
      at: Object.fromEntries([['worker', at(0, 0)], ...order.map((id, i) => [id, at(0, i + 1)])]),
      edges: [
        // side wires nest down their own lanes (sketch `lane`), the longer one outside
        { from: 'worker', to: 'opens', fromSide: 'w', toSide: 'w', lane: 18 },
        { from: 'worker', to: 'tokens', fromSide: 'w', toSide: 'w', lane: 32 },
        { from: 'worker', to: 'shard', fromSide: 'e', toSide: 'e', lane: 18 },
        { from: 'shard', to: 'msgs', fromSide: 'w', toSide: 'w', lane: 18 },
        { from: 'shard', to: 'attach', fromSide: 'w', toSide: 'w', lane: 32 },
        { from: 'shard', to: 'dir', fromSide: 'e', toSide: 'e', lane: 18 },
        { from: 'coal', to: 'shard', fromSide: 'e', toSide: 'e', lane: 32, dashed: true },
      ],
    },
  };
};

export const builders: Record<string, Builder> = { 'realtime-map': map, 'realtime-views': views, 'realtime-sketch': sketch };
