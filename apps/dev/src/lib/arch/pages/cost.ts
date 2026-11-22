/** Cost page diagrams (docs/SOURCES.md §9); the stage-by-stage 'costs' figure lives in specs/costs.ts. */
import { stack, type ArchNode } from '../arch.ts';
import type { SketchEdge, SketchSpec } from '../sketch.ts';
import type { Builder } from './types.ts';

const node = (id: string, icon: string, c: { name: string; role: string | string[] }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

const monitor: Builder = (d) => {
  const c = d.pages.cost.monitor;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'cost-monitor',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('jobs', 'cloudflare/queues', n.jobs, [1.2, 0]),
        node('graphql', 'cloudflare/analytics', n.graphql, [2.5, 0]),
        node('cron', 'lucide/timer', n.cron, [0, 1.2]),
        node('worker', 'cloudflare/workers', n.worker, [1.2, 1.2]),
        node('d1', 'cloudflare/d1', n.d1, [2.5, 1.2]),
        node('api', 'cloudflare/workers', n.api, [3.8, 1.2]),
        node('page', 'simple-icons/nextjs', n.page, [5.1, 1.2]),
        node('mail', 'cloudflare/queues', n.mail, [3.8, 2.4]),
        node('bunny', 'brand/bunny-cdn', n.bunny, [1.2, 3.75]),
        node('resend', 'simple-icons/resend', n.resend, [3.8, 3.75]),
        node('admins', 'lucide/users', n.admins, [5.1, 3.75]),
      ],
      groups: [
        { id: 'collector', label: c.group.collector, members: ['cron', 'worker', 'jobs'] },
        { id: 'admin', label: c.group.admin, members: ['api', 'page', 'mail'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', members: ['collector', 'graphql', 'd1', 'admin'] },
        { id: 'bunnyNet', label: c.group.bunny, kind: 'platform', tagLogo: { id: 'brand/bunnynet-logo-dark', w: 66, h: 19 }, tagEnd: true, accent: '#f29b1d', members: ['bunny'] },
      ],
      edges: [
        { from: 'cron', to: 'worker', flow: 'control', label: e.wake, fromSide: 'e', toSide: 'w' },
        { from: 'worker', to: 'jobs', flow: 'async', label: e.jobs, fromSide: 'n', toSide: 's' },
        { from: 'worker', to: 'graphql', flow: 'request', label: e.usage, fromSide: 'e', toSide: 'w' },
        { from: 'worker', to: 'd1', flow: 'async', label: e.rows, fromSide: 'e', toSide: 'w' },
        { from: 'worker', to: 'bunny', flow: 'request', label: e.charges, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'd1', flow: 'request', label: e.read, fromSide: 'w', toSide: 'e' },
        { from: 'page', to: 'api', flow: 'request', fromSide: 'w', toSide: 'e' },
        { from: 'admins', to: 'page', flow: 'request', label: e.open, fromSide: 'n', toSide: 's' },
        { from: 'api', to: 'mail', flow: 'async', label: e.alert, fromSide: 's', toSide: 'n' },
        { from: 'mail', to: 'resend', flow: 'async', label: e.send, fromSide: 's', toSide: 'n' },
        { from: 'resend', to: 'admins', flow: 'delivery', label: e.email, fromSide: 'e', toSide: 'w' },
      ],
    },
    // the charges wire drops into Bunny's top: the bunny.net tag sits on the group's bottom edge, clear of it
    wide: { colW: 190, rowH: 150, tagBottom: ['bunnyNet'] },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 40,
      // the jobs queue sits under Cron: its wire leaves cost-monitor's bottom and turns in, beside the usage and rows
      // wires that drop from cost-monitor to the stores
      at: {
        ...stack([
          [['cron', 'worker'], 0],
          [['jobs'], 1.15],
          [['graphql', 'd1'], 1.85],
          [['page', 'api'], 1.95],
          [['mail'], 1.05],
          [['admins', 'resend'], 2.2],
          [['bunny'], 2.0],
        ]),
        jobs: [0, 1.15],
      },
      edges: [
        { from: 'cron', to: 'worker', flow: 'control', label: e.wake, fromSide: 'e', toSide: 'w' },
        { from: 'worker', to: 'jobs', flow: 'async', fromSide: 's', toSide: 'e' },
        { from: 'worker', to: 'graphql', flow: 'request', label: e.usage, fromSide: 's', toSide: 'n' },
        { from: 'worker', to: 'd1', flow: 'async', label: e.rows, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'd1', flow: 'request', label: e.read, fromSide: 'n', toSide: 's' },
        { from: 'page', to: 'api', flow: 'request', fromSide: 'e', toSide: 'w' },
        { from: 'api', to: 'mail', flow: 'async', label: e.alert, fromSide: 's', toSide: 'e' },
        { from: 'mail', to: 'resend', flow: 'async', label: e.send, fromSide: 's', toSide: 'n' },
        { from: 'resend', to: 'admins', flow: 'delivery', label: e.email, fromSide: 'w', toSide: 'e' },
        { from: 'admins', to: 'page', flow: 'request', label: e.open, fromSide: 'n', toSide: 's' },
        { from: 'worker', to: 'bunny', flow: 'request', label: e.charges, fromSide: 'e', toSide: 'e' },
      ],
    },
  };
};

