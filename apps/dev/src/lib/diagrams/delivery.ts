/**
 * Delivery & caching (system-design/delivery-caching). Three rails reach the viewer from one
 * video: the public R2 custom domain with a Cache Rule, the private path through the media
 * Worker with a token in the path, and Bunny's token-signed CDN. An "at the API" zone holds the
 * app-level caches. SOURCES.md §3.
 */
import type { DiagramShape, DiagramSpec, IconKind, Tone } from '../diagram.ts';

export interface DeliveryLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { rails: string; api: string };
  node: Record<'pub' | 'cdn' | 'cache' | 'priv' | 'privRoute' | 'edgeCache' | 'bunnyLib' | 'bunnyCdn' | 'viewers' | 'signer' | 'settings' | 'jwks' | 'share' | 'mp4', { title: string; sub?: string[] }>;
  edge: { serve: string; token: string; signed: string };
}

export function deliveryWide(l: DeliveryLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'rails', x: 16, y: 64, w: 980, h: 560, label: l.zone.rails, tone: 'data' },
    { kind: 'zone', id: 'api', x: 1016, y: 64, w: 248, h: 560, label: l.zone.api, tone: 'apps' },
  ];
  const n = (id: keyof DeliveryLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title, sub: l.node[id].sub });

  n('pub', 60, 110, 250, 60, 'store', 'bucket');
  n('cdn', 420, 110, 250, 60, undefined, 'cloud');
  n('cache', 420, 210, 250, 60, undefined, 'shield');
  n('priv', 60, 330, 250, 60, 'store', 'bucket');
  n('privRoute', 420, 330, 250, 60, undefined, 'worker');
  n('edgeCache', 420, 430, 250, 60, undefined, 'cloud');
  n('bunnyLib', 740, 110, 220, 60, 'external', 'globe');
  n('bunnyCdn', 740, 210, 220, 60, 'external', 'cloud');
  n('viewers', 60, 530, 900, 56, 'client', 'browser');
  n('signer', 1040, 110, 200, 64, 'accent', 'worker');
  n('settings', 1040, 206, 200, 56, undefined, 'gear');
  n('jwks', 1040, 282, 200, 56, undefined, 'lock');
  n('share', 1040, 358, 200, 56, undefined, 'link');
  n('mp4', 1040, 434, 200, 56, undefined, 'upload');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, labelAt?: [number, number], via?: [number, number][]) =>
    s.push({ kind: 'edge', id, from, to, label, labelAt, via });
  e('pub-cdn', [310, 140], [420, 140], l.edge.serve);
  e('cdn-cache', [545, 170], [545, 210]);
  e('cache-viewers', [420, 240], [330, 530], undefined, undefined, [[330, 240]]);
  e('priv-route', [310, 360], [420, 360], l.edge.token);
  e('route-cache', [545, 390], [545, 430]);
  e('edge-viewers', [545, 490], [545, 530]);
  e('lib-cdn', [850, 170], [850, 210]);
  e('bunny-viewers', [850, 270], [850, 530], l.edge.signed);
  return { id: 'dg-delivery', width: 1280, height: 660, title: l.title, desc: l.desc, shapes: s };
}

export function deliveryNarrow(l: DeliveryLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'rails', x: 8, y: 8, w: 344, h: 722, label: l.zone.rails, tone: 'data' },
    { kind: 'zone', id: 'api', x: 8, y: 754, w: 344, h: 460, label: l.zone.api, tone: 'apps' },
  ];
  const n = (id: keyof DeliveryLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title });
  const col = (id: keyof DeliveryLabels['node'], y: number, tone?: Tone, icon?: IconKind) => n(id, 24, y, 312, 48, tone, icon);
  col('pub', 60, 'store', 'bucket');
  col('cdn', 134, undefined, 'cloud');
  col('cache', 206, undefined, 'shield');
  col('priv', 286, 'store', 'bucket');
  col('privRoute', 360, undefined, 'worker');
  col('edgeCache', 432, undefined, 'cloud');
  col('bunnyLib', 506, 'external', 'globe');
  col('bunnyCdn', 578, 'external', 'cloud');
  col('viewers', 652, 'client', 'browser');
  col('signer', 798, 'accent', 'worker');
  col('settings', 862);
  col('jwks', 920);
  col('share', 978);
  col('mp4', 1036);

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('pub-cdn', 108, 134);
  down('cdn-cache', 182, 206);
  down('cache-priv', 254, 286);
  down('priv-route', 334, 360);
  down('route-cache', 408, 432);
  down('cache-lib', 480, 506);
  down('lib-cdn', 554, 578);
  down('cdn-viewers', 626, 652);
  return { id: 'dg-delivery-narrow', width: 360, height: 1236, title: l.title, desc: l.narrowDesc, shapes: s };
}
