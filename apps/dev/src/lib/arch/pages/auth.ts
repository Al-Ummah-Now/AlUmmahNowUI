/** Sign-in API figures (docs/SOURCES.md §13): routes and parameters here, words in src/i18n/sd/auth.{en,ar}.ts. */
import { stack, type ArchNode } from '../arch.ts';
import type { SeqStep } from '../seq.ts';
import type { Builder } from './types.ts';

const node = (id: string, icon: string, c: { name: string; role: string | string[] }, at: [number, number], extra: Partial<ArchNode> = {}): ArchNode => ({ id, icon, name: c.name, role: c.role, at, ...extra });

/** Which flow for which app. */
const choose: Builder = (d) => {
  const c = d.pages.auth.choose;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'auth-choose',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('web', 'lucide/browser', n.web, [0, 0]),
        node('native', 'lucide/smartphone', n.native, [0, 1.2]),
        node('tv', 'lucide/tv', n.tv, [0, 2.4]),
        node('issuer', 'lucide/key-round', n.issuer, [1.8, 1.2]),
        node('server', 'lucide/server', n.server, [3.6, 0.6]),
        node('api', 'lucide/shield-check', n.api, [3.6, 1.8]),
      ],
      groups: [
        { id: 'apps', label: c.group.apps, members: ['web', 'native', 'tv'] },
        { id: 'servers', label: c.group.servers, members: ['server', 'api'] },
      ],
      edges: [
        { from: 'web', to: 'issuer', flow: 'request', label: e.web, fromSide: 'e', toSide: 'n' },
        { from: 'native', to: 'issuer', flow: 'request', label: e.native, fromSide: 'e', toSide: 'w' },
        { from: 'tv', to: 'issuer', flow: 'request', label: e.tv, fromSide: 'e', toSide: 's' },
        { from: 'server', to: 'issuer', flow: 'request', label: e.server, fromSide: 'w', toSide: 'e' },
        { from: 'issuer', to: 'api', flow: 'request', label: e.keys, fromSide: 'e', toSide: 'w' },
      ],
    },
    wide: { colW: 260, rowH: 120, pad: 40 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      at: stack([
        [['web', 'native'], 0],
        [['tv'], 1.4],
        [['issuer'], 1.6],
        [['server', 'api'], 2],
      ]),
      edges: [
        { from: 'web', to: 'issuer', flow: 'request', label: e.web, fromSide: 'w', toSide: 'w' },
        { from: 'native', to: 'issuer', flow: 'request', label: e.native, fromSide: 'e', toSide: 'e' },
        { from: 'tv', to: 'issuer', flow: 'request', label: e.tv, fromSide: 's', toSide: 'n' },
        { from: 'server', to: 'issuer', flow: 'request', label: e.server, fromSide: 'n', toSide: 's' },
        { from: 'issuer', to: 'api', flow: 'request', label: e.keys, fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

const WIDE = { colW: 250, rowH: 54 };
const NARROW = { colW: 104, rowH: 50, iconSize: 28 };

const sso: Builder = (d) => {
  const c = d.pages.auth.sso;
  const s = c.step;
  const steps: SeqStep[] = [
    { from: 'browser', to: 'app', label: s.open, code: 'GET /login', flow: 'request' },
    { from: 'app', to: 'issuer', label: s.send, code: 'GET /authorize', flow: 'request' },
    { from: 'issuer', to: 'issuer', label: s.session, code: '__session', flow: 'request' },
    { from: 'issuer', to: 'app', label: s.code, code: '302 redirect_uri?code&state', flow: 'request' },
    { from: 'app', to: 'issuer', label: s.exchange, code: 'POST /token', flow: 'request' },
    { from: 'issuer', to: 'app', label: s.tokens, code: 'access_token · refresh_token', flow: 'request', reply: true },
    { note: s.note, over: ['browser', 'issuer'] },
  ];
  return {
    kind: 'seq',
    spec: {
      id: 'auth-sso',
      title: c.title,
      desc: c.desc,
      actors: [
        { id: 'browser', icon: 'lucide/browser', ...c.actor.browser },
        { id: 'app', icon: 'lucide/server', ...c.actor.app },
        { id: 'issuer', icon: 'lucide/key-round', ...c.actor.issuer },
      ],
      steps,
    },
    wide: WIDE,
    narrow: NARROW,
  };
};

const life: Builder = (d) => {
  const c = d.pages.auth.life;
  const s = c.step;
  return {
    kind: 'seq',
    spec: {
      id: 'auth-life',
      title: c.title,
      desc: c.desc,
      actors: [
        { id: 'app', icon: 'lucide/smartphone', ...c.actor.app },
        { id: 'api', icon: 'lucide/shield-check', ...c.actor.api },
        { id: 'list', icon: 'cloudflare/kv', ...c.actor.list },
        { id: 'issuer', icon: 'lucide/key-round', ...c.actor.issuer },
      ],
      steps: [
        { from: 'app', to: 'api', label: s.call, code: 'Authorization: Bearer', flow: 'request' },
        { from: 'api', to: 'list', label: s.check, code: 'u:<usr_id> · s:<sid>', flow: 'request' },
        { from: 'api', to: 'app', label: s.answer, flow: 'request', reply: true },
        { from: 'app', to: 'issuer', label: s.refresh, code: 'POST /token', flow: 'request' },
        { from: 'issuer', to: 'app', label: s.tokens, code: 'access_token · refresh_token', flow: 'request', reply: true },
        { from: 'app', to: 'issuer', label: s.revoke, code: 'POST /account/sign-out-all', flow: 'request' },
        { from: 'issuer', to: 'list', label: s.record, code: 'u:<usr_id>', flow: 'request' },
      ],
    },
    wide: { colW: 220, rowH: 54 },
    narrow: { colW: 78, rowH: 50, iconSize: 26 },
  };
};

const web: Builder = (d) => {
  const c = d.pages.auth.web;
  const s = c.step;
  return {
    kind: 'seq',
    spec: {
      id: 'auth-web',
      title: c.title,
      desc: c.desc,
      actors: [
        { id: 'browser', icon: 'lucide/browser', ...c.actor.browser },
        { id: 'site', icon: 'lucide/server', ...c.actor.site },
        { id: 'issuer', icon: 'lucide/key-round', ...c.actor.issuer },
      ],
      steps: [
        { from: 'browser', to: 'site', label: s.start, code: 'GET /login', flow: 'request' },
        { from: 'site', to: 'browser', label: s.send, code: '302 /authorize?state&code_challenge', flow: 'request' },
        { from: 'browser', to: 'issuer', label: s.sign, code: 'GET /authorize', flow: 'request' },
        { from: 'issuer', to: 'site', label: s.back, code: '302 redirect_uri?code&state', flow: 'request' },
        { note: s.note, over: ['browser', 'site'] },
        { from: 'site', to: 'issuer', label: s.exchange, code: 'POST /token · code_verifier', flow: 'request' },
        { from: 'issuer', to: 'site', label: s.tokens, code: 'access_token · refresh_token', flow: 'request', reply: true },
      ],
    },
    wide: WIDE,
    narrow: NARROW,
  };
};

const race: Builder = (d) => {
  const c = d.pages.auth.race;
  const s = c.step;
  return {
    kind: 'seq',
    spec: {
      id: 'auth-race',
      title: c.title,
      desc: c.desc,
      actors: [
        { id: 'a', icon: 'lucide/browser', ...c.actor.a },
        { id: 'b', icon: 'lucide/browser', ...c.actor.b },
        { id: 'issuer', icon: 'lucide/key-round', ...c.actor.issuer },
      ],
      steps: [
        { from: 'a', to: 'issuer', label: s.first, code: 'POST /token', flow: 'request' },
        { from: 'issuer', to: 'a', label: s.tokens, code: 'refresh_token', flow: 'request', reply: true },
        { from: 'b', to: 'issuer', label: s.second, code: 'POST /token', flow: 'request' },
        { from: 'issuer', to: 'b', label: s.also, code: 'refresh_token', flow: 'request', reply: true },
        { from: 'b', to: 'issuer', label: s.late, code: 'POST /token', flow: 'request' },
        { from: 'issuer', to: 'b', label: s.end, code: 'invalid_grant', flow: 'request', reply: true },
      ],
    },
    wide: WIDE,
    narrow: NARROW,
  };
};

const out: Builder = (d) => {
  const c = d.pages.auth.out;
  const s = c.step;
  return {
    kind: 'seq',
    spec: {
      id: 'auth-out',
      title: c.title,
      desc: c.desc,
      actors: [
        { id: 'browser', icon: 'lucide/browser', ...c.actor.browser },
        { id: 'site', icon: 'lucide/server', ...c.actor.site },
        { id: 'issuer', icon: 'lucide/key-round', ...c.actor.issuer },
        { id: 'others', icon: 'lucide/layers', ...c.actor.others },
      ],
      steps: [
        { from: 'browser', to: 'site', label: s.out, code: 'POST /logout', flow: 'request' },
        { from: 'site', to: 'site', label: s.clear, flow: 'request' },
        { from: 'site', to: 'issuer', label: s.send, code: 'GET /logout?return', flow: 'request' },
        { from: 'issuer', to: 'issuer', label: s.end, code: '__session', flow: 'request' },
        { from: 'issuer', to: 'others', label: s.visit, code: '302 /logout?next', flow: 'request' },
        { from: 'issuer', to: 'browser', label: s.back, code: '302 return', flow: 'request' },
      ],
    },
    wide: { colW: 220, rowH: 54 },
    narrow: { colW: 78, rowH: 50, iconSize: 26 },
  };
};

/** A three-participant sequence. */
const seq3 = (id: string, c: { title: string; desc: string }, actors: [string, string, { name: string; role: string }][], steps: SeqStep[], size: 'three' | 'four' = 'three') => ({
  kind: 'seq' as const,
  spec: { id, title: c.title, desc: c.desc, actors: actors.map(([aid, icon, a]) => ({ id: aid, icon, ...a })), steps },
  wide: size === 'four' ? { colW: 220, rowH: 54 } : WIDE,
  narrow: size === 'four' ? { colW: 78, rowH: 50, iconSize: 26 } : NARROW,
});

const native: Builder = (d) => {
  const c = d.pages.auth.native;
  const s = c.step;
  return seq3('auth-native', c, [['app', 'lucide/smartphone', c.actor.app], ['browser', 'lucide/browser', c.actor.browser], ['issuer', 'lucide/key-round', c.actor.issuer]], [
    { from: 'app', to: 'browser', label: s.open, code: 'GET /authorize', flow: 'request' },
    { note: s.note, over: ['app', 'browser'] },
    { from: 'browser', to: 'issuer', label: s.sign, code: 'code_challenge', flow: 'request' },
    { from: 'issuer', to: 'app', label: s.back, code: 'alummahnow-studio://auth/callback', flow: 'request' },
    { from: 'app', to: 'issuer', label: s.exchange, code: 'POST /token · install_id', flow: 'request' },
    { from: 'issuer', to: 'app', label: s.tokens, code: 'access_token · refresh_token', flow: 'request', reply: true },
  ]);
};

const passkey: Builder = (d) => {
  const c = d.pages.auth.passkey;
  const s = c.step;
  return seq3('auth-passkey', c, [['platform', 'lucide/shield-check', c.actor.platform], ['app', 'lucide/smartphone', c.actor.app], ['issuer', 'lucide/key-round', c.actor.issuer]], [
    { from: 'app', to: 'issuer', label: s.ask, code: 'POST /native/passkey/options', flow: 'request' },
    { from: 'issuer', to: 'app', label: s.challenge, code: 'challenge_id', flow: 'request', reply: true },
    { from: 'app', to: 'platform', label: s.sign, code: 'publicKey', flow: 'request' },
    { from: 'app', to: 'issuer', label: s.send, code: 'POST /native/passkey/verify', flow: 'request' },
    { from: 'issuer', to: 'app', label: s.code, code: 'code', flow: 'request', reply: true },
    { from: 'app', to: 'issuer', label: s.exchange, code: 'POST /token', flow: 'request' },
  ]);
};

const device: Builder = (d) => {
  const c = d.pages.auth.device;
  const s = c.step;
  return seq3('auth-device', c, [['tv', 'lucide/tv', c.actor.tv], ['phone', 'lucide/smartphone', c.actor.phone], ['issuer', 'lucide/key-round', c.actor.issuer]], [
    { from: 'tv', to: 'issuer', label: s.start, code: 'POST /device_authorization', flow: 'request' },
    { from: 'issuer', to: 'tv', label: s.codes, code: 'user_code · device_code', flow: 'request', reply: true },
    { from: 'phone', to: 'issuer', label: s.approve, code: 'POST /activate', flow: 'request' },
    { from: 'tv', to: 'issuer', label: s.poll, code: 'POST /token · device_code', flow: 'request' },
    { from: 'issuer', to: 'tv', label: s.tokens, code: 'access_token · refresh_token', flow: 'request', reply: true },
    { note: s.note, over: ['tv', 'issuer'] },
  ]);
};

const own: Builder = (d) => {
  const c = d.pages.auth.own;
  const s = c.step;
  return seq3('auth-own', c, [['a', 'lucide/server', c.actor.a], ['issuer', 'lucide/key-round', c.actor.issuer], ['b', 'lucide/server', c.actor.b]], [
    { from: 'a', to: 'issuer', label: s.ask, code: 'POST /token · client_credentials', flow: 'request' },
    { from: 'issuer', to: 'a', label: s.token, code: 'access_token · scope', flow: 'request', reply: true },
    { from: 'a', to: 'b', label: s.call, code: 'Authorization: Bearer', flow: 'request' },
    { from: 'b', to: 'issuer', label: s.keys, code: 'GET jwks.json', flow: 'request' },
    { from: 'b', to: 'a', label: s.answer, flow: 'request', reply: true },
  ]);
};

const pass: Builder = (d) => {
  const c = d.pages.auth.pass;
  const s = c.step;
  return seq3('auth-pass', c, [['app', 'lucide/smartphone', c.actor.app], ['a', 'lucide/server', c.actor.a], ['b', 'lucide/server', c.actor.b]], [
    { from: 'app', to: 'a', label: s.call, code: 'Authorization: Bearer', flow: 'request' },
    { from: 'a', to: 'a', label: s.check, flow: 'request' },
    { from: 'a', to: 'b', label: s.forward, code: 'Authorization: Bearer', flow: 'request' },
    { from: 'b', to: 'b', label: s.roles, flow: 'request' },
    { from: 'b', to: 'a', label: s.answer, flow: 'request', reply: true },
    { from: 'a', to: 'app', label: s.done, flow: 'request', reply: true },
  ]);
};

/** The APIs that take the client's secret directly. */
const direct: Builder = (d) => {
  const c = d.pages.auth.direct;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'auth-direct',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('server', 'lucide/server', n.server, [0, 1.2]),
        node('invite', 'lucide/mail', n.invite, [1.7, 0]),
        node('moderation', 'lucide/shield-check', n.moderation, [1.7, 1.2]),
        node('revoke', 'lucide/lock', n.revoke, [1.7, 2.4]),
        node('db', 'cloudflare/d1', n.db, [3.4, 0.6]),
        node('audit', 'cloudflare/queues', n.audit, [3.4, 1.8]),
      ],
      groups: [{ id: 'issuer', label: c.group.issuer, members: ['invite', 'moderation', 'revoke'] }],
      edges: [
        { from: 'server', to: 'invite', flow: 'request', label: e.call, fromSide: 'n', toSide: 'w' },
        { from: 'server', to: 'moderation', flow: 'request', label: e.call, fromSide: 'e', toSide: 'w' },
        { from: 'server', to: 'revoke', flow: 'request', label: e.call, fromSide: 's', toSide: 'w' },
        { from: 'issuer', to: 'db', flow: 'request', label: e.write, fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'audit', flow: 'async', label: e.audit, fromSide: 'e', toSide: 'w' },
      ],
    },
    wide: { colW: 260, rowH: 120, pad: 40 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      at: stack([
        [['server'], 0],
        [['invite', 'revoke'], 1.9],
        [['moderation'], 1.4],
        [['db', 'audit'], 2],
      ]),
      edges: [
        { from: 'server', to: 'invite', flow: 'request', label: e.call, fromSide: 'w', toSide: 'n' },
        { from: 'server', to: 'moderation', flow: 'request', label: e.call, fromSide: 's', toSide: 'n' },
        { from: 'server', to: 'revoke', flow: 'request', label: e.call, fromSide: 'e', toSide: 'n' },
        { from: 'issuer', to: 'db', flow: 'request', label: e.write, fromSide: 's', toSide: 'n' },
        { from: 'issuer', to: 'audit', flow: 'async', label: e.audit, fromSide: 's', toSide: 'n' },
      ],
    },
  };
};

