/** The Sign-in API reference's data (scripts/auth-spec.ts) and the request samples drawn from it. */
import data from '../../data/auth-reference.json';
import { fill, formatNumber } from '../../../../../packages/render/src/format.ts';
import type { Field, Operation, Reference, Text } from '../../../scripts/auth-spec.ts';
import type { Locale } from '../pages.ts';

export type { Field, Operation, Reference, Text };
export const REFERENCE = data as Reference;
export const ISSUER = 'https://auth.alummahnow.net';

/** A text in the page's language, its {N…} numbers in the page's numerals. */
export const say = (t: Text, locale: Locale): string =>
  fill(
    t[locale].replace(/\{N(=?)(\d+)\}/g, (_m, _exact: string, n: string) => formatNumber(Number(n), locale, { useGrouping: false })),
    {},
    locale,
  );

export const LANGS = ['curl', 'ts', 'python', 'go'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { curl: 'curl', ts: 'TypeScript', python: 'Python', go: 'Go' };

/** A stand-in for a field's value: the only one allowed, else its name in capitals. */
const example = (f: Field): string => (f.values?.length ? f.values[0]! : f.name.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/\W/g, '_').toUpperCase());
/** …as JSON: the type the field has. */
const jsonExample = (f: Field): unknown => (f.type === 'integer' ? 1 : f.type === 'boolean' ? true : f.type.endsWith('[]') ? [] : f.type === 'object' ? {} : example(f));

interface Parts {
  url: string;
  headers: [string, string][];
  form?: [string, string][];
  json?: string;
  basic: boolean;
  session: boolean;
}

function parts(op: Operation): Parts {
  const path = op.path.replace(/\{(\w+)\}/g, (_m, name: string) => name.toUpperCase());
  const query = op.params.filter((p) => p.in === 'query' && p.required).map((p) => `${p.name}=${encodeURIComponent(example(p))}`);
  const headers: [string, string][] = op.params.filter((p) => p.in === 'header').map((p) => [p.name, example(p)]);
  if (op.auth === 'user') headers.unshift(['Authorization', 'Bearer ACCESS_TOKEN']);
  const required = op.body?.shapes[0]?.fields.filter((f) => f.required) ?? [];
  // /token: the public client's fields too, or the sample would not work
  const extra = op.id === 'token' ? (op.body?.shapes[0]?.fields.filter((f) => f.name === 'code_verifier') ?? []) : [];
  const fields = [...required, ...extra];
  return {
    url: `${ISSUER}${path}${query.length ? `?${query.join('&')}` : ''}`,
    headers,
    basic: op.auth === 'client',
    session: op.auth === 'session',
    ...(op.body?.type === 'form' ? { form: fields.map((f): [string, string] => [f.name, example(f)]) } : {}),
    ...(op.body?.type === 'json' ? { json: JSON.stringify(Object.fromEntries(fields.map((f) => [f.name, jsonExample(f)])), null, 2) } : {}),
  };
}

const q1 = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const q2 = (s: string) => JSON.stringify(s);

export function sample(op: Operation, lang: Lang): string {
  const p = parts(op);
  const headers = p.json ? [...p.headers, ['Content-Type', 'application/json'] as [string, string]] : p.headers;
  switch (lang) {
    case 'curl':
      return [
        `curl${op.method === 'GET' ? '' : op.method === 'HEAD' ? ' --head' : ` -X ${op.method}`} ${q1(p.url)}`,
        ...(p.basic ? [`  -u 'CLIENT_ID:CLIENT_SECRET'`] : []),
        ...(p.session ? [`  --cookie '__session=…'`] : []),
        ...headers.map(([k, v]) => `  -H ${q1(`${k}: ${v}`)}`),
        ...(p.form ?? []).map(([k, v]) => `  --data-urlencode ${q1(`${k}=${v}`)}`),
        ...(p.json ? [`  -d ${q1(p.json)}`] : []),
      ].join(' \\\n');
    case 'ts': {
      const head = [...headers, ...(p.basic ? [['Authorization', ''] as [string, string]] : [])].map(([k, v]) => `    ${/^\w+$/.test(k) ? k : q2(k)}: ${p.basic && k === 'Authorization' ? '`Basic ${btoa("CLIENT_ID:CLIENT_SECRET")}`' : q2(v)},`);
      const options = [
        ...(op.method === 'GET' ? [] : [`  method: ${q2(op.method)},`]),
        ...(p.session ? ['  credentials: "include",'] : []),
        ...(head.length ? ['  headers: {', ...head, '  },'] : []),
        ...(p.form ? ['  body: new URLSearchParams({', ...p.form.map(([k, v]) => `    ${k}: ${q2(v)},`), '  }),'] : []),
        ...(p.json ? [`  body: JSON.stringify(${p.json.replace(/\n/g, '\n  ')}),`] : []),
      ];
      return options.length ? `const res = await fetch(${q2(p.url)}, {\n${options.join('\n')}\n});` : `const res = await fetch(${q2(p.url)});`;
    }
    case 'python':
      return [
        'import requests',
        '',
        `res = requests.${op.method.toLowerCase()}(`,
        `    ${q2(p.url)},`,
        ...(p.basic ? ['    auth=("CLIENT_ID", "CLIENT_SECRET"),'] : []),
        ...(p.session ? ['    cookies={"__session": "…"},'] : []),
        ...(p.headers.length ? [`    headers={${p.headers.map(([k, v]) => `${q2(k)}: ${q2(v)}`).join(', ')}},`] : []),
        ...(p.form ? ['    data={', ...p.form.map(([k, v]) => `        ${q2(k)}: ${q2(v)},`), '    },'] : []),
        ...(p.json ? [`    json=${p.json.replace(/^( +)/gm, '$1$1').replace(/\btrue\b/g, 'True').replace(/\n/g, '\n    ')},`] : []),
        '    timeout=10,',
        ')',
      ].join('\n');
    case 'go': {
      const body = p.form ? `strings.NewReader(url.Values{\n${p.form.map(([k, v]) => `\t${q2(k)}: {${q2(v)}},`).join('\n')}\n}.Encode())` : p.json ? `strings.NewReader(\`${p.json}\`)` : 'nil';
      return [
        `req, err := http.NewRequest(${q2(op.method)}, ${q2(p.url)}, ${body})`,
        'if err != nil {',
        '\treturn err',
        '}',
        ...(p.basic ? ['req.SetBasicAuth("CLIENT_ID", "CLIENT_SECRET")'] : []),
        ...(p.session ? ['req.AddCookie(&http.Cookie{Name: "__session", Value: "…"})'] : []),
        ...[...headers, ...(p.form ? [['Content-Type', 'application/x-www-form-urlencoded'] as [string, string]] : [])].map(([k, v]) => `req.Header.Set(${q2(k)}, ${q2(v)})`),
        'res, err := client.Do(req)',
      ].join('\n');
    }
  }
}
