/**
 * Scaling (system-design/scaling). Workers, queues and Durable Objects spread over many copies
 * on their own; the platform's work is keeping that safe — sharded sockets and counters, slot
 * gates under the container ceiling, and single-writer discipline. SOURCES.md §10.
 */
import type { DiagramShape, DiagramSpec, IconKind, Tone } from '../diagram.ts';

export interface ScalingLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { edge: string; shards: string; transcode: string; data: string };
  node: Record<'requests' | 'workersN' | 'wsShards' | 'directories' | 'viewShards' | 'casFlush' | 'slots' | 'ceiling' | 'containerN' | 'd1Upsert' | 'queues', { title: string; sub?: string[] }>;
  edge: { fan: string; route: string; merge: string; gate: string; batch: string };
}

export function scalingWide(l: ScalingLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'edge', x: 16, y: 64, w: 300, h: 560, label: l.zone.edge, tone: 'edge' },
    { kind: 'zone', id: 'shards', x: 356, y: 64, w: 340, h: 560, label: l.zone.shards, tone: 'async' },
    { kind: 'zone', id: 'transcode', x: 736, y: 64, w: 260, h: 560, label: l.zone.transcode, tone: 'async' },
    { kind: 'zone', id: 'data', x: 1036, y: 64, w: 228, h: 560, label: l.zone.data, tone: 'data' },
  ];
  const n = (id: keyof ScalingLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title, sub: l.node[id].sub });

  n('requests', 36, 116, 260, 64, 'client', 'browser');
  n('workersN', 36, 240, 260, 76, 'accent', 'worker');
  n('queues', 36, 376, 260, 64, 'queue', 'queue');
  n('wsShards', 376, 116, 300, 64, undefined, 'do');
  n('directories', 376, 226, 300, 64, undefined, 'do');
  n('viewShards', 376, 336, 300, 64, undefined, 'do');
  n('casFlush', 376, 446, 300, 64, undefined, 'bucket');
  n('slots', 756, 116, 220, 64, undefined, 'do');
  n('ceiling', 756, 226, 220, 64, 'accent', 'shield');
  n('containerN', 756, 336, 220, 76, undefined, 'container');
  n('d1Upsert', 1056, 116, 188, 76, 'store', 'db');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, labelAt?: [number, number]) =>
    s.push({ kind: 'edge', id, from, to, label, labelAt });
  e('fan', [166, 180], [166, 240], l.edge.fan);
  e('route', [526, 180], [526, 226], l.edge.route, [590, 203]);
  e('merge', [526, 400], [526, 446], l.edge.merge, [594, 423]);
  e('gate', [866, 180], [866, 226], l.edge.gate, [936, 203]);
  e('batch', [296, 408], [376, 408]);
  return { id: 'dg-scaling', width: 1280, height: 660, title: l.title, desc: l.desc, shapes: s };
}

export function scalingNarrow(l: ScalingLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'edge', x: 8, y: 8, w: 344, h: 300, label: l.zone.edge, tone: 'edge' },
    { kind: 'zone', id: 'shards', x: 8, y: 324, w: 344, h: 340, label: l.zone.shards, tone: 'async' },
    { kind: 'zone', id: 'transcode', x: 8, y: 680, w: 344, h: 340, label: l.zone.transcode, tone: 'async' },
    { kind: 'zone', id: 'data', x: 8, y: 1036, w: 344, h: 220, label: l.zone.data, tone: 'data' },
  ];
  const n = (id: keyof ScalingLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title });
  const col = (id: keyof ScalingLabels['node'], y: number, tone?: Tone, icon?: IconKind) => n(id, 24, y, 312, 48, tone, icon);
  col('requests', 60, 'client', 'browser');
  col('workersN', 132, 'accent', 'worker');
  col('queues', 204, 'queue', 'queue');
  col('wsShards', 376, undefined, 'do');
  col('directories', 436, undefined, 'do');
  col('viewShards', 496, undefined, 'do');
  col('casFlush', 556, undefined, 'bucket');
  col('slots', 732, undefined, 'do');
  col('ceiling', 792, 'accent', 'shield');
  col('containerN', 852, undefined, 'container');
  col('d1Upsert', 1088, 'store', 'db');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('edge-shards', 308, 324);
  down('shards-transcode', 664, 680);
  down('transcode-data', 1020, 1036);
  return { id: 'dg-scaling-narrow', width: 360, height: 1288, title: l.title, desc: l.narrowDesc, shapes: s };
}
