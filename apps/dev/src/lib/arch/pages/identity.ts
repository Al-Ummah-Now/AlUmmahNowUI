/** Identity & security page diagrams (docs/SOURCES.md §7). */
import { stack, type ArchNode } from '../arch.ts';
import type { Builder } from './types.ts';

const node = (id: string, icon: string, c: { name: string; role: string | string[] }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

const map: Builder = (d) => {
  const c = d.pages.identity.map;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'identity-map',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('resend', 'simple-icons/resend', n.resend, [0, 0]),
        node('apps', 'lucide/users', n.apps, [0, 1.42]),
        node('turnstile', 'cloudflare/turnstile', n.turnstile, [1.4, 0]),
        node('limiters', 'cloudflare/waf', n.limiters, [2.6, 0]),
        node('issuer', 'cloudflare/workers', n.issuer, [1.4, 1.3]),
        node('profile', 'cloudflare/workers', n.profile, [1.4, 2.6]),
        node('authAdmin', 'cloudflare/workers', n.authAdmin, [2.6, 2.6]),
        node('kvStore', 'cloudflare/kv', n.kvStore, [3.9, 0]),
        node('d1', 'cloudflare/d1', n.d1, [3.9, 1.3]),
        node('revKv', 'cloudflare/kv', n.revKv, [3.9, 2.6]),
        node('videos', 'cloudflare/workers', n.videos, [5.3, 2.6]),
      ],
      groups: [
        { id: 'auth', label: c.group.auth, caption: c.caption.auth, pad: 28, members: ['turnstile', 'limiters', 'issuer', 'profile', 'authAdmin', 'kvStore', 'd1', 'revKv'] },
        { id: 'videosG', label: c.group.videos, members: ['videos'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', tagEnd: true, pad: 40, members: ['auth', 'videosG'] },
      ],
      edges: [
        { from: 'apps', to: 'issuer', flow: 'request', label: e.signIn, fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'resend', flow: 'async', label: e.code, fromSide: 'w', toSide: 'e' },
        { from: 'turnstile', to: 'issuer', flow: 'control', fromSide: 's', toSide: 'n' },
        { from: 'limiters', to: 'issuer', flow: 'control', fromSide: 's', toSide: 'n' },
        { from: 'profile', to: 'issuer', flow: 'request', label: e.client, fromSide: 'n', toSide: 's' },
        { from: 'authAdmin', to: 'issuer', flow: 'request', label: e.confidential, fromSide: 'n', toSide: 's' },
        { from: 'issuer', to: 'kvStore', flow: 'request', fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'd1', flow: 'request', label: e.rotate, fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'revKv', flow: 'async', label: e.revoke, fromSide: 'e', toSide: 'w' },
        { from: 'videos', to: 'revKv', flow: 'request', label: e.check, fromSide: 'w', toSide: 'e' },
        { from: 'apps', to: 'videos', flow: 'request', label: e.token, fromSide: 's', toSide: 's' },
      ],
    },
    wide: { colW: 200, rowH: 170, pad: 40 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      at: stack([
        [['apps', 'resend'], 0],
        [['profile', 'authAdmin'], 2.3],
        [['turnstile', 'limiters'], 1.4],
        [['issuer'], 1.4],
        [['kvStore', 'd1'], 1.5],
        [['revKv'], 1.4],
        [['videos'], 2.2],
      ]),
      edges: [
        { from: 'apps', to: 'issuer', flow: 'request', label: e.signIn, fromSide: 'w', toSide: 'w' },
        { from: 'issuer', to: 'resend', flow: 'async', label: e.code, fromSide: 'e', toSide: 'e' },
        { from: 'turnstile', to: 'issuer', flow: 'control', fromSide: 's', toSide: 'n' },
        { from: 'limiters', to: 'issuer', flow: 'control', fromSide: 's', toSide: 'n' },
        { from: 'profile', to: 'issuer', flow: 'request', fromSide: 'w', toSide: 'w' },
        { from: 'authAdmin', to: 'issuer', flow: 'request', fromSide: 'e', toSide: 'e' },
        { from: 'issuer', to: 'kvStore', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'issuer', to: 'd1', flow: 'request', label: e.rotate, fromSide: 's', toSide: 'n' },
        { from: 'issuer', to: 'revKv', flow: 'async', label: e.revoke, fromSide: 's', toSide: 'n' },
        { from: 'videos', to: 'revKv', flow: 'request', label: e.check, fromSide: 'n', toSide: 's' },
        { from: 'apps', to: 'videos', flow: 'request', label: e.token, fromSide: 'w', toSide: 'w' },
      ],
    },
  };
};

