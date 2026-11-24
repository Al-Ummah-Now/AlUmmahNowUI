import { describe, expect, it } from 'vitest';
import { LANGS, REFERENCE, sample, say, type Operation, type Text } from '../src/lib/auth/reference.ts';
import { reduce } from '../scripts/auth-spec.ts';

const ops = REFERENCE.groups.flatMap((g) => g.operations);

const texts = (op: Operation): Text[] => [
  op.summary,
  ...(op.description ? [op.description] : []),
  ...op.params.flatMap((p) => p.description ?? []),
  ...(op.body?.shapes.flatMap((s) => [...(s.description ? [s.description] : []), ...s.fields.flatMap((f) => f.description ?? [])]) ?? []),
  ...op.answers.flatMap((a) => [a.description, ...a.fields.flatMap((f) => f.description ?? [])]),
];

describe('the reference', () => {
  it('is pinned to a commit and holds no staff operation', () => {
    expect(REFERENCE.source.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(ops.length).toBeGreaterThan(40);
    expect(ops.filter((o) => o.path.startsWith('/admin') || o.path.startsWith('/rbac/admin'))).toEqual([]);
    expect(new Set(ops.map((o) => o.id)).size).toBe(ops.length);
  });
  it('says everything in both languages, with every number filled in', () => {
    for (const t of [...REFERENCE.groups.map((g) => g.name), ...ops.flatMap(texts)]) {
      expect(t.en.trim(), t.en).not.toBe('');
      // a standard's own name is the same in both
      if (!['OAuth', 'S256', 'BASE64URL(SHA256(code_verifier))'].includes(t.en)) expect(t.ar, t.en).toMatch(/\p{Script=Arabic}/u);
      for (const locale of ['en', 'ar'] as const) expect(say(t, locale), t.en).not.toMatch(/\{N/);
    }
  });
  it('writes a sample in every language for every operation', () => {
    for (const op of ops)
      for (const lang of LANGS) {
        const s = sample(op, lang);
        expect(s, `${op.id} ${lang}`).not.toMatch(/undefined|\[object|\{\w+\}'|NaN/);
        expect(s, `${op.id} ${lang}`).toContain('https://auth.alummahnow.net/');
      }
  });
  it('the code exchange names its grant and the verifier', () => {
    const token = ops.find((o) => o.id === 'token')!;
    const curl = sample(token, 'curl');
    expect(curl).toContain("--data-urlencode 'grant_type=authorization_code'");
    expect(curl).toContain('code_verifier=');
    expect(curl).not.toContain('client_secret=');
  });
});

describe('reducing the specification', () => {
  const op = (extra: object) => ({ 'x-audience': 'app', operationId: 'a', summary: 'A', 'x-summary-ar': 'أ', tags: ['T'], responses: {}, ...extra });
  const doc = (extra: object) => ({ paths: { '/a': { get: op(extra) } } });
  it('keeps app operations only', () => {
    const d = { paths: { '/a': { get: op({}) }, '/b': { get: op({ 'x-audience': 'admin', operationId: 'b' }) } } };
    expect(reduce(d, { T: 'ت' }, 'x').groups.flatMap((g) => g.operations.map((o) => o.id))).toEqual(['a']);
  });
  it('refuses a text that has no Arabic', () => {
    expect(() => reduce(doc({ description: 'Only English' }), { T: 'ت' }, 'x')).toThrow('no Arabic for: Only English');
  });
  it('refuses an operation whose security is not for apps', () => {
    expect(() => reduce(doc({ security: [{ adminSession: [] }] }), { T: 'ت' }, 'x')).toThrow('not for apps');
  });
});
