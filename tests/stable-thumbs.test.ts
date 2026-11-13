import { describe, expect, it } from 'vitest';
import type { CuratedVideo } from '../src/lib/cms-types';
import { contentSecurityPolicy } from '../src/lib/edge';
import { config } from '../src/lib/env';
import { facadeHtml } from '../src/lib/facade';
import { imgSrcSources, isSignedImageUrl, itemThumb, normalizeImageUrl, stableImageUrl } from '../src/lib/images';
import { articleLd, jsonLdText, ogImageUrl, scholarLd, videoObjectLd } from '../src/lib/seo';
import { channelCard, feedVideoItem } from '../src/lib/timeline';
import { fetchChannelVideos, fetchVideoItem, liveThumb, resolveCurated, snapshotItem, toVideoItem, type VideosDeps } from '../src/lib/videos';

const WEB = 'https://videos.alummahnow.net';
const ID = '0b5e2c7a-1f3d-4c8e-9a6b-2d4f6e8a0c1e';
const ID2 = '7c9d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const NOW = Date.UTC(2026, 10, 13, 12);
const exp = Math.floor(NOW / 1000) + 6 * 3600;

const PATH_FORM = `https://vz-abc123-4d5.b-cdn.net/bcdn_token=Zm9vYmFy&expires=${exp}&token_path=%2F${ID}%2F/${ID}/thumbnail.jpg`;
const QUERY_FORM = `https://vz-abc123-4d5.b-cdn.net/${ID}/thumbnail.jpg?token=abc&expires=${exp}`;
const PRIV = `https://media.alummahnow.net/priv/${exp}.c2lnbmF0dXJl/${ID}/thumb.jpg`;
const PRIV_QA = `https://media.qa.alummahnow.net/priv/${exp}.c2ln/${ID}/thumb.jpg`;
const STABLE = `${WEB}/thumb/${ID}.jpg`;

