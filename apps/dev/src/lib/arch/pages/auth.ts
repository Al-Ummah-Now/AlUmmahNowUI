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
        { from: 'api', to: 'list', label: s.check, code: 'user · s:<sid>', flow: 'request' },
        { from: 'api', to: 'app', label: s.answer, flow: 'request', reply: true },
        { from: 'app', to: 'issuer', label: s.refresh, code: 'POST /token', flow: 'request' },
        { from: 'issuer', to: 'app', label: s.tokens, code: 'access_token · refresh_token', flow: 'request', reply: true },
        { from: 'app', to: 'issuer', label: s.revoke, code: 'POST /account/sign-out-all', flow: 'request' },
        { from: 'issuer', to: 'list', label: s.record, code: 'user', flow: 'request' },
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

export const builders: Record<string, Builder> = { 'auth-choose': choose, 'auth-sso': sso, 'auth-life': life, 'auth-web': web, 'auth-race': race, 'auth-out': out };
