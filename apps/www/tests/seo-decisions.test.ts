import { describe, expect, it } from 'vitest';
import { AI_TRAINING_CRAWLERS, itemListLd, robotsTxt, websiteLd } from '../src/lib/seo';
import type { Config } from '../src/lib/env';

const cfg = { siteUrl: 'https://www.alummahnow.net', videosWebUrl: 'https://videos.alummahnow.net' } as Config;

describe('robots.txt AI crawler rules (D-SEO-8)', () => {
  const txt = robotsTxt(true, cfg.siteUrl);
  it('blocks every training-only crawler', () => {
    for (const bot of ['GPTBot', 'CCBot', 'Google-Extended', 'ClaudeBot', 'Applebot-Extended', 'Bytespider']) {
      expect(AI_TRAINING_CRAWLERS).toContain(bot);
      expect(txt).toContain(`User-agent: ${bot}\nDisallow: /\n`);
    }
  });
  it('leaves search and answer bots on the general rules', () => {
    for (const bot of ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot', 'Googlebot', 'Bingbot']) expect(txt).not.toContain(`User-agent: ${bot}`);
    expect(txt.startsWith('User-agent: *\nAllow: /\nDisallow: /auth/\nDisallow: /preview\n')).toBe(true);
    expect(txt).toContain('Sitemap: https://www.alummahnow.net/sitemap.xml');
  });
});

describe('JSON-LD', () => {
  it('WebSite carries a SearchAction to the site search', () => {
    expect(websiteLd(cfg, 'Al Ummah Now', 'ar').potentialAction.target.urlTemplate).toBe('https://www.alummahnow.net/ar/search?q={search_term_string}');
  });
  it('a list page is an ItemList of watch links, not VideoObjects', () => {
    const ld = itemListLd(cfg, [{ kind: 'video', id: 'a1b2c3d4-0000-4000-8000-000000000001' }, { kind: 'channel', id: 'c' }] as never, 'en');
    expect(ld?.['@type']).toBe('ItemList');
    expect(ld?.itemListElement).toEqual([{ '@type': 'ListItem', position: 1, url: 'https://videos.alummahnow.net/en/video/a1b2c3d4-0000-4000-8000-000000000001' }]);
    expect(itemListLd(cfg, [], 'en')).toBeNull();
  });
});
