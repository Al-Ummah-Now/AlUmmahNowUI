import { describe, expect, it } from 'vitest';
import { applyZone, checkToken, RECORDS, type Call } from '../scripts/sites-zone';

/** A fake Cloudflare API: `deny` lists path fragments answered with a permission error. */
function fake(deny: string[] = [], records: { name: string; type: string }[] = []) {
  const calls: string[] = [];
  const call: Call = async (method, path, body) => {
    calls.push(`${method} ${path}`);
    if (deny.some((d) => path.includes(d))) return { status: 403, body: { success: false, errors: [{ code: 10000, message: 'Authentication error' }], result: null as never } };
    if (method === 'GET' && path.includes('/dns_records')) return { status: 200, body: { success: true, result: records as never } };
    if (method === 'POST' && path.endsWith('/dns_records')) return { status: 200, body: { success: true, result: { id: 'rec1', ...(body as object) } as never } };
    return { status: 200, body: { success: true, result: {} as never } };
  };
  return { call, calls };
}

describe('sites zone setup', () => {
  it('check: every capability ok, and the TXT probe is deleted again', async () => {
    const f = fake();
    const caps = await checkToken(f.call);
    expect(caps.every((c) => c.ok)).toBe(true);
    expect(f.calls).toContain('DELETE /zones/c3cbc1b54070d957cdcef91444b746a9/dns_records/rec1');
  });

  it('check: names exactly what is missing', async () => {
    const caps = await checkToken(fake(['/dns_records', '/custom_hostnames']).call);
    const missing = caps.filter((c) => !c.ok).map((c) => c.needs);
    expect(missing).toContain('Zone → DNS: Read');
    expect(missing).toContain('Zone → DNS: Edit');
    expect(missing.some((m) => m.includes('SSL and Certificates: Edit'))).toBe(true);
  });

  it('apply: creates only the missing records, then HTTPS and the fallback origin', async () => {
    const f = fake([], [{ name: '*.alummahnow.org', type: 'AAAA' }]);
    const { lines, ok } = await applyZone(f.call);
    expect(ok).toBe(true);
    expect(lines[0]).toBe('DNS AAAA *.alummahnow.org: already there');
    expect(f.calls.filter((c) => c.startsWith('POST') && c.endsWith('/dns_records'))).toHaveLength(RECORDS.length - 1);
    expect(f.calls).toContain('PUT /zones/c3cbc1b54070d957cdcef91444b746a9/custom_hostnames/fallback_origin');
  });
});
