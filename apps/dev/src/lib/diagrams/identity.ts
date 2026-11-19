/**
 * Identity & security (system-design/identity). The sign-in flow with PKCE, the 15-minute
 * tokens and their revocation, and the two permission systems that never mix. SOURCES.md §7.
 */
import type { DiagramShape, DiagramSpec, IconKind, Tone } from '../diagram.ts';

export interface IdentityLabels {
  title: string; desc: string; narrowDesc: string;
  zone: { flow: string; issuer: string; tokens: string; roles: string };
  node: Record<'user' | 'app' | 'issuer' | 'pkce' | 'code' | 'access' | 'refresh' | 'revoke' | 'verify' | 'siteRoles' | 'channelRoles' | 'moderation', { title: string; sub?: string[] }>;
  edge: { start: string; authorize: string; back: string; exchange: string; verify: string; rotate: string; revoke: string; ask: string };
}

export function identityWide(l: IdentityLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'flow', x: 16, y: 64, w: 1248, h: 330, label: l.zone.flow, tone: 'apps' },
    { kind: 'zone', id: 'tokens', x: 16, y: 424, w: 620, h: 300, label: l.zone.tokens, tone: 'data' },
    { kind: 'zone', id: 'roles', x: 664, y: 424, w: 600, h: 300, label: l.zone.roles, tone: 'async' },
  ];
  const n = (id: keyof IdentityLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title, sub: l.node[id].sub });

  n('user', 60, 130, 220, 64, 'client', 'person');
  n('app', 360, 130, 220, 64, 'accent', 'worker');
  n('pkce', 660, 130, 200, 64, undefined, 'lock');
  n('issuer', 940, 130, 280, 64, 'accent', 'lock');
  n('code', 940, 250, 280, 64, undefined, 'mail');
  n('access', 60, 480, 270, 64, 'store', 'lock');
  n('refresh', 360, 480, 270, 64, 'store', 'db');
  n('verify', 60, 590, 270, 64, undefined, 'worker');
  n('revoke', 360, 590, 270, 64, 'store', 'shield');
  n('siteRoles', 700, 480, 240, 64, undefined, 'lock');
  n('channelRoles', 960, 480, 240, 64, undefined, 'person');
  n('moderation', 700, 590, 500, 64, undefined, 'chart');

  const e = (id: string, from: [number, number], to: [number, number], label?: string, via?: [number, number][], labelAt?: [number, number]) =>
    s.push({ kind: 'edge', id, from, to, via, label, labelAt });
  e('start', [280, 162], [360, 162], l.edge.start);
  e('authorize', [580, 162], [660, 162], l.edge.authorize, undefined, [620, 116]);
  e('to-issuer', [860, 162], [940, 162]);
  e('back', [1080, 194], [1080, 250]);
  e('exchange', [940, 282], [470, 194], l.edge.exchange, [[470, 282]]);
  e('verify', [195, 544], [195, 590], l.edge.verify);
  e('rotate', [450, 544], [450, 590], l.edge.rotate);
  e('ask', [1080, 544], [1080, 590], l.edge.ask);
  return { id: 'dg-identity', width: 1280, height: 760, title: l.title, desc: l.desc, shapes: s };
}

export function identityNarrow(l: IdentityLabels): DiagramSpec {
  const s: DiagramShape[] = [
    { kind: 'zone', id: 'flow', x: 8, y: 8, w: 344, h: 430, label: l.zone.flow, tone: 'apps' },
    { kind: 'zone', id: 'tokens', x: 8, y: 454, w: 344, h: 300, label: l.zone.tokens, tone: 'data' },
    { kind: 'zone', id: 'roles', x: 8, y: 778, w: 344, h: 300, label: l.zone.roles, tone: 'async' },
  ];
  const n = (id: keyof IdentityLabels['node'], x: number, y: number, w: number, h: number, tone?: Tone, icon?: IconKind) =>
    s.push({ kind: 'node', id, x, y, w, h, tone, icon, title: l.node[id].title });
  const col = (id: keyof IdentityLabels['node'], y: number, tone?: Tone, icon?: IconKind) => n(id, 24, y, 312, 48, tone, icon);
  col('user', 60, 'client', 'person');
  col('app', 132, 'accent', 'worker');
  col('pkce', 204);
  col('issuer', 276, 'accent', 'lock');
  col('code', 348);
  col('access', 506, 'store', 'kv');
  col('refresh', 570, 'store', 'db');
  col('revoke', 634, 'store', 'shield');
  col('verify', 698);
  col('siteRoles', 830);
  col('channelRoles', 892);

  const e = (id: string, from: [number, number], to: [number, number]) => s.push({ kind: 'edge', id, from, to });
  const down = (id: string, y1: number, y2: number) => e(id, [180, y1], [180, y2]);
  down('start', 108, 132);
  down('authorize', 180, 204);
  down('to-issuer', 252, 276);
  down('exchange', 324, 348);
  down('tokens', 434, 454);
  down('roles', 766, 778);
  return { id: 'dg-identity-narrow', width: 360, height: 1108, title: l.title, desc: l.narrowDesc, shapes: s };
}
