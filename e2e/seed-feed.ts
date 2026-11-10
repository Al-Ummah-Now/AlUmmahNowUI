/**
 * Seeds the local FEED KV (wrangler dev's local persistence) with a home timeline laid out exactly
 * as the CMS feed job writes it (tests/feed-fixture.ts), for the local E2E run. Never touches a
 * remote namespace (`--local`).
 *
 *   node --experimental-strip-types --no-warnings e2e/seed-feed.ts
 *
 * Content (both locales): a pinned post, a video entry, a post with two body videos, a card post,
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

export function seedItems(locale: 'en' | 'ar'): FeedItem[] {
  const ar = locale === 'ar';
  const items: FeedItem[] = [
    post(900, at(400), { title: ar ? 'مرحبًا بكم في الأمة الآن' : 'Welcome to Al Ummah Now', excerpt: ar ? 'ما الذي ستجده هنا.' : 'What you will find here.', locale }, true),
    { ...video(10, at(1)), video: { kind: 'video', ref_id: 'feed-video-1', title_override: ar ? 'درس الأسبوع' : 'Lesson of the week', snapshot: { title: 'Lesson', thumbnail_url: null, channel_name: ar ? 'قناة العلم' : 'Knowledge channel' } } },
    post(20, at(3), {
      title: ar ? 'محاضرتان جديدتان' : 'Two new lectures',
      excerpt: ar ? 'شاهدهما هنا مباشرة.' : 'Watch both right here.',
      locale,
      videos: [
        { kind: 'video', ref_id: 'body-video-1', snapshot: { title: ar ? 'المحاضرة الأولى' : 'First lecture', thumbnail_url: null, channel_name: null } },
        { kind: 'video', ref_id: 'body-video-2', snapshot: null },
      ],
    }),
    post(30, at(26), {
      title: ar ? 'خمس فوائد من سورة الكهف' : 'Five lessons from Surat al-Kahf',
      excerpt: ar ? 'بطاقات قصيرة للقراءة.' : 'Short cards to read.',
      locale,
      kind: 'cards',
      slide_count: 5,
      first_slide: { image: { url: '/brand/og-default.jpg', alt: '', width: 1200, height: 630 }, heading: ar ? 'الفائدة الأولى' : 'Lesson one', body: ar ? 'الصبر مفتاح الفرج.' : 'Patience opens the way.', position: 'bottom' },
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
