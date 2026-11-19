/**
 * The overview redrawn in the reference-architecture style (sample 5): clients on the left, the
 * dashed Cloudflare platform boundary with Front end / APIs / Async groups, data stores on the
 * right, cross-cutting services along the bottom, CI/CD at bottom-left. Solid arrows carry
 * traffic, dashed arrows carry control. SOURCES.md §1.
 */
import type { RefShape, RefSpec } from '../reference.ts';

export interface RefOverviewLabels {
  title: string;
  desc: string;
  narrowDesc: string;
  heading: { clients: string; data: string; providers: string; cross: string };
  boundary: string;
  group: { front: string; frontCap: string; apis: string; apisCap: string; async: string; asyncCap: string; cicd: string };
  svc: Record<'browsers' | 'native' | 'tv' | 'www' | 'videos' | 'admin' | 'cms' | 'shortLinks' | 'apiVideos' | 'adminApi' | 'auth' | 'processor' | 'scheduler' | 'costMonitor' | 'media' | 'containers' | 'slots' | 'realtime' | 'status' | 'r2Records' | 'r2Media' | 'd1' | 'kv' | 'queues' | 'do' | 'analytics' | 'bunny' | 'resend' | 'qf' | 'workersAi' | 'identity' | 'monitoring' | 'secrets' | 'ci' | 'devops', string[]>;
  edge: { https: string; nativeHttps: string; fetch: string; events: string; bindings: string; sso: string; retry: string; deploy: string; ai: string; bunny: string; cronQueues: string };
}

