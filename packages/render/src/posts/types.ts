/**
 * The post shapes the shared post renderers read (AlUmmahNowCMS docs/PUBLIC_API.md "Scholars"). www's
 * cms-types re-exports these; the scholar sites Worker maps its community posts onto them.
 */
import type { Locale } from '../locale';

/** Every post kind (AlUmmahNow post-schema.ts, vendored as ./post-schema.generated.ts). */
export type PostKind = 'article' | 'cards' | 'text' | 'image' | 'poll' | 'quiz' | 'video' | 'gif' | 'link';

export interface PostImageRef { url: string; alt: string | null; width: number | null; height: number | null }

/** A link post's page (SS14): `siteName` is absent on older posts and summaries. */
export interface PostLinkData { url: string; title: string | null; description: string | null; image: PostImageRef | null; siteName?: string | null }

/** A scholar post reference: the community post, where its likes, votes and comments live. */
export interface PostRef { post_id: string; channel_id: string; videos_url: string }

/** A reference's kind-specific summary (CMS PostSummary `v2`). */
export interface PostV2Summary {
  images: PostImageRef[];
  image_count: number;
  video_id: string | null;
  /** `site_name` from the CMS summary (snake case like its other fields); absent before FEED_FORMAT 5. */
  link: (Omit<PostLinkData, 'siteName'> & { site_name?: string | null }) | null;
  poll: { question: string; options: { id: string; text: string }[] } | null;
  quiz: { question: string; options: { id: string; text: string }[] } | null;
  gif: PostImageRef | null;
  text: string | null;
}

/** The community post's public fields (CMS Post `community`). */
export interface CommunityPostData {
  id: string;
  type: PostKind;
  content?: string;
  images?: { url: string; width?: number; height?: number; caption?: string }[];
  videoId?: string;
  gif?: { url: string; width?: number; height?: number };
  poll?: { question: string; options: { id: string; text?: string; votes?: number; percentage?: number }[]; totalVotes?: number; votingEndsAt?: string; multipleChoice?: boolean };
  quiz?: { question: string; options: { id: string; text: string }[] };
  link?: PostLinkData;
  likes?: number;
  comments?: number;
  commentsEnabled?: boolean;
  channelName?: string;
  channelNameLocalized?: Partial<Record<Locale, string>>;
}

/** What PostKindSummary needs from a list item. */
export interface PostSummaryLike { kind?: PostKind; locale: Locale; ref?: PostRef | null; v2?: PostV2Summary | null }

/** What PostKindBody needs from a post page. */
export interface PostPageLike extends PostSummaryLike { community?: CommunityPostData | null }
