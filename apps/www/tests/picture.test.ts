import { describe, expect, it } from 'vitest';
import type { MediaRef } from '../src/lib/cms-types';
import { renderMarkdown } from '../src/lib/markdown';
import { imageIndex, pictureHtml, SIZES, usableVariants } from '../src/lib/picture';

const CMS = 'https://cms.qa.alummahnow.net';
const url = `${CMS}/api/public/v1/media/cover.jpg`;
const set = (f: string, ws = [320, 640, 960]) => ws.map((w) => `${url}?w=${w}&f=${f} ${w}w`).join(', ');
const ref = (over: Partial<MediaRef> = {}): MediaRef => ({
  url,
  alt: 'A lantern',
  width: 1200,
  height: 600,
  variants: { widths: [320, 640, 960], fallback_type: 'image/jpeg', avif: set('avif'), webp: set('webp'), fallback: set('jpeg') },
  ...over,
});

describe('responsive CMS images (CMS-10)', () => {
  it('renders AVIF and WebP sources, a fallback srcset, sizes, and the intrinsic size', () => {
    const html = pictureHtml(ref(), CMS, { sizes: SIZES.cover, priority: true, className: 'cover' });
    expect(html).toBe(
      '<picture>' +
        `<source type="image/avif" srcset="${set('avif').replaceAll('&', '&amp;')}" sizes="${SIZES.cover}">` +
        `<source type="image/webp" srcset="${set('webp').replaceAll('&', '&amp;')}" sizes="${SIZES.cover}">` +
        `<img class="cover" src="${url}?w=960&amp;f=jpeg" srcset="${set('jpeg').replaceAll('&', '&amp;')}" sizes="${SIZES.cover}" alt="A lantern" width="1200" height="600" loading="eager" fetchpriority="high" decoding="async">` +
        '</picture>',
    );
  });

  it('is lazy unless it is the LCP image', () => {
    const html = pictureHtml(ref(), CMS, { sizes: SIZES.prose });
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('fetchpriority');
  });

  it('falls back to a plain sized <img> without variants (older CMS, width not known yet)', () => {
    expect(pictureHtml(ref({ variants: null }), CMS, { sizes: SIZES.prose })).toBe(`<img src="${url}" alt="A lantern" width="1200" height="600" loading="lazy" decoding="async">`);
    expect(pictureHtml(ref({ variants: undefined, width: null, height: null }), CMS, { sizes: SIZES.prose })).toBe(`<img src="${url}" alt="A lantern" loading="lazy" decoding="async">`);
  });

  it('ignores variants that point anywhere but the CMS origin, or are malformed (CSP, injection)', () => {
    const v = ref().variants!;
    expect(usableVariants(v, CMS)).toBe(v);
    expect(usableVariants({ ...v, avif: 'https://evil.example/x.avif 320w' }, CMS)).toBeNull();
    expect(usableVariants({ ...v, webp: `${url} 320w onerror=alert(1)` }, CMS)).toBeNull();
    expect(usableVariants({ ...v, fallback: `${url}` }, CMS)).toBeNull();
    expect(usableVariants({ ...v, fallback_type: 'text/html' as never }, CMS)).toBeNull();
    expect(usableVariants({ ...v, widths: [] }, CMS)).toBeNull();
  });

  it('escapes alt text', () => {
    expect(pictureHtml(ref({ alt: '"><script>' }), CMS, { sizes: SIZES.prose })).toContain('alt="&quot;&gt;&lt;script&gt;"');
  });

  it('inline markdown images the CMS described become responsive pictures; others stay plain lazy <img>', () => {
    const inline = ref({ url: `${CMS}/api/public/v1/media/in%20line.png`, alt: 'stored alt' });
    const lookup = imageIndex([inline], CMS);
    const html = renderMarkdown(`![Written *alt*](${CMS}/api/public/v1/media/in%20line.png)\n\n![x](https://images.alummahnow.net/y.jpg)`, {
      renderVideo: () => '',
      renderImage: (src, alt) => {
        const r = lookup(src);
        return r ? pictureHtml(r, CMS, { sizes: SIZES.prose, alt }) : null;
      },
    });
    expect(html).toContain('<picture><source type="image/avif"');
    expect(html).toContain('alt="Written alt"'); // the alt written in the article wins
    expect(html).toContain('width="1200" height="600"');
    expect(html).toContain('<img src="https://images.alummahnow.net/y.jpg" alt="x" loading="lazy" decoding="async">');
  });

  it('matches inline images by URL path on the CMS origin only', () => {
    const lookup = imageIndex([ref()], CMS);
    expect(lookup(`${CMS}/api/public/v1/media/cover.jpg`)).not.toBeNull();
    expect(lookup(`${CMS}/api/public/v1/media/cover%2Ejpg`)).not.toBeNull();
    expect(lookup('https://elsewhere.example/api/public/v1/media/cover.jpg')).toBeNull();
    expect(lookup('not a url')).toBeNull();
    expect(imageIndex(undefined, CMS)('x')).toBeNull();
  });
});
