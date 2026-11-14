import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AASA_PATH, ASSET_LINKS_PATH, appleAppSiteAssociation, assetLinks, normaliseFingerprint, wellKnownResponse } from '../src/lib/well-known';

const FP = '5A:1B:3D:2B:57:6E:9A:2D:F0:BF:1B:E3:F1:8C:40:20:13:F9:5C:09:EA:EE:7C:F7:31:10:C4:2F:B5:69:DD:C0';
const BUNDLES = 'net.alummahnow.studio,net.alummahnow.studio.mac,net.alummahnow.admin,net.alummahnow.admin.mac';

describe('passkey domain files', () => {
  it('AASA lists TEAMID.bundle for every configured app, webcredentials only', () => {
    expect(appleAppSiteAssociation({ APPLE_TEAM_ID: 'ABCDE12345', APPLE_WEBCREDENTIALS_BUNDLE_IDS: BUNDLES })).toEqual({
      webcredentials: {
        apps: ['ABCDE12345.net.alummahnow.studio', 'ABCDE12345.net.alummahnow.studio.mac', 'ABCDE12345.net.alummahnow.admin', 'ABCDE12345.net.alummahnow.admin.mac'],
      },
    });
  });

  it('AASA without a valid team id lists no apps and stays valid', () => {
    for (const team of [undefined, '', 'short', 'abcde12345']) {
      expect(appleAppSiteAssociation({ APPLE_TEAM_ID: team, APPLE_WEBCREDENTIALS_BUNDLE_IDS: BUNDLES })).toEqual({ webcredentials: { apps: [] } });
    }
    expect(appleAppSiteAssociation({ APPLE_TEAM_ID: 'ABCDE12345', APPLE_WEBCREDENTIALS_BUNDLE_IDS: ' bad id , net.alummahnow.admin,' })).toEqual({
      webcredentials: { apps: ['ABCDE12345.net.alummahnow.admin'] },
    });
  });

  it('assetlinks: get_login_creds per app with fingerprints, normalised; apps without any are left out', () => {
    const certs = JSON.stringify({
      'net.alummahnow.studio': [FP.replace(/:/g, '').toLowerCase(), FP],
      'net.alummahnow.admin': [],
      'net.alummahnow.bad': ['nope'],
      'not a package': [FP],
    });
    expect(assetLinks({ ANDROID_APP_CERTS: certs })).toEqual([
      {
        relation: ['delegate_permission/common.get_login_creds'],
        target: { namespace: 'android_app', package_name: 'net.alummahnow.studio', sha256_cert_fingerprints: [FP] },
      },
    ]);
    expect(assetLinks({})).toEqual([]);
    expect(assetLinks({ ANDROID_APP_CERTS: 'not json' })).toEqual([]);
    expect(normaliseFingerprint('AB:CD')).toBeNull();
  });

  it('serves both files as 200 JSON on any host (the apex too), never a redirect; other paths pass through', async () => {
    const env = { APPLE_TEAM_ID: 'ABCDE12345', APPLE_WEBCREDENTIALS_BUNDLE_IDS: 'net.alummahnow.studio', ANDROID_APP_CERTS: JSON.stringify({ 'net.alummahnow.studio': [FP] }) };
    for (const host of ['https://alummahnow.net', 'https://qa.alummahnow.net', 'https://www.alummahnow.net']) {
      const aasa = wellKnownResponse(new Request(`${host}${AASA_PATH}`), env)!;
      expect(aasa.status).toBe(200);
      expect(aasa.headers.get('content-type')).toBe('application/json');
      expect(await aasa.json()).toEqual({ webcredentials: { apps: ['ABCDE12345.net.alummahnow.studio'] } });
      const links = wellKnownResponse(new Request(`${host}${ASSET_LINKS_PATH}`), env)!;
      expect(links.status).toBe(200);
      expect(((await links.json()) as unknown[]).length).toBe(1);
    }
    expect(wellKnownResponse(new Request('https://alummahnow.net/en/'), env)).toBeNull();
    expect(wellKnownResponse(new Request('https://alummahnow.net/.well-known/other'), env)).toBeNull();
    expect(wellKnownResponse(new Request(`https://alummahnow.net${AASA_PATH}`, { method: 'POST' }), env)!.status).toBe(405);
    const head = wellKnownResponse(new Request(`https://alummahnow.net${AASA_PATH}`, { method: 'HEAD' }), env)!;
    expect(head.status).toBe(200);
  });

  it('the worker answers them before the apex redirect', () => {
    const src = readFileSync(new URL('../src/worker.ts', import.meta.url), 'utf8');
    expect(src.indexOf('wellKnownResponse(request, env)')).toBeGreaterThan(0);
    expect(src.indexOf('wellKnownResponse(request, env)')).toBeLessThan(src.indexOf('apexRedirect(request.url'));
  });

  it('every env names its apps; QA uses the .qa ids', () => {
    const raw = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
    expect(raw).toContain(`"APPLE_WEBCREDENTIALS_BUNDLE_IDS": "${BUNDLES}"`);
    expect(raw).toContain('"APPLE_WEBCREDENTIALS_BUNDLE_IDS": "net.alummahnow.studio.qa,net.alummahnow.studio.mac.qa,net.alummahnow.admin.qa,net.alummahnow.admin.mac.qa"');
    expect(raw).toContain('{ "pattern": "qa.alummahnow.net", "custom_domain": true }');
    expect(raw).toContain('{ "pattern": "stage.alummahnow.net", "custom_domain": true }');
  });
});
