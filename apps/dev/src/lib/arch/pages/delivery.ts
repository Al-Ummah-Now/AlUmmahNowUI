/** Delivery & caching page diagrams (docs/SOURCES.md §3). */
import { stack, type ArchNode } from '../arch.ts';
import type { Builder } from './types.ts';
import { rateLines } from '../specs/costs.ts';

const node = (id: string, icon: string, c: { name: string; role: string }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

const rails: Builder = (d) => {
  const c = d.pages.delivery.rails;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'delivery-rails',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('viewers', 'lucide/users', n.viewers, [0, 1]),
        node('api', 'cloudflare/workers', n.api, [1.25, 2.35]),
        node('cache', 'cloudflare/cache', n.cache, [1.25, 0]),
        node('domain', 'cloudflare/dns', n.domain, [2.35, 0]),
        node('pub', 'cloudflare/r2', n.pub, [3.45, 0]),
        node('edge', 'cloudflare/cache', n.edge, [1.25, 1.2]),
        node('worker', 'cloudflare/workers', n.worker, [2.35, 1.2]),
        node('priv', 'cloudflare/r2', n.priv, [3.45, 1.2]),
        node('bunnyCdn', 'brand/bunny-cdn', n.bunnyCdn, [1.25, 3.7]),
        node('library', 'brand/bunny-stream', n.library, [2.35, 3.7]),
      ],
      groups: [
        { id: 'pubRail', label: c.group.pub, caption: c.caption.pub, members: ['cache', 'domain', 'pub'] },
        { id: 'privRail', label: c.group.priv, caption: c.caption.priv, members: ['edge', 'worker', 'priv'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', members: ['pubRail', 'privRail', 'api'] },
        { id: 'bunny', label: c.group.bunny, kind: 'platform', tagLogo: { id: 'brand/bunnynet-logo-dark', w: 66, h: 19 }, tagEnd: true, accent: '#f29b1d', members: ['bunnyCdn', 'library'] },
      ],
      edges: [
        { from: 'viewers', to: 'api', flow: 'request', label: e.ask, fromSide: 's', toSide: 'w' },
        { from: 'pub', to: 'domain', flow: 'delivery', label: e.origin, fromSide: 'w', toSide: 'e' },
        { from: 'domain', to: 'cache', flow: 'delivery', fromSide: 'w', toSide: 'e' },
        { from: 'cache', to: 'viewers', flow: 'delivery', label: e.hls, fromSide: 'w', toSide: 'e', stream: true },
        { from: 'priv', to: 'worker', flow: 'delivery', label: e.origin, fromSide: 'w', toSide: 'e' },
        { from: 'worker', to: 'edge', flow: 'delivery', label: e.token, fromSide: 'w', toSide: 'e' },
        { from: 'edge', to: 'viewers', flow: 'delivery', fromSide: 'w', toSide: 'e', stream: true },
        { from: 'library', to: 'bunnyCdn', flow: 'delivery', fromSide: 'w', toSide: 'e' },
        { from: 'bunnyCdn', to: 'viewers', flow: 'delivery', fromSide: 'w', toSide: 'e', stream: true },
        { from: 'api', to: 'privRail', flow: 'control', label: e.key, fromSide: 'e', toSide: 's' },
        { from: 'api', to: 'pubRail', flow: 'control', label: e.purge, fromSide: 'e', toSide: 'e' },
      ],
    },
    wide: { colW: 200, rowH: 165 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      at: stack([
        [['viewers'], 0],
        [['api'], 2.3],
        [['cache', 'domain'], 1.95],
        [['pub'], 1.05],
        [['edge', 'worker'], 1.95],
        [['priv'], 1.05],
        [['bunnyCdn', 'library'], 2.5],
      ]),
      edges: [
        { from: 'viewers', to: 'api', flow: 'request', label: e.ask, fromSide: 's', toSide: 'n' },
        { from: 'pub', to: 'domain', flow: 'delivery', fromSide: 'e', toSide: 's' },
        { from: 'domain', to: 'cache', flow: 'delivery', fromSide: 'w', toSide: 'e' },
        { from: 'cache', to: 'viewers', flow: 'delivery', label: e.hls, fromSide: 'w', toSide: 'w', stream: true },
        { from: 'priv', to: 'worker', flow: 'delivery', fromSide: 'e', toSide: 's' },
        { from: 'worker', to: 'edge', flow: 'delivery', label: e.token, fromSide: 'w', toSide: 'e' },
        { from: 'edge', to: 'viewers', flow: 'delivery', fromSide: 'w', toSide: 'w', stream: true },
        { from: 'library', to: 'bunnyCdn', flow: 'delivery', fromSide: 'w', toSide: 'e' },
        { from: 'bunnyCdn', to: 'viewers', flow: 'delivery', fromSide: 'w', toSide: 'w', stream: true },
        { from: 'api', to: 'worker', flow: 'control', label: e.key, fromSide: 'e', toSide: 'e' },
      ],
    },
  };
};

