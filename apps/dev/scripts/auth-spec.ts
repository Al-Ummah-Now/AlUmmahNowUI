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
}
export interface Body {
  type: 'json' | 'form';
  /** more than one: the caller picks by this field */
  shapes: { name?: string; description?: Text; fields: Field[] }[];
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
interface Schema extends Json {
  $ref?: string;
  type?: string | string[];
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  enum?: string[];
  const?: string;
  oneOf?: Schema[];
  items?: Schema;
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
  const typeOf = (raw: Schema): string => {
    const s = follow(raw);
    if (s.const !== undefined) return 'string';
    if (s.type === 'array') return `${s.items ? typeOf(s.items) : 'object'}[]`;
    return Array.isArray(s.type) ? s.type.join(' | ') : (s.type ?? 'object');
  };
  const fields = (raw: Schema | undefined): Field[] => {
    if (!raw) return [];
    const s = follow(raw);
    return Object.entries(s.properties ?? {}).map(([name, prop]) => {
      const p = follow(prop);
      return {
        name,
        type: typeOf(prop),
        required: s.required?.includes(name) ?? false,
        ...(prop.description ? { description: must(prop.description) } : {}),
        ...(p.enum ? { values: p.enum } : p.const !== undefined ? { values: [p.const] } : {}),
      };
    });
  };
  const contentOf = (node: Json | undefined, type: string): Schema | undefined => (node?.content as Record<string, { schema?: Schema }> | undefined)?.[type]?.schema;

  const groups = new Map<string, Operation[]>();
  for (const [path, item] of Object.entries(doc.paths as Record<string, Record<string, Json>>)) {
    for (const [method, op] of Object.entries(item)) {
      if (op['x-audience'] !== 'public' && op['x-audience'] !== 'app') continue;
      const scheme = Object.keys(((op.security as Json[]) ?? [])[0] ?? {})[0];
      if (scheme && !(scheme in AUTH)) throw new Error(`${path}: ${scheme} is not for apps`);
      const request = op.requestBody as Json | undefined;
      const form = contentOf(request, 'application/x-www-form-urlencoded');
      const raw = form ?? contentOf(request, 'application/json');
      const schema = raw && follow(raw);
      const body: Body | undefined = schema && {
        type: form ? 'form' : 'json',
        shapes: (schema.oneOf ?? [schema]).map((shape) => {
          const s = follow(shape);
          const name = s.properties?.grant_type?.const;
          return { ...(name ? { name } : {}), ...(s.description ? { description: must(s.description) } : {}), fields: fields(s) };
        }),
      };
      const entry: Operation = {
        id: op.operationId as string,
        method: method.toUpperCase(),
        path,
        summary: { en: op.summary as string, ar: op['x-summary-ar'] as string },
        ...(op.description ? { description: must(op.description as string) } : {}),
        auth: scheme ? AUTH[scheme]! : 'none',
        params: ((op.parameters as (Schema & { name: string; in: 'path' | 'query' | 'header'; required?: boolean; schema: Schema })[]) ?? []).map((p) => ({
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