export function refOverviewWide(l: RefOverviewLabels): RefSpec {
  const s: RefShape[] = [
    { kind: 'heading', id: 'h-clients', x: 40, y: 96, text: l.heading.clients },
    { kind: 'heading', id: 'h-data', x: 1176, y: 96, text: l.heading.data },
    { kind: 'heading', id: 'h-providers', x: 1176, y: 812, text: l.heading.providers },
    { kind: 'heading', id: 'h-cross', x: 220, y: 770, text: l.heading.cross },
    { kind: 'boundary', id: 'platform', x: 200, y: 70, w: 930, h: 640, label: l.boundary },
    { kind: 'group', id: 'front', x: 220, y: 112, w: 410, h: 200, title: l.group.front, caption: l.group.frontCap },
    { kind: 'group', id: 'apis', x: 220, y: 344, w: 410, h: 180, title: l.group.apis, caption: l.group.apisCap },
    { kind: 'group', id: 'async', x: 656, y: 112, w: 456, h: 412, title: l.group.async, caption: l.group.asyncCap },
    { kind: 'group', id: 'cicd', x: 24, y: 560, w: 150, h: 130, title: l.group.cicd },
  ];
  const svc = (id: keyof RefOverviewLabels['svc'], icon: string, x: number, y: number) =>
    s.push({ kind: 'service', id, icon: icon as never, x, y, name: l.svc[id] });
  svc('browsers', 'lucide/browser', 82, 116);
  svc('native', 'lucide/smartphone', 82, 226);
  svc('tv', 'lucide/tv', 82, 336);
  svc('www', 'simple-icons/astro', 282, 150);
  svc('videos', 'simple-icons/nextjs', 412, 150);
  svc('admin', 'simple-icons/nextjs', 542, 150);
  svc('cms', 'lucide/server', 282, 246);
  svc('shortLinks', 'cloudflare/workers', 412, 246);
  svc('apiVideos', 'cloudflare/workers', 282, 382);
  svc('adminApi', 'cloudflare/workers', 412, 382);
  svc('auth', 'lucide/key-round', 542, 382);
  svc('processor', 'cloudflare/workers', 716, 150);
  svc('scheduler', 'cloudflare/workers', 846, 150);
  svc('costMonitor', 'cloudflare/workers', 976, 150);
  svc('media', 'cloudflare/workers', 716, 262);
  svc('containers', 'cloudflare/containers', 846, 262);
  svc('slots', 'cloudflare/durable-objects', 976, 262);
  svc('realtime', 'cloudflare/durable-objects', 716, 388);
  svc('status', 'cloudflare/workers', 846, 388);
  svc('r2Records', 'cloudflare/r2', 1216, 116);
  svc('r2Media', 'cloudflare/r2', 1216, 216);
  svc('d1', 'cloudflare/d1', 1216, 316);
  svc('kv', 'cloudflare/kv', 1216, 416);
  svc('queues', 'cloudflare/queues', 1216, 516);
  svc('do', 'cloudflare/durable-objects', 1216, 616);
  svc('analytics', 'lucide/chart-line', 1216, 700);
  svc('bunny', 'brand/bunny-stream', 1216, 832);
  svc('resend', 'simple-icons/resend', 1330, 832);
  svc('qf', 'lucide/book-open', 1216, 932);
  svc('workersAi', 'cloudflare/workers-ai', 1330, 932);
  svc('identity', 'lucide/shield-check', 300, 800);
  svc('monitoring', 'lucide/activity', 560, 800);
  svc('secrets', 'cloudflare/secrets-store', 820, 800);
  svc('ci', 'simple-icons/githubactions', 76, 600);
  svc('devops', 'lucide/user', 76, 690);

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][], dashed?: boolean, labelAt?: [number, number], flow?: 'request' | 'upload' | 'response', stream?: boolean, durMs?: number) =>
    s.push({ kind: 'edge', id, from, to, via, label, dashed, labelAt, flow, stream, durMs });
  e('www-in', [82, 170], [220, 170], l.edge.https, undefined, false, [151, 160], 'request');
  e('native-in', [82, 280], [220, 430], l.edge.nativeHttps, [[150, 280], [150, 430]], false, [150, 355], 'request');
  e('front-apis', [412, 276], [412, 344], l.edge.fetch, undefined, false, undefined, 'request');
  e('apis-async', [630, 434], [656, 434], l.edge.events, undefined, false, undefined, 'upload');
  e('apis-data', [282, 382], [1216, 100], l.edge.bindings, [[282, 88], [1216, 88]], false, [749, 80], 'response', true);
  e('async-data', [1112, 340], [1188, 340], l.edge.bindings, undefined, false, undefined, 'upload', true);
  e('apis-bunny', [542, 458], [1216, 826], l.edge.bunny, [[542, 980], [1216, 980]], false, [879, 994], 'upload');
  e('apis-identity', [412, 524], [300, 796], l.edge.sso, [[412, 700], [300, 700]], false, [356, 692]);
  e('monitoring-retry', [560, 848], [716, 712], l.edge.retry, [[560, 880], [716, 880]], true, [638, 894]);
  e('ci-deploy', [130, 644], [220, 644], l.edge.deploy, undefined, true, [175, 634]);
  e('devops-sso', [40, 712], [40, 790], undefined, [[40, 760], [278, 760], [278, 796]]);
  e('async-ai', [976, 306], [1330, 930], l.edge.ai, [[976, 490], [1150, 490], [1150, 950], [1308, 950]], true, [1070, 502]);
  e('cron-queues', [846, 226], [1216, 516], l.edge.cronQueues, [[846, 528], [1216, 528]], false, [1030, 542]);
  return { id: 'rf-overview', width: 1400, height: 1010, title: l.title, desc: l.desc, shapes: s };
}

