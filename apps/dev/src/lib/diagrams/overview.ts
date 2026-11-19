/**
 * The master overview diagram (system-design hub). Zones and members are the real deployment
 * (wiki README "System map"; every name from the wrangler configs — SOURCES.md §1). Logical LTR
 * coordinates; the renderer mirrors them for Arabic. The narrow variant is the same story
 * stacked for phones: fewer nodes, no sub-lines, one flow spine.
 */
import type { DiagramShape, DiagramSpec, IconKind, NodeShape, Tone } from '../diagram.ts';

export interface OverviewNodeLabels {
  title: string;
  sub?: string[];
}
export interface OverviewDiagramLabels {
  title: string;
  desc: string;
  narrowDesc: string;
  zone: { clients: string; edge: string; apps: string; async: string; data: string; providers: string; obs: string };
  node: Record<
    | 'browser' | 'native' | 'tools'
    | 'cdn' | 'bunnyCdn' | 'turnstile'
    | 'www' | 'videosWeb' | 'adminWeb' | 'cms' | 'apiVideos' | 'adminApi' | 'auth' | 'profileAdmin' | 'shortLinks' | 'status'
    | 'processor' | 'scheduler' | 'media' | 'container' | 'costMonitor'
    | 'r2' | 'mediaBuckets' | 'd1' | 'kv' | 'queues' | 'do' | 'analytics'
    | 'bunnyStream' | 'workersAi' | 'qf' | 'resend' | 'push' | 'googleOauth'
    | 'logs' | 'errorsPage' | 'rum' | 'statusPage' | 'costDash',
    OverviewNodeLabels
  >;
  edge: { https: string; native: string; bindings: string; serviceQueues: string; bunnyEmail: string; aiQf: string; logsErrors: string; signIn: string };
}

export function overviewWide(l: OverviewDiagramLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'clients', x: 16, y: 70, w: 240, h: 170, label: l.zone.clients, tone: 'clients' },
    { kind: 'zone', id: 'edge', x: 276, y: 70, w: 300, h: 164, label: l.zone.edge, tone: 'edge' },
    { kind: 'zone', id: 'providers', x: 996, y: 70, w: 268, h: 452, label: l.zone.providers, tone: 'providers' },
    { kind: 'zone', id: 'apps', x: 276, y: 260, w: 460, h: 400, label: l.zone.apps, tone: 'apps' },
    { kind: 'zone', id: 'async', x: 756, y: 260, w: 220, h: 400, label: l.zone.async, tone: 'async' },
    { kind: 'zone', id: 'obs', x: 996, y: 540, w: 268, h: 360, label: l.zone.obs, tone: 'obs' },
    { kind: 'zone', id: 'data', x: 16, y: 700, w: 940, h: 200, label: l.zone.data, tone: 'data' },
  ];
  const n = (
    id: keyof OverviewDiagramLabels['node'],
    x: number,
    y: number,
    w: number,
    h: number,
    tone?: Tone,
    icon?: IconKind,
    shape?: NodeShape,
  ) => s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title, sub: l.node[id].sub });

  n('browser', 32, 96, 208, 40, 'client', 'browser');
  n('native', 32, 144, 208, 44, 'client', 'device');
  n('tools', 32, 196, 208, 40, 'client', 'upload');
  n('cdn', 292, 96, 268, 40, undefined, 'cloud');
  n('bunnyCdn', 292, 144, 268, 40, 'external', 'cloud');
  n('turnstile', 292, 192, 268, 40, undefined, 'shield');
  n('www', 292, 300, 212, 56, undefined, 'worker');
  n('videosWeb', 524, 300, 212, 56, undefined, 'worker');
  n('adminWeb', 292, 366, 212, 56, undefined, 'worker');
  n('cms', 524, 366, 212, 56, undefined, 'worker');
  n('apiVideos', 292, 432, 212, 56, 'accent', 'worker');
  n('adminApi', 524, 432, 212, 56, undefined, 'worker');
  n('auth', 292, 512, 212, 56, 'accent', 'lock');
  n('profileAdmin', 524, 512, 212, 56, undefined, 'lock');
  n('shortLinks', 292, 578, 212, 56, undefined, 'link');
  n('status', 524, 578, 212, 56, undefined, 'pulse');
  n('processor', 772, 300, 188, 56, 'accent', 'worker');
  n('scheduler', 772, 366, 188, 56, undefined, 'gear');
  n('media', 772, 432, 188, 56, undefined, 'film');
  n('container', 772, 498, 188, 56, undefined, 'container');
  n('costMonitor', 772, 564, 188, 56, undefined, 'chart');
  n('r2', 32, 760, 216, 56, 'store', 'bucket');
  n('mediaBuckets', 32, 824, 216, 56, 'store', 'bucket');
  n('d1', 268, 760, 216, 56, 'store', 'db', 'cylinder');
  n('kv', 268, 824, 216, 56, 'store', 'kv');
  n('queues', 504, 760, 216, 56, 'queue', 'queue', 'pipe');
  n('do', 504, 824, 216, 56, 'store', 'do');
  n('analytics', 740, 760, 196, 56, 'store', 'pulse');
  n('bunnyStream', 1012, 104, 236, 48, 'external', 'globe');
  n('workersAi', 1012, 166, 236, 48, 'ai', 'ai');
  n('qf', 1012, 228, 236, 48, 'external', 'book');
  n('resend', 1012, 290, 236, 48, 'external', 'mail');
  n('push', 1012, 352, 236, 48, 'external', 'bell');
  n('googleOauth', 1012, 414, 236, 48, 'external', 'globe');
  n('logs', 1012, 578, 236, 48, undefined, 'pulse');
  n('errorsPage', 1012, 634, 236, 48, undefined, 'chart');
  n('rum', 1012, 690, 236, 48, undefined, 'pulse');
  n('statusPage', 1012, 746, 236, 48, undefined, 'pulse');
  n('costDash', 1012, 802, 236, 48, undefined, 'chart');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][], labelAt?: [number, number]) =>
    s.push({ kind: 'edge', id, from, to, via, label, labelAt });
  // routed in the channels between zones only: x 256..276, x 736..756, x 976..996, y 234..260, y 660..700
  e('https', [256, 150], [276, 150], l.edge.https);
  e('native', [136, 240], [276, 460], l.edge.native, [[136, 460]]);
  e('edge-apps', [430, 234], [430, 260]);
  e('sign-in', [524, 328], [398, 512], l.edge.signIn, [[514, 328], [514, 500], [398, 500]], [452, 500]);
  e('apps-data', [496, 660], [496, 700]);
  e('apps-async', [736, 500], [756, 500]);
  e('async-data', [866, 660], [866, 700]);
  e('apps-providers', [660, 260], [996, 300], l.edge.bunnyEmail, [[660, 248], [940, 248], [940, 300]], [800, 248]);
  e('async-providers', [976, 500], [996, 500], l.edge.aiQf, undefined, [986, 500]);
  e('apps-obs', [700, 660], [996, 620], l.edge.logsErrors, [[700, 681], [976, 681], [976, 620]], [838, 681]);

  return { id: 'dg-overview', width: 1280, height: 930, title: l.title, desc: l.desc, shapes: s };
}

