/**
 * Owner rule: a feature that is off or unconfigured is invisible. Rendered through Astro's container:
 * the footer's newsletter section and the header's Sign in (with the account probe's #account box)
 * appear only when the feature works; the newsletter pages are 404 when it doesn't.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Footer from '../src/components/Footer.astro';
import Header from '../src/components/Header.astro';
import NewsletterPage from '../src/pages/[locale]/newsletter/index.astro';
import ConfirmPage from '../src/pages/[locale]/newsletter/confirm.astro';
import UnsubscribePage from '../src/pages/[locale]/newsletter/unsubscribe.astro';
import { config, type WwwEnv } from '../src/lib/env';
import { FEATURES_HEADER } from '../src/lib/features';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';

const SECRET = 'a'.repeat(64);
let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const req = (path: string, newsletter: boolean, init: RequestInit = {}) =>
  new Request(`https://www.qa.alummahnow.net${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), [FEATURES_HEADER]: newsletter ? 'n1' : 'n0' } });

describe('footer newsletter section', () => {
  for (const locale of ['en', 'ar'] as const) {
    const props = { locale, nav: [], settings: null, videosWebUrl: 'https://videos.qa.alummahnow.net' };
    const t = locale === 'en' ? en : ar;
    it(`${locale}: shown with its form when the newsletter is on`, async () => {
      const html = await container.renderToString(Footer, { props, request: req(`/${locale}/`, true) });
      expect(html).toContain('data-testid="footer-newsletter"');
      expect(html).toContain(`action="/${locale}/newsletter/"`);
      expect(html).toContain(t.newsletter.title);
    });
    it(`${locale}: left out entirely when it is off (no section, no form, no "not working" text)`, async () => {
      const html = await container.renderToString(Footer, { props, request: req(`/${locale}/`, false) });
      expect(html).not.toContain('footer-newsletter');
      expect(html).not.toContain('/newsletter/');
      expect(html).not.toContain(t.newsletter.title);
      expect(html).not.toContain(t.newsletter.unavailable);
      // the rest of the footer is still there
      expect(html).toContain('data-testid="footer-help"');
    });
  }
});

describe('header Sign in', () => {
  for (const locale of ['en', 'ar'] as const) {
    const render = (secret: string | undefined) =>
      container.renderToString(Header, { props: { cfg: config({ APP_ENV: 'qa', SESSION_SECRET: secret }), locale, nav: [], switchHref: '/' }, request: req(`/${locale}/`, true) });
    it(`${locale}: Sign in and the account box (the /auth/me probe) with a valid SESSION_SECRET`, async () => {
      const html = await render(SECRET);
      expect(html).toContain('/auth/login?return=');
      expect(html).toContain('id="account"');
      expect(html).toContain('data-me="/auth/me"');
    });
    for (const secret of [undefined, '', 'not-hex']) {
      it(`${locale}: neither when SESSION_SECRET is ${JSON.stringify(secret)}`, async () => {
        const html = await render(secret);
        expect(html).not.toContain('/auth/login');
        expect(html).not.toContain('id="account"');
        expect(html).not.toContain('data-me=');
        expect(html).not.toMatch(/not configured|SESSION_SECRET/i);
        // the rest of the header is still there
        expect(html).toContain('id="mode-toggle"');
      });
    }
  }
});

describe('newsletter pages when off', () => {
  const env: WwwEnv = { ADMIN_API_URL: 'http://127.0.0.1:9', SESSION_SECRET: SECRET };
  const locals = { runtime: { env, ctx: { waitUntil: () => undefined } } } as never;
  const render = (page: Parameters<AstroContainer['renderToResponse']>[0], path: string, init?: RequestInit) =>
    container.renderToResponse(page, { params: { locale: 'en' }, locals, request: req(path, false, init) });

  it('/newsletter/ GET and POST are 404', async () => {
    expect((await render(NewsletterPage, '/en/newsletter/')).status).toBe(404);
    const post = await render(NewsletterPage, '/en/newsletter/', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{"email":"a@b.org"}' });
    expect(post.status).toBe(404);
  });
  it('/newsletter/confirm is 404', async () => {
    expect((await render(ConfirmPage, '/en/newsletter/confirm?token=confirm-ok-aaaaaaaaaaaaaaaaaaaa')).status).toBe(404);
  });
  it('/newsletter/unsubscribe is 404 only when www cannot reach the admin API at all', async () => {
    const res = await container.renderToResponse(UnsubscribePage, {
      params: { locale: 'en' },
      locals: { runtime: { env: { APP_ENV: 'qa', ADMIN_API_URL: 'https://admin' } as WwwEnv, ctx: { waitUntil: () => undefined } } } as never,
      request: req('/en/newsletter/unsubscribe?token=unsub-ok-aaaaaaaaaaaaaaaaaaaaaa', false),
    });
    expect(res.status).toBe(404);
  });
});
