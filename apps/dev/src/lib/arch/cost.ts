/**
 * What a video costs on each pipeline, stage by stage (docs/SOURCES.md §9a). Every rate is copied
 * from the code or docs named beside it, at AlUmmahNow origin/main; nothing here is a new estimate.
 * The unit assumptions (MB per video-minute, GB per viewer-hour, R2 reads per viewer-hour) are the
 * admin Delivery page's own ASSUMED values, so this page and the admin's projection agree.
 * A stage whose quantity the code doesn't know is `null` (shown as unknown, left out of totals).
 */

/** List prices, USD (2026-11). */
export const RATES = {
  /** standard-4: 4 vCPU + 12 GiB + 20 GB disk — api-videos lib/media/costs.ts PRICES.containerInstanceSecond */
  containerSecond: 4 * 0.00002 + 12 * 0.0000025 + 20 * 0.00000007,
  /** lib/media/costs.ts, cost-monitor pricing.ts */
  r2GbMonth: 0.015,
  r2ClassAPerMillion: 4.5,
  r2ClassBPerMillion: 0.36,
  r2EgressGb: 0,
  /** lib/media/costs.ts: per region, the library replicates to 2 */
  bunnyStorageGbMonthPerRegion: 0.01,
  bunnyRegions: 2,
  /** admin delivery/metrics.ts bunnyDeliveryGbHigh (lib/media/costs.ts bunnyEgressGb); $0.005 on the volume network */
  bunnyDeliveryGb: 0.01,
  bunnyDeliveryGbLow: 0.005,
  /** R2-DELIVERY-PLAN.md cost model: "Encoding is free." */
  bunnyEncode: 0,
  /** cost-monitor pricing.ts */
  workerRequestPerMillion: 0.3,
  queueOperationsPerMillion: 0.4,
  /** cost-monitor bills 3 operations per message (write, read, delete) */
  queueOpsPerMessage: 3,
  doRequestPerMillion: 0.15,
  /** processor moderation/pricing.ts USD_PER_NEURON; admin-web: first 10,000 neurons a day free */
  usdPerNeuron: 0.011 / 1000,
  freeNeuronsPerDay: 10_000,
  /** pricing.ts: Whisper large-v3-turbo, $0.000513 per audio minute */
  whisperPerMinute: 0.000513,
  /** wiki AUN-VIDEO-REVIEW §Cost and latency: about $0.075 per video-hour (frames, stage 2, Whisper, text) */
  reviewPerVideoHour: 0.075,
} as const;

/** admin-web delivery/metrics.ts ASSUMED */
export const ASSUMED = {
  containerSecondsPerVideoMinute: 45,
  storedGbPerVideoMinute: 0.04,
  classAPerVideoMinute: 40,
  classBPerViewerHour: 72,
  gbPerViewerHour: 0.9,
  storageMonths: 12,
} as const;

/** A metadata scan's neurons, from processor moderation/budget.ts + pricing.ts (Gemma 4 translate, one Llama Guard run, Gemma 4 extensions) for `tokens` of text. */
export function scanNeurons(tokens: number): number {
  const per = (inM: number, outM: number, i: number, o: number) => (i * inM + o * outM) / 1e6;
  const translate = per(9091, 27273, tokens, tokens * 2);
  const guard = per(44003, 2730, tokens * 2 + 450, 20);
  const ext = per(9091, 27273, tokens + 700, 300);
  return translate + guard + ext;
}

export type ScenarioId = 'one' | 'small' | 'medium';
export interface Scenario {
  id: ScenarioId;
  videoMinutes: number;
  viewerHours: number;
  /** months of uploads in storage (1 for one video stored a month; the admin's 12 for a month at scale) */
  storageMonths: number;
  /** uploads, when known (moderation scans one per upload) */
  uploads: number | null;
}
export const SCENARIOS: Scenario[] = [
  // one 10-minute video, watched in full 1,000 times, kept a month
  { id: 'one', videoMinutes: 10, viewerHours: (1000 * 10) / 60, storageMonths: 1, uploads: 1 },
  // admin-web delivery/metrics.ts SCALES: small and medium, a month after 12 months of uploads
  { id: 'small', videoMinutes: 20 * 60, viewerHours: 2_000, storageMonths: ASSUMED.storageMonths, uploads: null },
  { id: 'medium', videoMinutes: 200 * 60, viewerHours: 50_000, storageMonths: ASSUMED.storageMonths, uploads: null },
];

