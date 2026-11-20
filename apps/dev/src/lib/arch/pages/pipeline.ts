/**
 * Video pipeline page, for developers (docs/SOURCES.md §2, AlUmmahNow origin/main af72873e3).
 * The copy is in src/i18n/sd/pipeline.*.ts; the identifiers below (routes, bindings, keys, calls)
 * are code, not copy, and read the same in both languages.
 */
import { stack, type ArchNode } from '../arch.ts';
import type { SeqStep } from '../seq.ts';
import type { Builder } from './types.ts';

type Copy = { name: string; role: string | string[] };
const node = (id: string, icon: string, c: Copy, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });
const CF = 'simple-icons/cloudflare';
const BUNNY_TAG = { id: 'brand/bunnynet-logo-dark', w: 66, h: 19 };

/** Who calls whom: both Workers and every binding on the path. */
const map: Builder = (d) => {
  const c = d.pages.pipeline.map;
  const n = c.node;
  const e = c.edge;
  const apiBinds = ['kv', 'records', 'rules', 'db', 'originals'];
  const mediaBinds = ['slots', 'transcoder', 'renditions'];
  return {
    kind: 'arch',
    spec: {
      id: 'vp-map',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('studio', 'lucide/laptop', n.studio, [0, 0]),
        node('player', 'lucide/play', n.player, [0, 2.6]),
        node('bunny', 'brand/bunny-stream', n.bunny, [0, 4.2]),
        node('api', 'cloudflare/workers', n.api, [1.35, 1.3]),
        node('kv', 'cloudflare/kv', n.kv, [2.7, 0]),
        node('records', 'cloudflare/r2', n.records, [3.8, 0]),
        node('rules', 'cloudflare/r2', n.rules, [2.7, 1.1]),
        node('db', 'cloudflare/d1', n.db, [3.8, 1.1]),
        node('originals', 'cloudflare/r2', n.originals, [2.7, 2.2]),
        node('queue', 'cloudflare/queues', n.queue, [1.35, 3.6]),
        node('media', 'cloudflare/workers', n.media, [2.7, 3.6]),
        node('slots', 'cloudflare/durable-objects', n.slots, [4.05, 3.6]),
        node('transcoder', 'cloudflare/containers', n.transcoder, [4.05, 4.7]),
        node('renditions', 'cloudflare/r2', n.renditions, [5.15, 4.7]),
      ],
      groups: [
        { id: 'apiBinds', label: c.group.api, members: apiBinds },
        { id: 'mediaBinds', label: c.group.media, members: mediaBinds },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: CF, members: ['api', 'apiBinds', 'queue', 'media', 'mediaBinds'] },
        { id: 'bunnyG', label: c.group.bunny, kind: 'platform', tagLogo: BUNNY_TAG, accent: '#f29b1d', members: ['bunny'] },
      ],
      edges: [
        { from: 'studio', to: 'api', flow: 'media', label: e.upload, fromSide: 'e', toSide: 'n' },
        { from: 'player', to: 'api', flow: 'request', label: e.play, fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'apiBinds', flow: 'request', label: e.binds, fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'bunny', flow: 'media', label: e.tee, fromSide: 's', toSide: 'e' },
        { from: 'api', to: 'queue', flow: 'async', label: e.send, fromSide: 's', toSide: 'n' },
        { from: 'queue', to: 'media', flow: 'async', label: e.consume, fromSide: 'e', toSide: 'w' },
        { from: 'media', to: 'slots', flow: 'control', label: e.lease, fromSide: 'e', toSide: 'w' },
        { from: 'media', to: 'transcoder', flow: 'media', label: e.start, fromSide: 's', toSide: 'w' },
        { from: 'transcoder', to: 'renditions', flow: 'media', label: e.write, fromSide: 'e', toSide: 'w' },
        { from: 'media', to: 'api', flow: 'control', label: e.events, fromSide: 'n', toSide: 'e' },
      ],
    },
    wide: { colW: 200, rowH: 120 },
    narrow: {
      colW: 186,
      rowH: 104,
      iconSize: 34,
      at: stack([
        [['studio', 'player'], 0],
        [['api'], 2.1],
        [['kv', 'records'], 1.75],
        [['rules', 'db'], 1.05],
        [['originals'], 1.05],
        [['queue', 'media'], 1.8],
        [['slots', 'transcoder'], 1.75],
        [['renditions'], 1.05],
        [['bunny'], 1.9],
      ]),
      edges: [
        { from: 'studio', to: 'api', flow: 'media', label: e.upload, fromSide: 's', toSide: 'w' },
        { from: 'player', to: 'api', flow: 'request', fromSide: 's', toSide: 'e' },
        { from: 'api', to: 'apiBinds', flow: 'request', label: e.binds, fromSide: 's', toSide: 'n' },
        { from: 'apiBinds', to: 'queue', flow: 'async', label: e.send, fromSide: 's', toSide: 'n' },
        { from: 'queue', to: 'media', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'media', to: 'mediaBinds', flow: 'media', label: e.start, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'bunny', flow: 'media', label: e.tee, fromSide: 'e', toSide: 'e' },
      ],
    },
  };
};

