/** AI usage page diagrams (docs/SOURCES.md §8, §9a). */
import type { ArchNode } from '../arch.ts';
import type { Builder } from './types.ts';
import { aiChecksUsd, aiMeterLine, aiRateLine } from '../specs/costs.ts';

const node = (id: string, icon: string, c: { name: string; role: string | string[] }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

const map: Builder = (d, locale) => {
  const c = d.pages.ai.map;
  const n = c.node;
  const e = c.edge;
  const models = ['gemma', 'guard', 'scout', 'whisper', 'deepseek', 'clef'];
  return {
    kind: 'arch',
    spec: {
      id: 'ai-map',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('users', 'lucide/users', n.users, [0, 0.4]),
        node('creator', 'lucide/user', n.creator, [0, 1.6]),
        node('api', 'cloudflare/workers', n.api, [1.3, 1]),
        node('queue', 'cloudflare/queues', n.queue, [2.5, 1]),
        node('processor', 'cloudflare/workers', n.processor, [3.7, 1]),
        node('d1', 'cloudflare/d1', n.d1, [3.7, -0.4]),
        node('admin', 'cloudflare/workers', n.admin, [2.5, -0.4]),
        node('workersAi', 'cloudflare/workers-ai', n.workersAi, [4.95, 1], { rate: [aiRateLine(d.costs, locale), aiMeterLine(d.costs)], meter: { lane: 'ai', usd: aiChecksUsd() } }),
        node('cms', 'cloudflare/workers', n.cms, [4.95, 2.45]),
        node('gemma', 'lucide/sparkles', n.gemma, [6.3, -0.15]),
        node('guard', 'lucide/shield-check', n.guard, [7.9, -0.15]),
        node('scout', 'lucide/layers', n.scout, [6.3, 1]),
        node('whisper', 'lucide/radio', n.whisper, [7.9, 1]),
        node('deepseek', 'lucide/globe', n.deepseek, [6.3, 2.15]),
        node('clef', 'lucide/film', n.clef, [7.9, 2.15]),
      ],
      groups: [
        { id: 'models', label: c.group.models, caption: c.caption.models, members: models },
        // the account tag at the far end: the people's wires enter api-videos straight, not round the tag
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', tagEnd: true, members: ['api', 'queue', 'processor', 'd1', 'admin', 'cms', 'workersAi', 'models'] },
      ],
      edges: [
        { from: 'users', to: 'api', flow: 'request', label: e.text, fromSide: 'e', toSide: 'w' },
        { from: 'creator', to: 'api', flow: 'request', label: e.ask, fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'queue', flow: 'async', label: e.send, fromSide: 'e', toSide: 'w' },
        { from: 'queue', to: 'processor', flow: 'async', label: e.consume, fromSide: 'e', toSide: 'w' },
        { from: 'processor', to: 'd1', flow: 'control', label: e.budget, fromSide: 'n', toSide: 's' },
        { from: 'd1', to: 'admin', flow: 'request', label: e.signals, fromSide: 'w', toSide: 'e' },
        { from: 'processor', to: 'workersAi', flow: 'request', label: e.calls, fromSide: 'e', toSide: 'w' },
        { from: 'cms', to: 'workersAi', flow: 'request', label: e.assist, fromSide: 'n', toSide: 's' },
        { from: 'workersAi', to: 'models', flow: 'control', label: e.run, fromSide: 'e', toSide: 'w' },
      ],
    },
    wide: { colW: 200, rowH: 165, pad: 36 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 40,
      at: {
        users: [0, 0],
        creator: [1, 0],
        api: [0, 2.3],
        queue: [1, 2.3],
        d1: [0, 3.75],
        processor: [1, 3.75],
        admin: [0, 5.2],
        cms: [0, 6.9],
        workersAi: [1, 6.9],
        gemma: [0, 9.1],
        guard: [1, 9.1],
        scout: [0, 10.45],
        whisper: [1, 10.45],
        deepseek: [0, 11.8],
        clef: [1, 11.8],
      },
      edges: [
        { from: 'users', to: 'api', flow: 'request', label: e.text, fromSide: 's', toSide: 'n' },
        // both enter api-videos from above, side by side: no loop round the boundary tag
        { from: 'creator', to: 'api', flow: 'request', label: e.ask, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'queue', flow: 'async', fromSide: 'e', toSide: 'w' },
        { from: 'queue', to: 'processor', flow: 'async', label: e.consume, fromSide: 's', toSide: 'n' },
        { from: 'processor', to: 'd1', flow: 'control', label: e.budget, fromSide: 'w', toSide: 'e' },
        { from: 'd1', to: 'admin', flow: 'request', label: e.signals, fromSide: 's', toSide: 'n' },
        { from: 'processor', to: 'workersAi', flow: 'request', label: e.calls, fromSide: 's', toSide: 'n' },
        { from: 'cms', to: 'workersAi', flow: 'request', fromSide: 'e', toSide: 'w' },
        { from: 'workersAi', to: 'models', flow: 'control', label: e.run, fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

const scan: Builder = (d) => {
  const c = d.pages.ai.scan;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'ai-scan',
      title: c.title,
      desc: c.desc,
      motion: 'steps',
      hop: 1.1,
      nodes: [
        node('api', 'cloudflare/workers', n.api, [0, 1]),
        node('queue', 'cloudflare/queues', n.queue, [1.35, 1]),
        node('processor', 'cloudflare/workers', n.processor, [2.7, 1]),
        node('budget', 'cloudflare/d1', n.budget, [2.7, -0.5]),
        node('gemma', 'cloudflare/workers-ai', n.gemma, [4.3, -0.2]),
        node('guard', 'cloudflare/workers-ai', n.guard, [4.3, 1]),
        node('ext', 'cloudflare/workers-ai', n.ext, [4.3, 2.2]),
        node('signals', 'cloudflare/d1', n.signals, [2.7, 2.6]),
        node('admin', 'lucide/shield-check', n.admin, [1.35, 2.6]),
      ],
      groups: [
        { id: 'models', label: c.group.models, members: ['gemma', 'guard', 'ext'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', tagEnd: true, pad: 60, members: ['api', 'queue', 'processor', 'budget', 'models', 'signals', 'admin'] },
      ],
      edges: [
        { from: 'api', to: 'queue', flow: 'async', label: e.scan, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'queue', to: 'processor', flow: 'async', label: e.consume, step: 2, fromSide: 'e', toSide: 'w' },
        { from: 'processor', to: 'budget', flow: 'control', label: e.reserve, step: 3, fromSide: 'n', toSide: 's' },
        { from: 'processor', to: 'gemma', flow: 'request', label: e.translate, step: 4, fromSide: 'e', toSide: 'w' },
        { from: 'processor', to: 'guard', flow: 'request', step: 5, fromSide: 'e', toSide: 'w' },
        { from: 'processor', to: 'ext', flow: 'request', label: e.ext, step: 6, fromSide: 'e', toSide: 'w' },
        { from: 'processor', to: 'budget', flow: 'control', label: e.settle, step: 7, fromSide: 'n', toSide: 's' },
        { from: 'processor', to: 'signals', flow: 'async', label: e.decide, step: 8, fromSide: 's', toSide: 'n' },
        { from: 'signals', to: 'admin', flow: 'request', label: e.flag, step: 9, fromSide: 'w', toSide: 'e' },
      ],
    },
    wide: { colW: 300, rowH: 160, pad: 40 },
    narrow: {
      // the reserve and settle wires run side by side: a wider gap between the columns gives each its badge
      colW: 212,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      at: { api: [0, 0], queue: [1, 0], budget: [0, 1.7], processor: [1, 1.7], gemma: [1, 3.6], guard: [1, 4.95], ext: [1, 6.3], signals: [0, 4.95], admin: [0, 6.3] },
      edges: [
        { from: 'api', to: 'queue', flow: 'async', label: e.scan, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'queue', to: 'processor', flow: 'async', label: e.consume, step: 2, fromSide: 's', toSide: 'n' },
        { from: 'processor', to: 'budget', flow: 'control', label: e.reserve, step: 3, fromSide: 'w', toSide: 'e' },
        // the first model sits right under the processor: a straight drop; the other two nest down the end margin
        // (listed so the farther one takes the outer lane)
        { from: 'processor', to: 'gemma', flow: 'request', label: e.translate, step: 4, fromSide: 's', toSide: 'n' },
        { from: 'processor', to: 'guard', flow: 'request', step: 5, fromSide: 'e', toSide: 'e' },
        { from: 'processor', to: 'ext', flow: 'request', label: e.ext, step: 6, fromSide: 'e', toSide: 'e' },
        // settle returns under the tiles: two wires side by side have no room for both step badges
        { from: 'processor', to: 'signals', flow: 'async', label: e.decide, step: 8, fromSide: 's', toSide: 'n' },
        { from: 'processor', to: 'budget', flow: 'control', label: e.settle, step: 7, fromSide: 's', toSide: 's' },
        { from: 'signals', to: 'admin', flow: 'request', label: e.flag, step: 9, fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

const captions: Builder = (d) => {
  const c = d.pages.ai.captions;
  const n = c.node;
  const t = c.tag;
  const spec = {
    id: 'ai-captions',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      { id: 'creator', icon: 'lucide/user', title: n.creator.title, note: n.creator.note, tone: 'yellow' as const, at: [0, 0] as [number, number] },
      { id: 'whisper', icon: 'cloudflare/workers-ai', title: n.whisper.title, note: n.whisper.note, tone: 'orange' as const, at: [1, 0] as [number, number] },
      { id: 'index', icon: 'lucide/book-open', title: n.index.title, note: n.index.note, tone: 'blue' as const, at: [2, 0] as [number, number] },
      { id: 'suggest', icon: 'lucide/list-ordered', title: n.suggest.title, note: n.suggest.note, tone: 'blue' as const, at: [2, 1.5] as [number, number] },
      { id: 'confirmed', icon: 'lucide/scroll-text', title: n.confirmed.title, note: n.confirmed.note, tone: 'green' as const, at: [1, 1] as [number, number] },
      { id: 'uncertain', icon: 'lucide/search', title: n.uncertain.title, note: n.uncertain.note, tone: 'pink' as const, at: [1, 2] as [number, number] },
      { id: 'published', icon: 'lucide/play', title: n.published.title, note: n.published.note, tone: 'green' as const, at: [0, 1.5] as [number, number] },
    ],
    edges: [
      { from: 'creator', to: 'whisper', fromSide: 'e' as const, toSide: 'w' as const },
      { from: 'whisper', to: 'index', fromSide: 'e' as const, toSide: 'w' as const, tag: c.tag.draft, tone: 'orange' as const },
      { from: 'index', to: 'suggest', fromSide: 's' as const, toSide: 'n' as const },
      { from: 'suggest', to: 'confirmed', fromSide: 'w' as const, toSide: 'e' as const, bend: 20, tag: t.confirm, tone: 'green' as const, tagLevel: true },
      { from: 'suggest', to: 'uncertain', fromSide: 'w' as const, toSide: 'e' as const, bend: -20, tag: t.unsure, tone: 'pink' as const, tagLevel: true },
      { from: 'confirmed', to: 'published', fromSide: 'w' as const, toSide: 'e' as const, bend: 20 },
      { from: 'uncertain', to: 'published', fromSide: 'w' as const, toSide: 'e' as const, bend: -20 },
    ],
  };
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 390, rowH: 200, nodeW: 240, cols: 3 },
    narrow: {
      colW: 280,
      rowH: 205,
      nodeW: 250,
      cols: 1,
      at: { creator: [0, 0], whisper: [0, 1], index: [0, 2], suggest: [0, 3], confirmed: [0, 4], uncertain: [0, 5], published: [0, 6] },
      // one column: neighbours join straight down; the two skips bow out through opposite margins
      edges: [
        { from: 'creator', to: 'whisper', fromSide: 's', toSide: 'n' },
        { from: 'whisper', to: 'index', fromSide: 's', toSide: 'n', tag: t.draft, tone: 'orange' },
        { from: 'index', to: 'suggest', fromSide: 's', toSide: 'n' },
        { from: 'suggest', to: 'confirmed', fromSide: 's', toSide: 'n', tag: t.confirm, tone: 'green' },
        { from: 'suggest', to: 'uncertain', fromSide: 'e', toSide: 'e', bend: -46, dashed: true, tone: 'pink' },
        { from: 'confirmed', to: 'published', fromSide: 'w', toSide: 'w', bend: 46 },
        { from: 'uncertain', to: 'published', fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

export const builders: Record<string, Builder> = { 'ai-map': map, 'ai-scan': scan, 'ai-captions': captions };
