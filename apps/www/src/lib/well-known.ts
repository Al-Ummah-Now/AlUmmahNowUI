/**
 * Domain association files for native passkey sign-in (wiki AUTH-PASSKEYS "Native apps").
 *
 * The passkey RP ID is this Worker's apex host (alummahnow.net, qa.alummahnow.net,
 * stage.alummahnow.net), so Apple and Google fetch these two files from it:
 *
 *   /.well-known/apple-app-site-association  webcredentials.apps = "<team id>.<bundle id>"
 *   /.well-known/assetlinks.json             delegate_permission/common.get_login_creds per Android app
 *
 * Answered before the apex → www redirect (Apple never follows redirects), 200 JSON on every host.
 * Values come from vars, merged with videos admin → Mobile apps (admin-api `/public/mobile-apps`,
 * AlUmmahNow shared-types mobile-apps.ts: the Team ID, and the Studio / Admin bundle ids and
 * Android fingerprints). Pasting the owner's ids there is enough; the vars keep what was set before
 * (the CI pre-release key) and keep working when admin-api is unreachable.
 * An app without its values is left out and the file stays valid.
 */

export interface WellKnownEnv {
  /** 10-character Apple Developer Team ID. Empty: no Apple apps listed. */
  APPLE_TEAM_ID?: string;
  /** Comma list of bundle ids allowed to use this domain's passkeys (Studio + Admin, iOS + macOS). */
  APPLE_WEBCREDENTIALS_BUNDLE_IDS?: string;
  /** JSON { "<android package>": ["AA:BB:… SHA-256 of a signing certificate", …] } (same value as Auth's). */
  ANDROID_APP_CERTS?: string;
}

export const AASA_PATH = '/.well-known/apple-app-site-association';
export const ASSET_LINKS_PATH = '/.well-known/assetlinks.json';

const TEAM_ID = /^[A-Z0-9]{10}$/;
const BUNDLE_ID = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

/** The AASA document: only webcredentials (no app uses universal links on these hosts). */
export function appleAppSiteAssociation(env: WellKnownEnv): { webcredentials: { apps: string[] } } {
  const team = (env.APPLE_TEAM_ID ?? '').trim();
  if (!TEAM_ID.test(team)) return { webcredentials: { apps: [] } };
  const ids = (env.APPLE_WEBCREDENTIALS_BUNDLE_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => BUNDLE_ID.test(id));
  return { webcredentials: { apps: [...new Set(ids)].map((id) => `${team}.${id}`) } };
}

/** "aa:bb…" or plain hex → "AA:BB:…" (the form Digital Asset Links expects), or null. */
export function normaliseFingerprint(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hex = value.replace(/[:\s]/g, '').toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) return null;
  return hex.match(/../g)!.join(':');
}

export interface AssetStatement {
  relation: string[];
  target: { namespace: 'android_app'; package_name: string; sha256_cert_fingerprints: string[] };
}

/** One get_login_creds statement per Android app that has at least one valid fingerprint. */
export function assetLinks(env: WellKnownEnv): AssetStatement[] {
  if (!env.ANDROID_APP_CERTS) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(env.ANDROID_APP_CERTS);
  } catch {
    console.error(JSON.stringify({ msg: 'ANDROID_APP_CERTS is not JSON' }));
    return [];
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const statements: AssetStatement[] = [];
  for (const [pkg, list] of Object.entries(parsed as Record<string, unknown>)) {
    if (!PACKAGE.test(pkg) || !Array.isArray(list)) continue;
    const fingerprints = [...new Set(list.map(normaliseFingerprint).filter((f): f is string => !!f))];
    if (!fingerprints.length) continue;
    statements.push({
      relation: ['delegate_permission/common.get_login_creds'],
      target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: fingerprints },
    });
  }
  return statements;
}

/** The file for this request, or null when the path is not one of them. */
export function wellKnownResponse(request: Request, env: WellKnownEnv): Response | null {
  const { pathname } = new URL(request.url);
  if (pathname !== AASA_PATH && pathname !== ASSET_LINKS_PATH) return null;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  }
  const body = JSON.stringify(pathname === AASA_PATH ? appleAppSiteAssociation(env) : assetLinks(env));
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}

