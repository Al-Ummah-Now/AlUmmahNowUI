/**
 * Seeds the local FEED KV (wrangler dev's local persistence) with a home timeline laid out exactly
 * as the CMS feed job writes it (tests/feed-fixture.ts), for the local E2E run. Never touches a
 * remote namespace (`--local`).
 *
 *   node --experimental-strip-types --no-warnings e2e/seed-feed.ts
 *
 * Content (both locales): a pinned post, a video entry, a channel entry, a post with two body videos, a card post,
 * and 50 dated posts back to last year, so "Load more" walks past the head into the week buckets.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FeedItem } from '../src/lib/feed.ts';
import { layoutFeed, post, video } from '../tests/feed-fixture.ts';

export const SEED_NOW = Date.now();
const HOUR = 3_600_000;
const at = (hoursAgo: number) => new Date(SEED_NOW - hoursAgo * HOUR).toISOString();

const ORDINALS = { en: ['one', 'two', 'three', 'four', 'five'], ar: ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'] };
const IMAGES = ['/brand/og-default.jpg', '/brand/alummah-now-bg.png', '/brand/alummah-now-bg-2.png', '/brand/alummah-now-bg-3.png', '/brand/og-default.jpg'];
/** The card post's five slides (the feed carries up to 10 per card post). */
const kahf = (ar: boolean) =>
  ORDINALS[ar ? 'ar' : 'en'].map((n, i) => ({
    id: `k${i + 1}`,
    image: { url: IMAGES[i]!, alt: '', width: 1200, height: 630 },
    heading: ar ? `الفائدة ${n}` : `Lesson ${n}`,
    body: i === 0 ? (ar ? 'الصبر مفتاح الفرج.' : 'Patience opens the way.') : null,
    position: (['bottom', 'top', 'middle', 'bottom', 'bottom'] as const)[i]!,
  }));

export function seedItems(locale: 'en' | 'ar'): FeedItem[] {
  const ar = locale === 'ar';
  const items: FeedItem[] = [
    post(900, at(400), { title: ar ? 'مرحبًا بكم في الأمة الآن' : 'Welcome to Al Ummah Now', excerpt: ar ? 'ما الذي ستجده هنا.' : 'What you will find here.', locale }, true),
    // As production stores it (CMS FEED_FORMAT 3): the video's plain channel name is English, the
    // channel's names per language and the video's size travel in the snapshot
    {
      ...video(10, at(1)),
      video: {
        kind: 'video',
        ref_id: 'feed-video-1',
        title_override: ar ? 'درس الأسبوع' : 'Lesson of the week',
        snapshot: { title: 'Lesson', thumbnail_url: null, channel_name: 'Knowledge channel', channel_names: { en: 'Knowledge channel', ar: 'قناة العلم' }, width: 1280, height: 720 },
      },
    },
    // A channel entry (docs/specs/WWW-PAGES.md D7): name, @handle and its three latest videos
    {
      ...video(11, at(2)),
      video: {
        kind: 'channel',
        ref_id: 'feed-channel-1',
        title_override: null,
        snapshot: {
          title: ar ? 'قناة العلم' : 'Knowledge channel',
          thumbnail_url: null,
          channel_name: null,
          handle: 'knowledge',
          latest: [1, 2, 3].map((n) => ({ id: `feed-latest-${n}`, title: ar ? `الدرس ${n}` : `Lesson ${n}`, thumbnail_url: null, duration_seconds: 600 + n * 65 })),
        },
      },
    },
    post(20, at(3), {
      title: ar ? 'محاضرتان جديدتان' : 'Two new lectures',
      excerpt: ar ? 'شاهدهما هنا مباشرة.' : 'Watch both right here.',
      locale,
      videos: [
        // a vertical Short and a square video: the frame takes each one's shape
        { kind: 'video', ref_id: 'body-video-1', snapshot: { title: ar ? 'المحاضرة الأولى' : 'First lecture', thumbnail_url: null, channel_name: null, width: 720, height: 1256 } },
        { kind: 'video', ref_id: 'body-video-2', snapshot: null },
        { kind: 'video', ref_id: 'body-video-3', snapshot: { title: ar ? 'مقطع مربع' : 'Square clip', thumbnail_url: null, channel_name: null, width: 1080, height: 1080 } },
      ],
    }),
    post(30, at(26), {
      title: ar ? 'خمس فوائد من سورة الكهف' : 'Five lessons from Surat al-Kahf',
      excerpt: ar ? 'بطاقات قصيرة للقراءة.' : 'Short cards to read.',
      locale,
      kind: 'cards',
      slide_count: 5,
      first_slide: kahf(ar)[0],
      slides: kahf(ar),
    }),
  ];
  for (let i = 0; i < 50; i++) {
    items.push(post(100 + i, at(30 + i * 37), { title: ar ? `خبر رقم ${i + 1}` : `News item ${i + 1}`, excerpt: ar ? 'تحديث من الفريق.' : 'An update from the team.', author_name: ar ? 'فريق التحرير' : 'The editors', locale }));
  }
  return items;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(new URL(import.meta.url)));
if (isMain) {
  const entries: { key: string; value: string }[] = [];
  for (const l of ['en', 'ar'] as const) for (const [key, value] of layoutFeed(l, seedItems(l), 'e2e', new Date(SEED_NOW).toISOString())) entries.push({ key, value });
  const file = join(mkdtempSync(join(tmpdir(), 'feed-seed-')), 'feed.json');
  writeFileSync(file, JSON.stringify(entries));
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  execFileSync('npx', ['wrangler', 'kv', 'bulk', 'put', file, '--binding', 'FEED', '--local'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, CI: 'true' } });
  process.stdout.write(`seeded ${entries.length} FEED keys (local)\n`);
}