const check: Builder = (d) => {
  const c = d.pages.auth.check;
  const s = c.step;
  return seq3('auth-check', c, [['app', 'lucide/smartphone', c.actor.app], ['api', 'lucide/shield-check', c.actor.api], ['keys', 'lucide/key-round', c.actor.keys], ['list', 'cloudflare/kv', c.actor.list]], [
    { from: 'app', to: 'api', label: s.call, code: 'Authorization: Bearer', flow: 'request' },
    { from: 'api', to: 'keys', label: s.keys, code: 'GET jwks.json', flow: 'request' },
    { from: 'api', to: 'api', label: s.verify, code: 'iss · aud · exp · mode', flow: 'request' },
    { from: 'api', to: 'list', label: s.list, code: 'u:<usr_id> · s:<sid>', flow: 'request' },
    { from: 'api', to: 'app', label: s.answer, flow: 'request', reply: true },
  ], 'four');
};

const keys: Builder = (d) => {
  const c = d.pages.auth.keys;
  const s = c.step;
  return seq3('auth-keys', c, [['job', 'lucide/timer', c.actor.job], ['issuer', 'lucide/key-round', c.actor.issuer], ['jwks', 'lucide/globe', c.actor.jwks], ['api', 'lucide/shield-check', c.actor.api]], [
    { from: 'job', to: 'issuer', label: s.queue, code: 'ROTATE_EVERY_MS', flow: 'async' },
    { from: 'issuer', to: 'jwks', label: s.publish, code: 'PUBLISH_LEAD_MS', flow: 'request' },
    { from: 'api', to: 'jwks', label: s.read, code: 'GET jwks.json', flow: 'request' },
    { from: 'issuer', to: 'issuer', label: s.sign, code: 'kid', flow: 'request' },
    { from: 'issuer', to: 'jwks', label: s.retire, code: 'retireAfterMs', flow: 'request' },
  ], 'four');
};