/** An upload, call by call. */
const upload: Builder = (d) => {
  const c = d.pages.pipeline.upload;
  const a = c.actor;
  const s = c.step;
  const steps: SeqStep[] = [
    { from: 'studio', to: 'api', label: s.initiate, code: 'POST /api/videos/upload/initiate', flow: 'request' },
    { from: 'api', to: 'kv', label: s.session, code: 'tus:session:<id>', flow: 'control' },
    { from: 'api', to: 'studio', label: s.sessionId, code: 'tusSessionId', flow: 'request', reply: true },
    { from: 'studio', to: 'api', label: s.create, code: 'POST /api/videos/tus', flow: 'media' },
    { from: 'studio', to: 'api', label: s.chunk, code: 'PATCH /api/videos/tus/:uploadId', flow: 'media' },
    { from: 'api', to: 'bunny', label: s.forward, code: 'body.tee() → Bunny TUS', flow: 'media' },
    { from: 'api', to: 'originals', label: s.copy, code: 'src/<id>/<uploadId>/<offset>', flow: 'media' },
    { note: s.resume, over: ['studio', 'api'] },
    { from: 'api', to: 'originals', label: s.manifest, code: 'src/<id>/manifest.json', flow: 'request' },
    { from: 'api', to: 'db', label: s.row, code: 'INSERT media_originals', flow: 'request' },
    { from: 'api', to: 'queue', label: s.enqueue, code: "TranscodeJobMessage { reason: 'upload' }", flow: 'async' },
  ];
  return {
    kind: 'seq',
    spec: {
      id: 'vp-upload',
      title: c.title,
      desc: c.desc,
      actors: [
        { id: 'studio', icon: 'lucide/laptop', ...a.studio },
        { id: 'api', icon: 'cloudflare/workers', ...a.api },
        { id: 'kv', icon: 'cloudflare/kv', ...a.kv },
        { id: 'originals', icon: 'cloudflare/r2', ...a.originals },
        { id: 'db', icon: 'cloudflare/d1', ...a.db },
        { id: 'queue', icon: 'cloudflare/queues', ...a.queue },
        { id: 'bunny', icon: 'brand/bunny-stream', ...a.bunny },
      ],
      groups: [{ id: 'cf', label: d.pages.pipeline.map.group.cf, members: ['api', 'kv', 'originals', 'db', 'queue'], tag: CF }],
      steps,
    },
    wide: { colW: 168, rowH: 54 },
    narrow: { colW: 52, rowH: 50, iconSize: 26 },
  };
};

/** A transcode, call by call. */
const transcode: Builder = (d) => {
  const c = d.pages.pipeline.transcode;
  const a = c.actor;
  const s = c.step;
  return {
    kind: 'seq',
    spec: {
      id: 'vp-transcode',
      title: c.title,
      desc: c.desc,
      actors: [
        { id: 'queue', icon: 'cloudflare/queues', ...a.queue },
        { id: 'media', icon: 'cloudflare/workers', ...a.media },
        { id: 'slots', icon: 'cloudflare/durable-objects', ...a.slots },
        { id: 'transcoder', icon: 'cloudflare/durable-objects', ...a.transcoder },
        { id: 'box', icon: 'cloudflare/containers', ...a.box },
        { id: 'renditions', icon: 'cloudflare/r2', ...a.renditions },
        { id: 'api', icon: 'cloudflare/workers', ...a.api },
      ],
      steps: [
        { from: 'queue', to: 'media', label: s.deliver, code: 'max_batch_size 1 · max_retries 8', flow: 'async' },
        { from: 'media', to: 'slots', label: s.acquire, code: 'TRANSCODE_SLOTS · acquire(videoId)', flow: 'control' },
        { note: s.wait, over: ['queue', 'slots'] },
        { from: 'media', to: 'transcoder', label: s.start, code: 'TRANSCODER.get(idFromName(videoId)).startJob(job)', flow: 'media' },
        { from: 'transcoder', to: 'box', label: s.post, code: 'POST http://container/jobs', flow: 'media' },
        { from: 'box', to: 'transcoder', label: s.source, code: 'GET source.internal', flow: 'media' },
        { from: 'box', to: 'renditions', label: s.write, code: 'PUT media.internal/{pub|priv}/<id>/<rev>/<rung>/seg_<n>.m4s', flow: 'media' },
        { from: 'transcoder', to: 'slots', label: s.renew, code: 'renew() · LEASE_MS', flow: 'control' },
        { from: 'transcoder', to: 'api', label: s.events, code: 'VIDEOS · POST /internal/media/events', flow: 'control' },
        { from: 'transcoder', to: 'slots', label: s.release, code: 'release()', flow: 'control' },
      ],
    },
    wide: { colW: 168, rowH: 54 },
    narrow: { colW: 52, rowH: 50, iconSize: 26 },
  };
};

