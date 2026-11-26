import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, expect, it, vi } from 'vitest';
import { builtinContent } from '../src/content/fallback';
import { formatDate, strings } from '../src/i18n';
import type { Post } from '../src/lib/cms-types';
import ArticlePage from '../src/pages/[locale]/articles/[slug].astro';

afterEach(() => vi.unstubAllGlobals());

it.each([
  { locale: 'en', contentLocale: 'ar', dir: 'rtl', title: 'خبر من المدينة', excerpt: 'موجز الخبر', body: 'نص الخبر', tag: 'أخبار' },
  { locale: 'ar', contentLocale: 'en', dir: 'ltr', title: 'City news', excerpt: 'A short summary', body: 'The full article', tag: 'News' },
] as const)('$locale UI surrounds $contentLocale article prose', async ({ locale, contentLocale, dir, title, excerpt, body, tag }) => {
  const slug = 'local-news';
  const published = '2026-11-08T10:00:00.000Z';
  const post: Post = {
    slug,
    locale: contentLocale,
    title,
    excerpt,
    body,
    cover: null,
    author_name: 'Editorial team',
    tags: [tag],
    published_at: published,
    updated_at: published,
    seo_title: null,
    seo_description: null,
    alternates: [],
  };
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/site')) return Response.json(builtinContent(locale).site);
    if (url.pathname.endsWith(`/posts/${slug}`) && url.searchParams.get('locale') === contentLocale) {
      return Response.json(post);
    }
    return new Response(null, { status: 404 });
  });

  const container = await AstroContainer.create();
  const response = await container.renderToResponse(ArticlePage, {
    params: { locale, slug },
    request: new Request(`https://www.alummahnow.net/${locale}/articles/${slug}/`),
  });
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain(`<html lang="${locale}" dir="${locale === 'en' ? 'ltr' : 'rtl'}"`);
  const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0];
  expect(main).toMatch(/^<main id="main" tabindex="-1">/);
  expect(main).toContain(`href="/${locale}/articles/"`);
  expect(main).toContain(strings(locale).articles.backToArticles);
  expect(main).toContain(`<time datetime="${published}">${formatDate(published, locale)}</time>`);
  expect(main).toContain(`<h2 class="visually-hidden">${strings(locale).articles.tags}</h2>`);
  const language = `lang="${contentLocale}" dir="${dir}"`;
  expect(main).toContain(`<h1 ${language}>${title}</h1>`);
  expect(main).toContain(`<p class="lede" ${language}>${excerpt}</p>`);
  expect(main).toContain(`<div class="prose" ${language}><p>${body}</p>`);
  expect(main).toContain(`<ul class="tags" ${language}><li>${tag}</li></ul>`);
});
