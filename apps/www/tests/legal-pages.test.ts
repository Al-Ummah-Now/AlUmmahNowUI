import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Footer from '../src/components/Footer.astro';
import PageArticle from '../src/components/PageArticle.astro';
import { GET as privacyRedirect } from '../src/pages/privacy';
import { GET as termsRedirect } from '../src/pages/terms';
import { builtinContent } from '../src/content/fallback';
import { renderMarkdown } from '../src/lib/markdown';
import { buildSitemap } from '../src/lib/sitemap';
import { config } from '../src/lib/env';
import { FEATURES_HEADER } from '../src/lib/features';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const cfg = config({ APP_ENV: 'qa', SITE_URL: 'https://www.qa.alummahnow.net' });

describe('Privacy Policy and Terms of Service pages (AlUmmahNow#1929)', () => {
  for (const locale of ['en', 'ar'] as const) {
    for (const slug of ['privacy', 'terms'] as const) {
      it(`${locale}/${slug}: renders as frosted-glass sections with one h1 and links to contact`, async () => {
        const page = builtinContent(locale).pages[slug];
        expect(page).toBeDefined();
        const html = renderMarkdown(page!.body, { renderVideo: () => '' });
        const rendered = await container.renderToString(PageArticle, {
          props: { page: page!, html, cmsOrigin: 'https://cms.qa.alummahnow.net', built: null, locale, cfg },
        });
        expect(rendered).toContain(`<h1>${page!.title}</h1>`);
        expect(rendered).toContain('data-testid="page-sections"');
        expect(rendered).toContain('class="pb-glass-stack"');
        const sections = rendered.match(/class="pb-glass pb-glass-box prose"/g) ?? [];
        expect(sections.length).toBeGreaterThanOrEqual(5);
        expect(rendered).toContain(`href="/${locale}/contact/"`);
      });
    }
  }

  it('Arabic legal copy uses Eastern Arabic digits, Arabic commas, and «مرئي/مرئيات»', () => {
    const ar = builtinContent('ar').pages;
    for (const slug of ['privacy', 'terms'] as const) {
      const text = [ar[slug]!.title, ar[slug]!.summary ?? '', ar[slug]!.body].join('\n');
      const visible = text.replace(/https?:\/\/\S+/g, '').replace(/\(\/[^)]+\)/g, '');
      expect(visible, `${slug}: no ASCII digits in Arabic copy`).not.toMatch(/[0-9]/);
      expect(visible, `${slug}: uses Eastern Arabic digits`).toMatch(/[٠-٩]/);
      expect(visible, `${slug}: no thousands separator «٬»`).not.toContain('٬');
      expect(visible, `${slug}: never «فيديو»`).not.toContain('فيديو');
      expect(visible, `${slug}: no English comma`).not.toContain(',');
    }
  });

  it('deleted accounts and videos are purged after 30 days, never "within" (the cleanup starts then)', () => {
    for (const [locale, after, within] of [['en', 'after 30 days', /within (30|thirty) days/i], ['ar', 'بعد ٣٠ يومًا', /خلال ٣٠/]] as const) {
      for (const slug of ['privacy', 'terms'] as const) {
        const body = builtinContent(locale).pages[slug]!.body;
        expect(body, `${locale}/${slug}`).toContain(after);
        expect(body, `${locale}/${slug}`).not.toMatch(within);
      }
    }
  });

  it('neither page mentions internal budget or cap figures', () => {
    for (const locale of ['en', 'ar'] as const) {
      const pages = builtinContent(locale).pages;
      for (const slug of ['privacy', 'terms'] as const) {
        const text = `${pages[slug]!.title}\n${pages[slug]!.summary}\n${pages[slug]!.body}`;
        expect(text).not.toMatch(/\$\d|\/month|budget|ميزانية/i);
      }
    }
  });

  it('bare /privacy and /terms redirect to the negotiated locale with Vary headers', () => {
    const enPriv = privacyRedirect({ request: new Request('https://www.alummahnow.net/privacy') } as never) as Response;
    expect(enPriv.status).toBe(302);
    expect(enPriv.headers.get('Location')).toBe('/en/privacy/');
    expect(enPriv.headers.get('Vary')).toBe('Cookie, Accept-Language');

    const arPriv = privacyRedirect({
      request: new Request('https://www.alummahnow.net/privacy?ref=app', { headers: { 'Accept-Language': 'ar-EG,ar;q=0.9' } }),
    } as never) as Response;
    expect(arPriv.status).toBe(302);
    expect(arPriv.headers.get('Location')).toBe('/ar/privacy/?ref=app');

    const arTerms = termsRedirect({
      request: new Request('https://www.alummahnow.net/terms', { headers: { Cookie: 'aun_locale=ar' } }),
    } as never) as Response;
    expect(arTerms.status).toBe(302);
    expect(arTerms.headers.get('Location')).toBe('/ar/terms/');
  });

  it('footer links to Privacy Policy and Terms of Service in both locales without duplicates', async () => {
    for (const locale of ['en', 'ar'] as const) {
      const req = new Request(`https://www.qa.alummahnow.net/${locale}/`, { headers: { [FEATURES_HEADER]: 'n0' } });
      const html = await container.renderToString(Footer, {
        props: { locale, nav: [], settings: null, videosWebUrl: 'https://videos.qa.alummahnow.net' },
        request: req,
      });
      expect(html).toContain(`href="/${locale}/privacy/"`);
      expect(html).toContain(`href="/${locale}/terms/"`);
      expect(html).toContain('data-testid="footer-privacy"');
      expect(html).toContain('data-testid="footer-terms"');

      // When CMS nav already supplies Privacy/Terms, do not emit duplicates
      const dedup = await container.renderToString(Footer, {
        props: {
          locale,
          nav: [
            { label: 'Privacy', url: '/privacy/' },
            { label: 'Terms', url: '/terms/' },
          ],
          settings: null,
          videosWebUrl: 'https://videos.qa.alummahnow.net',
        },
        request: req,
      });
      expect(dedup.match(new RegExp(`href="/${locale}/privacy/"`, 'g'))).toHaveLength(1);
      expect(dedup.match(new RegExp(`href="/${locale}/terms/"`, 'g'))).toHaveLength(1);
    }
  });

  it('sitemap lists /en/privacy/, /ar/privacy/, /en/terms/, /ar/terms/ once each', () => {
    const site = 'https://www.alummahnow.net';
    const xml = buildSitemap(site, [], []);
    expect(xml).toContain(`<loc>${site}/en/privacy/</loc>`);
    expect(xml).toContain(`<loc>${site}/ar/privacy/</loc>`);
    expect(xml).toContain(`<loc>${site}/en/terms/</loc>`);
    expect(xml).toContain(`<loc>${site}/ar/terms/</loc>`);

    const withCms = buildSitemap(
      site,
      [
        { type: 'page', locale: 'en', slug: 'privacy', updated_at: '2026-11-25T00:00:00Z', translation_key: 'k-priv' },
        { type: 'page', locale: 'ar', slug: 'privacy', updated_at: '2026-11-25T00:00:00Z', translation_key: 'k-priv' },
      ],
      [],
    );
    expect(withCms.match(/<loc>https:\/\/www\.alummahnow\.net\/en\/privacy\/<\/loc>/g)).toHaveLength(1);
    expect(withCms.match(/<loc>https:\/\/www\.alummahnow\.net\/ar\/privacy\/<\/loc>/g)).toHaveLength(1);
  });
});
