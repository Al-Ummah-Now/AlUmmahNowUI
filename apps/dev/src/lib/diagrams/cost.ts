/**
 * Cost (system-design/cost). The platform runs under a fixed monthly budget cap; every cost line
 * is collected hourly into D1 and shown on the admin Costs page with a forecast and opt-in
 * alerts. The page's tiles carry the concrete choices that keep the bill small. SOURCES.md §9.
 * No figures are quoted (wiki AUN-DEV-SITE wording rule).
 */
import type { DiagramShape, DiagramSpec, IconKind, NodeShape, Tone } from '../diagram.ts';

export interface CostLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { lines: string; monitor: string; admin: string };
  node: Record<'workers' | 'r2' | 'containers' | 'bunny' | 'resend' | 'collector' | 'costsDb' | 'costsPage' | 'opsPage' | 'alerts' | 'budgetCap', { title: string; sub?: string[] }>;
  edge: { collect: string; read: string; watch: string };
}

export function costWide(l: CostLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'lines', x: 16, y: 64, w: 280, h: 560, label: l.zone.lines, tone: 'providers' },
    { kind: 'zone', id: 'monitor', x: 336, y: 64, w: 320, h: 560, label: l.zone.monitor, tone: 'async' },
    { kind: 'zone', id: 'admin', x: 696, y: 64, w: 568, h: 560, label: l.zone.admin, tone: 'apps' },
  ];
  const n = (id: keyof CostLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind, shape?: NodeShape) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title, sub: l.node[id].sub });

  n('workers', 36, 116, 240, 56, undefined, 'worker');
  n('r2', 36, 196, 240, 56, undefined, 'bucket');
  n('containers', 36, 276, 240, 56, undefined, 'container');
  n('bunny', 36, 356, 240, 56, 'external', 'globe');
  n('resend', 36, 436, 240, 56, 'external', 'mail');
  n('collector', 356, 116, 280, 64, 'accent', 'chart');
  n('costsDb', 356, 240, 280, 64, 'store', 'db', 'cylinder');
  n('costsPage', 716, 116, 250, 64, undefined, 'chart');
  n('opsPage', 716, 216, 250, 64, undefined, 'pulse');
  n('alerts', 990, 116, 250, 64, undefined, 'bell');
  n('budgetCap', 990, 216, 250, 64, 'accent', 'shield');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, labelAt?: [number, number]) =>
    s.push({ kind: 'edge', id, from, to, label, labelAt });
  e('collect', [276, 148], [356, 148], l.edge.collect, [316, 106]);
  e('store', [496, 180], [496, 240]);
  e('read', [636, 272], [716, 272], l.edge.read, [676, 320]);
  e('watch', [966, 148], [990, 148]);
  return { id: 'dg-cost', width: 1280, height: 660, title: l.title, desc: l.desc, shapes: s };
}

export function costNarrow(l: CostLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'lines', x: 8, y: 8, w: 344, h: 400, label: l.zone.lines, tone: 'providers' },
    { kind: 'zone', id: 'monitor', x: 8, y: 424, w: 344, h: 220, label: l.zone.monitor, tone: 'async' },
    { kind: 'zone', id: 'admin', x: 8, y: 660, w: 344, h: 300, label: l.zone.admin, tone: 'apps' },
  ];
  const n = (id: keyof CostLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind, shape?: NodeShape) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title });
  const col = (id: keyof CostLabels['node'], y: number, tone?: Tone, icon?: IconKind, shape?: NodeShape) => n(id, 24, y, 312, 48, tone, icon, shape);
  col('workers', 60, undefined, 'worker');
  col('r2', 120, undefined, 'bucket');
  col('containers', 180, undefined, 'container');
  col('bunny', 240, 'external', 'globe');
  col('resend', 300, 'external', 'mail');
  col('collector', 476, 'accent', 'chart');
  col('costsDb', 540, 'store', 'db', 'cylinder');
  col('costsPage', 712);
  col('alerts', 772, undefined, 'bell');
  col('budgetCap', 832, 'accent', 'shield');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('lines-monitor', 408, 424);
  down('monitor-admin', 644, 660);
  return { id: 'dg-cost-narrow', width: 360, height: 988, title: l.title, desc: l.narrowDesc, shapes: s };
}
