/**
 * Both pipelines side by side with what each stage costs (owner 2026-11-19): Bunny Stream, R2 on
 * Cloudflare Containers, and the checks every upload gets. Rates from lib/arch/cost.ts (every one
 * sourced); meters tick as the flow reaches each stage and every lane keeps a running total.
 */
import { stack, type ArchEdge, type ArchLayout, type ArchNode, type ArchSpec } from '../arch.ts';
import { ASSUMED, LANE_OF, RATES, SCENARIOS, asShown, costTable, money, type MoneyOptions, type Lane, type StageId } from '../cost.ts';
import { formatCount } from '../../../../../../packages/render/src/format.ts';
import type { diagramsEn } from '../../../i18n/diagrams.en.ts';

type Copy = typeof diagramsEn.costs;

/** A rate under 1 cent keeps 3 significant figures; otherwise 2 decimals. */
export function formatRate(locale: 'en' | 'ar', usd: number): string {
  const opt: MoneyOptions = usd !== 0 && usd < 0.01 ? { maximumSignificantDigits: 3 } : usd >= 0.1 || usd === 0 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 2, maximumFractionDigits: 3 };
  return money(usd, locale, opt);
}
// counts in a rate line come before what they count: «لكل ألف نيورون», «١٠ آلاف يوميًا»
const int = (locale: 'en' | 'ar', n: number) => formatCount(n, locale, { beforeNoun: true });

/** Fill a template's {placeholders} with locale-formatted numbers. */
export function fill(t: string, locale: 'en' | 'ar', vals: Record<string, { usd: number } | { n: number }>): string {
  return t.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vals[k];
    if (!v) return m;
    return 'usd' in v ? formatRate(locale, v.usd) : int(locale, v.n);
  });
}

/** The values every rate line uses. */
const RATE_VALUES: Record<StageId, Record<string, { usd: number } | { n: number }>> = {
  upload: { a: { usd: RATES.workerRequestPerMillion } },
  moderation: { a: { usd: RATES.usdPerNeuron * 1000 }, k: { n: 1000 }, free: { n: RATES.freeNeuronsPerDay } },
  captions: { a: { usd: RATES.whisperPerMinute } },
  quran: {},
  bunnyEncode: {},
  bunnyStore: { a: { usd: RATES.bunnyStorageGbMonthPerRegion }, n: { n: RATES.bunnyRegions } },
  bunnyDeliver: { a: { usd: RATES.bunnyDeliveryGb } },
  originals: { a: { usd: RATES.r2GbMonth }, d1: { n: 30 }, d2: { n: 90 } },
  queue: { a: { usd: RATES.queueOperationsPerMillion } },
  slots: { a: { usd: RATES.doRequestPerMillion } },
  transcode: { a: { usd: RATES.containerSecond * 3600 } },
  renditions: { a: { usd: RATES.r2GbMonth }, b: { usd: RATES.r2ClassAPerMillion } },
  r2Deliver: { z: { usd: RATES.r2EgressGb }, b: { usd: RATES.r2ClassBPerMillion } },
};

export function rateLines(c: Copy, locale: 'en' | 'ar', stage: StageId): string[] {
  return c.rate[stage].map((t) => fill(t, locale, RATE_VALUES[stage]));
}

export function scenarioLabels(c: Copy, locale: 'en' | 'ar'): { id: string; label: string }[] {
  const one = SCENARIOS[0]!;
  return SCENARIOS.map((s) => ({
    id: s.id,
    label: fill(c.scenario[s.id], locale, s.id === 'one' ? { m: { n: one.videoMinutes }, n: { n: Math.round((one.viewerHours * 60) / one.videoMinutes) } } : { h: { n: s.videoMinutes / 60 }, vh: { n: s.viewerHours } }),
  }));
}

const ICON: Record<StageId, string> = {
  upload: 'cloudflare/workers',
  moderation: 'cloudflare/workers-ai',
  captions: 'lucide/scroll-text',
  quran: 'lucide/book-open',
  bunnyEncode: 'brand/bunny-stream',
  bunnyStore: 'brand/bunny-stream',
  bunnyDeliver: 'brand/bunny-cdn',
  originals: 'cloudflare/r2',
  queue: 'cloudflare/queues',
  slots: 'cloudflare/durable-objects',
  transcode: 'cloudflare/containers',
  renditions: 'cloudflare/r2',
  r2Deliver: 'cloudflare/cache',
};

