/**
 * Block and card-post fixtures for the stub CMS (e2e/stub-cms.ts), shaped like the CMS public API
 * (docs/CMS_PUBLIC_API.md "Blocks", "Card posts"):
 *  - /pages/stories (en) and /pages/qisas (ar): pages built from every block type;
 *  - /lists/articles, /lists/videos and /lists/picks (list pages, docs/specs/WWW-PAGES.md);
 *  - /posts/<slug> for the card posts below (404 for one only in the other locale), /posts (the
 *    Articles list: summaries carry ≤ 10 slides) and /cards (newest first, ?tag=, paging);
 *  - /media/<id>.png: generated images at the sizes the refs declare.
 * Only these answer; every other public path stays 503 (the rest of the suite uses built-in content).
 */
import { deflateSync } from 'node:zlib';

const ORIGIN = `http://localhost:${Number(process.env.STUB_CMS_PORT || 8585)}`;
const now = '2026-11-08T10:00:00.000Z';

/** id → [width, height, from colour, to colour]. 13 is almost white (the scrim must still pass AA). */
const IMAGES: Record<number, [number, number, string, string]> = {
  1: [1600, 900, '0e4d5c', 'f5a443'],
  2: [1200, 900, '12282f', '4f8f86'],
  3: [1200, 900, '8a5a12', 'ffd9a3'],
  4: [1200, 900, '0a5c6e', 'b5cbcb'],
  5: [1000, 1000, '184456', 'f5cf92'],
  10: [1080, 1350, '0b1d2a', '3d6475'],
  11: [1080, 1350, '5b4620', 'f5a443'],
  12: [1600, 900, '0e2b3d', '7fb7b0'],
  13: [1080, 1350, 'f7f7f2', 'ffffff'],
  14: [1080, 1350, '133a4e', 'fbc661'],
  15: [1080, 1350, '2a2416', 'd3dfdd'],
  16: [1080, 1350, '060f15', '0a5c6e'],
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Buffer) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

const cache = new Map<number, Buffer>();
/** A diagonal gradient with soft bands (reads as a picture, compresses well). */
export function stubImage(id: number): Buffer {
  const hit = cache.get(id);
  if (hit) return hit;
  const [w, h, a, b] = IMAGES[id] ?? [400, 400, '444444', '888888'];
  const [c1, c2] = [rgb(a), rgb(b)];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const t = Math.min(1, (x / w + y / h) / 2 + 0.06 * Math.sin((y / h) * 18));
      for (let k = 0; k < 3; k++) raw[row + 1 + x * 3 + k] = Math.round(c1[k]! + (c2[k]! - c1[k]!) * t);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0))]);
  cache.set(id, png);
  return png;
}

const media = (id: number, alt: string) => ({ url: `${ORIGIN}/media/${id}.png`, alt, width: IMAGES[id]![0], height: IMAGES[id]![1] });

type Position = 'top' | 'middle' | 'bottom';
const slide = (id: string, img: number, alt: string, heading: string | null, body: string | null, position: Position) => ({ id, image: media(img, alt), heading, body, position });

