/**
 * Optional features of the public site, read from one place: `GET <ADMIN_API_URL>/public/features`
 * → `{ newsletter }` (AlUmmahNow apps/admin-api src/lib/public-features.ts). Owner rule: a feature
 * that is off or not configured is invisible — no footer section, no link, no page (404), no
 * "not working right now" text.
 *
 *   newsletter: the admin API can send (its Resend key and mail queue are bound) AND www can reach it
 *               (ADMIN_API_URL and INTERNAL_API_KEY are set here).
 *
 * Caching as in site-theme.ts: kept per isolate for FEATURES_FRESH_MS, then served stale while one
 * background refresh runs; a cold isolate waits FEATURES_TIMEOUT_MS at most. The flags are part of
 * the HTML cache key (src/worker.ts → edge.ts), so switching a feature reaches every page within
 * about a minute. Any failure (admin API down, slow, 404) reads as off and is retried on the next
 * request; a known answer is kept while a refresh fails.
 */
import type { Config, WwwEnv } from './env';

export const FEATURES_FRESH_MS = 30_000;
export const FEATURES_TIMEOUT_MS = 500;
const EDGE_TTL_SEC = 30;

/** The internal request header that carries the resolved flags from the Worker to Astro. */
export const FEATURES_HEADER = 'x-www-features';

export interface SiteFeatures {
  newsletter: boolean;
}
export const FEATURES_OFF: SiteFeatures = { newsletter: false };

interface Answer {
  features: SiteFeatures;
  /** false: no answer from the admin API (retried on the next request, never kept over a real one) */
  known: boolean;
}
interface Entry {
  url: string;
  at: number;
  answer: Answer;
  refreshing?: Promise<void>;
}
let memo: Entry | undefined;

/** Test hook. */
export function resetFeaturesCache(): void {
  memo = undefined;
}

type Fetcher = (url: string, init: RequestInit & { cf?: Record<string, unknown> }) => Promise<Response>;

async function fetchFeatures(url: string, fetcher: Fetcher): Promise<Answer> {
  try {
    const res = await fetcher(url, {
      signal: AbortSignal.timeout(FEATURES_TIMEOUT_MS),
      headers: { accept: 'application/json' },
      cf: { cacheTtl: EDGE_TTL_SEC, cacheEverything: true },
    });
    if (!res.ok) return { features: FEATURES_OFF, known: false };
    const body = (await res.json()) as { newsletter?: unknown } | null;
    return { features: { newsletter: body?.newsletter === true }, known: true };
  } catch {
    return { features: FEATURES_OFF, known: false };
  }
}

async function hasKey(binding: WwwEnv['INTERNAL_API_KEY']): Promise<boolean> {
  if (typeof binding === 'string') return binding.length > 0;
  try {
    return !!(await binding?.get());
  } catch {
    return false;
  }
}

/** The admin API's answer, cached per isolate (see the file comment). */
export async function adminFeatures(
  adminApiUrl: string,
  waitUntil: (p: Promise<unknown>) => void,
  fetcher: Fetcher = (u, i) => fetch(u, i as RequestInit),
  now: () => number = Date.now,
): Promise<SiteFeatures> {
  if (!adminApiUrl) return FEATURES_OFF;
  const url = `${adminApiUrl}/public/features`;
  const entry = memo && memo.url === url ? memo : undefined;
  if (entry && entry.answer.known) {
    if (now() - entry.at >= FEATURES_FRESH_MS && !entry.refreshing) {
      entry.refreshing = fetchFeatures(url, fetcher).then((answer) => {
        memo = { url, at: now(), answer: answer.known ? answer : entry.answer };
      });
      waitUntil(entry.refreshing);
    }
    return entry.answer.features;
  }
  const answer = await fetchFeatures(url, fetcher);
  memo = { url, at: now(), answer };
  return answer.features;
}

/**
 * The flags for this request. Local dev and local E2E talk to the stub admin API with a fixed key
 * (newsletter.ts LOCAL_KEY), so only ADMIN_API_URL is needed there.
 */
export async function resolveFeatures(
  env: WwwEnv,
  cfg: Config,
  waitUntil: (p: Promise<unknown>) => void,
  fetcher?: Fetcher,
): Promise<SiteFeatures> {
  if (!cfg.adminApiUrl) return FEATURES_OFF;
  if (cfg.appEnv !== 'local' && !(await hasKey(env.INTERNAL_API_KEY))) return FEATURES_OFF;
  return adminFeatures(cfg.adminApiUrl, waitUntil, fetcher);
}

/** Short form for the request header and the HTML cache key: `n1` / `n0`. */
export const featuresToken = (f: SiteFeatures) => `n${f.newsletter ? 1 : 0}`;

/** The request Astro renders, with the flags in FEATURES_HEADER (a client's own value is replaced). */
export function withFeaturesHeader(request: Request, f: SiteFeatures): Request {
  const headers = new Headers(request.headers);
  headers.set(FEATURES_HEADER, featuresToken(f));
  return new Request(request, { headers });
}

/** In Astro: the flags the Worker resolved. Rendered without them (e.g. `astro dev`): everything off. */
export function featuresFromRequest(request: Request): SiteFeatures {
  const v = request.headers.get(FEATURES_HEADER) ?? '';
  return { newsletter: v === 'n1' };
}