/** Nothing a crawler or a cached page keeps may carry an expiring signature. */
function expectUnsigned(text: string) {
  expect(text).not.toMatch(/bcdn_token/i);
  expect(text).not.toMatch(/token=[^"&\s]*[&?]expires=|[?&]token=.*expires=/);
  expect(text).not.toContain('/priv/');
}

const prod = config({
  APP_ENV: 'production',
  SITE_URL: 'https://www.alummahnow.net',
  AUTH_URL: 'https://auth.alummahnow.net',
  VIDEOS_WEB_URL: WEB,
  VIDEOS_API_URL: 'https://videos.api.alummahnow.net',
  CMS_PUBLIC_URL: 'https://cms.alummahnow.net',
});

describe('stableImageUrl', () => {
  it('detects expiring signatures and leaves plain URLs alone', () => {
    for (const u of [PATH_FORM, QUERY_FORM, PRIV, PRIV_QA]) expect(isSignedImageUrl(u)).toBe(true);
    for (const u of [`https://vz-1.b-cdn.net/${ID}/thumbnail.jpg`, 'https://images.alummahnow.net/a.jpg', `https://images.alummahnow.net/a.jpg?token=x`, `https://media.alummahnow.net/pub/${ID}/thumb.jpg`, `https://evil.example/priv/1.x/${ID}/a.jpg`])
      expect(isSignedImageUrl(u)).toBe(false);
  });

  it('a signed thumbnail becomes the videos web app /thumb/<id>.jpg', () => {
    expect(stableImageUrl(WEB, PATH_FORM)).toBe(STABLE);
    expect(stableImageUrl(WEB, QUERY_FORM)).toBe(STABLE);
    expect(stableImageUrl(WEB, PRIV)).toBe(STABLE);
    expect(stableImageUrl(`${WEB}/`, PRIV_QA)).toBe(STABLE);
    // path form: token_path wins over the path, upper-case ids are lowered
    expect(stableImageUrl(WEB, `https://vz-1.b-cdn.net/bcdn_token=x&expires=1&token_path=%2F${ID2.toUpperCase()}%2F/x/thumbnail.jpg`)).toBe(`${WEB}/thumb/${ID2}.jpg`);
  });

  it("the owning video's id wins; a non-UUID owner falls back to the URL", () => {
    expect(stableImageUrl(WEB, QUERY_FORM, ID2)).toBe(`${WEB}/thumb/${ID2}.jpg`);
    expect(stableImageUrl(WEB, QUERY_FORM, 'v1')).toBe(STABLE);
    expect(stableImageUrl(WEB, `https://vz-1.b-cdn.net/../${ID}/a.jpg?token=x&expires=1`, '../x')).toBe(STABLE);
  });

  it('a signed URL with no video id is null; unsigned ones and empties pass through', () => {
    expect(stableImageUrl(WEB, `https://vz-1.b-cdn.net/not-an-id/thumbnail.jpg?token=x&expires=${exp}`)).toBeNull();
    expect(stableImageUrl(WEB, `https://media.alummahnow.net/priv/${exp}.sig/abc/thumb.jpg`)).toBeNull();
    expect(stableImageUrl(WEB, 'https://images.alummahnow.net/a.jpg')).toBe('https://images.alummahnow.net/a.jpg');
    expect(stableImageUrl(WEB, null)).toBeNull();
    expect(stableImageUrl(WEB, '')).toBeNull();
  });

  it('itemThumb: videos own their thumbnail; playlists use the id in the URL', () => {
    expect(itemThumb(WEB, { kind: 'video', id: ID2, thumbnailUrl: QUERY_FORM })).toBe(`${WEB}/thumb/${ID2}.jpg`);
    expect(itemThumb(WEB, { kind: 'playlist', id: ID2, thumbnailUrl: QUERY_FORM })).toBe(STABLE);
  });

  it('liveThumb: stable with webUrl, allowed through normalisation; the expired-drop stays as a fallback', () => {
    expect(liveThumb(QUERY_FORM, NOW, WEB, ID)).toBe(STABLE);
    // a stable URL stored by the CMS survives normalisation (the videos origin is allowed)
    expect(liveThumb(STABLE, NOW, WEB)).toBe(STABLE);
    expect(normalizeImageUrl(STABLE)).toBeNull();
    // without webUrl: the old behaviour (kept until expiry, then dropped)
    expect(liveThumb(QUERY_FORM, NOW)).toBe(QUERY_FORM);
    expect(liveThumb(QUERY_FORM, (exp + 1) * 1000)).toBeNull();
  });
});

describe('CSP img-src allows the videos web origin per env', () => {
  it('prod, stage and QA', () => {
    expect(contentSecurityPolicy(prod)).toMatch(/img-src [^;]*https:\/\/videos\.alummahnow\.net[ ;]/);
    expect(contentSecurityPolicy(prod)).toMatch(/img-src [^;]*https:\/\/media\.alummahnow\.net[ ;]/);
    const stage = config({ APP_ENV: 'stage', SITE_URL: 'https://www.stage.alummahnow.net', VIDEOS_WEB_URL: 'https://videos.stage.alummahnow.net' });
    expect(contentSecurityPolicy(stage)).toMatch(/img-src [^;]*https:\/\/videos\.stage\.alummahnow\.net[ ;]/);
    const qa = config({ APP_ENV: 'qa', SITE_URL: 'https://www.qa.alummahnow.net', VIDEOS_WEB_URL: 'https://videos.qa.alummahnow.net/' });
    expect(contentSecurityPolicy(qa)).toMatch(/img-src [^;]*https:\/\/videos\.qa\.alummahnow\.net[ ;]/);
    // the hover posters (play API) stay allowed
    expect(imgSrcSources('https://cms.alummahnow.net', WEB)).toEqual(expect.arrayContaining(['https://*.b-cdn.net', 'https://media.alummahnow.net', 'https://media.stage.alummahnow.net', 'https://media.qa.alummahnow.net']));
  });
});

describe('rendered markup and JSON-LD never carry signed thumbnails', () => {
  const snapshot = (thumbnail_url: string) => ({ title: 'Lesson', thumbnail_url, channel_name: 'Ch', refreshed_at: new Date(NOW - 60_000).toISOString(), duration_seconds: 60 });
  const signed = [PATH_FORM, QUERY_FORM, PRIV];

  it('feed snapshots (KV FEED / CONTENT_SNAPSHOT copies) → facade, JSON-LD', () => {
    for (const url of signed) {
      const item = feedVideoItem({ kind: 'video', ref_id: ID, snapshot: snapshot(url) }, 'en', 'Video', NOW, WEB);
      expect(item.thumbnailUrl).toBe(STABLE);
      const html = facadeHtml(item, { videosWebUrl: WEB, lang: 'en' });
      expect(html).toContain(`src="${STABLE}"`);
      expectUnsigned(html);
      const ld = jsonLdText(videoObjectLd(prod, item, 'en'));
      expect(ld).toContain(STABLE);
      expectUnsigned(ld);
    }
  });

  it('an item that still holds a signed URL (built without webUrl) is made stable at render', () => {
    const raw = feedVideoItem({ kind: 'video', ref_id: ID, snapshot: snapshot(PRIV) }, 'en', 'Video', NOW);
    expect(raw.thumbnailUrl).toBe(PRIV);
    expectUnsigned(facadeHtml(raw, { videosWebUrl: WEB, lang: 'en' }));
    expectUnsigned(jsonLdText(videoObjectLd(prod, raw, 'en')));
    // a signed URL with no recoverable id: no thumbnail at all rather than a dying one
    const lost = { ...raw, id: 'v1', thumbnailUrl: `https://vz-1.b-cdn.net/x/thumbnail.jpg?token=t&expires=${exp}` };
    expect(videoObjectLd(prod, lost, 'en')).not.toHaveProperty('thumbnailUrl');
    expectUnsigned(facadeHtml(lost, { videosWebUrl: WEB, lang: 'en' }));
  });

  it('channel cards: latest videos and avatar', () => {
    const c = channelCard(
      { kind: 'channel', ref_id: ID2, snapshot: { ...snapshot(QUERY_FORM.replace(ID, ID2)), latest: signed.map((u, i) => ({ id: i ? ID : ID2, title: `V${i}`, thumbnail_url: u, duration_seconds: 5 })) } },
      'en',
      WEB,
      'Channel',
      NOW,
    )!;
    expectUnsigned(JSON.stringify(c));
    expect(c.latest.map((v) => v.thumbnailUrl)).toEqual([`${WEB}/thumb/${ID2}.jpg`, STABLE, STABLE]);
  });

  it('curated lists (CMS public API snapshots and live lookups) and channel video pages', async () => {
    const rows: CuratedVideo[] = [
      { id: 1, kind: 'video', ref_id: ID, title_override: null, snapshot: snapshot(PATH_FORM), sort: 0 },
      { id: 2, kind: 'playlist', ref_id: ID2, title_override: null, snapshot: snapshot(PRIV), sort: 1 },
      { id: 3, kind: 'video', ref_id: ID2, title_override: null, snapshot: null, sort: 2 },
    ];
    const api = (async (u: string) =>
      new Response(
        JSON.stringify(
          String(u).includes('/channels/')
            ? { data: [{ id: ID, title: 'C', thumbnailUrl: QUERY_FORM }], cursor: '' }
            : { title: 'Live', thumbnailUrl: QUERY_FORM.replace(ID, ID2) },
        ),
      )) as unknown as typeof fetch;
    const deps: VideosDeps = { apiUrl: 'https://api', webUrl: WEB, cacheKeyBase: 'https://w/__v', waitUntil: () => undefined, now: () => NOW, fetchImpl: api };
    const resolved = await resolveCurated(deps, rows, 'en');
    expect(resolved.map((r) => r.item.thumbnailUrl)).toEqual([STABLE, STABLE, `${WEB}/thumb/${ID2}.jpg`]);
    const page = await fetchChannelVideos(deps, ID2);
    expect(page.items[0]!.thumbnailUrl).toBe(STABLE);
    const one = await fetchVideoItem(deps, 'video', ID);
    expect(one!.thumbnailUrl).toBe(STABLE);
    const html = [...resolved.map((r) => r.item), ...page.items].map((i) => facadeHtml(i, { videosWebUrl: WEB, lang: 'ar' })).join('');
    expectUnsigned(html);
    expectUnsigned(jsonLdText([...resolved, ...page.items.map((item) => ({ item }))].map((r) => videoObjectLd(prod, r.item, 'en'))));
    expect(toVideoItem('video', ID, { title: 't', thumbnailUrl: PRIV }, WEB)!.thumbnailUrl).toBe(STABLE);
    expect(snapshotItem(rows[0]!, NOW, false, WEB)!.thumbnailUrl).toBe(STABLE);
  });

  it('og:image / twitter:image', () => {
    expect(ogImageUrl(prod, PATH_FORM)).toBe(STABLE);
    expect(ogImageUrl(prod, `https://vz-1.b-cdn.net/x/a.jpg?token=t&expires=${exp}`)).toBe('https://www.alummahnow.net/brand/og-default.jpg');
    expect(ogImageUrl(prod, 'https://cms.alummahnow.net/media/a.jpg')).toBe('https://cms.alummahnow.net/media/a.jpg');
    expect(ogImageUrl(prod, null)).toBe('https://www.alummahnow.net/brand/og-default.jpg');
    for (const u of [PATH_FORM, QUERY_FORM, PRIV]) expectUnsigned(ogImageUrl(prod, u));
  });

  it('article and scholar JSON-LD images', () => {
    const a = articleLd(prod, { title: 'T', description: 'D', url: '/en/articles/t', image: PATH_FORM, published: '2026-11-01', modified: '2026-11-01', author: null, locale: 'en' });
    expect(a.image).toEqual([STABLE]);
    const s = scholarLd(prod, { name: 'S', url: 'https://www.alummahnow.net/en/scholars/s', description: null, image: PRIV, locale: 'en', sameAs: [] });
    expectUnsigned(jsonLdText([a, s]));
  });
});