const CARD_POSTS = [
  {
    slug: 'a-day-in-madinah', locale: 'en', title: 'A day in Madinah', tags: ['travel'], published_at: '2026-11-07T08:00:00.000Z',
    slides: [
      slide('s1', 10, 'The Prophet’s Mosque before dawn', 'Before dawn', 'The courtyard fills quietly as the lamps are lit for Fajr.', 'bottom'),
      slide('s2', 11, 'Umbrellas opening over the courtyard', 'The umbrellas open', 'At sunrise the great canopies unfold over the marble.', 'top'),
      slide('s3', 12, 'A wide view of the city', 'The city wakes', null, 'middle'),
      slide('s4', 13, 'A pale marble floor in bright sun', 'Cool marble', 'Even at noon the floor stays cool underfoot.', 'bottom'),
      slide('s5', 14, 'Evening light on the minarets', 'Maghrib', 'The day ends where it began: in prayer.', 'bottom'),
    ],
  },
  {
    slug: 'ramadan-nights', locale: 'en', title: 'Ramadan nights', tags: ['ramadan'], published_at: '2026-11-05T08:00:00.000Z',
    slides: [slide('r1', 16, 'Lanterns along a street', 'Lanterns', 'Every street finds its own light.', 'bottom'), slide('r2', 15, 'A table set for iftar', 'Iftar', null, 'top')],
  },
  {
    slug: 'old-city-walk', locale: 'en', title: 'An old city walk', tags: ['travel'], published_at: '2026-11-03T08:00:00.000Z',
    slides: [slide('o1', 15, 'A narrow lane', 'The old lanes', null, 'bottom'), slide('o2', 10, 'A doorway', null, 'Doors that have stood for centuries.', 'bottom'), slide('o3', 14, 'A courtyard', 'A courtyard', null, 'middle')],
  },
  {
    slug: 'first-snow', locale: 'en', title: 'First snow at the masjid', tags: ['community'], published_at: '2026-11-01T08:00:00.000Z',
    slides: [slide('f1', 13, 'Snow on a dome', 'First snow', 'The community clears the path together.', 'bottom')],
  },
  {
    // Longer than a list carries (10): the inline strip ends with "See all 13 cards".
    slug: 'thirteen-lanterns', locale: 'en', title: 'Thirteen lanterns', tags: ['ramadan'], published_at: '2026-10-30T08:00:00.000Z',
    slides: Array.from({ length: 13 }, (_, i) => slide(`l${i + 1}`, [10, 11, 14, 15, 16][i % 5]!, `Lantern ${i + 1}`, `Lantern ${i + 1}`, i % 2 ? null : 'A light for every night of the month.', 'bottom')),
  },
  {
    // Square designed cards (like production's first card post): a square frame, nothing cropped.
    slug: 'tawhid', locale: 'ar', title: 'بطاقات التوحيد', tags: ['عقيدة'], published_at: '2026-10-28T08:00:00.000Z',
    slides: [slide('t1', 5, 'بطاقة مربعة', null, null, 'bottom'), slide('t2', 5, 'بطاقة مربعة ثانية', null, null, 'bottom'), slide('t3', 10, 'بطاقة طولية', 'بطاقة طولية', null, 'bottom')],
  },
  {
    // The Arabic translation of "Ramadan nights", under its own slug (alternates).
    slug: 'layali-ramadan', locale: 'ar', title: 'ليالي رمضان', tags: ['رمضان'], published_at: '2026-11-05T08:00:00.000Z',
    slides: [slide('lr1', 16, 'فوانيس على طول الشارع', 'الفوانيس', 'لكل شارع نوره.', 'bottom'), slide('lr2', 15, 'مائدة الإفطار', 'الإفطار', null, 'top')],
  },
  {
    slug: 'rihla-ila-al-quds', locale: 'ar', title: 'رحلة إلى القدس', tags: ['سفر'], published_at: '2026-11-06T08:00:00.000Z',
    slides: [
      slide('q1', 11, 'قبة الصخرة عند الفجر', 'عند الفجر', 'تلمع القبة الذهبية مع أول ضوء.', 'bottom'),
      slide('q2', 12, 'أسوار المدينة القديمة', 'الأسوار', 'أسوار شهدت قرونًا من التاريخ.', 'top'),
      slide('q3', 13, 'ساحة من الرخام في الشمس', 'الساحة', 'رخام أبيض تحت شمس الظهيرة.', 'bottom'),
      slide('q4', 16, 'فوانيس في الأزقة ليلًا', 'في المساء', null, 'middle'),
    ],
  },
] as const;

type CardPost = (typeof CARD_POSTS)[number];
/** Only in the Articles list and their own pages (the /cards grid fixtures predate them). */
const LIST_ONLY = new Set(['thirteen-lanterns', 'layali-ramadan', 'tawhid']);
/** Translations under different slugs (the CMS `alternates`). */
const TRANSLATIONS: [string, string][] = [['ramadan-nights', 'layali-ramadan']];
const alternatesOf = (p: CardPost) =>
  TRANSLATIONS.flatMap((pair) => (pair.includes(p.slug) ? CARD_POSTS.filter((x) => x.slug !== p.slug && pair.includes(x.slug)) : [])).map((x) => ({ locale: x.locale, slug: x.slug }));
