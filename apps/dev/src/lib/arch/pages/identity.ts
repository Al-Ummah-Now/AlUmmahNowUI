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
        node('apps', 'lucide/users', n.apps, [0, 1.3]),
        node('turnstile', 'cloudflare/turnstile', n.turnstile, [1.4, 0]),
        node('limiters', 'cloudflare/waf', n.limiters, [2.6, 0]),
        node('issuer', 'cloudflare/workers', n.issuer, [1.4, 1.3]),
        node('profile', 'cloudflare/workers', n.profile, [1.4, 2.6]),
        node('authAdmin', 'cloudflare/workers', n.authAdmin, [2.6, 2.6]),
        node('kvStore', 'cloudflare/kv', n.kvStore, [3.8, 0]),
        node('d1', 'cloudflare/d1', n.d1, [3.8, 1.3]),
        node('revKv', 'cloudflare/kv', n.revKv, [3.8, 2.6]),
        // under the apps, one column with Resend: the token drops straight into it and the check runs under Auth up
        // into the revocations, so no column of the figure holds an empty block
        node('videos', 'cloudflare/workers', n.videos, [0, 2.6]),
      ],
      groups: [
        { id: 'auth', label: c.group.auth, caption: c.caption.auth, pad: 28, members: ['turnstile', 'limiters', 'issuer', 'profile', 'authAdmin', 'kvStore', 'd1', 'revKv'] },
        { id: 'videosG', label: c.group.videos, caption: c.caption.videos, members: ['videos'] },
        { id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', tagEnd: true, pad: 40, members: ['auth', 'videosG'] },
      ],
      edges: [
        { from: 'apps', to: 'issuer', flow: 'request', label: e.signIn, fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'resend', flow: 'async', label: e.code, fromSide: 'w', toSide: 'e' },
        { from: 'turnstile', to: 'issuer', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'limiters', to: 'issuer', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'profile', to: 'issuer', flow: 'request', label: e.client, fromSide: 'n', toSide: 's' },
        { from: 'authAdmin', to: 'issuer', flow: 'request', label: e.confidential, fromSide: 'n', toSide: 's' },
        { from: 'issuer', to: 'kvStore', flow: 'request', fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'd1', flow: 'request', fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'revKv', flow: 'async', label: e.revoke, fromSide: 'e', toSide: 'w' },
        // its words under the run along Auth's foot: above it they would sit inside Auth
        { from: 'videos', to: 'revKv', flow: 'request', label: e.check, fromSide: 'e', toSide: 's', labelBelow: true },
        { from: 'apps', to: 'videos', flow: 'request', label: e.token, fromSide: 's', toSide: 'n' },
      ],
    },
    // the account boundary would hold Videos and Auth but not the clients beside them, leaving a block of nothing:
    // on desktop Videos says it is in the same account instead
    wide: { colW: 300, rowH: 170, pad: 40, hideGroups: ['cf'] },
    narrow: {
      // the account boundary is drawn here, so Videos needs no word that it is inside it
      hideCaptions: ['videosG'],
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      at: stack([
        // the apps centred over the account: sign-in drops straight down the middle lane into the issuer
        [['apps'], 0],
        [['profile', 'authAdmin'], 2.3],
        [['turnstile', 'limiters'], 1.4],
        [['issuer'], 1.4],
        [['kvStore', 'd1'], 1.5],
        [['revKv'], 1.4],
        [['videos'], 2.2],
        [['resend'], 2.2],
      ]),
      edges: [
        { from: 'apps', to: 'issuer', flow: 'request', label: e.signIn, fromSide: 's', toSide: 'n' },
        { from: 'issuer', to: 'resend', flow: 'async', label: e.code, fromSide: 'w', toSide: 'w' },
        { from: 'turnstile', to: 'issuer', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'limiters', to: 'issuer', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'profile', to: 'issuer', flow: 'request', fromSide: 'w', toSide: 'w' },
        { from: 'authAdmin', to: 'issuer', flow: 'request', fromSide: 'e', toSide: 'e' },
        { from: 'issuer', to: 'kvStore', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'issuer', to: 'd1', flow: 'request', fromSide: 's', toSide: 'n' },
        { from: 'issuer', to: 'revKv', flow: 'async', label: e.revoke, fromSide: 's', toSide: 'n' },
        { from: 'videos', to: 'revKv', flow: 'request', label: e.check, fromSide: 'n', toSide: 's' },
        { from: 'apps', to: 'videos', flow: 'request', label: e.token, fromSide: 'e', toSide: 'e' },
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
        // in the channel between the browser's redirect and the app's exchanges, outside the account: the code e-mail
        // drops from the issuer's foot outside the app's exchanges and runs straight in, the browser's two wires keep
        // the issuer's side to themselves (straight), and the figure needs no row above for it
        node('resend', 'simple-icons/resend', n.resend, [1.1, 1.0]),
        node('issuer', 'cloudflare/workers', n.issuer, [2.2, 0]),
        // the stores one gap beside the issuer and the API, the refresh tokens' store halfway down between them: no
        // empty block inside the account
        node('d1', 'cloudflare/d1', n.d1, [3.4, 1.3]),
        // straight under the browser: the callback lands on the app's middle, clear of the wires leaving its side
        node('app', 'lucide/smartphone', n.app, [0, 1.8]),
        node('api', 'cloudflare/workers', n.api, [2.2, 2.6]),
        node('revKv', 'cloudflare/kv', n.revKv, [3.4, 2.6]),
      ],
      groups: [{ id: 'cf', label: c.group.cf, kind: 'boundary', tag: 'simple-icons/cloudflare', tagEnd: true, members: ['issuer', 'd1', 'api', 'revKv'] }],
      edges: [
        { from: 'user', to: 'issuer', flow: 'request', label: e.authorize, step: 1, fromSide: 'e', toSide: 'w' },
        { from: 'issuer', to: 'resend', flow: 'async', label: e.email, step: 2, fromSide: 's', toSide: 'e' },
        { from: 'issuer', to: 'user', flow: 'request', label: e.redirect, step: 3, fromSide: 'w', toSide: 'e' },
        { from: 'user', to: 'app', flow: 'request', label: e.callback, step: 4, fromSide: 's', toSide: 'n' },
        { from: 'app', to: 'issuer', flow: 'request', label: e.exchange, step: 5, fromSide: 'e', toSide: 's' },
        { from: 'issuer', to: 'app', flow: 'request', label: e.tokens, step: 6, fromSide: 's', toSide: 'e' },
        { from: 'app', to: 'api', flow: 'request', label: e.call, step: 7, fromSide: 's', toSide: 'w' },
        { from: 'api', to: 'revKv', flow: 'request', label: e.check, step: 8, fromSide: 'e', toSide: 'w' },
        { from: 'app', to: 'issuer', flow: 'request', label: e.refresh, step: 9, fromSide: 'e', toSide: 's' },
        { from: 'issuer', to: 'd1', flow: 'request', step: 10, fromSide: 'e', toSide: 'n' },
      ],
    },
    // the app's three exchanges run as one bundle: room between them for the middle wire's words on its line
    wide: { colW: 300, rowH: 136, pad: 40, portStep: 32 },
    narrow: {
      colW: 180,
      rowH: 100,
      iconSize: 34,
      pad: 44,
      // the person and the app on top, the account below them with its tag along the bottom edge: the browser's two
      // wires drop straight into the issuer, the app's three exchanges come into its side as nested Ls, and the API
      // call runs straight down
      tagBottom: ['cf'],
      portStep: 24,
      at: { user: [0, 0], app: [1, 0], issuer: [0, 3.2], d1: [0, 4.8], api: [1.1, 4.8], revKv: [1.1, 6.4], resend: [0, 8.5] },
      edges: [
        { from: 'user', to: 'issuer', flow: 'request', label: e.authorize, step: 1, fromSide: 's', toSide: 'n' },
        { from: 'issuer', to: 'resend', flow: 'async', label: e.email, step: 2, fromSide: 'w', toSide: 'w' },
        { from: 'issuer', to: 'user', flow: 'request', label: e.redirect, step: 3, fromSide: 'n', toSide: 's' },
        { from: 'user', to: 'app', flow: 'request', label: e.callback, step: 4, fromSide: 'e', toSide: 'w' },
        // the tokens wire nests outermost: its long words sit in the open lane beside it
        { from: 'issuer', to: 'app', flow: 'request', label: e.tokens, step: 6, fromSide: 'e', toSide: 's' },
        { from: 'app', to: 'issuer', flow: 'request', label: e.exchange, step: 5, fromSide: 's', toSide: 'e' },
        { from: 'app', to: 'api', flow: 'request', label: e.call, step: 7, fromSide: 's', toSide: 'n' },
        { from: 'api', to: 'revKv', flow: 'request', label: e.check, step: 8, fromSide: 's', toSide: 'n' },
        // the refresh comes in under the issuer: on its side it would be the third of a bundle, its words with no room
        { from: 'app', to: 'issuer', flow: 'request', label: e.refresh, step: 9, fromSide: 's', toSide: 's' },
        { from: 'issuer', to: 'd1', flow: 'request', step: 10, fromSide: 's', toSide: 'n' },
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
      // a relation between the two, not a flow: no arrowhead
      { from: 'siteRoles', to: 'channelRoles', fromSide: 'e' as const, toSide: 'w' as const, dashed: true, noHead: true, tag: t.neither, tone: 'pink' as const },
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
      at: { channelRoles: [0, 0], siteRoles: [0, 1.4], token: [0, 2.4], transfer: [0, 3.4], record: [0, 4.4], can: [0, 5.4] },
      // one column, every wire the wide figure draws: the two role systems next to each other at the top ("neither
      // grants the other" bows out to the right), the token and ownership chain straight down, "never in a token" down the
      // left margin and channel roles → record down the right; the two relation tags stacked in the gap, lined up on
      // the start side
      edges: [
        { from: 'siteRoles', to: 'channelRoles', fromSide: 'e', toSide: 'e', bend: 70, tagAt: 0.3, tagGap: ['channelRoles', 'siteRoles', 20], tagStart: 106, tagEnd: 308 },
        { from: 'siteRoles', to: 'token', fromSide: 's', toSide: 'n' },
        { from: 'token', to: 'transfer', fromSide: 's', toSide: 'n' },
        { from: 'transfer', to: 'record', fromSide: 's', toSide: 'n' },
        { from: 'record', to: 'can', fromSide: 's', toSide: 'n' },
        // the farther wire first (its end spreads to the outer side) and bowed in proportion to its length, so the two
        // leave at the same angle and never cross
        // channel roles → channel record down the right margin, outside "neither grants the other": the left margin
        // keeps only "never in a token", and "stored in" sits beside its own wire in the gap under the token, well away
        // from the token → transfer arrow
        { from: 'channelRoles', to: 'record', fromSide: 'e', toSide: 'e', bend: -130, tagGap: ['token', 'transfer', 0] },
        { from: 'channelRoles', to: 'token', fromSide: 'w', toSide: 'w', bend: 50, tagAt: 0.2, tagGap: ['channelRoles', 'siteRoles', -36], tagStart: 106, tagEnd: 308 },
      ],
    },
  };
};

export const builders: Record<string, Builder> = { 'identity-map': map, 'identity-signin': signin, 'identity-roles': roles };
