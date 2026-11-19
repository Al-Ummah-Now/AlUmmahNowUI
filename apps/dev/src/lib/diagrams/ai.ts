/**
 * AI usage (system-design/ai). Where AI runs (moderation, categorise, captions, review, CMS
 * assist), the models by name, the shared daily neuron budget with reserve-and-settle, and the
 * guards: shadow mode first, AI never deletes, fixtures in tests, Quran text only from the
 * official source. SOURCES.md §8.
 */
import type { DiagramShape, DiagramSpec, IconKind, Tone } from '../diagram.ts';

export interface AiLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { inputs: string; models: string; outcomes: string; guards: string };
  node: Record<'content' | 'captions' | 'frames' | 'cmsDraft' | 'budget' | 'translate' | 'guard' | 'extensions' | 'whisper' | 'clef' | 'scout' | 'deepseek' | 'flags' | 'drafts' | 'holds' | 'suggest' | 'neverDeletes' | 'fixtures', { title: string; sub?: string[] }>;
  edge: { scan: string; capped: string; produce: string };
}

export function aiWide(l: AiLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'inputs', x: 16, y: 64, w: 260, h: 620, label: l.zone.inputs, tone: 'apps' },
    { kind: 'zone', id: 'models', x: 336, y: 64, w: 340, h: 620, label: l.zone.models, tone: 'ai' },
    { kind: 'zone', id: 'outcomes', x: 716, y: 64, w: 280, h: 620, label: l.zone.outcomes, tone: 'data' },
    { kind: 'zone', id: 'guards', x: 1036, y: 64, w: 228, h: 620, label: l.zone.guards, tone: 'obs' },
  ];
  const n = (id: keyof AiLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title, sub: l.node[id].sub });

  n('content', 36, 116, 220, 64, 'accent', 'worker');
  n('captions', 36, 226, 220, 64, undefined, 'film');
  n('frames', 36, 336, 220, 64, undefined, 'container');
  n('cmsDraft', 36, 446, 220, 64, undefined, 'worker');
  n('budget', 356, 116, 300, 64, 'accent', 'chart');
  n('translate', 356, 216, 300, 56, 'ai', 'ai');
  n('guard', 356, 288, 300, 56, 'ai', 'ai');
  n('extensions', 356, 360, 300, 56, 'ai', 'ai');
  n('whisper', 356, 432, 300, 56, 'ai', 'ai');
  n('clef', 356, 504, 300, 56, 'ai', 'ai');
  n('scout', 356, 576, 145, 56, 'ai', 'ai');
  n('deepseek', 511, 576, 145, 56, 'ai', 'ai');
  n('flags', 736, 116, 240, 64, undefined, 'chart');
  n('drafts', 736, 226, 240, 64, undefined, 'film');
  n('holds', 736, 336, 240, 64, undefined, 'shield');
  n('suggest', 736, 446, 240, 64, undefined, 'chart');
  n('neverDeletes', 1056, 116, 188, 100, undefined, 'shield');
  n('fixtures', 1056, 254, 188, 88, undefined, 'worker');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, labelAt?: [number, number]) =>
    s.push({ kind: 'edge', id, from, to, label, labelAt });
  e('scan', [256, 148], [356, 148], l.edge.scan, [306, 106]);
  e('capped', [356, 180], [356, 216], l.edge.capped, [470, 198]);
  e('produce', [656, 148], [736, 148], l.edge.produce, [696, 106]);
  return { id: 'dg-ai', width: 1280, height: 720, title: l.title, desc: l.desc, shapes: s };
}

export function aiNarrow(l: AiLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'inputs', x: 8, y: 8, w: 344, h: 300, label: l.zone.inputs, tone: 'apps' },
    { kind: 'zone', id: 'models', x: 8, y: 324, w: 344, h: 470, label: l.zone.models, tone: 'ai' },
    { kind: 'zone', id: 'outcomes', x: 8, y: 810, w: 344, h: 300, label: l.zone.outcomes, tone: 'data' },
    { kind: 'zone', id: 'guards', x: 8, y: 1134, w: 344, h: 300, label: l.zone.guards, tone: 'obs' },
  ];
  const n = (id: keyof AiLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title });
  const col = (id: keyof AiLabels['node'], y: number, tone?: Tone, icon?: IconKind) => n(id, 24, y, 312, 48, tone, icon);
  col('content', 60, 'accent', 'worker');
  col('captions', 120, undefined, 'film');
  col('frames', 180, undefined, 'container');
  col('cmsDraft', 240, undefined, 'worker');
  col('budget', 376, 'accent', 'chart');
  col('translate', 436, 'ai', 'ai');
  col('guard', 496, 'ai', 'ai');
  col('whisper', 556, 'ai', 'ai');
  col('clef', 616, 'ai', 'ai');
  col('scout', 676, 'ai', 'ai');
  col('flags', 862);
  col('drafts', 922, undefined, 'film');
  col('holds', 982, undefined, 'shield');
  col('neverDeletes', 1186, undefined, 'shield');
  col('fixtures', 1246, undefined, 'worker');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('inputs-models', 308, 324);
  down('models-outcomes', 794, 810);
  down('outcomes-guards', 1118, 1134);
  return { id: 'dg-ai-narrow', width: 360, height: 1478, title: l.title, desc: l.narrowDesc, shapes: s };
}
