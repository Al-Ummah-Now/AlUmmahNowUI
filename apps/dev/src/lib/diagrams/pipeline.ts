/**
 * The video pipeline diagram (system-design/video-pipeline). Two rails out of one upload
 * (Bunny Stream encode; our own original → transcode queue → media Worker → FFmpeg container →
 * R2 renditions), then one play URL chosen by the API — SOURCES.md §2. The dashed zone is the
 * Workers AI lanes (captions drafts, the Quran layer, review frames). Narrow: the same spine
 * stacked for phones.
 */
import type { DiagramShape, DiagramSpec, IconKind, NodeShape, Tone } from '../diagram.ts';

export interface PipelineNodeLabels {
  title: string;
  sub?: string[];
}
export interface PipelineDiagramLabels {
  title: string;
  desc: string;
  narrowDesc: string;
  zone: { upload: string; ai: string; transcode: string; delivery: string; choice: string };
  node: Record<
    | 'creator' | 'tus' | 'bunny' | 'bunnyCdn'
    | 'originals' | 'queue' | 'media' | 'slots' | 'container'
    | 'pub' | 'priv' | 'cdn' | 'privRoute'
    | 'choose' | 'players'
    | 'whisper' | 'quran' | 'clef',
    PipelineNodeLabels
  >;
  edge: {
    https: string;
    bytes: string;
    encode: string;
    tee: string;
    ready: string;
    consume: string;
    slot: string;
    run: string;
    writePub: string;
    writePriv: string;
    serve: string;
    servePriv: string;
    ifR2: string;
    ifBunny: string;
    playUrl: string;
    fallback: string;
    aiFeeds: string;
  };
}

export function pipelineWide(l: PipelineDiagramLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'upload', x: 16, y: 64, w: 1164, h: 140, label: l.zone.upload, tone: 'apps' },
    { kind: 'zone', id: 'ai', x: 16, y: 240, w: 200, h: 506, label: l.zone.ai, tone: 'ai' },
    { kind: 'zone', id: 'transcode', x: 240, y: 240, w: 940, h: 234, label: l.zone.transcode, tone: 'async' },
    { kind: 'zone', id: 'delivery', x: 240, y: 500, w: 940, h: 210, label: l.zone.delivery, tone: 'data' },
    { kind: 'zone', id: 'choice', x: 240, y: 742, w: 700, h: 150, label: l.zone.choice, tone: 'apps' },
  ];
  const n = (
    id: keyof PipelineDiagramLabels['node'],
    x: number,
    y: number,
    w: number,
    h: number,
    tone?: Tone,
    icon?: IconKind,
    shape?: NodeShape,
  ) => s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title, sub: l.node[id].sub });

  n('creator', 32, 100, 190, 56, 'client', 'person');
  n('tus', 262, 100, 210, 56, 'accent', 'upload');
  n('bunny', 520, 100, 180, 56, 'external', 'globe');
  n('bunnyCdn', 760, 100, 220, 56, 'external', 'cloud');
  n('originals', 260, 296, 200, 56, 'store', 'bucket');
  n('queue', 500, 296, 220, 56, 'queue', 'queue', 'pipe');
  n('media', 260, 380, 190, 64, undefined, 'film');
  n('slots', 486, 380, 200, 64, undefined, 'do');
  n('container', 716, 380, 290, 64, undefined, 'container');
  n('pub', 300, 536, 250, 60, 'store', 'bucket');
  n('priv', 830, 536, 250, 60, 'store', 'bucket');
  n('cdn', 300, 630, 250, 60, undefined, 'cloud');
  n('privRoute', 830, 630, 250, 60, undefined, 'worker');
  n('choose', 280, 776, 260, 64, 'accent', 'worker');
  n('players', 620, 776, 240, 64, 'client', 'play');
  n('whisper', 32, 292, 168, 64, 'ai', 'ai');
  n('quran', 32, 372, 168, 64, 'ai', 'book');
  n('clef', 32, 452, 168, 64, 'ai', 'ai');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][], dashed?: boolean, labelAt?: [number, number]) =>
    s.push({ kind: 'edge', id, from, to, via, label, dashed, labelAt });
  e('https', [222, 128], [262, 128], l.edge.https, undefined, undefined, [242, 176]);
  e('tee-bunny', [472, 128], [520, 128], l.edge.bytes, undefined, undefined, [496, 176]);
  e('encode', [700, 128], [760, 128], l.edge.encode, undefined, undefined, [730, 176]);
  e('tee-r2', [367, 156], [360, 296], l.edge.tee, undefined, undefined, [367, 224]);
  e('ready', [460, 324], [500, 324], l.edge.ready, undefined, undefined, [480, 282]);
  e('consume', [610, 352], [355, 380], l.edge.consume, [[610, 368], [355, 368]]);
  e('slot', [450, 412], [486, 412], l.edge.slot, undefined, undefined, [468, 368]);
  e('run', [686, 412], [716, 412], l.edge.run, undefined, undefined, [701, 368]);
  e('write-pub', [801, 444], [425, 536], l.edge.writePub, [[801, 464], [425, 464]], undefined, [613, 464]);
  e('write-priv', [921, 444], [921, 536], l.edge.writePriv);
  e('serve-pub', [425, 596], [425, 630], l.edge.serve);
  e('serve-priv', [955, 596], [955, 630], l.edge.servePriv);
  e('if-r2', [425, 690], [425, 776], l.edge.ifR2);
  e('if-bunny', [870, 156], [490, 776], l.edge.ifBunny, [[870, 172], [1204, 172], [1204, 730], [490, 730]]);
  e('play', [540, 846], [620, 846], l.edge.playUrl, undefined, undefined, [580, 868]);
  e('fallback', [620, 812], [540, 812], l.edge.fallback, undefined, true, [830, 760]);
  e('ai-feeds', [260, 324], [216, 324], l.edge.aiFeeds, undefined, true, [116, 281]);

  return { id: 'dg-pipeline', width: 1280, height: 924, title: l.title, desc: l.desc, shapes: s };
}