const miss: Builder = (d, locale) => {
  const c = d.pages.delivery.miss;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'delivery-miss',
      title: c.title,
      desc: c.desc,
      motion: 'steps',
      hop: 1.3,
      nodes: [node('player', 'lucide/play', n.player, [0, 0.5]), node('edge', 'cloudflare/cache', n.edge, [1.6, 0.5]), node('upper', 'cloudflare/network', n.upper, [3.2, 0.5]), node('r2', 'cloudflare/r2', n.r2, [4.8, 0.5], { rate: [rateLines(d.costs, locale, 'r2Deliver')[1]!] })],
      groups: [],
      edges: [
        // requests run straight along the row; every answer arcs back underneath
        { from: 'player', to: 'edge', flow: 'request', label: e.get, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'edge', to: 'upper', flow: 'request', label: e.miss, step: 2, fromSide: 'e', toSide: 'w' },
        { from: 'upper', to: 'r2', flow: 'request', label: e.read, step: 3, fromSide: 'e', toSide: 'w' },
        { from: 'edge', to: 'player', flow: 'delivery', label: e.hit, step: 2, fromSide: 's', toSide: 's' },
        { from: 'r2', to: 'upper', flow: 'delivery', label: e.fillUpper, step: 4, fromSide: 's', toSide: 's' },
        { from: 'upper', to: 'edge', flow: 'delivery', label: e.fillEdge, step: 5, fromSide: 's', toSide: 's' },
        { from: 'edge', to: 'player', flow: 'delivery', label: e.deliver, step: 6, fromSide: 's', toSide: 's' },
      ],
    },
    wide: { colW: 220, rowH: 250, pad: 72 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      at: stack([
        [['player'], 0],
        [['edge'], 2],
        [['upper'], 2],
        [['r2'], 2],
      ]),
      edges: [
        { from: 'player', to: 'edge', flow: 'request', label: e.get, step: 1, fromSide: 'w', toSide: 'w' },
        { from: 'edge', to: 'player', flow: 'delivery', label: e.hit, step: 2, fromSide: 'n', toSide: 's' },
        { from: 'edge', to: 'upper', flow: 'request', label: e.miss, step: 2, fromSide: 'w', toSide: 'w' },
        { from: 'upper', to: 'r2', flow: 'request', label: e.read, step: 3, fromSide: 'w', toSide: 'w' },
        { from: 'r2', to: 'upper', flow: 'delivery', label: e.fillUpper, step: 4, fromSide: 'n', toSide: 's' },
        { from: 'upper', to: 'edge', flow: 'delivery', label: e.fillEdge, step: 5, fromSide: 'e', toSide: 'e' },
        { from: 'edge', to: 'player', flow: 'delivery', label: e.deliver, step: 6, fromSide: 'e', toSide: 'e' },
      ],
    },
  };
};

const caches: Builder = (d) => {
  const c = d.pages.delivery.caches;
  const n = c.node;
  const spec = {
    id: 'delivery-caches',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      { id: 'settings', icon: 'lucide/settings', title: n.settings.title, note: n.settings.note, tone: 'blue' as const, at: [0, 0] as [number, number] },
      { id: 'jwks', icon: 'lucide/key-round', title: n.jwks.title, note: n.jwks.note, tone: 'yellow' as const, at: [1, 0] as [number, number] },
      { id: 'revoked', icon: 'cloudflare/kv', title: n.revoked.title, note: n.revoked.note, tone: 'pink' as const, at: [2, 0] as [number, number] },
      { id: 'api', icon: 'cloudflare/workers', title: n.api.title, note: n.api.note, tone: 'orange' as const, at: [1, 1] as [number, number] },
      { id: 'share', icon: 'lucide/film', title: n.share.title, note: n.share.note, tone: 'green' as const, at: [0, 2] as [number, number] },
      { id: 'mp4', icon: 'lucide/hard-drive', title: n.mp4.title, note: n.mp4.note, tone: 'green' as const, at: [2, 2] as [number, number] },
    ],
    edges: [
      { from: 'api', to: 'settings', fromSide: 'w' as const, toSide: 's' as const, bend: 30 },
      { from: 'api', to: 'jwks', fromSide: 'n' as const, toSide: 's' as const },
      { from: 'api', to: 'revoked', fromSide: 'e' as const, toSide: 's' as const, bend: -30 },
      { from: 'api', to: 'share', fromSide: 'w' as const, toSide: 'n' as const, bend: -30, tag: c.tag.never, tone: 'pink' as const, tagAt: 0.35 },
      { from: 'api', to: 'mp4', fromSide: 'e' as const, toSide: 'n' as const, bend: 30 },
    ],
  };
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 340, rowH: 190, nodeW: 230, cols: 3 },
    narrow: {
      colW: 280,
      rowH: 160,
      nodeW: 250,
      cols: 1,
      at: { api: [0, 0], settings: [0, 1], jwks: [0, 2], revoked: [0, 3], share: [0, 4], mp4: [0, 5] },
      // one column: each wire bows out through the margin at its own distance
      edges: ['settings', 'jwks', 'revoked', 'share', 'mp4'].map((to, i) => ({ from: 'api', to, fromSide: 'w' as const, toSide: 'w' as const, bend: 34 + i * 16 })),
    },
  };
};

export const builders: Record<string, Builder> = { 'delivery-rails': rails, 'delivery-miss': miss, 'delivery-caches': caches };
