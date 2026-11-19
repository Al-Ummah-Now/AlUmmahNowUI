/**
 * Release & quality (system-design/release). No hand deploys: a dated tag builds once, gates on
 * local E2E and the stage environment, promotes production at 0% before 100%, and can roll back
 * automatically. SOURCES.md §12.
 */
import type { DiagramShape, DiagramSpec, IconKind, Tone } from '../diagram.ts';

export interface ReleaseLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { build: string; gates: string; production: string };
  node: Record<'tag' | 'buildOnce' | 'localE2e' | 'stage' | 'stageE2e' | 'secrets' | 'zero' | 'smoke' | 'full' | 'rollback' | 'media' | 'statusPage', { title: string; sub?: string[] }>;
  edge: { gate: string; promote: string; watch: string };
}

export function releaseWide(l: ReleaseLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'build', x: 16, y: 64, w: 280, h: 560, label: l.zone.build, tone: 'apps' },
    { kind: 'zone', id: 'gates', x: 336, y: 64, w: 380, h: 560, label: l.zone.gates, tone: 'async' },
    { kind: 'zone', id: 'production', x: 756, y: 64, w: 508, h: 560, label: l.zone.production, tone: 'data' },
  ];
  const n = (id: keyof ReleaseLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title, sub: l.node[id].sub });

  n('tag', 36, 116, 240, 64, 'accent', 'upload');
  n('buildOnce', 36, 240, 240, 64, undefined, 'worker');
  n('localE2e', 356, 116, 340, 64, undefined, 'chart');
  n('stage', 356, 226, 340, 64, undefined, 'cloud');
  n('stageE2e', 356, 336, 340, 64, undefined, 'chart');
  n('secrets', 356, 446, 340, 64, undefined, 'shield');
  n('zero', 776, 116, 220, 64, 'accent', 'worker');
  n('smoke', 776, 226, 220, 64, undefined, 'pulse');
  n('full', 776, 336, 220, 64, 'accent', 'worker');
  n('rollback', 1024, 336, 220, 64, undefined, 'shield');
  n('media', 776, 446, 220, 64, undefined, 'film');
  n('statusPage', 1024, 446, 220, 64, undefined, 'pulse');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, labelAt?: [number, number]) =>
    s.push({ kind: 'edge', id, from, to, label, labelAt });
  e('tag-build', [156, 180], [156, 240]);
  e('build-local', [276, 148], [356, 148], l.edge.gate, [316, 106]);
  e('local-stage', [526, 180], [526, 226]);
  e('stage-e2e', [526, 290], [526, 336]);
  e('e2e-secrets', [526, 400], [526, 446]);
  e('gates-zero', [696, 148], [776, 148], l.edge.promote, [736, 106]);
  e('zero-smoke', [886, 180], [886, 226]);
  e('smoke-full', [886, 290], [886, 336]);
  e('full-rollback', [996, 368], [1024, 368], l.edge.watch, [1074, 404]);
  return { id: 'dg-release', width: 1280, height: 660, title: l.title, desc: l.desc, shapes: s };
}

export function releaseNarrow(l: ReleaseLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'build', x: 8, y: 8, w: 344, h: 220, label: l.zone.build, tone: 'apps' },
    { kind: 'zone', id: 'gates', x: 8, y: 244, w: 344, h: 400, label: l.zone.gates, tone: 'async' },
    { kind: 'zone', id: 'production', x: 8, y: 660, w: 344, h: 400, label: l.zone.production, tone: 'data' },
  ];
  const n = (id: keyof ReleaseLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title });
  const col = (id: keyof ReleaseLabels['node'], y: number, tone?: Tone, icon?: IconKind) => n(id, 24, y, 312, 48, tone, icon);
  col('tag', 60, 'accent', 'upload');
  col('buildOnce', 132, undefined, 'worker');
  col('localE2e', 296, undefined, 'chart');
  col('stage', 356, undefined, 'cloud');
  col('stageE2e', 416, undefined, 'chart');
  col('secrets', 476, undefined, 'shield');
  col('zero', 712, 'accent', 'worker');
  col('smoke', 772, undefined, 'pulse');
  col('full', 832, 'accent', 'worker');
  col('rollback', 892, undefined, 'shield');
  col('media', 952, undefined, 'film');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('tag-build', 108, 132);
  down('build-gates', 228, 244);
  down('gates-prod', 644, 660);
  return { id: 'dg-release-narrow', width: 360, height: 1080, title: l.title, desc: l.narrowDesc, shapes: s };
}