const LANES: Record<Lane, StageId[]> = {
  bunny: ['bunnyEncode', 'bunnyStore', 'bunnyDeliver'],
  r2: ['originals', 'queue', 'slots', 'transcode', 'renditions', 'r2Deliver'],
  shared: ['moderation', 'captions', 'quran'],
};
const TOTAL: Record<Lane, 'totalBunny' | 'totalR2' | 'totalShared'> = { bunny: 'totalBunny', r2: 'totalR2', shared: 'totalShared' };

export function costs(c: Copy, locale: 'en' | 'ar'): { spec: ArchSpec; wide: ArchLayout; narrow: ArchLayout } {
  const table = costTable();
  const laneTotal = (lane: Lane) => {
    const out: Record<string, number | null> = {};
    for (const s of SCENARIOS) out[s.id] = (Object.keys(LANE_OF) as StageId[]).filter((st) => LANE_OF[st] === lane).reduce((sum, st) => sum + asShown(table[st][s.id] ?? 0), 0);
    return out;
  };
  const stageNode = (st: StageId, at: [number, number]): ArchNode => ({
    id: st,
    icon: ICON[st],
    name: c.node[st].name,
    role: c.node[st].role,
    rate: rateLines(c, locale, st),
    meter: { lane: LANE_OF[st], usd: table[st] },
    at,
  });
  const totalNode = (lane: Lane, at: [number, number]): ArchNode => ({ id: TOTAL[lane], icon: 'lucide/receipt', name: c.node[TOTAL[lane]].name, role: c.node[TOTAL[lane]].role, total: { lane, usd: laneTotal(lane) }, at });

  // the Cloudflare boundary's title sits inside its top: room between it and the Bunny lane above
  const nodes: ArchNode[] = [stageNode('upload', [0, 1.4])];
  const rows: Record<Lane, number> = { bunny: 0, r2: 1.4, shared: 2.6 };
  // every lane spans the R2 lane's width: a shorter lane spreads its stages out, and the three totals stand in one
  // column at the end (no empty half-rows on a wide screen)
  const span = LANES.r2.length - 1;
  for (const lane of ['bunny', 'r2', 'shared'] as Lane[]) {
    const step = span / (LANES[lane].length - 1);
    LANES[lane].forEach((st, i) => nodes.push(stageNode(st, [1.2 + i * step, rows[lane]])));
    nodes.push(totalNode(lane, [1.2 + span + 1.15, rows[lane]]));
  }
  // the flow: the upload feeds all three lanes at once, then each lane hops along
  const edges: ArchEdge[] = [];
  const flowOf: Record<Lane, ArchEdge['flow']> = { bunny: 'delivery', r2: 'media', shared: 'request' };
  for (const lane of ['bunny', 'r2', 'shared'] as Lane[]) {
    const chain = [...LANES[lane], TOTAL[lane]];
    edges.push({ from: 'upload', to: chain[0]!, flow: lane === 'r2' ? 'media' : lane === 'bunny' ? 'media' : 'request', step: 1, fromSide: lane === 'bunny' ? 'n' : lane === 'shared' ? 's' : 'e', toSide: 'w' });
    for (let i = 1; i < chain.length; i++) {
      const last = i === chain.length - 1;
      const into = chain[i]!;
      const flow = into === 'bunnyDeliver' || into === 'r2Deliver' ? 'delivery' : last ? (lane === 'shared' ? 'request' : 'media') : lane === 'shared' ? 'request' : into === 'queue' ? 'async' : flowOf[lane] === 'delivery' ? 'media' : 'media';
      edges.push({ from: chain[i - 1]!, to: into, flow, step: i + 1, fromSide: 'e', toSide: 'w' });
    }
  }
  const spec: ArchSpec = {
    id: 'costs',
    title: c.title,
    desc: c.desc,
    motion: 'steps',
    hop: 1.15,
    badges: false,
    nodes,
    groups: [
      { id: 'laneBunny', label: c.lane.bunny, kind: 'platform', tagLogo: { id: 'brand/bunnynet-logo-dark', w: 66, h: 19 }, accent: '#f29b1d', members: [...LANES.bunny, TOTAL.bunny] },
      { id: 'laneR2', label: c.lane.r2, members: [...LANES.r2, TOTAL.r2] },
      { id: 'laneShared', label: c.lane.shared, members: [...LANES.shared, TOTAL.shared] },
      // room inside the account for the upload's wire round the R2 lane: it stays inside. The account's tag sits at the
      // far end of its top edge: the upload's wire rises straight up to the Bunny lane past the near corner
      { id: 'cf', label: c.lane.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', tagEnd: true, pad: 40, members: ['upload', 'laneR2', 'laneShared'] },
    ],
    edges,
  };
  // Arabic tiles are taller (Noto Naskh line boxes): more room between the lanes
  const wide: ArchLayout = { colW: 178, rowH: locale === 'ar' ? 222 : 196, iconSize: 34, nameSize: 13, roleSize: 11 };
  const narrow: ArchLayout = {
    colW: 182,
    rowH: 100,
    iconSize: 32,
    nameSize: 13,
    roleSize: 11,
    at: stack([
      // the Bunny lane reads upward from Encode, on the row nearest the upload, so each Upload wire ends on its lane's
      // first stage (as on a wide screen), never on a lane's border
      [['bunnyDeliver', 'totalBunny'], 0],
      [['bunnyEncode', 'bunnyStore'], 1.75],
      [['upload'], 2.75],
      [['originals', 'queue'], 2.5],
      [['slots', 'transcode'], 1.75],
      [['renditions', 'r2Deliver'], 1.75],
      [['totalR2'], 1.75],
      [['moderation', 'captions'], 2.4],
      [['quran'], 1.75],
      [['totalShared'], 1.75],
    ]),
    edges: [
      { from: 'upload', to: 'bunnyEncode', flow: 'media', step: 1, fromSide: 'n', toSide: 's' },
      { from: 'upload', to: 'originals', flow: 'media', step: 1, fromSide: 's', toSide: 'n' },
      { from: 'upload', to: 'moderation', flow: 'request', step: 1, fromSide: ['w', 'e'], toSide: ['w', 'e'] },
      { from: 'bunnyEncode', to: 'bunnyStore', flow: 'media', step: 2, fromSide: 'e', toSide: 'w' },
      { from: 'bunnyStore', to: 'bunnyDeliver', flow: 'delivery', step: 3, fromSide: 'n', toSide: 's' },
      { from: 'bunnyDeliver', to: 'totalBunny', flow: 'media', step: 4, fromSide: 'e', toSide: 'w' },
      { from: 'originals', to: 'queue', flow: 'async', step: 2, fromSide: 'e', toSide: 'w' },
      { from: 'queue', to: 'slots', flow: 'media', step: 3, fromSide: 's', toSide: 'n' },
      { from: 'slots', to: 'transcode', flow: 'media', step: 4, fromSide: 'e', toSide: 'w' },
      { from: 'transcode', to: 'renditions', flow: 'media', step: 5, fromSide: 's', toSide: 'n' },
      { from: 'renditions', to: 'r2Deliver', flow: 'delivery', step: 6, fromSide: 'e', toSide: 'w' },
      { from: 'r2Deliver', to: 'totalR2', flow: 'media', step: 7, fromSide: 's', toSide: 'n' },
      { from: 'moderation', to: 'captions', flow: 'request', step: 2, fromSide: 'e', toSide: 'w' },
      { from: 'captions', to: 'quran', flow: 'request', step: 3, fromSide: 's', toSide: 'n' },
      { from: 'quran', to: 'totalShared', flow: 'request', step: 4, fromSide: 's', toSide: 'n' },
    ],
  };
  return { spec, wide, narrow };
}

/** The AI check every upload gets (moderation), per example: the Workers AI meter in the design diagrams. Captions run only when a creator asks. */
export function aiChecksUsd(): Record<string, number | null> {
  const table = costTable();
  const out: Record<string, number | null> = {};
  for (const s of SCENARIOS) out[s.id] = (['moderation'] as StageId[]).reduce((sum, st) => sum + (table[st][s.id] ?? 0), 0);
  return out;
}
/** The Workers AI price line, in the page's language. */
export const aiRateLine = (c: Copy, locale: 'en' | 'ar') => rateLines(c, locale, 'moderation')[0]!;
/** The words over a Workers AI meter: what its amount is the price of. */
export const aiMeterLine = (c: Copy) => c.perUpload;

/** For the HTML comparison under the diagram: each lane's total per scenario. */
export function laneTotals(): Record<Lane, Record<string, number>> {
  const table = costTable();
  const out = {} as Record<Lane, Record<string, number>>;
  for (const lane of ['bunny', 'r2', 'shared'] as Lane[]) {
    out[lane] = {};
    for (const s of SCENARIOS) out[lane][s.id] = (Object.keys(LANE_OF) as StageId[]).filter((st) => LANE_OF[st] === lane).reduce((sum, st) => sum + asShown(table[st][s.id] ?? 0), 0);
  }
  return out;
}
export { ASSUMED };