export function pipelineNarrow(l: PipelineDiagramLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'upload', x: 8, y: 8, w: 344, h: 232, label: l.zone.upload, tone: 'apps' },
    { kind: 'zone', id: 'transcode', x: 8, y: 256, w: 344, h: 296, label: l.zone.transcode, tone: 'async' },
    { kind: 'zone', id: 'delivery', x: 8, y: 568, w: 344, h: 200, label: l.zone.delivery, tone: 'data' },
    { kind: 'zone', id: 'choice', x: 8, y: 784, w: 344, h: 196, label: l.zone.choice, tone: 'apps' },
    { kind: 'zone', id: 'ai', x: 8, y: 996, w: 344, h: 176, label: l.zone.ai, tone: 'ai' },
  ];
  const n = (id: keyof PipelineDiagramLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind, shape?: NodeShape) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, shape, title: l.node[id].title });
  n('creator', 24, 44, 312, 44, 'client', 'person');
  n('tus', 24, 96, 312, 44, 'accent', 'upload');
  n('bunny', 24, 156, 152, 56, 'external', 'globe');
  n('originals', 184, 156, 152, 56, 'store', 'bucket');
  n('queue', 24, 292, 312, 44, 'queue', 'queue', 'pipe');
  n('media', 24, 344, 312, 44, undefined, 'film');
  n('slots', 24, 396, 312, 44, undefined, 'do');
  n('container', 24, 448, 312, 56, undefined, 'container');
  n('pub', 24, 604, 152, 56, 'store', 'bucket');
  n('priv', 184, 604, 152, 56, 'store', 'bucket');
  n('cdn', 24, 668, 152, 56, undefined, 'cloud');
  n('privRoute', 184, 668, 152, 56, undefined, 'worker');
  n('choose', 24, 820, 312, 56, 'accent', 'worker');
  n('players', 24, 884, 312, 56, 'client', 'play');
  n('whisper', 24, 1032, 152, 48, 'ai', 'ai');
  n('quran', 184, 1032, 152, 48, 'ai', 'book');
  n('clef', 24, 1088, 312, 48, 'ai', 'ai');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][], dashed?: boolean) =>
    s.push({ kind: 'edge', id, from, to, via, label, dashed });
  e('https', [180, 88], [180, 96]);
  e('tee-bunny', [100, 140], [100, 156]);
  e('tee-r2', [260, 140], [260, 156]);
  e('ready', [260, 212], [180, 292], undefined, [[260, 268], [180, 268]]);
  e('consume', [180, 336], [180, 344]);
  e('slot', [180, 388], [180, 396]);
  e('run', [180, 440], [180, 448]);
  e('write-pub', [100, 504], [100, 604], l.edge.writePub);
  e('write-priv', [260, 504], [260, 604], l.edge.writePriv);
  e('serve-pub', [100, 660], [100, 668]);
  e('serve-priv', [260, 660], [260, 668]);
  e('if-r2', [100, 724], [180, 820], l.edge.ifR2, [[100, 744], [180, 744]]);
  e('play', [180, 876], [180, 884]);
  return { id: 'dg-pipeline-narrow', width: 360, height: 1204, title: l.title, desc: l.narrowDesc, shapes: s };
}
