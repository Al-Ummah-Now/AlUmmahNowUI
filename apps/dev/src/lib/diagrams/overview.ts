/**
 * The master overview diagram (system-design hub). Zones and members are the real deployment
 * (wiki README "System map"; every name from the wrangler configs — SOURCES.md §1). Logical LTR
 * coordinates; the renderer mirrors them for Arabic. The narrow variant is the same story
 * stacked for phones: fewer nodes, no sub-lines, one flow spine.
 */
import type { DiagramShape, DiagramSpec, Tone } from '../diagram.ts';

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
  edge: { https: string; native: string; bindings: string; serviceQueues: string; bunnyEmail: string; aiQf: string; logsErrors: string };
}

export function overviewWide(l: OverviewDiagramLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'clients', x: 16, y: 70, w: 240, h: 170, label: l.zone.clients },
    { kind: 'zone', id: 'edge', x: 276, y: 70, w: 300, h: 164, label: l.zone.edge },
    { kind: 'zone', id: 'providers', x: 996, y: 70, w: 268, h: 452, label: l.zone.providers },
    { kind: 'zone', id: 'apps', x: 276, y: 260, w: 460, h: 440, label: l.zone.apps },
    { kind: 'zone', id: 'async', x: 756, y: 260, w: 220, h: 440, label: l.zone.async },
    { kind: 'zone', id: 'obs', x: 996, y: 540, w: 268, h: 370, label: l.zone.obs },
    { kind: 'zone', id: 'data', x: 16, y: 720, w: 940, h: 190, label: l.zone.data },
  ];
  const n = (id: keyof OverviewDiagramLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, title: l.node[id].title, sub: l.node[id].sub });

  n('browser', 32, 96, 208, 40, 'client');
  n('native', 32, 144, 208, 44, 'client');
  n('tools', 32, 196, 208, 40, 'client');
  n('cdn', 292, 96, 268, 40);
  n('bunnyCdn', 292, 144, 268, 40, 'external');
  n('turnstile', 292, 192, 268, 40);
  n('www', 292, 300, 212, 56);
  n('videosWeb', 524, 300, 212, 56);
  n('adminWeb', 292, 366, 212, 56);
  n('cms', 524, 366, 212, 56);
  n('apiVideos', 292, 432, 212, 56, 'accent');
  n('adminApi', 524, 432, 212, 56);
  n('auth', 292, 498, 212, 56, 'accent');
  n('profileAdmin', 524, 498, 212, 56);
  n('shortLinks', 292, 564, 212, 56);
  n('status', 524, 564, 212, 56);
  n('processor', 772, 300, 188, 56, 'accent');
  n('scheduler', 772, 366, 188, 56);
  n('media', 772, 432, 188, 56);
  n('container', 772, 498, 188, 56);
  n('costMonitor', 772, 564, 188, 56);
  n('r2', 32, 760, 216, 56, 'store');
  n('mediaBuckets', 32, 824, 216, 56, 'store');
  n('d1', 268, 760, 216, 56, 'store');
  n('kv', 268, 824, 216, 56, 'store');
  n('queues', 504, 760, 216, 56, 'queue');
  n('do', 504, 824, 216, 56, 'store');
  n('analytics', 740, 760, 196, 56, 'store');
  n('bunnyStream', 1012, 104, 236, 48, 'external');
  n('workersAi', 1012, 166, 236, 48, 'ai');
  n('qf', 1012, 228, 236, 48, 'external');
  n('resend', 1012, 290, 236, 48, 'external');
  n('push', 1012, 352, 236, 48, 'external');
  n('googleOauth', 1012, 414, 236, 48, 'external');
  n('logs', 1012, 578, 236, 48);
  n('errorsPage', 1012, 634, 236, 48);
  n('rum', 1012, 690, 236, 48);
  n('statusPage', 1012, 746, 236, 48);
  n('costDash', 1012, 802, 236, 48);

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][]) =>
    s.push({ kind: 'edge', id, from, to, via, label });
  e('https', [256, 150], [276, 150], l.edge.https);
  e('native', [136, 240], [276, 520], l.edge.native, [[136, 520]]);
  e('edge-apps', [430, 234], [430, 260]);
  e('apps-data', [496, 700], [496, 720], l.edge.bindings);
  e('apps-async', [736, 420], [756, 420], l.edge.serviceQueues);
  e('async-data', [866, 700], [866, 720], l.edge.bindings);
  e('apps-providers', [660, 260], [996, 300], l.edge.bunnyEmail, [[660, 250], [940, 250], [940, 300]]);
  e('async-providers', [976, 420], [996, 420], l.edge.aiQf);
  e('apps-obs', [700, 700], [996, 620], l.edge.logsErrors, [[700, 712], [976, 712], [976, 620]]);

  return { id: 'dg-overview', width: 1280, height: 940, title: l.title, desc: l.desc, shapes: s };
}

