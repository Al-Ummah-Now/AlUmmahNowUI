/** Data page diagrams (docs/SOURCES.md §4). */
import { stack, type ArchNode } from '../arch.ts';
import type { Builder } from './types.ts';

const node = (id: string, icon: string, c: { name: string; role: string }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

const stores: Builder = (d) => {
  const c = d.pages.data.stores;
  const n = c.node;
  const e = c.edge;
  // workers across the top, one store kind per column underneath
  const y0 = 1.9;
  return {
    kind: 'arch',
    spec: {
      id: 'data-stores',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('apiVideos', 'cloudflare/workers', n.apiVideos, [0, 0]),
        node('processor', 'cloudflare/workers', n.processor, [1, 0]),
        node('auth', 'cloudflare/workers', n.auth, [2, 0]),
        node('comms', 'cloudflare/workers', n.comms, [3, 0]),
        node('web', 'simple-icons/nextjs', n.web, [4, 0]),
        node('records', 'cloudflare/r2', n.records, [0, y0]),
        node('media', 'cloudflare/r2', n.media, [0, y0 + 1]),
        node('system', 'cloudflare/r2', n.system, [0, y0 + 2]),
        node('search', 'cloudflare/d1', n.search, [1, y0]),
        node('notifications', 'cloudflare/d1', n.notifications, [1, y0 + 1]),
        node('reports', 'cloudflare/d1', n.reports, [1, y0 + 2]),
        node('authDb', 'cloudflare/d1', n.authDb, [1, y0 + 3]),
        node('revocations', 'cloudflare/kv', n.revocations, [2, y0]),
        node('appKv', 'cloudflare/kv', n.appKv, [2, y0 + 1]),
        node('sessions', 'cloudflare/kv', n.sessions, [2, y0 + 2]),
        node('feed', 'cloudflare/kv', n.feed, [2, y0 + 3]),
        node('sockets', 'cloudflare/durable-objects', n.sockets, [3, y0]),
        node('views', 'cloudflare/durable-objects', n.views, [3, y0 + 1]),
        node('transcoder', 'cloudflare/durable-objects', n.transcoder, [3, y0 + 2]),
        node('lock', 'cloudflare/durable-objects', n.lock, [3, y0 + 3]),
        node('rum', 'cloudflare/analytics', n.rum, [4, y0]),
        node('abuse', 'cloudflare/analytics', n.abuse, [4, y0 + 1]),
        node('authEvents', 'cloudflare/analytics', n.authEvents, [4, y0 + 2]),
      ],
      groups: [
        { id: 'workers', label: c.group.workers, members: ['apiVideos', 'processor', 'auth', 'comms', 'web'] },
        { id: 'r2', label: c.group.r2, members: ['records', 'media', 'system'] },
        { id: 'd1', label: c.group.d1, caption: c.caption.d1, members: ['search', 'notifications', 'reports', 'authDb'] },
        { id: 'kv', label: c.group.kv, caption: c.caption.kv, members: ['revocations', 'appKv', 'sessions', 'feed'] },
        { id: 'do', label: c.group.do, members: ['sockets', 'views', 'transcoder', 'lock'] },
        { id: 'ae', label: c.group.ae, members: ['rum', 'abuse', 'authEvents'] },
        // room inside the account for the margin wires: a wire between two stores stays inside it
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', pad: 64, members: ['workers', 'r2', 'd1', 'kv', 'do', 'ae'] },
      ],
      edges: [
        { from: 'apiVideos', to: 'r2', flow: 'request', label: e.records, fromSide: 's', toSide: 'n' },
        { from: 'apiVideos', to: 'd1', flow: 'request', label: e.search, fromSide: 's', toSide: 'n' },
        { from: 'processor', to: 'd1', flow: 'async', label: e.rows, fromSide: 's', toSide: 'n' },
        { from: 'auth', to: 'kv', flow: 'control', label: e.revoke, fromSide: 's', toSide: 'n' },
        { from: 'comms', to: 'do', flow: 'request', label: e.sockets, fromSide: 's', toSide: 'n' },
        { from: 'web', to: 'ae', flow: 'control', label: e.vitals, fromSide: 's', toSide: 'n' },
      ],
    },
    // D1's title at the far end of its top: the search rows wire drops into the near end in one bend, clear of the
    // notifications wire
    wide: { colW: 200, rowH: 112, titleEnd: ['d1'] },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      // room inside the account's side for the search-rows words beside the outer lane, clear of the dashed edge
      growPad: { cf: { l: 6 } },
      at: stack([
        [['apiVideos', 'processor'], 0],
        [['auth', 'comms'], 1.05],
        [['web'], 1.05],
        // Analytics Engine sits right under the Workers: videos web's page-speed wire drops straight in
        [['rum', 'abuse'], 2.1],
        [['authEvents'], 1.05],
        [['records', 'media'], 2.1],
        [['system'], 1.05],
        [['search', 'notifications'], 2.1],
        [['reports', 'authDb'], 1.05],
        [['revocations', 'appKv'], 2.3],
        [['sessions', 'feed'], 1.05],
        [['sockets', 'views'], 2.3],
        [['transcoder', 'lock'], 1.05],
      ]),
      edges: [
        { from: 'apiVideos', to: 'r2', flow: 'request', label: e.records, fromSide: 'w', toSide: 'w' },
        { from: 'apiVideos', to: 'd1', flow: 'request', fromSide: 'w', toSide: 'w' },
        { from: 'processor', to: 'd1', flow: 'async', label: e.rows, fromSide: 'e', toSide: 'e' },
        { from: 'auth', to: 'kv', flow: 'control', fromSide: 'w', toSide: 'w' },
        { from: 'comms', to: 'do', flow: 'request', fromSide: 'e', toSide: 'e' },
        { from: 'web', to: 'ae', flow: 'control', fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

const write: Builder = (d) => {
  const c = d.pages.data.write;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'data-write',
      title: c.title,
      desc: c.desc,
      motion: 'steps',
      hop: 1.1,
      nodes: [
        node('creator', 'lucide/user', n.creator, [0, 0]),
        node('api', 'cloudflare/workers', n.api, [1.35, 0]),
        node('r2', 'cloudflare/r2', n.r2, [2.7, 0]),
        node('search', 'cloudflare/d1', n.search, [1.35, 1.25]),
        node('queue', 'cloudflare/queues', n.queue, [2.7, 1.25]),
        node('processor', 'cloudflare/workers', n.processor, [4.05, 1.25]),
        node('notif', 'cloudflare/d1', n.notif, [5.4, 1.25]),
        node('realtime', 'cloudflare/workers', n.realtime, [5.4, 0]),
        node('subscribers', 'lucide/bell-ring', n.subscribers, [6.75, 0]),
      ],
      groups: [{ id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', members: ['api', 'r2', 'search', 'queue', 'processor', 'notif', 'realtime'] }],
      edges: [
        { from: 'creator', to: 'api', flow: 'request', label: e.publish, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'r2', flow: 'request', label: e.cas, step: 2, fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'search', flow: 'request', label: e.index, step: 3, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'queue', flow: 'async', label: e.event, step: 3, fromSide: 'e', toSide: 'n' },
        { from: 'queue', to: 'processor', flow: 'async', label: e.batch, step: 4, fromSide: 'e', toSide: 'w' },
        { from: 'processor', to: 'notif', flow: 'async', label: e.rows, step: 5, fromSide: 'e', toSide: 'w' },
        { from: 'processor', to: 'realtime', flow: 'async', label: e.broadcast, step: 6, fromSide: 'n', toSide: 'w' },
        { from: 'realtime', to: 'subscribers', flow: 'delivery', label: e.bell, step: 7, fromSide: 'e', toSide: 'w' },
      ],
    },
    // the conditional write and the event leave api-videos' side together: room between them for the event's badge
    wide: { colW: 200, rowH: 170, portStep: 24 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      // the creator and api a little toward the queue: room between the record write's drop and the event wire for
      // the record write's words
      at: {
        ...stack([
          [['creator'], 0],
          [['api'], 2.2],
          [['r2', 'search'], 1.6],
          [['processor', 'queue'], 1.6],
          [['notif', 'realtime'], 1.6],
          [['subscribers'], 2.2],
        ]),
        creator: [0.58, 0],
        api: [0.58, 2.2],
      },
      edges: [
        { from: 'creator', to: 'api', flow: 'request', label: e.publish, step: 1, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'r2', flow: 'request', label: e.cas, step: 2, fromSide: 'w', toSide: 'n' },
        { from: 'api', to: 'search', flow: 'request', label: e.index, step: 3, fromSide: 'e', toSide: 'n' },
        { from: 'api', to: 'queue', flow: 'async', label: e.event, step: 3, fromSide: 's', toSide: 'n' },
        { from: 'queue', to: 'processor', flow: 'async', label: e.batch, step: 4, fromSide: 'w', toSide: 'e' },
        { from: 'processor', to: 'notif', flow: 'async', label: e.rows, step: 5, fromSide: 's', toSide: 'n' },
        { from: 'processor', to: 'realtime', flow: 'async', label: e.broadcast, step: 6, fromSide: 's', toSide: 'n' },
        { from: 'realtime', to: 'subscribers', flow: 'delivery', label: e.bell, step: 7, fromSide: 's', toSide: 'e' },
      ],
    },
  };
};

const sketch: Builder = (d) => {
  const c = d.pages.data.sketch;
  const n = c.node;
  const spec = {
    id: 'data-sketch',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      { id: 'r2', icon: 'cloudflare/r2', title: n.r2.title, note: n.r2.note, tone: 'green' as const, at: [0, 0] as [number, number] },
      { id: 'kv', icon: 'cloudflare/kv', title: n.kv.title, note: n.kv.note, tone: 'yellow' as const, at: [1, 0] as [number, number] },
      { id: 'd1', icon: 'cloudflare/d1', title: n.d1.title, note: n.d1.note, tone: 'blue' as const, at: [2, 0] as [number, number] },
      { id: 'api', icon: 'cloudflare/workers', title: n.api.title, note: n.api.note, tone: 'orange' as const, at: [1, 1] as [number, number] },
      { id: 'dobj', icon: 'cloudflare/durable-objects', title: n.dobj.title, note: n.dobj.note, tone: 'pink' as const, at: [0, 2] as [number, number] },
      { id: 'ae', icon: 'cloudflare/analytics', title: n.ae.title, note: n.ae.note, tone: 'blue' as const, at: [2, 2] as [number, number] },
    ],
    edges: [
      { from: 'api', to: 'r2', fromSide: 'w' as const, toSide: 's' as const, bend: 30, tag: c.tag.whole, tone: 'green' as const, tagAt: 0.45 },
      { from: 'api', to: 'kv', fromSide: 'n' as const, toSide: 's' as const },
      { from: 'api', to: 'd1', fromSide: 'e' as const, toSide: 's' as const, bend: -30, tag: c.tag.sql, tone: 'blue' as const, tagAt: 0.45 },
      { from: 'api', to: 'dobj', fromSide: 'w' as const, toSide: 'n' as const, bend: -30 },
      { from: 'api', to: 'ae', fromSide: 'e' as const, toSide: 'n' as const, bend: 30 },
    ],
  };
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 340, rowH: 190, nodeW: 240, cols: 3 },
    narrow: {
      colW: 280,
      rowH: 160,
      nodeW: 250,
      cols: 1,
      at: { api: [0, 0], r2: [0, 1], d1: [0, 2], kv: [0, 3], dobj: [0, 4], ae: [0, 5] },
      edges: ['r2', 'd1', 'kv', 'dobj', 'ae'].map((to, i) => ({ from: 'api', to, fromSide: 'w' as const, toSide: 'w' as const, lane: 18 + i * 18 })),
    },
  };
};

export const builders: Record<string, Builder> = { 'data-stores': stores, 'data-write': write, 'data-sketch': sketch };
