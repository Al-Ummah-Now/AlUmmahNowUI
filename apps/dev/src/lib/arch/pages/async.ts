/** Async work page diagrams (docs/SOURCES.md §5). */
import { stack, type ArchNode } from '../arch.ts';
import type { SketchEdge } from '../sketch.ts';
import type { Builder } from './types.ts';

const node = (id: string, icon: string, c: { name: string; role: string }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

const queues: Builder = (d) => {
  const c = d.pages.async.queues;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'async-queues',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('apiVideos', 'cloudflare/workers', n.apiVideos, [0, 1]),
        node('adminApi', 'cloudflare/workers', n.adminApi, [0, 2.5]),
        node('scheduler', 'cloudflare/workers', n.scheduler, [0, 4]),
        node('videosQ', 'cloudflare/queues', n.videosQ, [1.4, 0]),
        node('moderationQ', 'cloudflare/queues', n.moderationQ, [1.4, 1]),
        node('processingQ', 'cloudflare/queues', n.processingQ, [1.4, 2]),
        node('jobsQ', 'cloudflare/queues', n.jobsQ, [1.4, 3]),
        node('transcodeQ', 'cloudflare/queues', n.transcodeQ, [1.4, 4]),
        node('errorsQ', 'cloudflare/queues', n.errorsQ, [1.4, 5]),
        node('processor', 'cloudflare/workers', n.processor, [2.8, 0.5]),
        node('apiC', 'cloudflare/workers', n.apiC, [2.8, 2.5]),
        node('media', 'cloudflare/workers', n.media, [2.8, 4]),
        node('adminC', 'cloudflare/workers', n.adminC, [2.8, 5]),
        node('dlq', 'cloudflare/queues', n.dlq, [4.2, 2.5]),
        node('errorsPage', 'lucide/activity', n.errorsPage, [5.6, 2.5]),
      ],
      groups: [
        { id: 'producers', label: c.group.producers, caption: c.caption.producers, members: ['apiVideos', 'adminApi', 'scheduler'] },
        { id: 'queues', label: c.group.queues, caption: c.caption.queues, members: ['videosQ', 'moderationQ', 'processingQ', 'jobsQ', 'transcodeQ', 'errorsQ'] },
        { id: 'consumers', label: c.group.consumers, members: ['processor', 'apiC', 'media', 'adminC'] },
        { id: 'dead', label: c.group.dead, caption: c.caption.dead, members: ['dlq'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', members: ['producers', 'queues', 'consumers', 'dead', 'errorsPage'] },
      ],
      edges: [
        { from: 'producers', to: 'queues', flow: 'async', label: e.enqueue, fromSide: 'e', toSide: 'w' },
        { from: 'videosQ', to: 'processor', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'moderationQ', to: 'processor', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'processingQ', to: 'apiC', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'jobsQ', to: 'apiC', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'transcodeQ', to: 'media', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'errorsQ', to: 'adminC', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'consumers', to: 'dead', flow: 'control', label: e.giveUp, fromSide: 'e', toSide: 'w' },
        { from: 'dead', to: 'errorsPage', flow: 'control', label: e.flag, fromSide: 'e', toSide: 'w' },
        { from: 'errorsPage', to: 'processor', flow: 'control', label: e.replay, fromSide: 'n', toSide: 'e' },
      ],
    },
    wide: { colW: 200, rowH: 118 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      at: stack([
        [['apiVideos', 'adminApi'], 0],
        [['scheduler'], 1.05],
        [['videosQ', 'moderationQ'], 2.3],
        [['processingQ', 'jobsQ'], 1.05],
        [['transcodeQ', 'errorsQ'], 1.05],
        [['processor', 'apiC'], 2.3],
        [['media', 'adminC'], 1.05],
        [['dlq', 'errorsPage'], 2.3],
      ]),
      edges: [
        { from: 'producers', to: 'queues', flow: 'async', label: e.enqueue, fromSide: 's', toSide: 'n' },
        { from: 'queues', to: 'consumers', flow: 'async', fromSide: 's', toSide: 'n' },
        { from: 'consumers', to: 'dead', flow: 'control', label: e.giveUp, fromSide: 's', toSide: 'n' },
        { from: 'dead', to: 'errorsPage', flow: 'control', fromSide: 'e', toSide: 'w' },
        { from: 'errorsPage', to: 'consumers', flow: 'control', label: e.replay, fromSide: 'e', toSide: 'e' },
      ],
    },
  };
};

