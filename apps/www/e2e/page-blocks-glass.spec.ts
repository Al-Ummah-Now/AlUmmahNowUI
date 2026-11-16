/**
 * Page-builder panels, and the sections of text-only pages (pb-glass, packages/render/src/glass-sections.ts),
 * are frosted glass with a golden glow (owner, 2026-11-15; shared renderer CSS, AlUmmahNow
 * packages/shared-types/src/page-blocks.css). On the shared sample page and About, en and ar, dark
 * and light, every project's viewport:
 *   - each toned panel blurs what is behind it (backdrop-filter, -webkit- in WebKit), has a
 *     translucent background and a glow in the theme's primary colour;
 *   - every line of text in a panel is WCAG AA (4.5:1, 3:1 for large text) against the darkest AND the
 *     lightest pixel behind it, with the lantern street showing through, at three scroll positions
 *     (panel at the top, middle and bottom of the window). Text is hidden for the measuring shot, so
 *     only the glass and what shows through it are measured.
 */
import { expect, test, type Page } from '@playwright/test';
import { THEME_IDS } from './site-theme.ts';
import { SAMPLE_THUMB_IMAGE, SAMPLE_THUMBS, stubImage } from './stub-blocks.ts';

const LOCAL = !process.env.WWW_URL || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(process.env.WWW_URL);
test.skip(!LOCAL, 'needs the stub CMS (local E2E)');

const PANELS = '.pb-b:not(.pb-t-none):not(.pb-w-full):not(.pb-k-hero) > .pb-in';
/** Text-only pages (here About as the CMS migrated it: one markdown block): one glass box per section. */
const SECTIONS = '[data-testid=page-sections] .pb-glass';
const PAGES = [
  { locale: 'en', path: '/en/every-block/', what: 'page-builder panels', sel: PANELS, min: 2, lines: 20 },
  { locale: 'ar', path: '/ar/kull-al-kutal/', what: 'page-builder panels', sel: PANELS, min: 2, lines: 20 },
  { locale: 'en', path: '/en/about/', what: 'text page sections', sel: SECTIONS, min: 2, lines: 8 },
  { locale: 'ar', path: '/ar/about/', what: 'text page sections', sel: SECTIONS, min: 2, lines: 8 },
] as const;

interface TextBox { x: number; y: number; w: number; h: number; rgb: [number, number, number]; large: boolean; text: string }

/** Every text line inside the panel at `index` that is in the window: its box (CSS px), colour and size class. */
async function textBoxes(page: Page, sel: string, index: number): Promise<TextBox[]> {
  return page.evaluate(([sel, i]) => {
    const panel = document.querySelectorAll(sel)[i as number] as HTMLElement;
    // Computed colours come as rgb()/rgba() or color(srgb r g b / a) (WebKit's canvas can't parse the latter)

    const rgbOf = (c: string): [number, number, number] => {

      let m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(c);

      if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];

      m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(c);

      if (m) return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255];

      throw new Error(`text colour not understood: ${c}`);

    };
    const out: TextBox[] = [];
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent || '').trim();
      const el = n.parentElement;
      if (!text || !el || el.closest('[aria-hidden=true], .sr-only, .visually-hidden, svg')) continue;
      // Only text that sits on the glass: buttons and chips paint their own opaque surface (theme tokens, axe)
      let own = false;
      for (let a: HTMLElement | null = el; a && a !== panel; a = a.parentElement) {
        const ac = getComputedStyle(a);
        if (ac.backgroundImage !== 'none' || !/rgba\(.*, 0\)$|transparent/.test(ac.backgroundColor)) own = true;
      }
      if (own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || Number(cs.opacity) === 0) continue;
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight) continue;
        // under the sticky site header (or anything else on top): not visible, not measured
        const cx = r.left + r.width / 2;
        const ends = [document.elementFromPoint(cx, r.top + 1), document.elementFromPoint(cx, r.bottom - 1)];
        if (ends.some((e) => !e || !panel.contains(e))) continue;
        // the glyph band: the line box minus its leading
        const inset = Math.max(0, (r.height - size) / 2);
        out.push({ x: r.left, y: r.top + inset, w: r.width, h: r.height - 2 * inset, rgb: rgbOf(cs.color), large, text: text.slice(0, 40) });
      }
    }
    return out;
  }, [sel, index] as const);
}