export function refOverviewNarrow(l: RefOverviewLabels): RefSpec {
  const s: RefShape[] = [
    { kind: 'heading', id: 'h-clients', x: 24, y: 24, text: l.heading.clients },
    { kind: 'boundary', id: 'platform', x: 8, y: 118, w: 344, h: 900, label: l.boundary },
    { kind: 'group', id: 'front', x: 20, y: 160, w: 320, h: 130, title: l.group.front, caption: l.group.frontCap },
    { kind: 'group', id: 'apis', x: 20, y: 310, w: 320, h: 130, title: l.group.apis, caption: l.group.apisCap },
    { kind: 'group', id: 'async', x: 20, y: 460, w: 320, h: 250, title: l.group.async, caption: l.group.asyncCap },
    { kind: 'heading', id: 'h-data', x: 24, y: 1040, text: l.heading.data },
    { kind: 'heading', id: 'h-providers', x: 24, y: 1420, text: l.heading.providers },
    { kind: 'heading', id: 'h-cross', x: 24, y: 1620, text: l.heading.cross },
    { kind: 'group', id: 'cicd', x: 8, y: 1780, w: 344, h: 120, title: l.group.cicd },
  ];
  const svc = (id: keyof RefOverviewLabels['svc'], icon: string, x: number, y: number) =>
    s.push({ kind: 'service', id, icon: icon as never, x, y, name: l.svc[id] });
  svc('browsers', 'lucide/browser', 70, 40);
  svc('native', 'lucide/smartphone', 180, 40);
  svc('tv', 'lucide/tv', 290, 40);
  svc('www', 'simple-icons/astro', 70, 186);
  svc('videos', 'simple-icons/nextjs', 180, 186);
  svc('admin', 'simple-icons/nextjs', 290, 186);
  svc('apiVideos', 'cloudflare/workers', 70, 336);
  svc('adminApi', 'cloudflare/workers', 180, 336);
  svc('auth', 'lucide/key-round', 290, 336);
  svc('processor', 'cloudflare/workers', 70, 486);
  svc('scheduler', 'cloudflare/workers', 180, 486);
  svc('costMonitor', 'cloudflare/workers', 290, 486);
  svc('media', 'cloudflare/workers', 70, 596);
  svc('containers', 'cloudflare/containers', 180, 596);
  svc('realtime', 'cloudflare/durable-objects', 290, 596);
  svc('r2Records', 'cloudflare/r2', 70, 1062);
  svc('r2Media', 'cloudflare/r2', 180, 1062);
  svc('d1', 'cloudflare/d1', 290, 1062);
  svc('kv', 'cloudflare/kv', 70, 1172);
  svc('queues', 'cloudflare/queues', 180, 1172);
  svc('do', 'cloudflare/durable-objects', 290, 1172);
  svc('analytics', 'lucide/chart-line', 180, 1282);
  svc('bunny', 'brand/bunny-stream', 70, 1442);
  svc('resend', 'simple-icons/resend', 180, 1442);
  svc('qf', 'lucide/book-open', 290, 1442);
  svc('workersAi', 'cloudflare/workers-ai', 180, 1552);
  svc('identity', 'lucide/shield-check', 70, 1660);
  svc('monitoring', 'lucide/activity', 180, 1660);
  svc('secrets', 'cloudflare/secrets-store', 290, 1660);
  svc('ci', 'simple-icons/githubactions', 70, 1810);
  svc('devops', 'lucide/user', 180, 1810);
  const e = (id: string, from: [number, number], to: [number, number], label?: string, dashed?: boolean, flow?: 'request' | 'upload' | 'response', stream?: boolean) =>
    s.push({ kind: 'edge', id, from, to, label, dashed, flow, stream });
  e('c-front', [70, 96], [70, 160], l.edge.https, false, 'request');
  e('front-apis', [70, 290], [70, 310], l.edge.fetch, false, 'request');
  e('apis-async', [70, 426], [70, 460], l.edge.events, false, 'upload');
  e('async-data', [180, 700], [180, 1040], l.edge.bindings, false, 'upload', true);
  e('ci-deploy', [70, 1870], [70, 1910], l.edge.deploy, true);
  return { id: 'rf-overview-narrow', width: 360, height: 1930, title: l.title, desc: l.narrowDesc, shapes: s };
}
