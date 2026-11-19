/**
 * Realtime (system-design/realtime). One Worker takes the socket onto a random shard; channel
 * directories route broadcasts to the shards that hold a subscriber; admin updates coalesce;
 * view counters count in shards and flush back to the video record. SOURCES.md §6.
 */
import type { DiagramShape, DiagramSpec, IconKind, Tone } from '../diagram.ts';

export interface RealtimeLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { worker: string; shards: string; directories: string; counters: string };
  node: Record<'ws' | 'shard0' | 'shard1' | 'shardN' | 'dir' | 'coalescer' | 'views' | 'videoJson' | 'apiVideos' | 'apps' | 'limiters', { title: string; sub?: string[] }>;
  edge: { socket: string; broadcast: string; join: string; coalesce: string; flush: string; binding: string };
}

export function realtimeWide(l: RealtimeLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'worker', x: 16, y: 64, w: 260, h: 470, label: l.zone.worker, tone: 'apps' },
    { kind: 'zone', id: 'shards', x: 336, y: 64, w: 320, h: 300, label: l.zone.shards, tone: 'async' },
    { kind: 'zone', id: 'directories', x: 696, y: 64, w: 300, h: 300, label: l.zone.directories, tone: 'async' },
    { kind: 'zone', id: 'counters', x: 336, y: 400, w: 660, h: 300, label: l.zone.counters, tone: 'data' },
  ];
  const n = (id: keyof RealtimeLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title, sub: l.node[id].sub });

  n('apps', 36, 116, 220, 64, 'client', 'browser');
  n('ws', 36, 240, 220, 64, 'accent', 'worker');
  n('limiters', 36, 364, 220, 56, undefined, 'shield');
  n('shard0', 356, 116, 130, 56, undefined, 'do');
  n('shard1', 506, 116, 130, 56, undefined, 'do');
  n('shardN', 356, 196, 280, 56, undefined, 'do');
  n('dir', 716, 116, 260, 64, undefined, 'do');
  n('coalescer', 716, 216, 260, 56, undefined, 'do');
  n('views', 356, 452, 250, 64, undefined, 'do');
  n('videoJson', 356, 560, 250, 64, 'store', 'bucket');
  n('apiVideos', 700, 452, 276, 64, 'accent', 'worker');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][], labelAt?: [number, number]) =>
    s.push({ kind: 'edge', id, from, to, via, label, labelAt });
  e('apps-ws', [146, 180], [146, 240], l.edge.socket);
  e('ws-shard', [256, 272], [356, 144], undefined, [[306, 272], [306, 144]], [306, 208]);
  e('shard-dir', [636, 144], [716, 144], l.edge.join);
  e('dir-broadcast', [716, 244], [636, 244], l.edge.broadcast);
  e('coalesce-dir', [846, 216], [846, 180]);
  e('views-flush', [481, 516], [481, 560], l.edge.flush, undefined, [556, 538]);
  e('api-views', [700, 484], [606, 484], l.edge.binding, undefined, [653, 530]);
  return { id: 'dg-realtime', width: 1024, height: 740, title: l.title, desc: l.desc, shapes: s };
}

export function realtimeNarrow(l: RealtimeLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'worker', x: 8, y: 8, w: 344, h: 300, label: l.zone.worker, tone: 'apps' },
    { kind: 'zone', id: 'shards', x: 8, y: 324, w: 344, h: 220, label: l.zone.shards, tone: 'async' },
    { kind: 'zone', id: 'directories', x: 8, y: 560, w: 344, h: 220, label: l.zone.directories, tone: 'async' },
    { kind: 'zone', id: 'counters', x: 8, y: 796, w: 344, h: 300, label: l.zone.counters, tone: 'data' },
  ];
  const n = (id: keyof RealtimeLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title });
  const col = (id: keyof RealtimeLabels['node'], y: number, tone?: Tone, icon?: IconKind) => n(id, 24, y, 312, 48, tone, icon);
  col('apps', 60, 'client', 'browser');
  col('ws', 132, 'accent', 'worker');
  col('limiters', 204);
  col('shard0', 376, undefined, 'do');
  col('shard1', 436, undefined, 'do');
  col('shardN', 496, undefined, 'do');
  col('dir', 612, undefined, 'do');
  col('coalescer', 672, undefined, 'do');
  col('views', 848, undefined, 'do');
  col('videoJson', 908, 'store', 'bucket');
  col('apiVideos', 988, 'accent', 'worker');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('apps-ws', 108, 132);
  down('ws-shards', 288, 324);
  down('shards-dir', 544, 560);
  down('dir-counters', 780, 796);
  down('views-json', 896, 908);
  return { id: 'dg-realtime-narrow', width: 360, height: 1136, title: l.title, desc: l.narrowDesc, shapes: s };
}
