/**
 * The owner's number rule (2026-11-21) on a rendered scholar post: likes and comments from 1,000 on
 * are compact and cut («٤٫٨ ألف إعجاب», "4.8K likes"), Arabic is never grouped («٬» never appears)
 * and the Arabic meta line joins with «،», never «·».
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import PostCard from '../src/components/PostCard.astro';
import PostEngagement from '../../../packages/render/src/posts/PostEngagement.astro';
import { config } from '../src/lib/env';
import { strings } from '../src/lib/i18n';
import { toSitePost, type SitePost } from '../src/lib/data';
import { sitePostRenderProps } from '../src/lib/post-render';
import { fixtureSite } from './fixtures';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const post = (likes: number, comments: number): SitePost => ({
  id: 'p1', kind: 'text', text: 'One.\n\nTwo.\n\nThree.', images: [], videoId: null, article: null, options: [], question: null, link: null, gif: null, slides: [],
  likes, comments, createdAt: '2026-11-15T10:00:00Z', updatedAt: null, pinned: false,
});

/** The visible text of rendered HTML: tags dropped until none are left, whitespace collapsed (U+00A0 kept). */
const text = (html: string) => {
  let out = html;
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<[^>]*>/g, '');
  } while (out !== prev);
  return out.replace(/[ \t\r\n]+/g, ' ');
};

describe('post meta numbers', () => {
  const render = (locale: 'en' | 'ar', likes: number, comments: number) => {
    const ctx = { cfg: config({ APP_ENV: 'qa' }), site: fixtureSite(), locale, t: strings(locale), data: {} as never, scheme: 'https', channelHref: 'https://videos' };
    return container.renderToString(PostCard, { props: { ctx, post: post(likes, comments) } });
  };

  it('ar: compact, ungrouped, joined with «،»', async () => {
    const meta = text((await render('ar', 4887, 12_000_000)).match(/<p class="post-engagement-counts">[\s\S]*?<\/p>/)![0]);
    expect(meta).toContain('٤٫٨ ألف إعجاب');
    expect(meta).toContain('١٢ م تعليق');
    expect(meta).toContain('، ');
    expect(meta).not.toMatch(/[·•٬0-9]/);
  });

  it('en: K/M and a dot', async () => {
    const meta = text((await render('en', 4887, 12_000_000)).match(/<p class="post-engagement-counts">[\s\S]*?<\/p>/)![0]);
    expect(meta).toContain('4.8K likes · 12M comments');
  });

  it('ar: under 1,000 stays exact with its noun', async () => {
    const meta = text((await render('ar', 999, 2)).match(/<p class="post-engagement-counts">[\s\S]*?<\/p>/)![0]);
    expect(meta).toContain('٩٩٩ إعجابًا، تعليقان');
  });

  it('PostEngagement: the same counts, joined with «،» in Arabic', async () => {
    const postRef = { post_id: 'p1', videos_url: 'https://videos/p1' } as never;
    const ar = text(await container.renderToString(PostEngagement, { props: { postRef, locale: 'ar', likes: 25_000, comments: 1000 } }));
    expect(ar).toContain('٢٥ ألف إعجاب، ألف تعليق');
    expect(ar).not.toMatch(/[·•٬]/);
    const en = text(await container.renderToString(PostEngagement, { props: { postRef, locale: 'en', likes: 25_000, comments: 1000 } }));
    expect(en).toContain('25K likes · 1K comments');
  });
});

describe.each(['en', 'ar'] as const)('shared post rendering in %s', (locale) => {
  const ctx = {
    cfg: config({ APP_ENV: 'qa' }), site: fixtureSite(), locale, t: strings(locale),
    data: { apiUrl: 'https://videos.api.alummahnow.net', cache: null, waitUntil: () => {} },
    scheme: 'https', channelHref: `https://videos.example/${locale}/@scholar`,
  };

  it.each(['poll', 'quiz'] as const)('maps and renders a %s with a localized handoff', async (kind) => {
    const post = toSitePost({
      id: 'p1', type: kind, content: 'One.\n\nTwo.\n\nThree.',
      [kind]: { question: 'ما السؤال؟', options: [{ id: 'a', text: '<Choice>' }], correctOptionId: 'a' },
    })!;
    const { body, summary, ref, preview } = sitePostRenderProps(post, ctx);
    expect(body.v2[kind]).toEqual({ question: 'ما السؤال؟', options: [{ id: 'a', text: '<Choice>' }] });
    expect(summary.v2[kind]).toEqual(body.v2[kind]);
    expect(ref).toMatchObject({ post_id: 'p1', channel_id: ctx.site.channel.id, videos_url: `${ctx.channelHref}/community` });
    expect(preview).toEqual(['One.', 'Two.']);

    const card = await container.renderToString(PostCard, { props: { ctx, post } });
    const detail = await container.renderToString(PostCard, { props: { ctx, post, full: true } });
    for (const html of [card, detail]) {
      expect(html).toContain(`lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}" data-post-kind="${kind}"`);
      expect(html).toContain(`href="${ref.videos_url}"`);
      expect(html).toContain('<bdi>&lt;Choice&gt;</bdi>');
    }
    expect(card).not.toContain('Three.');
    expect(detail).toContain('<p dir="auto">Three.</p>');
    expect(detail).toContain('ما السؤال؟');
  });
});
