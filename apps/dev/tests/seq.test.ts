import { describe, expect, it } from 'vitest';
import { renderSeq, type SeqSpec } from '../src/lib/arch/seq.ts';
import { renderArch } from '../src/lib/arch/arch.ts';

const spec: SeqSpec = {
  id: 'seq-test',
  title: 'Test',
  desc: 'A test sequence',
  actors: [
    { id: 'app', icon: 'lucide/laptop', name: 'Studio', role: 'creator app' },
    { id: 'api', icon: 'cloudflare/workers', name: 'api-videos', role: 'Worker' },
    { id: 'kv', icon: 'cloudflare/kv', name: 'TUS_SESSIONS', role: 'KV' },
  ],
  groups: [{ id: 'cf', label: 'Cloudflare account', members: ['api', 'kv'], tag: 'simple-icons/cloudflare' }],
  steps: [
    { from: 'app', to: 'api', label: 'Start an upload', code: 'POST /api/videos/upload/initiate', flow: 'request' },
    { from: 'api', to: 'kv', label: 'Keep the session', code: 'tus:session:<id>', flow: 'control' },
    { from: 'api', to: 'app', label: 'Session id', code: 'tusSessionId', flow: 'request', reply: true },
    { note: 'After a drop the app asks for the offset and carries on', over: ['app', 'api'] },
    { from: 'api', to: 'api', label: 'Check the offset', flow: 'control' },
  ],
};

describe('sequence diagrams', () => {
  const wide = renderSeq(spec, { colW: 200, rowH: 50 }, { rtl: false, variant: 'wide', locale: 'en' });
  const narrowAr = renderSeq(spec, { colW: 118, rowH: 50, narrow: true }, { rtl: true, variant: 'narrow', locale: 'ar' });

  it('draws one tile per participant and one wire per message, with the hooks the gate reads', () => {
    expect(wide.match(/data-node="/g)).toHaveLength(3);
    expect(wide.match(/data-edge="/g)).toHaveLength(4);
    expect(wide).toContain('data-group="cf" data-members="api kv"');
    expect(wide).not.toMatch(/style=/);
  });

  it('numbers requests, not replies, and writes calls in code type', () => {
    expect(wide.match(/class="an-badge/g)).toHaveLength(3);
    expect(wide).toContain('class="an-seq-code"');
    expect(wide).toContain('POST /api/videos/upload/initiate');
    expect(wide).toContain('an-reply');
  });

  it('Arabic: ٠–٩ badges, mirrored columns, identifiers still left to right', () => {
    expect(narrowAr).toContain('>١<');
    expect(narrowAr).toContain('direction="ltr"');
    const x = (id: string, svg: string) => Number(svg.match(new RegExp(`data-node="${id}"><rect class="an-node-box" x="([\\d.]+)"`))![1]);
    expect(x('app', narrowAr)).toBeGreaterThan(x('kv', narrowAr));
    expect(x('app', wide)).toBeLessThan(x('kv', wide));
  });

  it('rejects a message to someone not in the diagram', () => {
    expect(() => renderSeq({ ...spec, steps: [{ from: 'app', to: 'nobody', label: 'x', flow: 'request' }] }, { colW: 200, rowH: 50 }, { rtl: false, variant: 'w', locale: 'en' })).toThrow(/unknown participant/);
  });
});

describe('field tiles', () => {
  it('lists fields in code type under a rule, aligned to the start edge', () => {
    const svg = renderArch(
      { id: 'er', title: 'T', desc: 'D', motion: 'pulses', groups: [], edges: [], nodes: [{ id: 't', icon: 'cloudflare/d1', name: 'notifications', role: 'D1 table', list: ['id TEXT primary key', 'user_id TEXT'], at: [0, 0] }] },
      { colW: 240, rowH: 200 },
      { rtl: false, variant: 'wide', locale: 'en' },
    );
    expect(svg).toContain('class="an-field-rule"');
    expect(svg.match(/class="an-field"/g)).toHaveLength(2);
    expect(svg).toContain('text-anchor="start" direction="ltr"');
  });
});
