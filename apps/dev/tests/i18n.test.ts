import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';

/** Same shape: every key and array length in en exists in ar, and no string is empty. */
function shape(v: unknown, path = ''): string[] {
  if (Array.isArray(v)) return [`${path}[${v.length}]`, ...v.flatMap((x, i) => shape(x, `${path}[${i}]`))];
  if (v && typeof v === 'object') return Object.keys(v).sort().flatMap((k) => [`${path}.${k}`, ...shape((v as Record<string, unknown>)[k], `${path}.${k}`)]);
  return [];
}
function strings(v: unknown, path = ''): [string, string][] {
  if (typeof v === 'string') return [[path, v]];
  if (Array.isArray(v)) return v.flatMap((x, i) => strings(x, `${path}[${i}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => strings(x, `${path}.${k}`));
  return [];
}

describe('copy', () => {
  it('ar has exactly the keys of en', () => {
    expect(shape(ar)).toEqual(shape(en));
  });
  it('no empty strings (repo licences excepted)', () => {
    for (const t of [en, ar]) for (const [p, s] of strings(t)) if (!p.endsWith('.licence')) expect(s.trim(), p).not.toBe('');
  });
  it('links and feature ids are the same in both languages', () => {
    const pick = (t: unknown) => strings(t).filter(([p]) => p.endsWith('.href') || p.endsWith('.feature') || p.endsWith('.topic') || p.endsWith('.licence'));
    // Links into our own sites point at the page's own language
    const norm = (t: unknown) => pick(t).map(([p, v]) => [p, v.replace('/ar/', '/en/')]);
    expect(norm(ar)).toEqual(norm(en));
  });
  it('Arabic uses «مرئي» for video, never «فيديو» (wiki glossary)', () => {
    for (const [p, s] of strings(ar)) expect(s, p).not.toMatch(/فيديو/);
  });
  it('describes only what exists and runs today: no plans, no studies (owner, 2026-11-19)', () => {
    const all = strings(en).map(([, s]) => s).join('\n');
    expect(all).not.toMatch(/\bwe are (exploring|studying|considering|planning)\b|\bcoming soon\b|\bin development\b|\brolling out\b|\bplanned\b|\blater\b(?! in case)|\bwaqf\b|tax[- ]deductible|donate now/i);
    const allAr = strings(ar).map(([, s]) => s).join('\n');
    expect(allAr).not.toMatch(/ندرس|نخطط|قريبًا|الوقف|قيد التطوير|قيد الطرح|قيد الإطلاق|لاحقًا|مخطط له/);
  });
  it('one term per thing, and no sentence opens with a lowercase code name (AUDIT-2, round 5)', () => {
    const allAr = strings(ar).map(([, s]) => s).join('\n');
    expect(allAr).not.toMatch(/خانة شاغرة|البوتات/);
    // a range of rungs in Arabic reads as words («من ٣٦٠p إلى ١٠٨٠p»), never a dash the bidi algorithm can reverse
    expect(allAr).not.toMatch(/\{tkRung\w+\}\s*[–-]\s*\{tkRung/);
    // and so does any other range: «من ٣٠ إلى ٩٠ يومًا», never «٣٠–٩٠»
    expect(allAr).not.toMatch(/\}\s*[–-]\s*\{|\d\s*–\s*\d/);
    // prose only: a tile's name (api-videos) is a label, not a sentence
    const lc = /(?:[.!?]\s+)(?:[a-z][a-z0-9]*[-_][a-z0-9_-]+|videos|processor|media|scheduler)\b/;
    for (const [path, s] of strings(en)) {
      expect(s, path).not.toMatch(lc);
      if (s.length > 60 && /\. /.test(s)) expect(s, path).not.toMatch(/^(?:[a-z][a-z0-9]*[-_][a-z0-9_-]+|videos|processor|media|scheduler)\b/);
    }
  });
  it('no user, view or money figures', () => {
    const all = strings(en).map(([, s]) => s).join('\n');
    expect(all).not.toMatch(/\$\s?\d|\d+\s?(k|m)?\s?(users|viewers|subscribers|views)\b/i);
  });
});