const signin: Builder = (d) => {
  const c = d.pages.identity.signin;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'identity-signin',
      title: c.title,
      desc: c.desc,
      motion: 'steps',
      hop: 1.1,
      nodes: [
        node('user', 'lucide/browser', n.user, [0, 0]),
        node('resend', 'simple-icons/resend', n.resend, [2.2, -1.45]),
        node('issuer', 'cloudflare/workers', n.issuer, [2.2, 0]),
        node('d1', 'cloudflare/d1', n.d1, [4.2, 0]),
        node('app', 'lucide/smartphone', n.app, [0, 1.8]),
        node('api', 'cloudflare/workers', n.api, [2.2, 3.0]),
        node('revKv', 'cloudflare/kv', n.revKv, [4.2, 3.0]),
      ],
      groups: [{ id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', tagEnd: true, members: ['issuer', 'd1', 'api', 'revKv'] }],
      edges: [
        { from: 'user', to: 'issuer', flow: 'request', label: e.authorize, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'resend', flow: 'async', label: e.email, step: 2, fromSide: 'n', toSide: 's' },
        { from: 'issuer', to: 'user', flow: 'control', label: e.redirect, step: 3, fromSide: 'w', toSide: 'e' },
        { from: 'user', to: 'app', flow: 'request', label: e.callback, step: 4, fromSide: 's', toSide: 'n' },
        { from: 'app', to: 'issuer', flow: 'request', label: e.exchange, step: 5, fromSide: 'e', toSide: 's' },
        { from: 'issuer', to: 'app', flow: 'delivery', label: e.tokens, step: 6, fromSide: 's', toSide: 'e' },
        { from: 'app', to: 'api', flow: 'request', label: e.call, step: 7, fromSide: 's', toSide: 'w' },
        { from: 'api', to: 'revKv', flow: 'request', label: e.check, step: 8, fromSide: 'e', toSide: 'w' },
        { from: 'app', to: 'issuer', flow: 'request', label: e.refresh, step: 9, fromSide: 'e', toSide: 's' },
        { from: 'issuer', to: 'd1', flow: 'request', label: e.rotate, step: 10, fromSide: 'e', toSide: 'w' },
      ],
    },
    wide: { colW: 210, rowH: 160, pad: 40 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      at: { user: [0, 0], app: [1, 0], issuer: [0, 2.9], d1: [0, 4.6], api: [1, 4.6], revKv: [1, 6.1], resend: [0, 7.9] },
      edges: [
        { from: 'user', to: 'issuer', flow: 'request', label: e.authorize, step: 1, fromSide: 's', toSide: 'n' },
        { from: 'issuer', to: 'resend', flow: 'async', label: e.email, step: 2, fromSide: 'w', toSide: 'w' },
        { from: 'issuer', to: 'user', flow: 'control', label: e.redirect, step: 3, fromSide: 'n', toSide: 's' },
        { from: 'user', to: 'app', flow: 'request', label: e.callback, step: 4, fromSide: 'e', toSide: 'w' },
        { from: 'app', to: 'issuer', flow: 'request', label: e.exchange, step: 5, fromSide: 's', toSide: 'e' },
        { from: 'issuer', to: 'app', flow: 'delivery', label: e.tokens, step: 6, fromSide: 'e', toSide: 's' },
        { from: 'app', to: 'api', flow: 'request', label: e.call, step: 7, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'revKv', flow: 'request', label: e.check, step: 8, fromSide: 's', toSide: 'n' },
        { from: 'app', to: 'issuer', flow: 'request', label: e.refresh, step: 9, fromSide: 's', toSide: 'e' },
        { from: 'issuer', to: 'd1', flow: 'request', label: e.rotate, step: 10, fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

const roles: Builder = (d) => {
  const c = d.pages.identity.roles;
  const n = c.node;
  const t = c.tag;
  const spec = {
    id: 'identity-roles',
    title: c.title,
    desc: c.desc,
    heading: c.heading,
    around: c.around,
    nodes: [
      { id: 'siteRoles', icon: 'lucide/shield-check', title: n.siteRoles.title, note: n.siteRoles.note, tone: 'blue' as const, at: [0, 0] as [number, number] },
      { id: 'token', icon: 'lucide/key-round', title: n.token.title, note: n.token.note, tone: 'yellow' as const, at: [0, 1] as [number, number] },
      { id: 'transfer', icon: 'lucide/user', title: n.transfer.title, note: n.transfer.note, tone: 'pink' as const, at: [0, 2] as [number, number] },
      { id: 'channelRoles', icon: 'lucide/users', title: n.channelRoles.title, note: n.channelRoles.note, tone: 'green' as const, at: [2, 0] as [number, number] },
      { id: 'record', icon: 'cloudflare/r2', title: n.record.title, note: n.record.note, tone: 'green' as const, at: [2, 1] as [number, number] },
      { id: 'can', icon: 'cloudflare/workers', title: n.can.title, note: n.can.note, tone: 'orange' as const, at: [2, 2] as [number, number] },
    ],
    edges: [
      { from: 'siteRoles', to: 'token', fromSide: 's' as const, toSide: 'n' as const, tag: t.issued, tone: 'blue' as const },
      { from: 'channelRoles', to: 'record', fromSide: 's' as const, toSide: 'n' as const, tag: t.stored, tone: 'green' as const },
      { from: 'record', to: 'can', fromSide: 's' as const, toSide: 'n' as const },
      { from: 'siteRoles', to: 'channelRoles', fromSide: 'e' as const, toSide: 'w' as const, dashed: true, tag: t.neither, tone: 'pink' as const },
      { from: 'channelRoles', to: 'token', fromSide: 'w' as const, toSide: 'e' as const, dashed: true, tag: t.never, tone: 'pink' as const, tagAt: 0.55 },
      { from: 'token', to: 'transfer', fromSide: 's' as const, toSide: 'n' as const },
      { from: 'transfer', to: 'record', fromSide: 'e' as const, toSide: 'w' as const, bend: -20, tag: t.owner, tone: 'yellow' as const, tagAt: 0.6 },
    ],
  };
  return {
    kind: 'sketch',
    spec,
    wide: { colW: 340, rowH: 200, nodeW: 240, cols: 3 },
    narrow: {
      colW: 280,
      rowH: 205,
      nodeW: 250,
      cols: 1,
      at: { siteRoles: [0, 0], token: [0, 1], transfer: [0, 2], record: [0, 3], channelRoles: [0, 4], can: [0, 5] },
      // one column: every wire joins neighbours except "never in a token", which bows out through the margin
      edges: [
        { from: 'siteRoles', to: 'token', fromSide: 's', toSide: 'n', tag: t.issued, tone: 'blue' },
        { from: 'token', to: 'transfer', fromSide: 's', toSide: 'n' },
        { from: 'transfer', to: 'record', fromSide: 's', toSide: 'n' },
        { from: 'channelRoles', to: 'record', fromSide: 'n', toSide: 's', tag: t.stored, tone: 'green' },
        { from: 'channelRoles', to: 'can', fromSide: 's', toSide: 'n' },
        { from: 'channelRoles', to: 'token', fromSide: 'w', toSide: 'w', bend: -46, dashed: true, tone: 'pink' },
      ],
    },
  };
};

export const builders: Record<string, Builder> = { 'identity-map': map, 'identity-signin': signin, 'identity-roles': roles };