// ---------------------------------------------------------------------------
// videos admin → Mobile apps
// ---------------------------------------------------------------------------

/** The part of the Mobile apps settings these files use (AlUmmahNow shared-types MobileAppsSettings). */
export interface MobileAppsSettings {
  apple?: { teamId?: string; apps?: { role?: string; bundleId?: string }[] };
  android?: { apps?: { role?: string; packageName?: string; sha256Fingerprints?: string[] }[] };
}

/** Apps that sign in with passkeys (the same roles admin-api lists for get_login_creds / webcredentials). */
const PASSKEY_ROLES = new Set(['studio', 'admin']);

/** The vars with the admin's values added: its Team ID wins when valid; bundle ids and fingerprints are merged. */
export function withMobileApps(env: WellKnownEnv, settings: MobileAppsSettings | null): WellKnownEnv {
  if (!settings) return env;
  const team = (settings.apple?.teamId ?? '').trim();
  const bundles = new Set(
    (env.APPLE_WEBCREDENTIALS_BUNDLE_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
  for (const app of settings.apple?.apps ?? []) {
    if (app.role && PASSKEY_ROLES.has(app.role) && app.bundleId && BUNDLE_ID.test(app.bundleId)) bundles.add(app.bundleId);
  }
  let certs: Record<string, unknown> = {};
  try {
    const parsed: unknown = env.ANDROID_APP_CERTS ? JSON.parse(env.ANDROID_APP_CERTS) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) certs = { ...(parsed as Record<string, unknown>) };
  } catch {
    certs = {};
  }
  for (const app of settings.android?.apps ?? []) {
    if (!app.role || !PASSKEY_ROLES.has(app.role) || !app.packageName || !Array.isArray(app.sha256Fingerprints)) continue;
    const before = Array.isArray(certs[app.packageName]) ? (certs[app.packageName] as unknown[]) : [];
    certs[app.packageName] = [...before, ...app.sha256Fingerprints];
  }
  return {
    APPLE_TEAM_ID: TEAM_ID.test(team) ? team : env.APPLE_TEAM_ID,
    APPLE_WEBCREDENTIALS_BUNDLE_IDS: [...bundles].join(','),
    ANDROID_APP_CERTS: JSON.stringify(certs),
  };
}

const SETTINGS_FRESH_MS = 60_000;
const SETTINGS_LAST_GOOD_MS = 10 * 60_000;
let kept: { at: number; settings: MobileAppsSettings } | null = null;

/** Forget the isolate's copy (tests). */
export function resetMobileAppsCache(): void {
  kept = null;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The admin's settings, one read a minute per isolate; on a failure the last copy (10 min), else none. */
export async function mobileAppsSettings(adminApiUrl: string | undefined, fetcher: Fetch = fetch, now = Date.now()): Promise<MobileAppsSettings | null> {
  if (kept && now - kept.at < SETTINGS_FRESH_MS) return kept.settings;
  const base = (adminApiUrl ?? '').replace(/\/$/, '');
  if (base) {
    try {
      const res = await fetcher(`${base}/public/mobile-apps`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const body = (await res.json()) as { settings?: MobileAppsSettings };
        if (body.settings && typeof body.settings === 'object') {
          kept = { at: now, settings: body.settings };
          return body.settings;
        }
      }
      console.warn(JSON.stringify({ msg: 'Mobile apps settings not read', status: res.status }));
    } catch (error) {
      console.warn(JSON.stringify({ msg: 'Mobile apps settings not read', error: String(error) }));
    }
  }
  return kept && now - kept.at < SETTINGS_LAST_GOOD_MS ? kept.settings : null;
}

/** wellKnownResponse with the admin's values merged in; null when the path is neither file (no read then). */
export async function passkeyFilesResponse(request: Request, env: WellKnownEnv & { ADMIN_API_URL?: string }, fetcher: Fetch = fetch): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname !== AASA_PATH && pathname !== ASSET_LINKS_PATH) return null;
  const settings = request.method === 'GET' || request.method === 'HEAD' ? await mobileAppsSettings(env.ADMIN_API_URL, fetcher) : null;
  return wellKnownResponse(request, withMobileApps(env, settings));
}
