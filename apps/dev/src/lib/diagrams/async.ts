/**
 * Async work (system-design/async). Producers on the left, the queues as pipes in the middle,
 * consumers on the right, the DLQ and the admin Errors page closing the loop. SOURCES.md §5.
 */
import type { DiagramShape, DiagramSpec, IconKind, NodeShape, Tone } from '../diagram.ts';

export interface AsyncLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { producers: string; queues: string; consumers: string };
  node: Record<
    | 'apiVideos' | 'adminApi' | 'scheduler' | 'auth' | 'status' | 'costMonitor'
    | 'videosQ' | 'moderationQ' | 'processingQ' | 'transcodeQ' | 'errorsQ' | 'contactQ'
    | 'processor' | 'media' | 'adminApiConsumer' | 'apiConsumer' | 'dlq' | 'errorsPage',
    { title: string; sub?: string[] }
  >;
  edge: { enqueue: string; consume: string; dead: string; retry: string };
}

export function asyncWide(l: AsyncLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'producers', x: 16, y: 64, w: 260, h: 620, label: l.zone.producers, tone: 'apps' },
    { kind: 'zone', id: 'queues', x: 336, y: 64, w: 300, h: 620, label: l.zone.queues, tone: 'async' },
    { kind: 'zone', id: 'consumers', x: 696, y: 64, w: 568, h: 620, label: l.zone.consumers, tone: 'apps' },
  ];
  const n = (id: keyof AsyncLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind, shape?: NodeShape) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title, sub: l.node[id].sub });

  n('apiVideos', 36, 116, 220, 64, 'accent', 'worker');
  n('adminApi', 36, 216, 220, 64, undefined, 'worker');
  n('scheduler', 36, 316, 220, 64, undefined, 'gear');
  n('auth', 36, 416, 220, 64, undefined, 'lock');
  n('status', 36, 516, 220, 56, undefined, 'pulse');
  n('costMonitor', 36, 592, 220, 56, undefined, 'chart');
  const qx = 356;
  n('videosQ', qx, 116, 260, 56, 'queue', 'queue', 'pipe');
  n('moderationQ', qx, 196, 260, 56, 'queue', 'queue', 'pipe');
  n('processingQ', qx, 276, 260, 56, 'queue', 'queue', 'pipe');
  n('transcodeQ', qx, 356, 260, 56, 'queue', 'queue', 'pipe');
  n('errorsQ', qx, 436, 260, 56, 'queue', 'queue', 'pipe');
  n('contactQ', qx, 516, 260, 56, 'queue', 'queue', 'pipe');
  n('dlq', qx, 596, 260, 56, 'queue', 'queue', 'pipe');
  n('processor', 716, 116, 250, 64, 'accent', 'worker');
  n('media', 716, 216, 250, 64, undefined, 'film');
  n('adminApiConsumer', 716, 316, 250, 64, undefined, 'worker');
  n('apiConsumer', 716, 416, 250, 64, undefined, 'worker');
  n('errorsPage', 1000, 316, 240, 64, undefined, 'chart');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][], labelAt?: [number, number]) =>
    s.push({ kind: 'edge', id, from, to, via, label, labelAt });
  e('p-q', [256, 150], [356, 150], l.edge.enqueue, undefined, [306, 106]);
  e('q-c', [616, 150], [716, 150], l.edge.consume, undefined, [666, 106]);
  e('q-media', [616, 244], [716, 244]);
  e('q-admin', [616, 348], [716, 348]);
  e('dlq-errors', [616, 624], [1000, 348], l.edge.dead, [[676, 624], [676, 560], [976, 560], [976, 348]], [830, 560]);
  e('errors-retry', [1000, 352], [966, 352], l.edge.retry, undefined, [983, 404]);
  return { id: 'dg-async', width: 1280, height: 720, title: l.title, desc: l.desc, shapes: s };
}

export function asyncNarrow(l: AsyncLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'producers', x: 8, y: 8, w: 344, h: 300, label: l.zone.producers, tone: 'apps' },
    { kind: 'zone', id: 'queues', x: 8, y: 324, w: 344, h: 470, label: l.zone.queues, tone: 'async' },
    { kind: 'zone', id: 'consumers', x: 8, y: 810, w: 344, h: 470, label: l.zone.consumers, tone: 'apps' },
  ];
  const n = (id: keyof AsyncLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind, shape?: NodeShape) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title });
  n('apiVideos', 24, 60, 312, 48, 'accent', 'worker');
  n('adminApi', 24, 120, 312, 48, undefined, 'worker');
  n('scheduler', 24, 180, 312, 48, undefined, 'gear');
  n('auth', 24, 240, 312, 48, undefined, 'lock');
  const q = (id: keyof AsyncLabels['node'], y: number) => n(id, 24, y, 312, 48, 'queue', 'queue', 'pipe');
  q('videosQ', 376);
  q('moderationQ', 436);
  q('processingQ', 496);
  q('transcodeQ', 556);
  q('errorsQ', 616);
  q('dlq', 676);
  n('processor', 24, 862, 312, 48, 'accent', 'worker');
  n('media', 24, 922, 312, 48, undefined, 'film');
  n('adminApiConsumer', 24, 982, 312, 48, undefined, 'worker');
  n('errorsPage', 24, 1042, 312, 48, undefined, 'chart');
  n('apiConsumer', 24, 1102, 312, 48, undefined, 'worker');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('p-q', 308, 324);
  down('q-c', 794, 810);
  return { id: 'dg-async-narrow', width: 360, height: 1300, title: l.title, desc: l.narrowDesc, shapes: s };
}
