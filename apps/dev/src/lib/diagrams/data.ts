/**
 * Data (system-design/data). What holds what: the R2 buckets (records, media pipeline, system
 * stores), the seven D1 databases, the KV namespaces, the Durable Objects and the Analytics
 * Engine datasets. Names from the wrangler bindings — SOURCES.md §4.
 */
import type { DiagramShape, DiagramSpec, IconKind, NodeShape, Tone } from '../diagram.ts';

export interface DataLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { r2: string; d1: string; kv: string; doZone: string; ae: string };
  node: Record<
    | 'records' | 'mediaBuckets' | 'systemStores'
    | 'authDb' | 'notificationsDb' | 'searchDb' | 'reportsDb' | 'costsDb' | 'statusDb' | 'cmsDb'
    | 'authKv' | 'appKv' | 'feedKv'
    | 'socketDo' | 'transcodeDo' | 'lockDo'
    | 'rumDs' | 'abuseDs' | 'authDs',
    { title: string; sub?: string[] }
  >;
  edge: { written: string; held: string };
}

export function dataWide(l: DataLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'r2', x: 16, y: 64, w: 300, h: 560, label: l.zone.r2, tone: 'data' },
    { kind: 'zone', id: 'd1', x: 340, y: 64, w: 300, h: 560, label: l.zone.d1, tone: 'data' },
    { kind: 'zone', id: 'kv', x: 664, y: 64, w: 280, h: 560, label: l.zone.kv, tone: 'apps' },
    { kind: 'zone', id: 'do', x: 964, y: 64, w: 300, h: 340, label: l.zone.doZone, tone: 'async' },
    { kind: 'zone', id: 'ae', x: 964, y: 428, w: 300, h: 236, label: l.zone.ae, tone: 'obs' },
  ];
  const n = (id: keyof DataLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind, shape?: NodeShape) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title, sub: l.node[id].sub });

  n('records', 36, 116, 260, 76, 'store', 'bucket');
  n('mediaBuckets', 36, 232, 260, 76, 'store', 'bucket');
  n('systemStores', 36, 348, 260, 96, 'store', 'bucket');
  const d1x = 360;
  n('authDb', d1x, 116, 260, 60, 'store', 'db', 'cylinder');
  n('notificationsDb', d1x, 192, 260, 60, 'store', 'db', 'cylinder');
  n('searchDb', d1x, 268, 260, 60, 'store', 'db', 'cylinder');
  n('reportsDb', d1x, 344, 260, 60, 'store', 'db', 'cylinder');
  n('costsDb', d1x, 420, 260, 60, 'store', 'db', 'cylinder');
  n('statusDb', d1x, 496, 260, 60, 'store', 'db', 'cylinder');
  n('cmsDb', d1x, 560, 260, 56, 'store', 'db', 'cylinder');
  n('authKv', 684, 116, 240, 76, undefined, 'kv');
  n('appKv', 684, 232, 240, 76, undefined, 'kv');
  n('feedKv', 684, 348, 240, 76, undefined, 'kv');
  n('socketDo', 984, 116, 260, 60, undefined, 'do');
  n('transcodeDo', 984, 192, 260, 60, undefined, 'do');
  n('lockDo', 984, 268, 260, 60, undefined, 'do');
  n('rumDs', 984, 480, 260, 48, undefined, 'pulse');
  n('abuseDs', 984, 538, 260, 48, undefined, 'pulse');
  n('authDs', 984, 596, 260, 48, undefined, 'pulse');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  e('r2-d1', [316, 200], [340, 200]);
  e('d1-kv', [640, 200], [664, 200]);
  e('kv-do', [924, 200], [964, 200]);
  e('do-ae', [1114, 404], [1114, 428]);
  return { id: 'dg-data', width: 1280, height: 700, title: l.title, desc: l.desc, shapes: s };
}

export function dataNarrow(l: DataLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'r2', x: 8, y: 8, w: 344, h: 268, label: l.zone.r2, tone: 'data' },
    { kind: 'zone', id: 'd1', x: 8, y: 292, w: 344, h: 500, label: l.zone.d1, tone: 'data' },
    { kind: 'zone', id: 'kv', x: 8, y: 812, w: 344, h: 268, label: l.zone.kv, tone: 'apps' },
    { kind: 'zone', id: 'do', x: 8, y: 1096, w: 344, h: 220, label: l.zone.doZone, tone: 'async' },
    { kind: 'zone', id: 'ae', x: 8, y: 1336, w: 344, h: 220, label: l.zone.ae, tone: 'obs' },
  ];
  const n = (id: keyof DataLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind, shape?: NodeShape) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title });
  n('records', 24, 60, 312, 56, 'store', 'bucket');
  n('mediaBuckets', 24, 128, 312, 56, 'store', 'bucket');
  n('systemStores', 24, 196, 312, 56, 'store', 'bucket');
  const col = (id: keyof DataLabels['node'], y: number) => n(id, 24, y, 312, 52, 'store', 'db', 'cylinder');
  col('authDb', 344);
  col('notificationsDb', 408);
  col('searchDb', 472);
  col('reportsDb', 536);
  col('costsDb', 600);
  col('statusDb', 664);
  col('cmsDb', 728);
  n('authKv', 24, 864, 312, 52, undefined, 'kv');
  n('appKv', 24, 928, 312, 52, undefined, 'kv');
  n('feedKv', 24, 992, 312, 52, undefined, 'kv');
  n('socketDo', 24, 1148, 312, 48, undefined, 'do');
  n('transcodeDo', 24, 1206, 312, 48, undefined, 'do');
  n('lockDo', 24, 1264, 312, 48, undefined, 'do');
  n('rumDs', 24, 1388, 312, 48, undefined, 'pulse');
  n('abuseDs', 24, 1446, 312, 48, undefined, 'pulse');
  n('authDs', 24, 1504, 312, 48, undefined, 'pulse');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('r2-d1', 276, 292);
  down('d1-kv', 804, 812);
  down('kv-do', 1088, 1096);
  down('do-ae', 1328, 1336);
  return { id: 'dg-data-narrow', width: 360, height: 1576, title: l.title, desc: l.narrowDesc, shapes: s };
}
