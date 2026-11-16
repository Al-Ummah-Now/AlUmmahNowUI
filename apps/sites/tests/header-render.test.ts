/**
 * Owner rule: sign-in that isn't configured is invisible. The scholar site header, rendered through
 * Astro's container, has Sign in and the account menu only with a valid SESSION_SECRET.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import SiteHeader from '../src/components/SiteHeader.astro';
import { config } from '../src/lib/env';
import { strings } from '../src/lib/i18n';
import { fixtureSite } from './fixtures';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

describe('scholar site header Sign in', () => {
  for (const locale of ['en', 'ar'] as const) {
    const render = (secret: string | undefined) => {
      const site = fixtureSite();
      const ctx = { cfg: config({ APP_ENV: 'qa', SESSION_SECRET: secret }), site, locale, t: strings(locale), data: {} as never, scheme: 'https', channelHref: 'https://videos' };
      return container.renderToString(SiteHeader, { props: { ctx, alternates: { en: '/en/', ar: '/ar/' } }, request: new Request(`https://mustafa-elbadry.qa.alummahnow.org/${locale}/`) });
    };
    it(`${locale}: Sign in and the account menu with a valid SESSION_SECRET`, async () => {
      const html = await render('a'.repeat(64));
      expect(html).toContain('/auth/login?return=');
      expect(html).toContain('id="account"');
    });
    for (const secret of [undefined, 'short']) {
      it(`${locale}: neither when SESSION_SECRET is ${JSON.stringify(secret)}`, async () => {
        const html = await render(secret);
        expect(html).not.toContain('/auth/login');
        expect(html).not.toContain('id="account"');
        expect(html).not.toMatch(/not available|not configured/i);
        expect(html).toContain('id="mode-toggle"');
      });
    }
  }
});
