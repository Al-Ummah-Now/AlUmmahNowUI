/**
 * The video pipeline diagram (system-design/video-pipeline). Two rails out of one upload
 * (Bunny Stream encode; our own original → transcode queue → media Worker → FFmpeg container →
 * R2 renditions), then one play URL chosen by the API — SOURCES.md §2. The dashed zone is the
 * Workers AI lanes (captions drafts, the Quran layer, review frames). Narrow: the same spine
 * stacked for phones.
 */
import type { DiagramShape, DiagramSpec, Tone } from '../diagram.ts';

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
    { kind: 'zone', id: 'upload', x: 16, y: 64, w: 1164, h: 140, label: l.zone.upload },
    { kind: 'zone', id: 'ai', x: 16, y: 240, w: 200, h: 506, label: l.zone.ai },
    { kind: 'zone', id: 'transcode', x: 240, y: 240, w: 940, h: 234, label: l.zone.transcode },
    { kind: 'zone', id: 'delivery', x: 240, y: 500, w: 940, h: 210, label: l.zone.delivery },
    { kind: 'zone', id: 'choice', x: 240, y: 742, w: 700, h: 120, label: l.zone.choice },
  ];
  const n = (id: keyof PipelineDiagramLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, title: l.node[id].title, sub: l.node[id].sub });

  n('creator', 32, 100, 190, 56, 'client');
  n('tus', 262, 100, 210, 56, 'accent');
  n('bunny', 520, 100, 180, 56, 'external');
  n('bunnyCdn', 760, 100, 220, 56, 'external');
  n('originals', 260, 296, 200, 56, 'store');
  n('queue', 500, 296, 220, 56, 'queue');
  n('media', 260, 380, 190, 64);
  n('slots', 486, 380, 200, 64);
  n('container', 716, 380, 290, 64);
  n('pub', 300, 536, 250, 60, 'store');
  n('priv', 830, 536, 250, 60, 'store');
  n('cdn', 300, 630, 250, 60);
  n('privRoute', 830, 630, 250, 60);
  n('choose', 280, 776, 260, 64, 'accent');
  n('players', 620, 776, 240, 64, 'client');
  n('whisper', 32, 292, 168, 64, 'ai');
  n('quran', 32, 372, 168, 64, 'ai');
  n('clef', 32, 452, 168, 64, 'ai');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][], dashed?: boolean) =>
    s.push({ kind: 'edge', id, from, to, via, label, dashed });
  e('https', [222, 128], [262, 128], l.edge.https);
  e('tee-bunny', [472, 128], [520, 128], l.edge.bytes);
  e('encode', [700, 128], [760, 128], l.edge.encode);
  e('tee-r2', [367, 156], [360, 296], l.edge.tee);
  e('ready', [460, 324], [500, 324], l.edge.ready);
  e('consume', [610, 352], [355, 380], l.edge.consume, [[610, 368], [355, 368]]);
  e('slot', [450, 412], [486, 412], l.edge.slot);
  e('run', [686, 412], [716, 412], l.edge.run);
  e('write-pub', [801, 444], [425, 536], l.edge.writePub, [[801, 464], [425, 464]]);
  e('write-priv', [921, 444], [921, 536], l.edge.writePriv);
  e('serve-pub', [425, 596], [425, 630], l.edge.serve);
  e('serve-priv', [955, 596], [955, 630], l.edge.servePriv);
  e('if-r2', [425, 690], [425, 776], l.edge.ifR2);
  e('if-bunny', [870, 156], [490, 776], l.edge.ifBunny, [[870, 172], [1204, 172], [1204, 730], [490, 730]]);
  e('play', [540, 846], [620, 846], l.edge.playUrl);
  e('fallback', [620, 812], [540, 812], l.edge.fallback, undefined, true);
  e('ai-feeds', [260, 324], [200, 324], l.edge.aiFeeds, undefined, true);

  return { id: 'dg-pipeline', width: 1280, height: 894, title: l.title, desc: l.desc, shapes: s };
}

export function pipelineNarrow(l: PipelineDiagramLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'upload', x: 8, y: 8, w: 344, h: 232, label: l.zone.upload },
    { kind: 'zone', id: 'transcode', x: 8, y: 256, w: 344, h: 296, label: l.zone.transcode },
    { kind: 'zone', id: 'delivery', x: 8, y: 568, w: 344, h: 200, label: l.zone.delivery },
    { kind: 'zone', id: 'choice', x: 8, y: 784, w: 344, h: 196, label: l.zone.choice },
    { kind: 'zone', id: 'ai', x: 8, y: 996, w: 344, h: 176, label: l.zone.ai },
  ];
  const n = (id: keyof PipelineDiagramLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, title: l.node[id].title });
  n('creator', 24, 44, 312, 44, 'client');
  n('tus', 24, 96, 312, 44, 'accent');
  n('bunny', 24, 156, 152, 56, 'external');
  n('originals', 184, 156, 152, 56, 'store');
  n('queue', 24, 292, 312, 44, 'queue');
  n('media', 24, 344, 312, 44);
  n('slots', 24, 396, 312, 44);
  n('container', 24, 448, 312, 56);
  n('pub', 24, 604, 152, 56, 'store');
  n('priv', 184, 604, 152, 56, 'store');
  n('cdn', 24, 668, 152, 56);
  n('privRoute', 184, 668, 152, 56);
  n('choose', 24, 820, 312, 56, 'accent');
  n('players', 24, 884, 312, 56, 'client');
  n('whisper', 24, 1032, 152, 48, 'ai');
  n('quran', 184, 1032, 152, 48, 'ai');
  n('clef', 24, 1088, 312, 48, 'ai');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][], dashed?: boolean) =>
    s.push({ kind: 'edge', id, from, to, via, label, dashed });
  e('https', [180, 88], [180, 96], l.edge.https);
  e('tee-bunny', [100, 140], [100, 156], l.edge.bytes);
  e('tee-r2', [260, 140], [260, 156], l.edge.tee);
  e('ready', [260, 212], [180, 292], l.edge.ready, [[260, 268], [180, 268]]);
  e('consume', [180, 336], [180, 344], l.edge.consume);
  e('slot', [180, 388], [180, 396], l.edge.slot);
  e('run', [180, 440], [180, 448], l.edge.run);
  e('write-pub', [100, 504], [100, 604], l.edge.writePub);
  e('write-priv', [260, 504], [260, 604], l.edge.writePriv);
  e('serve-pub', [100, 660], [100, 668], l.edge.serve);
  e('serve-priv', [260, 660], [260, 668], l.edge.servePriv);
  e('if-r2', [100, 724], [180, 820], l.edge.ifR2, [[100, 744], [180, 744]]);
  e('play', [180, 876], [180, 884], l.edge.playUrl);
  return { id: 'dg-pipeline-narrow', width: 360, height: 1204, title: l.title, desc: l.narrowDesc, shapes: s };
}
