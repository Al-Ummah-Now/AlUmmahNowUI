import { expect, test, type Page } from '@playwright/test';
import { LOCALES } from './env';
import { IS_PRODUCTION, SCHEMES } from './site-theme';

/**
 * The Fawanees lantern street on www (the shared module, vendored by scripts/sync-fanous.ts;
 * design: AlUmmahNow docs/design/FAWANEES-STREET.md). The street is pre-made art painted by CSS:
 * a wide image tile of strings and lit lanterns that wraps both ways, repeated behind the whole
 * page over a small distant-lights tile. The theme gives 4 tile variants per mode; the inline head
 * script picks one per load before first paint (<html data-fanous-street-variant>), and only that
 * one downloads. Through the non-production ?theme= preview, in light and dark, English and Arabic:
 *   - the street is on, shows the picked variant of this mode's tile, repeated, centred, at its
 *     own size (never stretched), down the whole page, and no other variant is fetched;
 *   - the timeline column has its light frost (a soft-edged blur layer behind its content);
 *   - no control or text block is see-through;
 * a test can pin the variant; other themes have no street; the street adds no element, fixed
 * layer or animation (nothing to do on scroll).
 */
test.skip(IS_PRODUCTION, 'production ignores ?theme= previews');
// The style tag that stills transitions is inline (www's CSP allows no inline styles)
test.use({ bypassCSP: true });

const DEPTHS = [0, 900, 1800];
const TILE = /street-tile(?:-dark)?-([1-4])\.webp/;

/** Opens a page, recording which street tile files it fetched. */
async function open(page: Page, path: string) {
  const fetched = new Set<string>();
  page.on('request', (req) => {
    const m = req.url().match(/street-tile[\w-]*\.webp/);
    if (m) fetched.add(m[0]);
  });
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}' });
  return fetched;
}

/** The street's layers and the timeline frost, as the browser computes them. */
function street(page: Page) {
  return page.evaluate(() => {
    const before = getComputedStyle(document.body, '::before');
    const after = getComputedStyle(document.body, '::after');
    const wrap = document.querySelector('.tl-wrap');
    const frost = wrap ? getComputedStyle(wrap, '::before') : null;
    return {
      on: document.documentElement.classList.contains('fanous-street'),
      variant: document.documentElement.getAttribute('data-fanous-street-variant'),
      lights: before.content !== 'none' ? before.backgroundImage : 'none',
      tile: after.content !== 'none' ? after.backgroundImage : 'none',
      repeat: after.backgroundRepeat,
      at: after.backgroundPosition,
      size: after.backgroundSize,
      position: after.position,
      covers: Math.round(parseFloat(after.height)) >= document.documentElement.scrollHeight - 2,
      frost: frost && frost.content !== 'none' ? { blur: frost.backdropFilter, bg: frost.backgroundColor, mask: frost.getPropertyValue('mask-image') || frost.getPropertyValue('-webkit-mask-image') } : null,
    };
  });
}