/** A summary carries at most 10 slides; slide_count counts them all (docs/CMS_PUBLIC_API.md). */
const summaryOf = (p: CardPost) => ({
  slug: p.slug, locale: p.locale, title: p.title, excerpt: null, cover: null, author_name: 'Editorial team', tags: [...p.tags],
  published_at: p.published_at, updated_at: p.published_at, kind: 'cards', slide_count: p.slides.length, first_slide: p.slides[0], slides: p.slides.slice(0, 10),
});
const postOf = (p: CardPost) => ({ ...summaryOf(p), body: '', seo_title: null, seo_description: null, alternates: alternatesOf(p), images: p.slides.map((s) => s.image), slides: p.slides });

const article = (slug: string, title: string) => ({ slug, locale: 'en', title, excerpt: 'A short excerpt for the list.', cover: null, author_name: 'Editorial team', tags: [], published_at: now, updated_at: now, kind: 'article', slide_count: 0, first_slide: null, slides: [] });
const ARTICLES = [article('community-iftar', 'Community iftar this Friday'), article('new-classes', 'New Qur’an classes for children')];

const EN_BLOCKS = [
  { id: 'intro', type: 'markdown', text: '## Stories from the Ummah\n\nPictures, places and people, told **one card at a time**. Open a story to read it card by card.' },
  { id: 'hero', type: 'image', image: media(1, 'Sunrise over a city of minarets'), caption: 'Sunrise, seen from the hills.', size: 'wide' },
  { id: 'grid', type: 'cards', heading: 'Card stories', tag: null, page_size: 3, filter: true },
  { id: 'q', type: 'quote', variant: 'quote', text: 'Travel through the earth and see how He began creation.', cite: 'Al-ʿAnkabūt 29:20' },
  { id: 'gal', type: 'gallery', columns: 3, items: [{ image: media(2, 'A tiled wall'), caption: 'Tilework' }, { image: media(3, 'A brass lantern'), caption: 'Lanterns' }, { image: media(4, 'A courtyard fountain'), caption: null }] },
  { id: 'col', type: 'columns', text: '### Share your story\n\nSend us your photos and a few lines about each one. We publish a new card story every week.', image: media(5, 'A camera on a prayer mat'), caption: null, image_side: 'end' },
  { id: 'note', type: 'quote', variant: 'callout', text: 'Every story is checked by our editors before it is published.', cite: null },
  { id: 'line', type: 'divider', style: 'line', size: 'm' },
  { id: 'news', type: 'posts', heading: 'Latest news', items: [ARTICLES[0], summaryOf(CARD_POSTS[1]), ARTICLES[1]] },
  { id: 'cta', type: 'cta', heading: 'Have a story?', text: 'Tell us about it and we will help you share it.', label: 'Contact the team', url: '/contact', tone: 'primary' },
];
const AR_BLOCKS = [
  { id: 'intro', type: 'markdown', text: '## قصص من الأمة\n\nصور وأماكن وناس، **بطاقة بعد بطاقة**.' },
  { id: 'hero', type: 'image', image: media(1, 'شروق الشمس فوق مدينة المآذن'), caption: 'الشروق من التلال.', size: 'wide' },
  { id: 'grid', type: 'cards', heading: 'قصص بالبطاقات', tag: null, page_size: 6, filter: false },
  { id: 'q', type: 'quote', variant: 'quote', text: 'قُلْ سِيرُوا فِي الْأَرْضِ فَانظُرُوا كَيْفَ بَدَأَ الْخَلْقَ', cite: 'العنكبوت ٢٠' },
  { id: 'col', type: 'columns', text: '### شارك قصتك\n\nأرسل إلينا صورك وبضعة أسطر عن كل صورة.', image: media(5, 'كاميرا على سجادة صلاة'), caption: null, image_side: 'start' },
  { id: 'note', type: 'quote', variant: 'callout', text: 'يراجع المحررون كل قصة قبل نشرها.', cite: null },
  { id: 'space', type: 'divider', style: 'space', size: 'l' },
  { id: 'cta', type: 'cta', heading: 'لديك قصة؟', text: null, label: 'راسل الفريق', url: '/contact', tone: 'quiet' },
];

