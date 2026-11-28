import { plainLines } from '../../../../packages/render/src/posts/post-kinds';
import { splitQafQuotes } from '../../../../packages/render/src/posts/qaf-quote';
import type { PostPageLike, PostRef } from '../../../../packages/render/src/posts/types';
import type { PageContext } from './context';
import type { SitePost } from './data';

export function sitePostRenderProps(post: SitePost, ctx: PageContext) {
  const { locale } = ctx;
  const ref: PostRef = {
    post_id: post.id,
    channel_id: ctx.site.channel.id,
    videos_url: `${ctx.channelHref}/community`,
  };
  const href = `/${locale}/posts/${post.id}/`;
  const videoHref = post.videoId ? `/${locale}/watch/${post.videoId}/` : null;
  const paragraphs = splitQafQuotes(post.text ?? '').flatMap((part) =>
    typeof part === 'string' ? plainLines(part) : [part.text, part.label]);
  const preview = paragraphs.slice(0, 2);
  const choices = post.options.length ? { question: post.question ?? '', options: post.options } : null;
  const link = post.link && { ...post.link, site_name: post.link.siteName };
  const body = {
    locale,
    kind: post.kind,
    ref,
    community: { id: post.id, type: post.kind, content: post.text ?? undefined },
    v2: {
      text: post.text,
      images: post.images,
      image_count: post.images.length,
      video_id: post.videoId,
      link,
      gif: post.gif && { ...post.gif, alt: null },
      poll: post.kind === 'poll' ? choices : null,
      quiz: post.kind === 'quiz' ? choices : null,
    },
  } satisfies PostPageLike;

  const summary = { locale, kind: post.kind, ref, v2: { ...body.v2, images: post.images.slice(0, 4) } };

  return { body, summary, ref, href, videoHref, paragraphs, preview, hasMore: !!post.article?.body || paragraphs.length > preview.length };
}
