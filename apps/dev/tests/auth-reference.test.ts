import { describe, expect, it } from 'vitest';
import { LANGS, REFERENCE, exampleOf, sample, sampleBody, say, type Field, type Operation, type Schema, type Text } from '../src/lib/auth/reference.ts';
import { reduce } from '../scripts/auth-spec.ts';

const ops = REFERENCE.groups.flatMap((g) => g.operations);

const every = (fields: Field[]): Field[] => fields.flatMap((f) => [f, ...every(f.fields ?? [])]);

/** What is wrong with a value, by the JSON Schema keywords the reducer keeps (it refuses any other). */
function problems(value: unknown, s: Schema, at = 'body'): string[] {
  const out: string[] = [];
  const types = s.type === undefined ? [] : [s.type].flat();
  const is = Array.isArray(value) ? 'array' : value === null ? 'null' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types.length && !types.includes(is)) return [`${at}: ${is}, not ${types.join(' or ')}`];
  if (s.const !== undefined && value !== s.const) out.push(`${at}: not ${s.const}`);
  if (s.enum && !s.enum.includes(value as string)) out.push(`${at}: not in the list`);
  if (typeof value === 'string') {
    if (s.pattern && !new RegExp(s.pattern).test(value)) out.push(`${at}: ${value} does not match ${s.pattern}`);
    if (value.length < (s.minLength ?? 0) || value.length > (s.maxLength ?? Infinity)) out.push(`${at}: length ${value.length}`);
    if (s.format === 'email' && !/^\S+@\S+\.\S+$/.test(value)) out.push(`${at}: no email`);
    if (s.format === 'uri' && !URL.canParse(value)) out.push(`${at}: no address`);
  }
  if (Array.isArray(value)) {
    if (value.length > (s.maxItems ?? Infinity)) out.push(`${at}: too many`);
    value.forEach((v, i) => out.push(...problems(v, s.items ?? {}, `${at}[${i}]`)));
  }
  if (is === 'object') {
    const o = value as Record<string, unknown>;
    for (const key of s.required ?? []) if (!(key in o)) out.push(`${at}.${key}: missing`);
    if (Object.keys(o).length < (s.minProperties ?? 0)) out.push(`${at}: empty`);
    for (const [key, v] of Object.entries(o)) if (s.properties) out.push(...(key in s.properties ? problems(v, s.properties[key]!, `${at}.${key}`) : [`${at}.${key}: unknown`]));
    if (s.oneOf) {
      const fit = s.oneOf.filter((one) => problems(value, { ...one, type: undefined }, at).length === 0).length;
      if (fit !== 1) out.push(`${at}: fits ${fit} of oneOf`);
    }
  }
  return out;
}

const texts = (op: Operation): Text[] => [
  op.summary,
  ...(op.description ? [op.description] : []),
  ...op.params.flatMap((p) => p.description ?? []),
  ...(op.body?.shapes.flatMap((s) => [...(s.description ? [s.description] : []), ...every(s.fields).flatMap((f) => f.description ?? [])]) ?? []),
  ...op.answers.flatMap((a) => [a.description, ...every(a.fields).flatMap((f) => f.description ?? [])]),
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

describe('sample bodies', () => {
  it('every one is a body its endpoint accepts', () => {
    const wrong = ops.flatMap((op) =>
      (op.body?.shapes ?? []).flatMap((shape, i) => {
        // what the samples send, and for a choice of bodies the other ones too
        const body = i === 0 ? (sampleBody(op) ?? {}) : exampleOf(shape.schema, 'body');
        return problems(body, shape.schema).map((p) => `${op.method} ${op.path} ${p}`);
      }),
    );
    expect(wrong).toEqual([]);
  });
  it('the samples carry that body', () => {
    const of = (id: string, lang: (typeof LANGS)[number]) => sample(ops.find((o) => o.id === id)!, lang);
    expect(of('createModerationRequest', 'curl')).toContain('"display_name"');
    expect(of('setAccountName', 'ts')).toContain('"displayName": "DISPLAY_NAME"');
    expect(of('revokeInstall', 'python')).toContain('"install_id"');
    expect(of('revokeInstall', 'python')).not.toContain('"client_id"');
    // nothing to send, and nothing asked: no body
    expect(of('revokeInvite', 'curl')).not.toContain(' -d ');
  });
  it('the check itself refuses what an endpoint would', () => {
    const body = ops.find((o) => o.id === 'createModerationRequest')!.body!.shapes[0]!.schema;
    const good = sampleBody(ops.find((o) => o.id === 'createModerationRequest')!) as Record<string, unknown>;
    expect(problems(good, body)).toEqual([]);
    expect(problems({ ...good, requested_by: {} }, body)).toEqual(['body.requested_by.id: missing', 'body.requested_by.display_name: missing']);
    expect(problems({ ...good, action: 'x' }, body)).not.toEqual([]);
    expect(problems({ ...good, evidence: [{ url: 'no address' }] }, body)).not.toEqual([]);
    const revoke = ops.find((o) => o.id === 'revokeInstall')!.body!.shapes[0]!.schema;
    expect(problems({ user_id: 'a' }, revoke)).not.toEqual([]);
    expect(problems({ user_id: 'a', install_id: 'b', client_id: 'c' }, revoke)).not.toEqual([]);
    const name = ops.find((o) => o.id === 'setAccountName')!.body!.shapes[0]!.schema;
    expect(problems({}, name)).not.toEqual([]);
  });
  it('fields inside objects and lists are there', () => {
    const names = (id: string) => {
      const op = ops.find((o) => o.id === id)!;
      return every([...(op.body?.shapes.flatMap((s) => s.fields) ?? []), ...op.answers.flatMap((a) => a.fields)]).map((f) => f.name);
    };
    expect(names('createModerationRequest')).toEqual(expect.arrayContaining(['display_name', 'url', 'label']));
    expect(names('listSessionAccounts')).toContain('isActive');
    expect(names('createInvite')).toContain('acceptedAt');
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
  it('follows a schema that names itself once, and refuses a staff scheme in any alternative or a keyword it does not know', () => {
    const named = { ...doc({ responses: { 200: { description: 'D', content: { 'application/json': { schema: { $ref: '#/components/schemas/S' } } } } } }), components: { schemas: { S: { properties: { child: { $ref: '#/components/schemas/S' } } } } } };
    expect(reduce(named, { T: 'ت', D: 'د' }, 'x').groups[0]!.operations[0]!.answers[0]!.fields).toEqual([{ name: 'child', type: 'object', required: false }]);
    expect(() => reduce(doc({ security: [{ userToken: [] }, { adminSession: [] }] }), { T: 'ت' }, 'x')).toThrow('not for apps');
    expect(() => reduce(doc({ requestBody: { content: { 'application/json': { schema: { type: 'object', not: {} } } } } }), { T: 'ت' }, 'x')).toThrow('uses not');
  });
  it('refuses an operation whose security is not for apps', () => {
    expect(() => reduce(doc({ security: [{ adminSession: [] }] }), { T: 'ت' }, 'x')).toThrow('not for apps');
  });
});
