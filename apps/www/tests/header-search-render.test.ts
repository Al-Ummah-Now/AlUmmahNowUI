/**
 * www's header search is the shared one (AlUmmahNow docs/design/NAV.md "Search"): rendered through Astro's
 * container, its elements, contract classes and working attributes match nav/header.js searchHtml(), with
 * www's suggestions (popup, list, status) inside the form. The menu panel no longer has a second search.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Header from '../src/components/Header.astro';
import { config } from '../src/lib/env';
import { searchHtml } from '../../../packages/render/src/nav/header.js';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const ATTRS = ['popover', 'popovertarget', 'popovertargetaction', 'method', 'data-testid'];
/** The search's elements in order: tag, aun-* classes and the attributes that make it work; the slot id named "slot". */
const skeleton = (markup: string) =>
  [...markup.matchAll(/<(button|div|form|input)\b([^>]*)>/g)]
    .map(([, tag, attrs]) => {
      const value = (a: string) => new RegExp(`\\s${a}="([^"]*)"`).exec(attrs!)?.[1];
      const cls = (value('class') ?? '').split(/\s+/).filter((c) => c.startsWith('aun-') && c !== 'aun-search-field'); // the field wrapper is optional (NAV.md)
      const kept = ATTRS.filter((a) => value(a) !== undefined).map((a) => `${a}=${a === 'popovertarget' ? 'slot' : value(a)}`);
      if (tag === 'form') kept.push(`role=${value('role')}`);
      if (tag === 'button') kept.push(`type=${value('type')}`);
      return cls.length || kept.some((k) => k.startsWith('popover') || k.startsWith('data-testid=header-search')) ? [tag, ...cls].join('.') + ' ' + kept.join(' ') : '';
    })
    .filter(Boolean);

describe('the header search = the shared contract', () => {
  for (const locale of ['en', 'ar'] as const) {
    it(`${locale}: searchHtml's elements and classes, suggestions inside the form`, async () => {
      const html = await container.renderToString(Header, {
        props: { cfg: config({ APP_ENV: 'qa', SESSION_SECRET: 'a'.repeat(64) }), locale, nav: [], switchHref: '/' },
        request: new Request(`https://www.qa.alummahnow.net/${locale}/`),
      });
      const start = html.indexOf('class="aun-icon-btn aun-search-open"');
      const search = html.slice(html.lastIndexOf('<button', start), html.indexOf('<div class="aun-header-tools"'));
      expect(skeleton(search)).toEqual(skeleton(searchHtml({ lang: locale, action: `/${locale}/search` })));
      expect(search).toContain(`action="/${locale}/search"`);
      expect(search).toMatch(/<input[^>]*class="aun-search-input"[^>]*role="combobox"|<input[^>]*role="combobox"[^>]*class="aun-search-input"/);
      expect(search).toContain('data-search-popup');
      expect(search).toContain(`aria-label="${locale === 'ar' ? 'رجوع' : 'Back'}"`);
      // one search: the menu panel holds the links only
      const panel = html.slice(html.indexOf('id="site-menu"'), html.indexOf('</header>'));
      expect(panel).not.toContain('data-search');
    });
  }
});
