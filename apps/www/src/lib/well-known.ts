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
 * Values come from vars; an app without its values is left out and the file stays valid.
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
