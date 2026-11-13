import { describe, expect, it } from 'vitest';
import { applyZone, checkToken, ownDomainSmoke, RECORDS, type Call } from '../scripts/sites-zone';

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

describe('own-domain smoke', () => {
  /** A fake Cloudflare with a hostname that goes active on the third read. */
  function saas(opts: { denyDns?: boolean; neverActive?: boolean } = {}) {
    const calls: string[] = [];
    let reads = 0;
    const call: Call = async (method, path) => {
      calls.push(`${method} ${path}`);
      const ok = (result: unknown) => ({ status: 200, body: { success: true, result: result as never } });
      if (path.startsWith('/zones?name=')) return ok([{ id: 'testzone', name: 'example.com' }]);
      if (method === 'POST' && path.endsWith('/custom_hostnames')) return ok({ id: 'ch1', status: 'pending', ssl: { status: 'initializing' }, ownership_verification: { type: 'txt', name: '_cf-custom-hostname.h', value: 'own' } });
      if (method === 'GET' && path.includes('/custom_hostnames/ch1')) {
        reads++;
        const active = !opts.neverActive && reads >= 3;
        return ok({ id: 'ch1', status: active ? 'active' : 'pending', ssl: { status: active ? 'active' : 'pending_validation', validation_records: [{ txt_name: '_acme-challenge.h', txt_value: 'cert' }] }, ownership_verification: { type: 'txt', name: '_cf-custom-hostname.h', value: 'own' } });
      }
      if (method === 'POST' && path.endsWith('/dns_records')) {
        if (opts.denyDns) return { status: 403, body: { success: false, errors: [{ code: 10000, message: 'Authentication error' }], result: null as never } };
        return ok({ id: `rec${calls.length}` });
      }
      if (method === 'POST' && path.endsWith('/workers/routes')) return ok({ id: 'route1' });
      return ok({});
    };
    return { call, calls };
  }
  const deps = (status = 200, body: unknown = { ok: true, app: 'sites', env: 'qa' }) => ({ id: 'abc', sleep: async () => undefined, probe: async () => ({ status, body }), pollMs: 1 });

  it('creates, validates, reaches the qa Worker, then removes everything', async () => {
    const f = saas();
    const { ok, lines } = await ownDomainSmoke(f.call, 'qa', 'example.com', deps());
    expect(ok).toBe(true);
    expect(lines).toContain('Test host: saas-smoke-abc.qa-sites.example.com (env qa, worker al-ummah-now-sites-qa)');
    expect(lines.some((l) => l.startsWith('Records the owner adds: CNAME <host> (traffic), TXT _cf-custom-hostname.h (ownership), TXT _acme-challenge.h (certificate)'))).toBe(true);
    expect(f.calls.filter((c) => c.startsWith('POST') && c.endsWith('/dns_records'))).toHaveLength(3);
    expect(f.calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(5);
    expect(f.calls.at(-1)).toBe('DELETE /zones/c3cbc1b54070d957cdcef91444b746a9/custom_hostnames/ch1');
  });

  it('fails when the site answers from another env, and still cleans up', async () => {
    const f = saas();
    const { ok, lines } = await ownDomainSmoke(f.call, 'qa', 'example.com', { ...deps(200, { ok: true, app: 'sites', env: 'production' }), probeTimeoutMs: 0 });
    expect(ok).toBe(false);
    expect(lines.some((l) => l.startsWith('Routing:') && l.includes('did not reach the qa sites Worker'))).toBe(true);
    expect(f.calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(5);
  });

  it('names the missing DNS permission and removes the hostname', async () => {
    const f = saas({ denyDns: true });
    const { ok, lines } = await ownDomainSmoke(f.call, 'stage', 'example.com', deps());
    expect(ok).toBe(false);
    expect(lines.some((l) => l.includes('needs Zone → DNS: Edit on example.com'))).toBe(true);
    expect(f.calls).toContain('DELETE /zones/c3cbc1b54070d957cdcef91444b746a9/custom_hostnames/ch1');
  });

  it('gives up when validation never finishes', async () => {
    const f = saas({ neverActive: true });
    const { ok, lines } = await ownDomainSmoke(f.call, 'qa', 'example.com', { ...deps(), activeTimeoutMs: 0 });
    expect(ok).toBe(false);
    expect(lines.some((l) => l.startsWith('Validation: NOT active in time'))).toBe(true);
  });
});
