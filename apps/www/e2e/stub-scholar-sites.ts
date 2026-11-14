/**
 * Scholar-site fixtures for local E2E (AUN-SCHOLAR-SITES SS6/SS7, AlUmmahNow#1215), served by the stub
 * CMS (e2e/stub-cms.ts), which also stands in for api-videos' `GET /api/sites/by-channel/:id` (www's
 * VIDEOS_API_URL points at it in local E2E; every other videos API path is proxied to QA as before):
 *   - `e2e-site-scholar`: primary channel ch_site_e2e, which has a live site on a subdomain
 *     (Arabic first): the same full scholar page and post, canonical on the site;
 *   - `e2e-plain-scholar`: ch_nosite_e2e, no site (404): the full scholar page;
 *   - `e2e-down-scholar`: ch_sitedown_e2e, the lookup fails (503): www stays canonical.
 */
const now = '2026-11-12T10:00:00.000Z';

export const SITE_HOST = 'e2e-scholar.sites.example';
export const SITE_CHANNEL = 'ch_site_e2e';
export const SITE_REF_POST = 'cp_e2e_site_1';

const SCHOLARS: Record<string, { channel: string; name_en: string; name_ar: string; bio_en: string; bio_ar: string }> = {
  'e2e-site-scholar': {
    channel: SITE_CHANNEL,
    name_en: 'Sh. Example Scholar',
    name_ar: 'الشيخ عالم المثال',
    bio_en: 'Writes about fiqh and shares weekly videos and posts with the community.',
    bio_ar: 'يكتب في الفقه وينشر مرئيات ومنشورات أسبوعية للمجتمع.',
  },
  'e2e-plain-scholar': { channel: 'ch_nosite_e2e', name_en: 'Plain Scholar', name_ar: 'عالم بلا موقع', bio_en: 'No site of their own yet.', bio_ar: 'لا موقع خاص بعد.' },
  'e2e-down-scholar': { channel: 'ch_sitedown_e2e', name_en: 'Lookup Down Scholar', name_ar: 'عالم تعذّر البحث', bio_en: 'The site lookup fails for this one.', bio_ar: 'يتعذّر البحث عن موقعه.' },
};

const scholarOf = (slug: string, locale: string) => {
  const s = SCHOLARS[slug]!;
  const name = locale === 'ar' ? s.name_ar : s.name_en;
  const bio = locale === 'ar' ? s.bio_ar : s.bio_en;
  return {
    slug, name, name_en: s.name_en, name_ar: s.name_ar, bio_excerpt: bio, avatar: null, updated_at: now,
    bio, bio_en: s.bio_en, bio_ar: s.bio_ar, channel_ids: [s.channel], primary_channel_id: s.channel, created_at: now,
  };
};

const refPost = (slug: string, channel: string, postId: string, author: string) => ({
  slug, locale: 'en', title: `Scholar post ${slug}`, excerpt: 'A post from the scholar’s channel.', cover: null,
  author_name: SCHOLARS[author]!.name_en, author: { slug: author, name: SCHOLARS[author]!.name_en, avatar: null }, tags: [],
  published_at: now, updated_at: now, body: 'A post from the scholar’s channel.', seo_title: null, seo_description: null, alternates: [],
  ref: { post_id: postId, channel_id: channel, videos_url: `https://videos.qa.alummahnow.net/en/post/${postId}` }, community: null,
});

const POSTS: Record<string, ReturnType<typeof refPost>> = {
  'e2e-site-post': refPost('e2e-site-post', SITE_CHANNEL, SITE_REF_POST, 'e2e-site-scholar'),
  'e2e-plain-post': refPost('e2e-plain-post', 'ch_nosite_e2e', 'cp_e2e_plain_1', 'e2e-plain-scholar'),
  'e2e-down-post': refPost('e2e-down-post', 'ch_sitedown_e2e', 'cp_e2e_down_1', 'e2e-down-scholar'),
};

/** The CMS public API paths these fixtures answer (`/api/public/v1` already stripped), else null. */
export function scholarSitesFixture(path: string, locale: string): { status: number; body: unknown } | null {
  const scholar = /^\/scholars\/([^/]+)$/.exec(path);
  if (scholar && SCHOLARS[scholar[1]!]) {
    return { status: 200, body: { scholar: scholarOf(scholar[1]!, locale), posts: { items: [], page: 1, limit: 12, total: 0 }, post_counts: { en: 0, ar: 0 } } };
  }
  const post = /^\/posts\/([^/]+)$/.exec(path);
  if (post && POSTS[post[1]!]) return locale === 'en' ? { status: 200, body: POSTS[post[1]!] } : { status: 404, body: { error: 'not_found' } };
  if (path === '/sitemap') {
    return {
      status: 200,
      body: {
        items: Object.values(POSTS).map((p) => ({ type: 'post', locale: 'en', slug: p.slug, updated_at: now, translation_key: null, ref_post_id: p.ref.post_id, ref_channel_id: p.ref.channel_id })),
        scholars: Object.entries(SCHOLARS).map(([slug, s]) => ({ slug, updated_at: now, primary_channel_id: s.channel })),
      },
    };
  }
  return null;
}

/** api-videos' `GET /api/sites/by-channel/:id` (AlUmmahNow feat/scholar-site-canonicals), else null. */
export function siteByChannel(path: string): { status: number; body: unknown } | null {
  const m = /^\/api\/sites\/by-channel\/([^/]+)$/.exec(path);
  if (!m) return null;
  if (m[1] === SITE_CHANNEL) return { status: 200, body: { channelId: SITE_CHANNEL, primaryHost: SITE_HOST, primaryKind: 'subdomain', locales: ['ar', 'en'] } };
  if (m[1] === 'ch_sitedown_e2e') return { status: 503, body: { error: 'unavailable' } };
  return { status: 404, body: { error: 'site_not_found' } };
}