export function overviewNarrow(l: OverviewDiagramLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'clients', x: 8, y: 8, w: 344, h: 132, label: l.zone.clients, tone: 'clients' },
    { kind: 'zone', id: 'edge', x: 8, y: 164, w: 344, h: 132, label: l.zone.edge, tone: 'edge' },
    { kind: 'zone', id: 'apps', x: 8, y: 312, w: 344, h: 204, label: l.zone.apps, tone: 'apps' },
    { kind: 'zone', id: 'async', x: 8, y: 532, w: 344, h: 148, label: l.zone.async, tone: 'async' },
    { kind: 'zone', id: 'providers', x: 8, y: 696, w: 344, h: 148, label: l.zone.providers, tone: 'providers' },
    { kind: 'zone', id: 'data', x: 8, y: 860, w: 344, h: 148, label: l.zone.data, tone: 'data' },
    { kind: 'zone', id: 'obs', x: 8, y: 1024, w: 344, h: 204, label: l.zone.obs, tone: 'obs' },
  ];
  const n = (id: keyof OverviewDiagramLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind, shape?: NodeShape) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title });
  n('browser', 24, 44, 152, 44, 'client', 'browser');
  n('native', 184, 44, 152, 44, 'client', 'device');
  n('tools', 24, 96, 312, 40, 'client', 'upload');
  n('cdn', 24, 200, 152, 44, undefined, 'cloud');
  n('bunnyCdn', 184, 200, 152, 44, 'external', 'cloud');
  n('turnstile', 24, 252, 312, 36, undefined, 'shield');
  n('www', 24, 348, 152, 48, undefined, 'worker');
  n('videosWeb', 184, 348, 152, 48, undefined, 'worker');
  n('apiVideos', 24, 404, 152, 48, 'accent', 'worker');
  n('auth', 184, 404, 152, 48, 'accent', 'lock');
  n('cms', 24, 460, 152, 48, undefined, 'worker');
  n('adminWeb', 184, 460, 152, 48, undefined, 'worker');
  n('processor', 24, 568, 152, 48, 'accent', 'worker');
  n('scheduler', 184, 568, 152, 48, undefined, 'gear');
  n('media', 24, 624, 152, 48, undefined, 'film');
  
  n('bunnyStream', 24, 732, 152, 48, 'external', 'globe');
  n('workersAi', 184, 732, 152, 48, 'ai', 'ai');
  n('qf', 24, 788, 152, 48, 'external', 'book');
  n('resend', 184, 788, 152, 48, 'external', 'mail');
  n('r2', 24, 896, 152, 48, 'store', 'bucket');
  n('d1', 184, 896, 152, 48, 'store', 'db', 'cylinder');
  n('queues', 24, 952, 152, 48, 'queue', 'queue', 'pipe');
  n('do', 184, 952, 152, 48, 'store', 'do');
  n('logs', 24, 1060, 152, 48, undefined, 'pulse');
  n('errorsPage', 184, 1060, 152, 48, undefined, 'chart');
  n('rum', 24, 1116, 152, 48, undefined, 'pulse');
  n('statusPage', 184, 1116, 152, 48, undefined, 'pulse');
  n('costDash', 24, 1172, 312, 44, undefined, 'chart');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  e('c-edge', [180, 140], [180, 164]);
  e('edge-apps', [180, 296], [180, 312]);
  e('apps-async', [180, 516], [180, 532]);
  e('async-prov', [180, 680], [180, 696]);
  e('prov-data', [180, 844], [180, 860]);
  e('data-obs', [180, 1008], [180, 1024]);
  return { id: 'dg-overview-narrow', width: 360, height: 1248, title: l.title, desc: l.narrowDesc, shapes: s };
}
