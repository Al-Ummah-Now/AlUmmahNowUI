import { describe, expect, it } from 'vitest';
import { RATES, SCENARIOS, costTable, formatUsd, scanNeurons, stageCost } from '../src/lib/arch/cost';
import { fill, formatRate } from '../src/lib/arch/specs/costs';

/**
 * The cost diagram's numbers must agree with the sources it cites (docs/SOURCES.md §9a): the
 * admin Delivery page's projection (R2-DELIVERY-PLAN.md "Cost model" table), the runbook's slot
 * price, and the processor's Workers AI price table.
 */
const small = SCENARIOS.find((s) => s.id === 'small')!;
const one = SCENARIOS.find((s) => s.id === 'one')!;

describe('cost model', () => {
  it('a busy standard-4 slot is about $0.40 an hour (RUNBOOK.md, lib/media/costs.ts)', () => {
    expect(RATES.containerSecond * 3600).toBeCloseTo(0.401, 3);
  });
  it('the small month matches the plan’s table: transcode ~$6, R2 storage ~$9, Bunny storage ~$12, delivery $9–18', () => {
    expect(stageCost('transcode', small)).toBeCloseTo(6.02, 1);
    expect(stageCost('renditions', small)!).toBeGreaterThan(8.6);
    expect(stageCost('renditions', small)!).toBeLessThan(9.0);
    expect(stageCost('bunnyStore', small)).toBeCloseTo(11.52, 2);
    expect(stageCost('bunnyDeliver', small)).toBeCloseTo(18, 2);
    expect(stageCost('r2Deliver', small)!).toBeLessThan(1);
  });
  it('the example video: 10 minutes, 1,000 full plays', () => {
    expect(one.viewerHours * 60).toBeCloseTo(10_000, 6);
    expect(stageCost('transcode', one)).toBeCloseTo(10 * 45 * RATES.containerSecond, 9);
    expect(stageCost('bunnyDeliver', one)).toBeCloseTo((10_000 / 60) * 0.9 * 0.01, 9);
    expect(stageCost('captions', one)).toBeCloseTo(10 * 0.000513, 9);
  });
  it('a 300-token moderation scan is about 83 neurons (processor moderation/budget.ts + pricing.ts)', () => {
    expect(scanNeurons(300)).toBeGreaterThan(80);
    expect(scanNeurons(300)).toBeLessThan(86);
  });
  it('what the code does not know stays unknown and out of the totals', () => {
    const t = costTable();
    expect(t.originals.one).toBeNull();
    expect(t.moderation.small).toBeNull();
  });
  it('numbers follow the page language: ٠–٩ in Arabic', () => {
    expect(formatUsd('ar', 1.5)).toMatch(/[٠-٩]/);
    expect(formatUsd('ar', 1.5)).not.toMatch(/[0-9]/);
    expect(formatRate('en', 0.000513)).toBe('$0.000513');
    expect(fill('{a}/h per slot', 'en', { a: { usd: 0.401 } })).toBe('$0.40/h per slot');
    // the owner's number rule (2026-11-21): never grouped in Arabic, a count from a thousand in words (number and
    // scale word held together by a no-break space, as render's formatCompact writes them)
    expect(fill('{n} مرة', 'ar', { n: { n: 1000 } })).toBe('ألف مرة');
    expect(fill('{n} يوميًا', 'ar', { n: { n: 10000 } })).toBe('١٠\u00a0آلاف يوميًا');
    expect(fill('{n} نيورون', 'ar', { n: { n: 1500 } })).toBe('١٫٥\u00a0ألف نيورون');
    expect(fill('{n} times', 'en', { n: { n: 1000 } })).toBe('1,000 times');
  });
});