const pageOf = (slug: string, locale: 'en' | 'ar', title: string, summary: string, blocks: unknown[]) => ({
  slug, locale, title, summary, body: blocks.filter((b) => (b as { type: string }).type === 'markdown').map((b) => (b as { text: string }).text).join('\n\n'),
  seo_title: null, seo_description: null, cover: null, published_at: now, updated_at: now, alternates: [], images: [], blocks,
});

const PAGES: Record<string, unknown> = {
  'picks:en': { ...pageOf('picks', 'en', 'Editors’ picks', 'A page the editors put together by hand.', []), list_kind: 'curated' },
  'stories:en': pageOf('stories', 'en', 'Stories', 'Card stories, pictures and news from the community.', EN_BLOCKS),
  'qisas:ar': pageOf('qisas', 'ar', 'قصص', 'قصص بالصور من المجتمع.', AR_BLOCKS),
};

/** Drafts for /preview: a blocks page and an Arabic card post (e2e/blocks.spec.ts). */
export const PREVIEW_ROWS: Record<string, unknown> = {
  'pages/3': { ...pageOf('stories-draft', 'en', 'Stories (draft)', 'A draft built from blocks.', EN_BLOCKS.filter((b) => b.type !== 'cards')) },
  'posts/4': { ...postOf(CARD_POSTS.find((p) => p.slug === 'rihla-ila-al-quds')!), slug: 'rihla-draft', title: 'رحلة (مسودة)' },
};

/* List pages (docs/specs/WWW-PAGES.md §4 "Public API"): /lists/articles (the Articles list as feed
   items), /lists/videos (a channel with its latest videos, then 24 videos: two pages in English)
   and the curated page `picks` (en only, with a pinned post). */
const LIST_SIZE = 20;
const ago = (h: number) => new Date(Date.parse(now) - h * 3_600_000).toISOString();
const feedPost = (p: ReturnType<typeof summaryOf> | (typeof ARTICLES)[number], id: number, pinned = false) => ({ key: `p${id}`, type: 'post', date: p.published_at, pinned, post: { ...p, videos: [] } });
const feedVideo = (id: number, kind: 'video' | 'channel', refId: string, title: string, h: number, extra: Record<string, unknown> = {}) => ({
  key: `v${id}`, type: 'video', date: ago(h), pinned: false,
  video: { kind, ref_id: refId, title_override: null, snapshot: { title, thumbnail_url: null, channel_name: kind === 'video' ? 'Knowledge channel' : null, ...extra } },
});
const CHANNEL = (ar: boolean) =>
  feedVideo(1, 'channel', 'stub-channel', ar ? 'قناة العلم' : 'Knowledge channel', 1, {
    handle: 'knowledge',
    latest: [1, 2, 3].map((n) => ({ id: `stub-latest-${n}`, title: ar ? `الدرس ${n}` : `Lesson ${n}`, thumbnail_url: null, duration_seconds: 600 + n * 65 })),
  });
