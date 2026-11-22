/** Scaling page diagrams (docs/SOURCES.md §2, §6, §10). */
import { stack, type ArchNode } from '../arch.ts';
import type { Builder } from './types.ts';

const node = (id: string, icon: string, c: { name: string; role: string | string[] }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

const copies: Builder = (d) => {
  const c = d.pages.scaling.copies;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'scaling-copies',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('users', 'lucide/users', n.users, [0, 1.35]),
        node('workers', 'cloudflare/workers', n.workers, [1.3, 1.35]),
        node('sockets', 'cloudflare/durable-objects', n.sockets, [3.15, 0]),
        node('topics', 'cloudflare/durable-objects', n.topics, [4.35, 0]),
        node('views', 'cloudflare/durable-objects', n.views, [3.15, 1.35]),
        node('videoJson', 'cloudflare/r2', n.videoJson, [4.35, 1.35]),
        node('queue', 'cloudflare/queues', n.queue, [2.9, 2.7]),
        node('container', 'cloudflare/containers', n.container, [4.1, 2.7]),
        node('slots', 'cloudflare/durable-objects', n.slots, [2.9, 3.7]),
      ],
      groups: [
        { id: 'realtime', label: c.group.realtime, caption: c.caption.realtime, members: ['sockets', 'topics'] },
        { id: 'counting', label: c.group.counting, caption: c.caption.counting, members: ['views', 'videoJson'] },
        { id: 'transcode', label: c.group.transcode, caption: c.caption.transcode, members: ['queue', 'container', 'slots'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', members: ['workers', 'realtime', 'counting', 'transcode'] },
      ],
      edges: [
        { from: 'users', to: 'workers', flow: 'request', label: e.req, fromSide: 'e', toSide: 'w' },
        { from: 'workers', to: 'sockets', flow: 'request', label: e.socket, fromSide: 'e', toSide: 'w' },
        { from: 'topics', to: 'sockets', flow: 'delivery', label: e.broadcast, fromSide: 'w', toSide: 'e' },
        { from: 'workers', to: 'views', flow: 'request', label: e.view, fromSide: 'e', toSide: 'w' },
        { from: 'views', to: 'videoJson', flow: 'async', label: e.cas, fromSide: 'e', toSide: 'w' },
        { from: 'workers', to: 'queue', flow: 'async', label: e.job, fromSide: 'e', toSide: 'w' },
        { from: 'queue', to: 'slots', flow: 'control', label: e.acquire, fromSide: 's', toSide: 'n' },
        { from: 'queue', to: 'container', flow: 'media', label: e.start, fromSide: 'e', toSide: 'w' },
      ],
    },
    wide: { colW: 300, rowH: 160, pad: 36 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      // a lane inside the account down each side: the view wire on the left, the transcode job on the right
      growPad: { cf: { l: 24, r: 24 } },
      // Video JSON under the views (its long "conditional write" words beside the wire, in the empty column); the
      // queue under the job lane on the right, so the job lands clear of the group's title
      at: { users: [0.5, 0], workers: [0.5, 2.4], sockets: [0, 4.7], topics: [1, 4.7], views: [0, 7], videoJson: [0, 8.6], queue: [1, 10.9], container: [0, 10.9], slots: [1, 12.35] },
      edges: [
        { from: 'users', to: 'workers', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'workers', to: 'sockets', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'topics', to: 'sockets', flow: 'delivery', fromSide: 'w', toSide: 'e' },
        { from: 'workers', to: 'views', flow: 'request', fromSide: 'w', toSide: 'w' },
        { from: 'views', to: 'videoJson', flow: 'async', fromSide: 's', toSide: 'n' },
        { from: 'workers', to: 'queue', flow: 'async', fromSide: 'e', toSide: 'n' },
        { from: 'queue', to: 'slots', flow: 'control', fromSide: 's', toSide: 'n' },
        { from: 'queue', to: 'container', flow: 'media', fromSide: 'w', toSide: 'e' },
      ],
    },
  };
};