/** Translucent controls and text blocks whose backdrop is the page (the street would show through). */
function seeThrough(page: Page) {
  return page.evaluate(() => {
    const alpha = (bg: string) => { const slash = bg.match(/\/\s*([\d.]+)\)/), rgba = bg.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/); return slash ? parseFloat(slash[1]!) : rgba ? parseFloat(rgba[1]!) : bg === 'transparent' ? 0 : 1; };
    const paints = (e: Element) => { const st = getComputedStyle(e); return alpha(st.backgroundColor) === 1 || st.backgroundImage !== 'none' || /^(IMG|VIDEO|CANVAS|PICTURE|IFRAME)$/.test(e.tagName); };
    return Array.from(document.querySelectorAll('main *')).filter((el) => {
      if (el.tagName === 'IMG') return false;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return false;
      const a = alpha(getComputedStyle(el).backgroundColor);
      if (!(a > 0 && a < 1)) return false;
      const stack = document.elementsFromPoint(r.left + r.width / 2, Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
      const below = stack.slice(stack.indexOf(el) + 1).filter((e) => !el.contains(e) && e !== document.body && e !== document.documentElement);
      return !below.some(paints);
    }).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`);
  });
}

for (const scheme of SCHEMES) {
  test.describe(`street, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const locale of LOCALES) {
      test(`home ${locale}: the picked tile behind the page, only it fetched, timeline frosted, nothing see-through`, async ({ page }) => {
        test.setTimeout(120_000);
        const fetched = await open(page, `/${locale}/?theme=fawanees`);
        const s = await street(page);
        expect(s.on, 'street on').toBe(true);
        expect(s.variant, 'a variant picked before first paint').toMatch(/^[1-4]$/);
        expect(s.tile, 'the street tile').toMatch(TILE);
        expect(s.tile.match(TILE)?.[1], 'the picked variant').toBe(s.variant);
        expect(s.tile.includes('-dark-'), `the ${scheme} tile`).toBe(scheme === 'dark');
        expect(s.lights, 'distant lights').toMatch(/url\(/);
        expect(s.repeat, 'repeated both ways').toBe('repeat');
        expect(s.at, 'centred on the page').toMatch(/^50% 0(%|px)?$/);
        expect(s.size, "shown at the tile's own size").toBe('auto');
        expect(s.position, 'scrolls with the page').toBe('absolute');
        expect(s.covers, 'down the whole page').toBe(true);
        // Only the picked variant downloads (an unused variant's custom property fetches nothing)
        expect([...fetched], 'tiles fetched').toEqual([s.tile.match(/street-tile[\w-]*\.webp/)![0]]);
        const res = await page.request.get(`/fanous/street/${[...fetched][0]}`);
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toContain('image/webp');
        // The timeline's light frost: a few px of blur, a faint tint, edges faded by a mask
        expect(s.frost, 'timeline frost layer').not.toBeNull();
        expect(s.frost!.blur, 'a light blur').toMatch(/^blur\([1-6]px\)$/);
        expect(s.frost!.mask, 'soft edges').toMatch(/gradient/);
        const problems: string[] = [];
        const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        for (const depth of DEPTHS.filter((d) => d <= maxY)) {
          await page.evaluate((y) => window.scrollTo(0, y), depth);
          await page.waitForTimeout(300);
          for (const x of await seeThrough(page)) problems.push(`@${depth}px see-through: ${x}`);
        }
        expect(problems, problems.join('\n')).toEqual([]);
      });
    }
  });
}

test('a test can pin the street variant (visual snapshots stay stable)', async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __AUN_STREET_VARIANT__: number }).__AUN_STREET_VARIANT__ = 3; });
  const fetched = await open(page, '/en/?theme=fawanees');
  await expect(page.locator('html')).toHaveAttribute('data-fanous-street-variant', '3');
  expect([...fetched].every((f) => /-3\.webp$/.test(f)), [...fetched].join(', ')).toBe(true);
});

test('other themes have no street and fetch no tile', async ({ page }) => {
  for (const theme of ['lantern', 'zujaj', 'nahas']) {
    const fetched = await open(page, `/en/?theme=${theme}`);
    await expect(page.locator('html'), theme).not.toHaveClass(/fanous-street/);
    expect((await street(page)).tile, theme).toBe('none');
    expect([...fetched], theme).toEqual([]);
  }
});

test('the street adds no element, fixed layer or animation', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough');
  await open(page, '/en/?theme=fawanees');
  await expect(page.locator('html')).toHaveClass(/fanous-street/);
  const r = await page.evaluate(() => ({
    elements: document.querySelectorAll('#fanous-street, #fanous-street-lights').length,
    fixed: [getComputedStyle(document.body, '::before').position, getComputedStyle(document.body, '::after').position].filter((p) => p === 'fixed').length,
    animations: document.getAnimations().filter((a) => {
      const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
      return t === document.documentElement || t === document.body;
    }).length,
  }));
  expect(r).toEqual({ elements: 0, fixed: 0, animations: 0 });
});
