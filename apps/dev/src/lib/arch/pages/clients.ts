/** Clients page diagrams (docs/SOURCES.md §11). */
import { stack, type ArchNode } from '../arch.ts';
import type { SketchSpec } from '../sketch.ts';
import type { Builder } from './types.ts';

const node = (id: string, icon: string, c: { name: string; role: string }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

const map: Builder = (d) => {
  const c = d.pages.clients.map;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'clients-map',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('browsers', 'lucide/browser', n.browsers, [0, 0]),
        node('embeds', 'lucide/play', n.embeds, [0, 1]),
        node('www', 'simple-icons/astro', n.www, [1.45, 0]),
        node('videos', 'simple-icons/nextjs', n.videos, [2.45, 0]),
        node('adminWeb', 'simple-icons/nextjs', n.adminWeb, [3.45, 0]),
        node('shortLinks', 'cloudflare/workers', n.shortLinks, [4.45, 0]),
        node('r2', 'cloudflare/r2', n.r2, [5.85, 1.35]),
        node('apiVideos', 'cloudflare/workers', n.apiVideos, [2.45, 1.35]),
        node('adminApi', 'cloudflare/workers', n.adminApi, [3.45, 1.35]),
        node('auth', 'cloudflare/workers', n.auth, [4.45, 1.35]),
        node('apple', 'simple-icons/apple', n.apple, [0, 2.9]),
        node('android', 'simple-icons/android', n.android, [1, 2.9]),
        node('desktop', 'simple-icons/windows', n.desktop, [0, 3.9]),
        node('tv', 'lucide/tv', n.tv, [1, 3.9]),
        node('core', 'lucide/cpu', n.core, [2.45, 3.4]),
        node('importer', 'lucide/cloud-upload', n.importer, [5.85, 3.0]),
        node('bunny', 'brand/bunny-stream', n.bunny, [5.85, 4.55]),
      ],
      groups: [
        { id: 'web', label: c.group.web, members: ['browsers', 'embeds'] },
        { id: 'sites', label: c.group.sites, members: ['www', 'videos', 'adminWeb', 'shortLinks'] },
        { id: 'apis', label: c.group.apis, members: ['apiVideos', 'adminApi', 'auth'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', members: ['sites', 'apis', 'r2'] },
        { id: 'native', label: c.group.native, caption: c.caption.native, members: ['apple', 'android', 'desktop', 'tv'] },
        { id: 'bunnyNet', label: c.group.bunny, kind: 'platform', tagLogo: { id: 'brand/bunnynet-logo-dark', w: 66, h: 19 }, accent: '#f29b1d', members: ['bunny'] },
      ],
      edges: [
        { from: 'web', to: 'sites', flow: 'request', label: e.https, fromSide: 'e', toSide: 'w' },
        { from: 'sites', to: 'apis', flow: 'request', label: e.bindings, fromSide: 's', toSide: 'n' },
        { from: 'apis', to: 'r2', flow: 'media', label: e.media, fromSide: 'e', toSide: 'w' },
        { from: 'native', to: 'core', flow: 'request', label: e.uniffi, fromSide: 'e', toSide: 'w' },
        { from: 'core', to: 'apiVideos', flow: 'request', label: e.api, fromSide: 'n', toSide: 's' },
        { from: 'core', to: 'auth', flow: 'request', label: e.signIn, fromSide: 'e', toSide: 's' },
        { from: 'importer', to: 'r2', flow: 'media', label: e.upload, fromSide: 'n', toSide: 's' },
        { from: 'importer', to: 'bunny', flow: 'media', label: e.upload, fromSide: 's', toSide: 'n' },
      ],
    },
    // Bunny's tag is wide for its one-tile box: room on its side keeps it clear of the uploads wire into the tile
    wide: { colW: 180, rowH: 150, growPad: { bunnyNet: { l: 60 } } },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      // Bunny's tag sits top-left in its box: room on the left keeps it off the uploads wire dropping into the tile
      growPad: { bunnyNet: { l: 64, r: 64 } },
      at: stack([
        [['browsers', 'embeds'], 0],
        [['www', 'videos'], 2.7],
        [['adminWeb', 'shortLinks'], 1.05],
        [['apiVideos', 'adminApi'], 1.95],
        [['auth'], 1.05],
        [['r2'], 1.5],
        [['apple', 'android'], 1.9],
        [['desktop', 'tv'], 1.05],
        [['core'], 2.0],
        [['importer'], 1.9],
        [['bunny'], 2.1],
      ]),
      edges: [
        { from: 'web', to: 'sites', flow: 'request', label: e.https, fromSide: 's', toSide: 'n' },
        { from: 'sites', to: 'apis', flow: 'request', label: e.bindings, fromSide: 's', toSide: 'n' },
        { from: 'apis', to: 'r2', flow: 'media', label: e.media, fromSide: 's', toSide: 'n' },
        { from: 'native', to: 'core', flow: 'request', label: e.uniffi, fromSide: 's', toSide: 'n' },
        { from: 'core', to: 'apiVideos', flow: 'request', label: e.api, fromSide: 'w', toSide: 'w' },
        { from: 'core', to: 'auth', flow: 'request', label: e.signIn, fromSide: 'w', toSide: 'w' },
        { from: 'importer', to: 'r2', flow: 'media', label: e.upload, fromSide: 'e', toSide: 'e' },
        { from: 'importer', to: 'bunny', flow: 'media', label: e.upload, fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

const device: Builder = (d) => {
  const c = d.pages.clients.device;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'clients-device',
      title: c.title,
      desc: c.desc,
      motion: 'steps',
      hop: 1.3,
      nodes: [node('api', 'cloudflare/workers', n.api, [0, 0]), node('tv', 'lucide/tv', n.tv, [1.5, 0]), node('issuer', 'cloudflare/workers', n.issuer, [3.3, 0]), node('phone', 'lucide/smartphone', n.phone, [5.1, 0])],
      groups: [],
      edges: [
        { from: 'tv', to: 'issuer', flow: 'request', label: e.ask, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'tv', flow: 'delivery', label: e.code, step: 2, fromSide: 's', toSide: 's' },
        { from: 'phone', to: 'issuer', flow: 'request', label: e.enter, step: 3, fromSide: 'w', toSide: 'e' },
        { from: 'issuer', to: 'phone', flow: 'control', label: e.confirm, step: 4, fromSide: 's', toSide: 's' },
        { from: 'tv', to: 'issuer', flow: 'request', label: e.poll, step: 5, fromSide: 'n', toSide: 'n' },
        { from: 'issuer', to: 'tv', flow: 'delivery', label: e.tokens, step: 6, fromSide: 's', toSide: 's' },
        { from: 'tv', to: 'api', flow: 'request', label: e.call, step: 7, fromSide: 'w', toSide: 'e' },
      ],
    },
    wide: { colW: 210, rowH: 170, pad: 100 },
    narrow: {
      // the code and token steps run down side by side between the TV and the issuer: a wide column gives each its words
      colW: 270,
      tileMin: 240,
      rowH: 100,
      iconSize: 34,
      pad: 56,
      at: { tv: [0, 0], api: [1, 0], issuer: [0, 3.2], phone: [1, 3.2] },
      edges: [
        { from: 'tv', to: 'issuer', flow: 'request', label: e.ask, step: 1, fromSide: 'w', toSide: 'w' },
        // the code goes back up the east side, so each of the four TV ↔ issuer wires keeps its words beside it
        { from: 'issuer', to: 'tv', flow: 'delivery', label: e.code, step: 2, fromSide: 'e', toSide: 'e' },
        { from: 'phone', to: 'issuer', flow: 'request', label: e.enter, step: 3, fromSide: 'w', toSide: 'e' },
        { from: 'issuer', to: 'phone', flow: 'control', label: e.confirm, step: 4, fromSide: 's', toSide: 's' },
        { from: 'tv', to: 'issuer', flow: 'request', label: e.poll, step: 5, fromSide: 's', toSide: 'n' },
        { from: 'issuer', to: 'tv', flow: 'delivery', label: e.tokens, step: 6, fromSide: 'n', toSide: 's' },
        { from: 'tv', to: 'api', flow: 'request', label: e.call, step: 7, fromSide: 'e', toSide: 'w' },
      ],
    },
  };
};

const core: Builder = (d) => {
  const c = d.pages.clients.core;
  const n = c.node;
  const sk = (id: keyof typeof n, icon: string, tone: SketchSpec['nodes'][number]['tone'], at: [number, number]) => ({ id, icon, title: n[id].title, note: n[id].note, tone, at });
  const spec: SketchSpec = {
    id: 'clients-core',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      sk('apple', 'simple-icons/apple', 'blue', [0, 0]),
      sk('android', 'simple-icons/android', 'blue', [1, 0]),
      sk('desktop', 'simple-icons/windows', 'blue', [2, 0]),
      sk('pair', 'lucide/film', 'yellow', [0, 1]),
      sk('core', 'lucide/cpu', 'orange', [1, 1]),
      sk('config', 'cloudflare/kv', 'pink', [2, 1]),
      sk('api', 'cloudflare/workers', 'green', [0.5, 2]),
      sk('auth', 'cloudflare/workers', 'green', [1.5, 2]),
    ],
    edges: [
      { from: 'apple', to: 'core', fromSide: 's', toSide: 'n', bend: -20 },
      { from: 'android', to: 'core', fromSide: 's', toSide: 'n' },
      { from: 'desktop', to: 'core', fromSide: 's', toSide: 'n', bend: 20 },
      { from: 'core', to: 'pair', fromSide: 'w', toSide: 'e', dashed: true, tag: c.tag.linked, tone: 'yellow' },
      { from: 'config', to: 'core', fromSide: 'w', toSide: 'e' },
      { from: 'core', to: 'api', fromSide: 's', toSide: 'n', bend: 14 },
      { from: 'core', to: 'auth', fromSide: 's', toSide: 'n', bend: -14 },
    ],
  };
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 390, rowH: 200, nodeW: 240, cols: 3 },
    narrow: {
      colW: 280,
      rowH: 160,
      nodeW: 250,
      cols: 1,
      at: { pair: [0, 0], apple: [0, 1], android: [0, 2], desktop: [0, 3], core: [0, 4], api: [0, 5], auth: [0, 6], config: [0, 7] },
      // one column: the platforms come in on the left, the config and the player pair join on the right
      edges: [
        // side wires nest down their own lanes (sketch `lane`), the farther one outside
        { from: 'apple', to: 'core', fromSide: 'w', toSide: 'w', lane: 32 },
        { from: 'android', to: 'core', fromSide: 'w', toSide: 'w', lane: 18 },
        { from: 'desktop', to: 'core', fromSide: 's', toSide: 'n' },
        { from: 'core', to: 'api', fromSide: 's', toSide: 'n' },
        { from: 'core', to: 'auth', fromSide: 'w', toSide: 'w', lane: 18 },
        { from: 'config', to: 'core', fromSide: 'e', toSide: 'e', lane: 18 },
        // the player pair it is linked into, up on the right above the config wire
        { from: 'core', to: 'pair', fromSide: 'e', toSide: 'e', lane: 18 },
      ],
    },
  };
};

export const builders: Record<string, Builder> = { 'clients-map': map, 'clients-device': device, 'clients-core': core };