/** The example metadata (title + description) the moderation line is shown for. */
export const SCAN_TOKENS = 300;

export type StageId =
  | 'upload'
  | 'moderation'
  | 'captions'
  | 'quran'
  | 'review'
  | 'bunnyEncode'
  | 'bunnyStore'
  | 'bunnyDeliver'
  | 'originals'
  | 'queue'
  | 'slots'
  | 'transcode'
  | 'renditions'
  | 'r2Deliver';
export type Lane = 'shared' | 'bunny' | 'r2';
export const LANE_OF: Record<StageId, Lane> = {
  upload: 'shared',
  moderation: 'shared',
  captions: 'shared',
  quran: 'shared',
  review: 'shared',
  bunnyEncode: 'bunny',
  bunnyStore: 'bunny',
  bunnyDeliver: 'bunny',
  originals: 'r2',
  queue: 'r2',
  slots: 'r2',
  transcode: 'r2',
  renditions: 'r2',
  r2Deliver: 'r2',
};

/** USD for one stage in one scenario; null = the code doesn't know the quantity. */
export function stageCost(stage: StageId, s: Scenario): number | null {
  const storedGb = s.videoMinutes * ASSUMED.storedGbPerVideoMinute * s.storageMonths;
  const deliveredGb = s.viewerHours * ASSUMED.gbPerViewerHour;
  switch (stage) {
    case 'upload':
      return 0; // a handful of Worker requests, inside the account's included 10M a month
    case 'moderation':
      return s.uploads === null ? null : s.uploads * scanNeurons(SCAN_TOKENS) * RATES.usdPerNeuron;
    case 'captions':
      return s.videoMinutes * RATES.whisperPerMinute;
    case 'quran':
      return 0; // matched in code against the synced Quran index: no AI call
    case 'review':
      return (s.videoMinutes / 60) * RATES.reviewPerVideoHour;
    case 'bunnyEncode':
      return s.videoMinutes * RATES.bunnyEncode;
    case 'bunnyStore':
      return storedGb * RATES.bunnyStorageGbMonthPerRegion * RATES.bunnyRegions;
    case 'bunnyDeliver':
      return deliveredGb * RATES.bunnyDeliveryGb;
    case 'originals':
      return null; // $0.015/GB-month × the uploaded file's size, which the cost model doesn't track
    case 'queue':
      return s.uploads === null ? null : (s.uploads * RATES.queueOpsPerMessage * RATES.queueOperationsPerMillion) / 1e6;
    case 'slots':
      return s.uploads === null ? null : (s.uploads * 3 * RATES.doRequestPerMillion) / 1e6; // acquire, renew, release
    case 'transcode':
      return s.videoMinutes * ASSUMED.containerSecondsPerVideoMinute * RATES.containerSecond;
    case 'renditions':
      return storedGb * RATES.r2GbMonth + (s.videoMinutes * ASSUMED.classAPerVideoMinute * RATES.r2ClassAPerMillion) / 1e6;
    case 'r2Deliver':
      return deliveredGb * RATES.r2EgressGb + (s.viewerHours * ASSUMED.classBPerViewerHour * RATES.r2ClassBPerMillion) / 1e6;
  }
}

/** Every stage's cost per scenario, for the page's script: { stage: { scenario: usd | null } }. */
export function costTable(): Record<StageId, Record<ScenarioId, number | null>> {
  const out = {} as Record<StageId, Record<ScenarioId, number | null>>;
  for (const st of Object.keys(LANE_OF) as StageId[]) {
    out[st] = {} as Record<ScenarioId, number | null>;
    for (const s of SCENARIOS) out[st][s.id] = stageCost(st, s);
  }
  return out;
}

/** Money as the page's language writes it: ٠–٩ in Arabic; more decimals for tiny amounts. */
export function formatUsd(locale: 'en' | 'ar', usd: number): string {
  if (usd > 0 && usd < 0.0001) return `< ${formatUsd(locale, 0.0001)}`;
  const digits = usd === 0 ? 2 : usd < 0.01 ? 4 : usd < 1 ? 3 : 2;
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-arab' : 'en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(usd);
}
