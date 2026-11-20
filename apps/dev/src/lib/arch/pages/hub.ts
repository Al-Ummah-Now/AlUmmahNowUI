/** System design hub diagrams (docs/SOURCES.md §1): the common pattern, hand-drawn. */
import type { SketchSpec } from '../sketch.ts';
import type { Builder } from './types.ts';

const pattern: Builder = (d) => {
  const c = d.pages.hub.pattern;
  const n = c.node;
  const sk = (id: keyof typeof n, icon: string, tone: SketchSpec['nodes'][number]['tone'], at: [number, number]) => ({ id, icon, title: n[id].title, note: n[id].note, tone, at });
  const spec: SketchSpec = {
    id: 'hub-pattern',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      sk('clients', 'lucide/users', 'yellow', [0, 0]),
      sk('edge', 'cloudflare/cache', 'blue', [1, 0]),
      sk('workers', 'cloudflare/workers', 'orange', [2, 0]),
      sk('data', 'cloudflare/d1', 'green', [3, 0]),
      sk('ai', 'cloudflare/workers-ai', 'pink', [4, 0]),
      sk('queue', 'cloudflare/queues', 'pink', [2, 1]),
      sk('bg', 'cloudflare/workers', 'orange', [3, 1]),
      sk('container', 'cloudflare/containers', 'blue', [4, 1]),
    ],
    foot: [
      { id: 'logs', icon: 'cloudflare/logs', title: c.obs.logs },
      { id: 'errors', icon: 'lucide/activity', title: c.obs.errors },
      { id: 'rum', icon: 'lucide/gauge', title: c.obs.rum },
    ],
    edges: [
      { from: 'clients', to: 'edge', fromSide: 'e', toSide: 'w' },
      { from: 'edge', to: 'workers', fromSide: 'e', toSide: 'w' },
      { from: 'workers', to: 'data', fromSide: 'e', toSide: 'w' },
      { from: 'workers', to: 'queue', fromSide: 's', toSide: 'n', tag: c.tag.later, tone: 'pink' },
      { from: 'queue', to: 'bg', fromSide: 'e', toSide: 'w' },
      { from: 'bg', to: 'data', fromSide: 'n', toSide: 's' },
      { from: 'bg', to: 'ai', fromSide: 'n', toSide: 's' },
      { from: 'bg', to: 'container', fromSide: 'e', toSide: 'w' },
      { from: 'data', to: 'edge', fromSide: 'n', toSide: 'n', bend: 50, tag: c.tag.segments, tone: 'green' },
    ],
  };
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 270, rowH: 210, nodeW: 236, cols: 5, topGap: 44 },
    narrow: {
      colW: 300,
      rowH: 160,
      nodeW: 250,
      cols: 1,
      at: { clients: [0, 0], edge: [0, 1], workers: [0, 2], data: [0, 3], queue: [0, 4], bg: [0, 5], ai: [0, 6], container: [0, 7] },
      edges: [
        { from: 'clients', to: 'edge', fromSide: 's', toSide: 'n' },
        { from: 'edge', to: 'workers', fromSide: 's', toSide: 'n' },
        { from: 'workers', to: 'data', fromSide: 's', toSide: 'n' },
        // on a phone the single column leaves no room beside this curve inside the cloud: no tag here
        { from: 'workers', to: 'queue', fromSide: 'w', toSide: 'w', bend: 44 },
        { from: 'queue', to: 'bg', fromSide: 's', toSide: 'n' },
        { from: 'bg', to: 'data', fromSide: 'e', toSide: 'e', bend: 44 },
        { from: 'bg', to: 'ai', fromSide: 's', toSide: 'n' },
        { from: 'bg', to: 'container', fromSide: 'w', toSide: 'w', bend: 44 },
        { from: 'data', to: 'edge', fromSide: 'e', toSide: 'e', bend: 70 },
      ],
    },
  };
};

export const builders: Record<string, Builder> = { 'hub-pattern': pattern };