const listHead = (slug: string, locale: string, title: string, summary: string, kind: 'curated' | 'filter', alternates: { locale: string; slug: string }[]) => ({
  slug, locale, title, summary, seo_title: null, seo_description: null, list_kind: kind,
  list_filter: kind === 'filter' ? { kinds: slug === 'videos' ? ['video', 'playlist', 'channel'] : ['article', 'cards'], tag: null } : null, alternates,
});
function listsFixture(slug: string, locale: string, n: number): { status: number; body: unknown } {
  const ar = locale === 'ar';
  let head;
  let pinned: unknown[] = [];
  let all: unknown[];
  if (slug === 'articles') {
    head = listHead('articles', locale, ar ? 'المقالات' : 'Articles', ar ? 'إعلانات ومستجدات من فريق الأمة الآن.' : 'Announcements and updates from the Al Ummah Now team.', 'filter', [{ locale: ar ? 'en' : 'ar', slug: 'articles' }]);
    const posts = [...CARD_POSTS.filter((p) => p.locale === locale).map(summaryOf), ...(ar ? [] : ARTICLES)].sort((a, b) => b.published_at.localeCompare(a.published_at));
    all = posts.map((p, i) => feedPost(p, i + 1));
  } else if (slug === 'videos') {
    head = listHead('videos', locale, ar ? 'المرئيات' : 'Videos', ar ? 'دروس وسلاسل وقنوات اختارها فريق التحرير.' : 'Lessons, series and channels chosen by our editors.', 'filter', [{ locale: ar ? 'en' : 'ar', slug: 'videos' }]);
    all = [CHANNEL(ar), ...(ar ? [] : Array.from({ length: 24 }, (_, i) => feedVideo(i + 2, 'video', `stub-video-${i + 1}`, `Lesson video ${i + 1}`, 2 + i * 5)))];
  } else if (slug === 'picks' && !ar) {
    head = listHead('picks', 'en', 'Editors’ picks', 'A page the editors put together by hand.', 'curated', []);
    pinned = [feedPost(ARTICLES[1]!, 900, true)];
    all = [CHANNEL(false), feedPost(ARTICLES[0]!, 901)];
  } else {
    return { status: 404, body: { error: 'not_found' } };
  }
  const pages = Math.max(1, Math.ceil(all.length / LIST_SIZE));
  return { status: 200, body: { page: head, pinned: n === 1 ? pinned : [], items: all.slice((n - 1) * LIST_SIZE, n * LIST_SIZE), page_number: n, pages, total: all.length, limit: LIST_SIZE } };
}

/** The public API answers the stub knows, or null (→ 503). */
export function publicFixture(url: URL): { status: number; body: unknown } | null {
  const path = url.pathname.replace(/^\/api\/public\/v1/, '');
  if (path === url.pathname) return null;
  const locale = url.searchParams.get('locale') ?? 'en';
  const page = /^\/pages\/([^/]+)$/.exec(path);
  if (page) {
    const row = PAGES[`${decodeURIComponent(page[1]!)}:${locale}`];
    return row ? { status: 200, body: row } : null;
  }
  const list = /^\/lists\/([^/]+)$/.exec(path);
  if (list) return listsFixture(decodeURIComponent(list[1]!), locale, Math.max(1, Number(url.searchParams.get('page')) || 1));
  const post = /^\/posts\/([^/]+)$/.exec(path);
  if (post) {
    const slug = decodeURIComponent(post[1]!);
    const p = CARD_POSTS.find((x) => x.slug === slug && x.locale === locale);
    if (p) return { status: 200, body: postOf(p) };
    // A card post the stub knows in the other locale only: 404 here, like the CMS.
    return CARD_POSTS.some((x) => x.slug === slug) ? { status: 404, body: { error: 'not_found' } } : null;
  }
  if (path === '/posts') {
    // The Articles list: card posts and two articles in English, card posts in Arabic.
    const all = [...CARD_POSTS.filter((p) => p.locale === locale).map(summaryOf), ...(locale === 'en' ? ARTICLES : [])].sort((a, b) => b.published_at.localeCompare(a.published_at));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10));
    const n = Math.max(1, Number(url.searchParams.get('page')) || 1);
    return { status: 200, body: { items: all.slice((n - 1) * limit, n * limit), page: n, limit, total: all.length } };
  }
  if (path === '/cards') {
    const all = CARD_POSTS.filter((p) => p.locale === locale && !LIST_ONLY.has(p.slug));
    const tag = url.searchParams.get('tag');
    const items = all.filter((p) => !tag || (p.tags as readonly string[]).includes(tag));
    const limit = Math.min(24, Math.max(1, Number(url.searchParams.get('limit')) || 12));
    const n = Math.max(1, Number(url.searchParams.get('page')) || 1);
    return {
      status: 200,
      body: { items: items.slice((n - 1) * limit, n * limit).map(summaryOf), page: n, limit, total: items.length, tags: [...new Set(all.flatMap((p) => p.tags))].sort() },
    };
  }
  return null;
}