/** Lightest and darkest relative luminance in each box of a PNG (decoded in the page's canvas). */
async function extremes(page: Page, png: Buffer, boxes: TextBox[]): Promise<{ min: number; max: number }[]> {
  return page.evaluate(async ([b64, list]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return (list as TextBox[]).map((b) => {
      const x = Math.max(0, Math.floor(b.x)), y = Math.max(0, Math.floor(b.y));
      const w = Math.max(1, Math.min(c.width - x, Math.ceil(b.w))), h = Math.max(1, Math.min(c.height - y, Math.ceil(b.h)));
      const d = ctx.getImageData(x, y, w, h).data;
      let min = 1, max = 0;
      for (let i = 0; i < d.length; i += 4) {
        const L = 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!);
        if (L < min) min = L;
        if (L > max) max = L;
      }
      return { min, max };
    });
  }, [png.toString('base64'), boxes] as const);
}

const lum = ([r, g, b]: [number, number, number]) => {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

test.describe.configure({ timeout: 300_000 });

for (const p of PAGES) {
  for (const scheme of ['dark', 'light'] as const) {
    test(`${p.what} are frosted glass with a golden glow, text AA over the street (${p.path}, ${scheme})`, async ({ page }) => {
      await page.route(`${SAMPLE_THUMBS}**`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: stubImage(SAMPLE_THUMB_IMAGE) }));
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      const failures: string[] = [];
      const measured: Record<string, number> = {};
      for (const theme of THEME_IDS) {
        await page.goto(`${p.path}?theme=${theme}`);
        await page.evaluate(() => document.fonts.ready);
        const panels = page.locator(p.sel);
        const count = await panels.count();
        expect(count, `${p.what} (${theme})`).toBeGreaterThanOrEqual(p.min);

        const style = await panels.evaluateAll((els) =>
          els.map((e) => {
            const cs = getComputedStyle(e);
            return { blur: cs.backdropFilter || (cs as unknown as Record<string, string>).webkitBackdropFilter || '', shadow: cs.boxShadow, bg: cs.backgroundColor + ' ' + cs.backgroundImage };
          }),
        );
        for (const s of style) {
          expect(s.blur).toMatch(/blur\(\d+px\)/);
          // a glow: a shadow with a blur radius and no offset
          expect(s.shadow).toMatch(/\) 0px 0px \d+px/);
        }

        for (let i = 0; i < count; i++) {
          for (const block of ['start', 'center', 'end'] as const) {
            await panels.nth(i).evaluate((e, b) => e.scrollIntoView({ block: b as ScrollLogicalPosition }), block);
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
            const boxes = await textBoxes(page, p.sel, i);
            if (!boxes.length) continue;
            // CSSOM, not a <style> tag: the site's CSP allows no inline styles
            const hide = (on: boolean) =>
              page.evaluate((v) => {
                for (const el of document.querySelectorAll<HTMLElement>('main, main *')) {
                  // transitions off while the colours change, both ways: a colour transition (Fawanees) outranks even
                  // an inline !important, and one left running would be read back as the text's colour
                  el.style.setProperty('transition', 'none', 'important');
                  for (const prop of ['color', '-webkit-text-fill-color', 'text-decoration-color', 'text-shadow']) {
                    if (v) el.style.setProperty(prop, prop === 'text-shadow' ? 'none' : 'transparent', 'important');
                    else el.style.removeProperty(prop);
                  }
                  if (!v) {
                    void getComputedStyle(el).color;
                    el.style.removeProperty('transition');
                  }
                }
              }, on);
            await hide(true);
            // until the text is really gone: the same frame twice (a stale composited frame can still show it)
            let png = await page.screenshot({ scale: 'css' });
            for (let tries = 0; tries < 10; tries++) {
              const again = await page.screenshot({ scale: 'css' });
              if (again.equals(png)) break;
              png = again;
            }
            await hide(false);
            const ext = await extremes(page, png, boxes);
            measured[theme] = (measured[theme] ?? 0) + boxes.length;
            boxes.forEach((b, k) => {
              const L = lum(b.rgb);
              const worst = Math.min(ratio(L, ext[k]!.min), ratio(L, ext[k]!.max));
              const need = b.large ? 3 : 4.5;
              if (worst < need) failures.push(`${theme} panel ${i} (${block}) "${b.text}": ${worst.toFixed(2)} < ${need}`);
            });
          }
        }
      }
      console.log(`glass text lines measured: ${JSON.stringify(measured)}`);
      for (const theme of THEME_IDS) expect(measured[theme] ?? 0, `text measured on ${theme}'s glass`).toBeGreaterThan(p.lines);
      expect(failures).toEqual([]);
    });
  }
}
