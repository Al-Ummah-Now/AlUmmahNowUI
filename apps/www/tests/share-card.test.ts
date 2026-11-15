/**
 * Large link previews (2026-11-15): every og:image on www and the scholar sites is a 1200x630 JPEG
 * card made by the videos app, or the brand card, declared with its size, type and alt.
 */
import { describe, expect, it } from 'vitest';
import { BRAND_CARD_PATH, channelCardUrl, SHARE_CARD, shareCardUrl, videoCardUrl } from '../src/lib/share-card';

const WEB = 'https://videos.alummahnow.net';
const ID = '0b5e2c7a-1f3d-4c8e-9a6b-2d4f6e8a0c1e';

describe('shareCardUrl', () => {
  it('a video thumbnail (signed, unsigned or the stable /thumb) is that video\'s card', () => {
    expect(shareCardUrl(WEB, `https://vz-1.b-cdn.net/bcdn_token=T&expires=9&token_path=%2F${ID}%2F/${ID}/thumbnail.jpg`)).toBe(`${WEB}/og/v/${ID}.jpg`);
    expect(shareCardUrl(WEB, `${WEB}/thumb/${ID}.jpg`)).toBe(`${WEB}/og/v/${ID}.jpg`);
    expect(shareCardUrl(WEB, 'https://media.alummahnow.net/pub/x/thumb.jpg', ID)).toBe(videoCardUrl(WEB, ID));
  });

  it('a picture on our hosts is framed by /og/i/, round-tripping Arabic names', () => {
    const src = 'https://images.alummahnow.net/avatars/عالم.jpg';
    const card = shareCardUrl(WEB, src)!;
    expect(card).toMatch(/^https:\/\/videos\.alummahnow\.net\/og\/i\/[A-Za-z0-9_-]+\.jpg$/);
    expect(Buffer.from(card.split('/og/i/')[1]!.replace(/\.jpg$/, ''), 'base64url').toString('utf8')).toBe(src);
  });

  it('nothing usable: null (the caller uses the brand card or the channel card)', () => {
    expect(shareCardUrl(WEB, null)).toBeNull();
    expect(shareCardUrl(WEB, 'https://evil.example/a.jpg')).toBeNull();
    expect(shareCardUrl(WEB, 'http://images.alummahnow.net/a.jpg')).toBeNull();
    expect(BRAND_CARD_PATH).toBe('/brand/og-default.jpg');
  });

  it('card constants and channel cards', () => {
    expect(SHARE_CARD).toEqual({ width: 1200, height: 630, type: 'image/jpeg' });
    expect(channelCardUrl(`${WEB}/`, 'c1')).toBe(`${WEB}/og/c/c1.jpg`);
  });
});
