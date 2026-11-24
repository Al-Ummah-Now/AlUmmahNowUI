/**
 * The Sign-in API reference (/auth/reference/) is drawn from AlUmmahNowAuth's openapi.json and
 * openapi.ar.json. This reduces them, at one commit, to what the page shows (operations for apps,
 * never staff ones) and writes src/data/auth-reference.json, which is committed: a build needs no
 * network, and a change to the reference is reviewed like any other.
 *
 *   node --experimental-strip-types scripts/auth-spec.ts <commit of AlUmmahNowAuth>
 *   AUTH_SPEC_DIR=<checkout> node … scripts/auth-spec.ts <commit>      read the files from a checkout
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, env } from 'node:process';
import { fileURLToPath } from 'node:url';

export const AUTH_REPO = 'Al-Ummah-Now/AlUmmahNowAuth';
export interface Text {
  en: string;
  ar: string;
}
export interface Field {
  name: string;
  type: string;
  required: boolean;
  description?: Text;
  values?: string[];
  /** an object's fields, or an array's items' */
  fields?: Field[];
}
/** A request body's JSON Schema, every $ref followed and the texts left out: samples are drawn from it and checked against it. */
export interface Schema {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  oneOf?: Schema[];
  enum?: string[];
  const?: string;
  pattern?: string;
  format?: string;
  example?: unknown;
  minLength?: number;
  maxLength?: number;
  minProperties?: number;
  maxItems?: number;
}
export interface Shape {
  name?: string;
  description?: Text;
  fields: Field[];
  schema: Schema;
}
export interface Body {
  type: 'json' | 'form';
  required: boolean;
  /** more than one: the caller picks by this field */
  shapes: Shape[];
}
export interface Answer {
  status: number;
  description: Text;
  fields: Field[];
}
export interface Operation {
  id: string;
  method: string;
  path: string;
  summary: Text;
  description?: Text;
  auth: 'none' | 'user' | 'client' | 'session';
  params: (Field & { in: 'path' | 'query' | 'header' })[];
  body?: Body;
  answers: Answer[];
}
export interface Reference {
  source: { repo: string; sha: string };
  groups: { name: Text; operations: Operation[] }[];
}

type Json = Record<string, unknown>;
interface Spec extends Schema {
  $ref?: string;
  description?: string;
  properties?: Record<string, Spec>;
  oneOf?: Spec[];
  items?: Spec;
}

const AUTH: Record<string, Operation['auth']> = { userToken: 'user', clientBasic: 'client', browserSession: 'session' };