/** A play, call by call. */
const play: Builder = (d) => {
  const c = d.pages.pipeline.play;
  const a = c.actor;
  const s = c.step;
  return {
    kind: 'seq',
    spec: {
      id: 'vp-play',
      title: c.title,
      desc: c.desc,
      actors: [
        { id: 'player', icon: 'lucide/play', ...a.player },
        { id: 'api', icon: 'cloudflare/workers', ...a.api },
        { id: 'rules', icon: 'cloudflare/r2', ...a.rules },
        { id: 'pub', icon: 'cloudflare/cache', ...a.pub },
        { id: 'media', icon: 'cloudflare/workers', ...a.media },
        { id: 'bunny', icon: 'brand/bunny-cdn', ...a.bunny },
      ],
      steps: [
        { from: 'player', to: 'api', label: s.ask, code: 'GET /api/videos/:id', flow: 'request' },
        { from: 'api', to: 'rules', label: s.rules, code: 'ops/media-delivery.json', flow: 'request' },
        { from: 'api', to: 'api', label: s.plan, code: 'effectiveRules() → planSources()', flow: 'control' },
        { from: 'api', to: 'player', label: s.sources, code: 'sources[] · playUrl = sources[0]', flow: 'request', reply: true },
        { from: 'player', to: 'pub', label: s.pub, code: 'GET /pub/<id>/<rev>/<rung>/seg_<n>.m4s', flow: 'delivery' },
        { from: 'player', to: 'media', label: s.priv, code: 'GET /priv/<token>/<id>/<rev>/<rung>/seg_<n>.m4s', flow: 'delivery' },
        { note: s.stall, over: ['player', 'api'] },
        { from: 'player', to: 'api', label: s.report, code: 'GET /api/videos/:id/playback?exclude=r2&reason=stall_timeout', flow: 'control' },
        { from: 'player', to: 'bunny', label: s.next, code: 'sources[1]', flow: 'delivery' },
      ],
    },
    wide: { colW: 186, rowH: 54 },
    narrow: { colW: 58, rowH: 50, iconSize: 26 },
  };
};