const fail: Builder = (d) => {
  const c = d.pages.async.fail;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'async-fail',
      title: c.title,
      desc: c.desc,
      motion: 'steps',
      hop: 1.1,
      nodes: [
        node('producer', 'cloudflare/workers', n.producer, [0, 0]),
        node('queue', 'cloudflare/queues', n.queue, [1.4, 0]),
        node('consumer', 'cloudflare/workers', n.consumer, [2.8, 0]),
        node('dlq', 'cloudflare/queues', n.dlq, [1.4, 1.35]),
        node('dlqConsumer', 'cloudflare/workers', n.dlqConsumer, [2.8, 1.35]),
        node('deadLetters', 'cloudflare/d1', n.deadLetters, [4.2, 1.35]),
        node('errorsPage', 'lucide/activity', n.errorsPage, [2.8, 2.7]),
        node('admin', 'lucide/user', n.admin, [4.2, 2.7]),
      ],
      groups: [],
      edges: [
        { from: 'producer', to: 'queue', flow: 'async', label: e.event, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'queue', to: 'consumer', flow: 'async', label: e.batch, step: 2, fromSide: 'e', toSide: 'w' },
        { from: 'consumer', to: 'queue', flow: 'control', label: e.retry, step: 3, fromSide: 'n', toSide: 'n' },
        { from: 'queue', to: 'dlq', flow: 'control', label: e.dead, step: 4, fromSide: 's', toSide: 'n' },
        { from: 'dlq', to: 'dlqConsumer', flow: 'async', label: e.read, step: 5, fromSide: 'e', toSide: 'w' },
        { from: 'dlqConsumer', to: 'deadLetters', flow: 'async', label: e.store, step: 6, fromSide: 'e', toSide: 'w' },
        { from: 'dlqConsumer', to: 'errorsPage', flow: 'control', label: e.flag, step: 6, fromSide: 's', toSide: 'n' },
        { from: 'admin', to: 'errorsPage', flow: 'request', label: e.replay, step: 7, fromSide: 'w', toSide: 'e' },
        { from: 'errorsPage', to: 'queue', flow: 'async', label: e.resend, step: 8, fromSide: 'w', toSide: 'w' },
      ],
    },
    wide: { colW: 210, rowH: 165, pad: 60 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      at: stack([
        [['producer'], 0],
        [['queue', 'dlq'], 1.9],
        [['consumer', 'dlqConsumer'], 2.1],
        [['errorsPage', 'deadLetters'], 1.9],
        [['admin'], 1.6],
      ]),
      edges: [
        { from: 'producer', to: 'queue', flow: 'async', label: e.event, step: 1, fromSide: 's', toSide: 'n' },
        { from: 'queue', to: 'consumer', flow: 'async', label: e.batch, step: 2, fromSide: 's', toSide: 'n' },
        { from: 'consumer', to: 'queue', flow: 'control', label: e.retry, step: 3, fromSide: 'w', toSide: 'w' },
        { from: 'queue', to: 'dlq', flow: 'control', step: 4, fromSide: 'e', toSide: 'w' },
        { from: 'dlq', to: 'dlqConsumer', flow: 'async', label: e.read, step: 5, fromSide: 's', toSide: 'n' },
        { from: 'dlqConsumer', to: 'deadLetters', flow: 'async', label: e.store, step: 6, fromSide: 's', toSide: 'n' },
        { from: 'dlqConsumer', to: 'errorsPage', flow: 'control', step: 6, fromSide: 'w', toSide: 'n' },
        { from: 'admin', to: 'errorsPage', flow: 'request', label: e.replay, step: 7, fromSide: 'n', toSide: 's' },
        { from: 'errorsPage', to: 'queue', flow: 'async', label: e.resend, step: 8, fromSide: 'w', toSide: 'w' },
      ],
    },
  };
};

const crons: Builder = (d) => {
  const c = d.pages.async.crons;
  const n = c.node;
  const at = (x: number, y: number) => [x, y] as [number, number];
  const spec = {
    id: 'async-crons',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      { id: 'scheduler', icon: 'cloudflare/workers', title: n.scheduler.title, note: n.scheduler.note, tone: 'green' as const, at: at(0, 0) },
      { id: 'apiVideos', icon: 'cloudflare/workers', title: n.apiVideos.title, note: n.apiVideos.note, tone: 'blue' as const, at: at(1, 0) },
      { id: 'processor', icon: 'cloudflare/workers', title: n.processor.title, note: n.processor.note, tone: 'yellow' as const, at: at(2, 0) },
      { id: 'adminApi', icon: 'cloudflare/workers', title: n.adminApi.title, note: n.adminApi.note, tone: 'pink' as const, at: at(0, 2) },
      { id: 'clock', icon: 'lucide/timer', title: n.clock.title, note: n.clock.note, tone: 'orange' as const, at: at(1, 1) },
      { id: 'status', icon: 'cloudflare/workers', title: n.status.title, note: n.status.note, tone: 'green' as const, at: at(2, 2) },
      { id: 'costMonitor', icon: 'cloudflare/workers', title: n.costMonitor.title, note: n.costMonitor.note, tone: 'blue' as const, at: at(1, 2) },
    ],
    edges: [
      { from: 'clock', to: 'scheduler', fromSide: 'w' as const, toSide: 's' as const, bend: 30 },
      { from: 'clock', to: 'apiVideos', fromSide: 'n' as const, toSide: 's' as const },
      { from: 'clock', to: 'processor', fromSide: 'e' as const, toSide: 's' as const, bend: -30 },
      { from: 'clock', to: 'adminApi', fromSide: 'w' as const, toSide: 'n' as const, bend: -30 },
      { from: 'clock', to: 'status', fromSide: 'e' as const, toSide: 'n' as const, bend: 30 },
      { from: 'clock', to: 'costMonitor', fromSide: 's' as const, toSide: 'n' as const },
    ] as SketchEdge[],
  };
  const order = ['scheduler', 'apiVideos', 'processor', 'adminApi', 'status', 'costMonitor'];
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 340, rowH: 190, nodeW: 270, cols: 3 },
    narrow: {
      colW: 300,
      rowH: 160,
      nodeW: 270,
      cols: 1,
      at: Object.fromEntries([['clock', at(0, 0)], ...order.map((id, i) => [id, at(0, i + 1)])]),
      edges: order.map((to, i) => ({ from: 'clock', to, fromSide: 'w' as const, toSide: 'w' as const, bend: 34 + i * 14 })),
    },
  };
};

export const builders: Record<string, Builder> = { 'async-queues': queues, 'async-fail': fail, 'async-crons': crons };