export function reduce(doc: Json, arabic: Record<string, string>, sha: string): Reference {
  const text = (en: string | undefined): Text | undefined => {
    if (en === undefined) return undefined;
    const ar = arabic[en];
    if (!ar) throw new Error(`no Arabic for: ${en}`);
    return { en, ar };
  };
  const must = (en: string): Text => text(en)!;
  const follow = <T extends { $ref?: string }>(node: T): T => (node.$ref ? (node.$ref.slice(2).split('/').reduce<unknown>((at, k) => (at as Json)[k], doc) as T) : node);
  const typeOf = (raw: Spec): string => {
    const s = follow(raw);
    if (s.const !== undefined) return 'string';
    if (s.type === 'array') return `${s.items ? typeOf(s.items) : 'object'}[]`;
    return Array.isArray(s.type) ? s.type.join(' | ') : (s.type ?? 'object');
  };
  // `above`: the schemas this one is inside, so one that names itself ends
  const fields = (raw: Spec | undefined, above: Spec[] = []): Field[] => {
    if (!raw) return [];
    const s = follow(raw);
    if (above.includes(s)) return [];
    return Object.entries(s.properties ?? {}).map(([name, prop]) => {
      const p = follow(prop);
      const description = prop.description ?? p.description;
      const nested = fields(p.type === 'array' ? p.items : p, [...above, s]);
      return {
        name,
        type: typeOf(prop),
        required: s.required?.includes(name) ?? false,
        ...(description ? { description: must(description) } : {}),
        ...(p.enum ? { values: p.enum } : p.const !== undefined ? { values: [p.const] } : {}),
        ...(nested.length ? { fields: nested } : {}),
      };
    });
  };
  const KEEP = ['type', 'required', 'enum', 'const', 'pattern', 'format', 'example', 'minLength', 'maxLength', 'minProperties', 'maxItems'] as const;
  const plain = (raw: Spec, above: Spec[] = []): Schema => {
    const s = follow(raw);
    if (above.includes(s)) throw new Error('a request body that contains itself');
    const inside = [...above, s];
    const kept = Object.fromEntries(KEEP.filter((k) => s[k] !== undefined).map((k) => [k, s[k]])) as Schema;
    // a keyword nothing here reads would let a wrong sample through
    for (const k of Object.keys(s)) if (!(KEEP as readonly string[]).concat('description', 'properties', 'items', 'oneOf', 'default').includes(k)) throw new Error(`a request body uses ${k}`);
    return {
      ...kept,
      ...(s.properties ? { properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, plain(v, inside)])) } : {}),
      ...(s.items ? { items: plain(s.items, inside) } : {}),
      ...(s.oneOf ? { oneOf: s.oneOf.map((v) => plain(v, inside)) } : {}),
    };
  };
  const contentOf = (node: Json | undefined, type: string): Spec | undefined => (node?.content as Record<string, { schema?: Spec }> | undefined)?.[type]?.schema;

  const groups = new Map<string, Operation[]>();
  for (const [path, item] of Object.entries(doc.paths as Record<string, Record<string, Json>>)) {
    for (const [method, op] of Object.entries(item)) {
      if (op['x-audience'] !== 'public' && op['x-audience'] !== 'app') continue;
      // every alternative, not only the first
      const schemes = ((op.security as Json[]) ?? []).flatMap((alternative) => Object.keys(alternative));
      for (const name of schemes) if (!(name in AUTH)) throw new Error(`${path}: ${name} is not for apps`);
      const scheme = schemes[0];
      const request = op.requestBody as Json | undefined;
      const form = contentOf(request, 'application/x-www-form-urlencoded');
      const raw = form ?? contentOf(request, 'application/json');
      const schema = raw && follow(raw);
      const body: Body | undefined = schema && {
        type: form ? 'form' : 'json',
        required: request?.required === true,
        // bodies to choose from; a body of its own with a oneOf has a rule on its fields instead
        shapes: (schema.properties ? [schema] : (schema.oneOf ?? [schema])).map((shape) => {
          const s = follow(shape);
          const name = s.properties?.grant_type?.const;
          return { ...(name ? { name } : {}), ...(s.description ? { description: must(s.description) } : {}), fields: fields(s), schema: plain(s) };
        }),
      };
      const entry: Operation = {
        id: op.operationId as string,
        method: method.toUpperCase(),
        path,
        summary: { en: op.summary as string, ar: op['x-summary-ar'] as string },
        ...(op.description ? { description: must(op.description as string) } : {}),
        auth: scheme ? AUTH[scheme]! : 'none',
        params: ((op.parameters as (Spec & { name: string; in: 'path' | 'query' | 'header'; required?: boolean; schema: Spec })[]) ?? []).map((p) => ({
          name: p.name,
          in: p.in,
          type: typeOf(p.schema),
          required: p.required ?? false,
          ...(p.description ? { description: must(p.description) } : {}),
          ...(p.schema.enum ? { values: p.schema.enum } : {}),
        })),
        ...(body ? { body } : {}),
        answers: Object.entries(op.responses as Record<string, Json & { $ref?: string }>).map(([status, r]) => {
          const response = follow(r);
          return { status: Number(status), description: must(response.description as string), fields: Number(status) < 300 ? fields(contentOf(response, 'application/json')) : [] };
        }),
      };
      const tag = (op.tags as string[])[0]!;
      groups.set(tag, [...(groups.get(tag) ?? []), entry]);
    }
  }
  return { source: { repo: AUTH_REPO, sha }, groups: [...groups].map(([name, operations]) => ({ name: must(name), operations })) };
}

async function load(sha: string, file: string): Promise<unknown> {
  if (env.AUTH_SPEC_DIR) return JSON.parse(readFileSync(resolve(env.AUTH_SPEC_DIR, file), 'utf8'));
  const url = `https://raw.githubusercontent.com/${AUTH_REPO}/${sha}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

if (argv[1] && resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  const sha = argv[2] ?? '';
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('usage: scripts/auth-spec.ts <40-hex commit of AlUmmahNowAuth>');
  const reference = reduce((await load(sha, 'openapi.json')) as Json, (await load(sha, 'openapi.ar.json')) as Record<string, string>, sha);
  writeFileSync(fileURLToPath(new URL('../src/data/auth-reference.json', import.meta.url)), `${JSON.stringify(reference, null, 1)}\n`);
  console.log(`auth reference: ${reference.groups.reduce((n, g) => n + g.operations.length, 0)} operations from ${AUTH_REPO}@${sha.slice(0, 7)}`);
}