const cheap: Builder = (d) => {
  const c = d.pages.cost.cheap;
  const n = c.node;
  const sk = (id: keyof typeof n, icon: string, tone: SketchSpec['nodes'][number]['tone'], at: [number, number]) => ({ id, icon, title: n[id].title, note: n[id].note, tone, at });
  const levers = ['containers', 'logs', 'rum', 'originals', 'ai', 'tests', 'dev'] as const;
  const spec: SketchSpec = {
    id: 'cost-cheap',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      sk('containers', 'cloudflare/containers', 'blue', [0, 0]),
      sk('logs', 'cloudflare/logs', 'blue', [1, 0]),
      sk('rum', 'lucide/gauge', 'blue', [2, 0]),
      sk('originals', 'cloudflare/r2', 'green', [0, 1]),
      sk('budget', 'lucide/receipt', 'orange', [1, 1]),
      sk('ai', 'cloudflare/workers-ai', 'green', [2, 1]),
      sk('tests', 'lucide/list-ordered', 'pink', [0.5, 2]),
      sk('dev', 'simple-icons/astro', 'pink', [1.5, 2]),
    ],
    edges: [
      { from: 'containers', to: 'budget', fromSide: 's', toSide: 'n', bend: -16 },
      { from: 'logs', to: 'budget', fromSide: 's', toSide: 'n' },
      { from: 'rum', to: 'budget', fromSide: 's', toSide: 'n', bend: 16 },
      { from: 'originals', to: 'budget', fromSide: 'e', toSide: 'w' },
      { from: 'ai', to: 'budget', fromSide: 'w', toSide: 'e' },
      { from: 'tests', to: 'budget', fromSide: 'n', toSide: 's', bend: -12 },
      { from: 'dev', to: 'budget', fromSide: 'n', toSide: 's', bend: 12 },
    ],
  };
  // one column: the budget on top, each lever's wire bows up through a margin at its own distance
  const narrowEdges: SketchEdge[] = levers.map((id, i) => {
    if (i === 0) return { from: id, to: 'budget', fromSide: 'n', toSide: 's' };
    const left = i % 2 === 1;
    // each side's wires nest down their own lanes, 14 px apart
    return { from: id, to: 'budget', fromSide: left ? 'w' : 'e', toSide: left ? 'w' : 'e', lane: 18 + Math.floor((i - 1) / 2) * 18 };
  });
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 360, rowH: 200, nodeW: 250, cols: 3 },
    narrow: {
      // tiles wide enough for the longest title with room inside its border («عيّنات سرعة الصفحات، ١ من ٢٠»)
      colW: 300,
      rowH: 160,
      nodeW: 276,
      cols: 1,
      at: Object.fromEntries([['budget', [0, 0]], ...levers.map((id, i) => [id, [0, i + 1]])]) as Record<string, [number, number]>,
      edges: narrowEdges,
    },
  };
};

export const builders: Record<string, Builder> = { 'cost-monitor': monitor, 'cost-cheap': cheap };
