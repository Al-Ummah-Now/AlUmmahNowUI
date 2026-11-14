/**
 * The site's statuses come only from the wiki's feature registry (scripts/registry.ts,
 * src/lib/registry.ts). These pin the rules the build relies on.
 */
import { describe, expect, it } from 'vitest';
import { validateRegistry } from '../scripts/registry.ts';
import { en } from '../src/i18n/en.ts';

const base = { id: 'creator-tiers', name: { en: 'Creator tiers', ar: 'مستويات صنّاع المحتوى' }, apps: ['videos'], wiki: 'epics/CHAT-CREATOR-TIERS-creator-tiers.md' };
const reg = (...features: object[]) => ({ version: 1, features });

describe('feature registry rules', () => {
  it('accepts each release form for live, and none for the other statuses', () => {
    expect(validateRegistry(reg(
      { ...base, status: 'live', release: { repo: 'AlUmmahNow', tag: 'v2026.11.14.3' } },
      { ...base, id: 'a', status: 'live', release: { repo: 'AlUmmahNowAuth', run: 123, sha: 'abc1234' } },
      { ...base, id: 'b', status: 'live', release: { repo: 'AlUmmahNow', before: 'v2026.11.06' } },
      { ...base, id: 'c', status: 'rolling', prs: ['AlUmmahNow#1'] },
      { ...base, id: 'd', status: 'planned' },
    ))).toEqual([]);
  });

  it('rejects a live feature without its release, a release on a feature not live, bad statuses and duplicates', () => {
    const errs = validateRegistry(reg(
      { ...base, status: 'live' },
      { ...base, id: 'x', status: 'planned', release: { repo: 'AlUmmahNow', tag: 'v2026.11.14' } },
      { ...base, id: 'y', status: 'shipped' },
      { ...base, id: 'x', status: 'planned' },
      { ...base, id: 'z', status: 'live', release: { repo: 'AlUmmahNow', tag: '2026-11-14' } },
    ));
    expect(errs.join('\n')).toMatch(/creator-tiers\): live needs its release/);
    expect(errs.join('\n')).toMatch(/\(x\): only live features have a release/);
    expect(errs.join('\n')).toMatch(/\(y\): status/);
    expect(errs.join('\n')).toMatch(/\(x\): duplicate id/);
    expect(errs.join('\n')).toMatch(/\(z\): live needs its release/);
    expect(validateRegistry({ features: [] })).toHaveLength(1);
  });

  it('the copy never writes a status itself: items name a registry feature', () => {
    expect(JSON.stringify(en)).not.toMatch(/"status":"(live|rolling|building|planned)"/);
    expect(JSON.stringify(en)).toMatch(/"feature":"csam-intake"/);
  });
});
