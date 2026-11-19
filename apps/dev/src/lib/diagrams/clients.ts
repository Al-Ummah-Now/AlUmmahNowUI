/**
 * Clients (system-design/clients). Browsers on the three web apps and embeds, the native viewer
 * and Studio apps (in development) on a shared Rust core, TVs through the device grant, and the
 * .NET bulk importer. SOURCES.md §11.
 */
import type { DiagramShape, DiagramSpec, IconKind, Tone } from '../diagram.ts';

export interface ClientsLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { web: string; native: string; importZone: string; platform: string };
  node: Record<'browser' | 'embeds' | 'apple' | 'android' | 'desktop' | 'tv' | 'core' | 'tools' | 'api' | 'auth' | 'remoteConfig' | 'shortLinks', { title: string; sub?: string[] }>;
  edge: { https: string; sso: string; link: string; feed: string };
}

export function clientsWide(l: ClientsLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'web', x: 16, y: 64, w: 300, h: 300, label: l.zone.web, tone: 'clients' },
    { kind: 'zone', id: 'native', x: 16, y: 400, w: 300, h: 380, label: l.zone.native, tone: 'clients' },
    { kind: 'zone', id: 'importZone', x: 1016, y: 64, w: 248, h: 380, label: l.zone.importZone, tone: 'providers' },
    { kind: 'zone', id: 'platform', x: 356, y: 400, w: 620, h: 380, label: l.zone.platform, tone: 'apps' },
  ];
  const n = (id: keyof ClientsLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title, sub: l.node[id].sub });

  n('browser', 36, 116, 260, 64, 'client', 'browser');
  n('embeds', 36, 226, 260, 64, 'client', 'play');
  n('apple', 36, 452, 130, 64, 'client', 'device');
  n('android', 186, 452, 130, 64, 'client', 'device');
  n('desktop', 36, 540, 130, 64, 'client', 'device');
  n('tv', 186, 540, 130, 64, 'client', 'device');
  n('core', 36, 628, 280, 56, 'accent', 'container');
  n('api', 480, 452, 230, 64, 'accent', 'worker');
  n('auth', 750, 452, 210, 64, 'accent', 'lock');
  n('remoteConfig', 480, 562, 230, 64, undefined, 'kv');
  n('shortLinks', 750, 562, 210, 64, undefined, 'link');
  n('tools', 1036, 116, 208, 76, 'external', 'upload');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, labelAt?: [number, number], dashed?: boolean, via?: [number, number][]) =>
    s.push({ kind: 'edge', id, from, to, label, labelAt, dashed, via });
  e('web-api', [296, 148], [356, 148], l.edge.https, [326, 106]);
  e('web-auth', [296, 258], [356, 258]);
  e('native-api', [316, 484], [480, 484]);
  e('core-desktop', [101, 628], [101, 604], undefined, undefined, true);
  e('core-tv', [251, 628], [251, 604], undefined, undefined, true);
  e('tools-platform', [1036, 154], [976, 500], undefined, undefined, undefined, [[1000, 154], [1000, 500]]);
  return { id: 'dg-clients', width: 1280, height: 820, title: l.title, desc: l.desc, shapes: s };
}

export function clientsNarrow(l: ClientsLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'web', x: 8, y: 8, w: 344, h: 220, label: l.zone.web, tone: 'clients' },
    { kind: 'zone', id: 'native', x: 8, y: 244, w: 344, h: 400, label: l.zone.native, tone: 'clients' },
    { kind: 'zone', id: 'platform', x: 8, y: 660, w: 344, h: 340, label: l.zone.platform, tone: 'apps' },
    { kind: 'zone', id: 'importZone', x: 8, y: 1024, w: 344, h: 220, label: l.zone.importZone, tone: 'providers' },
  ];
  const n = (id: keyof ClientsLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title });
  const col = (id: keyof ClientsLabels['node'], y: number, tone?: Tone, icon?: IconKind) => n(id, 24, y, 312, 48, tone, icon);
  col('browser', 60, 'client', 'browser');
  col('embeds', 120, 'client', 'play');
  col('apple', 296, 'client', 'device');
  col('android', 356, 'client', 'device');
  col('desktop', 416, 'client', 'device');
  col('tv', 476, 'client', 'device');
  col('core', 536, 'accent', 'container');
  col('api', 712, 'accent', 'worker');
  col('auth', 772, 'accent', 'lock');
  col('remoteConfig', 832);
  col('tools', 1076, 'external', 'upload');

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('web-native', 228, 244);
  down('native-platform', 644, 660);
  down('platform-import', 1008, 1024);
  return { id: 'dg-clients-narrow', width: 360, height: 1272, title: l.title, desc: l.narrowDesc, shapes: s };
}