/** Queues on the path, and where failures go. */
const queues: Builder = (d) => {
  const c = d.pages.pipeline.queues;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'vp-queues',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('api', 'cloudflare/workers', n.api, [0, 1.1]),
        node('sweep', 'lucide/timer', n.sweep, [0, 0]),
        node('transcode', 'cloudflare/queues', n.transcode, [1.4, 0]),
        node('check', 'cloudflare/queues', n.check, [1.4, 1.1]),
        node('events', 'cloudflare/queues', n.events, [1.4, 2.2]),
        node('media', 'cloudflare/workers', n.media, [2.8, 0]),
        node('apiC', 'cloudflare/workers', n.apiC, [2.8, 1.1]),
        node('processor', 'cloudflare/workers', n.processor, [2.8, 2.2]),
        node('tdlq', 'cloudflare/queues', n.tdlq, [4.2, 0]),
        node('dlq', 'cloudflare/queues', n.dlq, [4.2, 1.65]),
      ],
      groups: [
        { id: 'queuesG', label: c.group.queues, members: ['transcode', 'check', 'events'] },
        { id: 'consumersG', label: c.group.consumers, members: ['media', 'apiC', 'processor'] },
        { id: 'dead', label: c.group.dead, members: ['tdlq', 'dlq'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: CF, members: ['api', 'sweep', 'queuesG', 'consumersG', 'dead'] },
      ],
      edges: [
        { from: 'api', to: 'transcode', flow: 'async', label: e.send, fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'check', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'events', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'sweep', to: 'transcode', flow: 'control', label: e.requeue, fromSide: 'e', toSide: 'w' },
        { from: 'transcode', to: 'media', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'check', to: 'apiC', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'events', to: 'processor', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'media', to: 'transcode', flow: 'control', label: e.wait, fromSide: 'n', toSide: 'n' },
        { from: 'media', to: 'tdlq', flow: 'control', label: e.giveUp, fromSide: 'e', toSide: 'w' },
        { from: 'apiC', to: 'dlq', flow: 'control', fromSide: 'e', toSide: 'w' },
        { from: 'processor', to: 'dlq', flow: 'control', label: e.giveUp, fromSide: 'e', toSide: 'w' },
        { from: 'dlq', to: 'processor', flow: 'async', label: e.read, fromSide: 's', toSide: 's' },
      ],
    },
    wide: { colW: 200, rowH: 120, pad: 44 },
    narrow: {
      colW: 186,
      rowH: 104,
      iconSize: 34,
      at: stack([
        [['api', 'sweep'], 0],
        [['transcode', 'check'], 1.75],
        [['events'], 1.05],
        [['media', 'apiC'], 1.8],
        [['processor'], 1.05],
        [['tdlq', 'dlq'], 1.8],
      ]),
      edges: [
        { from: 'api', to: 'transcode', flow: 'async', label: e.send, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'check', flow: 'async', fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'events', flow: 'async', fromSide: 'w', toSide: 'w' },
        { from: 'sweep', to: 'transcode', flow: 'control', label: e.requeue, fromSide: 's', toSide: 'e' },
        { from: 'transcode', to: 'media', flow: 'async', fromSide: 's', toSide: 'n' },
        { from: 'check', to: 'apiC', flow: 'async', fromSide: 's', toSide: 'n' },
        { from: 'events', to: 'processor', flow: 'async', fromSide: 's', toSide: 'n' },
        { from: 'media', to: 'tdlq', flow: 'control', label: e.giveUp, fromSide: 's', toSide: 'n' },
        { from: 'apiC', to: 'dlq', flow: 'control', fromSide: 's', toSide: 'n' },
        { from: 'processor', to: 'dlq', flow: 'control', fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

/** What a video is made of: the record, two tables and two key layouts. */
const model: Builder = (d) => {
  const c = d.pages.pipeline.model;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'vp-model',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('record', 'cloudflare/r2', n.record, [0, 0], { list: ['uploadStatus', 'processingIssue', 'processingCheck', 'media.providers.{bunny,r2}', 'r2.status · r2.rev · r2.access', 'r2.result.rungs[]', 'mediaOverride?'] }),
        node('jobs', 'cloudflare/d1', n.jobs, [1.35, 0], { list: ['video_id  PRIMARY KEY', 'job_id · status · access', 'reason · attempts', 'queued_at · started_at', 'ready_at · failed_at', 'container_seconds'] }),
        node('renditions', 'cloudflare/r2', n.renditions, [0, 1.75], { list: ['master.m3u8', '<rung>/index.m3u8', '<rung>/init.mp4', '<rung>/seg_<n>.m4s', 'video.mp4', 'thumb.jpg · preview.webp'] }),
        node('origRows', 'cloudflare/d1', n.origRows, [1.35, 1.75], { list: ['video_id  PRIMARY KEY', 'upload_id · bytes · parts', 'completed_at · deleted_at', 'keep'] }),
        node('originals', 'cloudflare/r2', n.originals, [2.7, 1.75], { list: ['<uploadId>/<offset>', 'manifest.json'] }),
      ],
      groups: [],
      edges: [
        { from: 'record', to: 'jobs', flow: 'request', label: e.job, fromSide: 'e', toSide: 'w' },
        { from: 'record', to: 'renditions', flow: 'media', label: e.rev, fromSide: 's', toSide: 'n' },
        { from: 'origRows', to: 'originals', flow: 'request', label: e.original, fromSide: 'e', toSide: 'w' },
      ],
    },
    wide: { colW: 250, rowH: 150 },
    narrow: {
      colW: 300,
      rowH: 270,
      iconSize: 32,
      at: stack(
        [
          [['record'], 0],
          [['renditions'], 1],
          [['jobs'], 1],
          [['origRows'], 1],
          [['originals'], 0.85],
        ],
        1,
      ),
      edges: [
        { from: 'record', to: 'renditions', flow: 'media', label: e.rev, fromSide: 's', toSide: 'n' },
        { from: 'record', to: 'jobs', flow: 'request', label: e.job, fromSide: 'e', toSide: 'e' },
        { from: 'origRows', to: 'originals', flow: 'request', label: e.original, fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

export const builders: Record<string, Builder> = { 'vp-map': map, 'vp-upload': upload, 'vp-transcode': transcode, 'vp-play': play, 'vp-queues': queues, 'vp-model': model };