/** Three ways a sign-in ends early, and who reads each. */
const end: Builder = (d) => {
  const c = d.pages.auth.end;
  const n = c.node;
  const e = c.edge;
  return {
    kind: 'arch',
    spec: {
      id: 'auth-end',
      title: c.title,
      desc: c.desc,
      motion: 'pulses',
      nodes: [
        node('all', 'lucide/globe', n.all, [0, 0]),
        node('browser', 'lucide/browser', n.browser, [0, 1.2]),
        node('install', 'lucide/smartphone', n.install, [0, 2.4]),
        node('db', 'cloudflare/d1', n.db, [1.7, 1.2]),
        node('list', 'cloudflare/kv', n.list, [3.2, 0.4]),
        node('issuer', 'lucide/key-round', n.issuer, [3.2, 2.0]),
        node('api', 'lucide/shield-check', n.api, [4.7, 0.4]),
      ],
      groups: [{ id: 'who', label: c.group.who, members: ['all', 'browser', 'install'] }],
      edges: [
        { from: 'who', to: 'db', flow: 'request', label: e.db, fromSide: 'e', toSide: 'w' },
        { from: 'db', to: 'list', flow: 'request', label: e.kv, fromSide: 'n', toSide: 'w' },
        { from: 'api', to: 'list', flow: 'request', label: e.api, fromSide: 'w', toSide: 'e' },
        { from: 'issuer', to: 'db', flow: 'request', label: e.issuer, fromSide: 'w', toSide: 's' },
      ],
    },
    wide: { colW: 220, rowH: 120, pad: 40 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      at: stack([
        [['all', 'browser'], 0],
        [['install'], 1.3],
        [['db'], 1.8],
        [['list', 'issuer'], 1.8],
        [['api'], 1.7],
      ]),
      edges: [
        { from: 'who', to: 'db', flow: 'request', label: e.db, fromSide: 's', toSide: 'n' },
        { from: 'db', to: 'list', flow: 'request', label: e.kv, fromSide: 'w', toSide: 'n' },
        { from: 'api', to: 'list', flow: 'request', label: e.api, fromSide: 'w', toSide: 's' },
        { from: 'issuer', to: 'db', flow: 'request', label: e.issuer, fromSide: 'n', toSide: 'e' },
      ],
    },
  };
};

export const builders: Record<string, Builder> = {
  'auth-choose': choose,
  'auth-sso': sso,
  'auth-life': life,
  'auth-web': web,
  'auth-race': race,
  'auth-out': out,
  'auth-native': native,
  'auth-passkey': passkey,
  'auth-device': device,
  'auth-own': own,
  'auth-pass': pass,
  'auth-direct': direct,
  'auth-check': check,
  'auth-keys': keys,
  'auth-end': end,
};