const slot: Builder = (d) => {
  const c = d.pages.scaling.slot;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'scaling-slot',
      title: c.title,
      desc: c.desc,
      motion: 'steps',
      hop: 1.1,
      nodes: [
        node('api', 'cloudflare/workers', n.api, [0, 1]),
        node('queue', 'cloudflare/queues', n.queue, [1.3, 1]),
        node('media', 'cloudflare/workers', n.media, [2.65, 1]),
        node('container', 'cloudflare/containers', n.container, [3.95, 1]),
        node('r2', 'cloudflare/r2', n.r2, [5.3, 1]),
        node('slots', 'cloudflare/durable-objects', n.slots, [2.65, 2.55]),
        node('range', 'lucide/settings', n.range, [1.3, 2.55]),
      ],
      groups: [
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', tagEnd: true, pad: 48, members: ['api', 'queue', 'media', 'container', 'slots', 'r2', 'range'] },
      ],
      edges: [
        { from: 'api', to: 'queue', flow: 'async', label: e.enqueue, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'queue', to: 'media', flow: 'async', label: e.deliver, step: 2, fromSide: 'e', toSide: 'w' },
        { from: 'media', to: 'slots', flow: 'control', label: e.acquire, step: 3, fromSide: 's', toSide: 'n' },
        { from: 'media', to: 'queue', flow: 'control', label: e.wait, step: 4, fromSide: 's', toSide: 's' },
        { from: 'media', to: 'container', flow: 'media', label: e.start, step: 4, fromSide: 'e', toSide: 'w' },
        { from: 'container', to: 'slots', flow: 'control', label: e.renew, step: 5, fromSide: 's', toSide: 'e' },
        { from: 'container', to: 'r2', flow: 'media', label: e.write, step: 6, fromSide: 'e', toSide: 'w' },
        { from: 'container', to: 'slots', flow: 'control', label: e.release, step: 7, fromSide: 's', toSide: 'e' },
        { from: 'range', to: 'slots', flow: 'control', label: e.allowed, fromSide: 'e', toSide: 'w' },
      ],
    },
    wide: { colW: 200, rowH: 165, pad: 40 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      at: { api: [0, 0], queue: [1, 0], slots: [0, 1.9], media: [1, 1.9], container: [1, 3.6], range: [0, 5.3], r2: [1, 5.3] },
      edges: [
        { from: 'api', to: 'queue', flow: 'async', label: e.enqueue, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'queue', to: 'media', flow: 'async', label: e.deliver, step: 2, fromSide: 's', toSide: 'n' },
        { from: 'media', to: 'slots', flow: 'control', label: e.acquire, step: 3, fromSide: 'w', toSide: 'e' },
        { from: 'media', to: 'queue', flow: 'control', label: e.wait, step: 4, fromSide: 'e', toSide: 'e' },
        { from: 'media', to: 'container', flow: 'media', label: e.start, step: 4, fromSide: 's', toSide: 'n' },
        { from: 'container', to: 'slots', flow: 'control', label: e.renew, step: 5, fromSide: 'w', toSide: 's' },
        { from: 'container', to: 'r2', flow: 'media', label: e.write, step: 6, fromSide: 's', toSide: 'n' },
        { from: 'container', to: 'slots', flow: 'control', label: e.release, step: 7, fromSide: 'w', toSide: 's' },
        { from: 'range', to: 'slots', flow: 'control', label: e.allowed, fromSide: 'w', toSide: 'w' },
      ],
    },
  };
};

const fixes: Builder = (d) => {
  const c = d.pages.scaling.fixes;
  const n = c.node;
  const around = ['cas', 'shards', 'upsert', 'sockets', 'limiter', 'reserve'] as const;
  const at: Record<string, [number, number]> = { blind: [1, 1], cas: [0, 0], shards: [1, 0], upsert: [2, 0], sockets: [0, 2], limiter: [1, 2], reserve: [2, 2] };
  const look = {
    blind: { icon: 'lucide/users', tone: 'pink' as const },
    cas: { icon: 'cloudflare/r2', tone: 'green' as const },
    shards: { icon: 'cloudflare/durable-objects', tone: 'blue' as const },
    upsert: { icon: 'cloudflare/d1', tone: 'yellow' as const },
    sockets: { icon: 'cloudflare/durable-objects', tone: 'blue' as const },
    limiter: { icon: 'cloudflare/waf', tone: 'orange' as const },
    reserve: { icon: 'cloudflare/workers-ai', tone: 'yellow' as const },
  };
  const spec = {
    id: 'scaling-fixes',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: (['blind', ...around] as const).map((id) => ({ id, icon: look[id].icon, title: n[id].title, note: n[id].note, tone: look[id].tone, at: at[id]! })),
    edges: [
      { from: 'blind', to: 'cas', fromSide: 'w' as const, toSide: 's' as const, bend: 30 },
      { from: 'blind', to: 'shards', fromSide: 'n' as const, toSide: 's' as const, tag: c.tag.exact, tone: 'blue' as const },
      { from: 'blind', to: 'upsert', fromSide: 'e' as const, toSide: 's' as const, bend: -30 },
      { from: 'blind', to: 'sockets', fromSide: 'w' as const, toSide: 'n' as const, bend: -30 },
      { from: 'blind', to: 'limiter', fromSide: 's' as const, toSide: 'n' as const },
      { from: 'blind', to: 'reserve', fromSide: 'e' as const, toSide: 'n' as const, bend: 30 },
    ],
  };
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 340, rowH: 200, nodeW: 240, cols: 3 },
    narrow: {
      colW: 280,
      rowH: 160,
      nodeW: 250,
      cols: 1,
      at: { blind: [0, 0], cas: [0, 1], shards: [0, 2], upsert: [0, 3], sockets: [0, 4], limiter: [0, 5], reserve: [0, 6] },
      // one column: each wire bows out through the margin at its own distance
      edges: around.map((to, i) => ({ from: 'blind', to, fromSide: 'w' as const, toSide: 'w' as const, lane: 18 + i * 14 })),
    },
  };
};

export const builders: Record<string, Builder> = { 'scaling-copies': copies, 'scaling-slot': slot, 'scaling-fixes': fixes };