export function overviewNarrow(l: OverviewDiagramLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'clients', x: 8, y: 8, w: 344, h: 132, label: l.zone.clients },
    { kind: 'zone', id: 'edge', x: 8, y: 164, w: 344, h: 132, label: l.zone.edge },
    { kind: 'zone', id: 'apps', x: 8, y: 312, w: 344, h: 204, label: l.zone.apps },
    { kind: 'zone', id: 'async', x: 8, y: 532, w: 344, h: 148, label: l.zone.async },
    { kind: 'zone', id: 'providers', x: 8, y: 696, w: 344, h: 148, label: l.zone.providers },
    { kind: 'zone', id: 'data', x: 8, y: 860, w: 344, h: 148, label: l.zone.data },
    { kind: 'zone', id: 'obs', x: 8, y: 1024, w: 344, h: 204, label: l.zone.obs },
  ];
  const n = (id: keyof OverviewDiagramLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, title: l.node[id].title });
  n('browser', 24, 44, 152, 44, 'client');
  n('native', 184, 44, 152, 44, 'client');
  n('tools', 24, 96, 312, 40, 'client');
  n('cdn', 24, 200, 152, 44);
  n('bunnyCdn', 184, 200, 152, 44, 'external');
  n('turnstile', 24, 252, 312, 36);
  n('www', 24, 348, 152, 48);
  n('videosWeb', 184, 348, 152, 48);
  n('apiVideos', 24, 404, 152, 48, 'accent');
  n('auth', 184, 404, 152, 48, 'accent');
  n('cms', 24, 460, 152, 48);
  n('adminWeb', 184, 460, 152, 48);
  n('processor', 24, 568, 152, 48, 'accent');
  n('scheduler', 184, 568, 152, 48);
  n('media', 24, 624, 152, 48);
  n('container', 184, 624, 152, 48);
  n('bunnyStream', 24, 732, 152, 48, 'external');
  n('workersAi', 184, 732, 152, 48, 'ai');
  n('qf', 24, 788, 152, 48, 'external');
  n('resend', 184, 788, 152, 48, 'external');
  n('r2', 24, 896, 152, 48, 'store');
  n('d1', 184, 896, 152, 48, 'store');
  n('queues', 24, 952, 152, 48, 'queue');
  n('do', 184, 952, 152, 48, 'store');
  n('logs', 24, 1060, 152, 48);
  n('errorsPage', 184, 1060, 152, 48);
  n('rum', 24, 1116, 152, 48);
  n('statusPage', 184, 1116, 152, 48);
  n('costDash', 24, 1172, 312, 44);

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  e('c-edge', [180, 140], [180, 164]);
  e('edge-apps', [180, 296], [180, 312]);
  e('apps-async', [180, 516], [180, 532]);
  e('async-prov', [180, 680], [180, 696]);
  e('prov-data', [180, 844], [180, 860]);
  e('data-obs', [180, 1008], [180, 1024]);
  return { id: 'dg-overview-narrow', width: 360, height: 1248, title: l.title, desc: l.narrowDesc, shapes: s };
}
