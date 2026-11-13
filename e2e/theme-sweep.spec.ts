import AxeBuilder from '@axe-core/playwright';
import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AUTH_URL, LOCALES, WWW_URL } from './env';
import { SCHEMES, THEME_IDS } from './site-theme';

/**
 * Audit sweep (report only, SWEEP=1): pages and header menus x themes x modes x languages, through
 * the non-production ?theme= preview. Writes every text under 4.5:1 measured from rendered pixels,
 * and every axe colour-contrast node, to test-results-themes/sweep/. The pixel probe is the videos
 * app's (AlUmmahNow apps/web/e2e/themes/harness.ts): it sees text over gradients and images.
 *
 *   SWEEP=1 npx playwright test e2e/theme-sweep.spec.ts --project=desktop
 *   SWEEP=1 SWEEP_ONLY=signed-in …  (only the steps whose name matches)
 */
test.skip(!process.env.SWEEP, 'audit run only: SWEEP=1');
const ONLY = process.env.SWEEP_ONLY ? new RegExp(process.env.SWEEP_ONLY) : null;
// The probe hides text with an injected <style> and decodes screenshots from data: URLs
test.use({ bypassCSP: true });

const SUGGESTIONS = [
  { id: 1, type: 'article', title: 'Salah: the five prayers', slug: 'salah', locale: 'en', href: '/en/articles/salah/', thumbnailUrl: null, excerpt: null, publishedAt: '2026-11-01T00:00:00.000Z' },
  { id: 2, type: 'cards', title: 'أحاديث في الصلاة', slug: 'cards', locale: 'ar', href: '/ar/articles/cards/', thumbnailUrl: null, excerpt: null, publishedAt: '2026-11-02T00:00:00.000Z' },
];

interface Step { name: string; path: string; open?: (page: Page) => Promise<void>; root?: string; signedIn?: boolean }

/** Signed in (stubbed /auth/me + auth's list, the hint cookie): the hero CTA and the account button/menu. */
async function signIn(page: Page) {
  const origin = new URL(WWW_URL).origin;
  const email = 'meywd@example.com';
  await page.context().addCookies([{ name: 'aun_www_si', value: '1', url: origin }]);
  const profile = { displayName: 'Mahmoud', displayNameLocalized: { en: 'Mahmoud', ar: 'محمود' }, handle: 'meywd', avatarUrl: null };
  await page.route((u) => u.origin === origin && u.pathname === '/auth/me', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: true, sub: 'u1', name: email, authName: null, email, roles: [], profile }) }),
  );
  await page.route(`${AUTH_URL}/session/accounts`, (r) =>
    r.fulfill({
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts: [{ userId: 'u1', isActive: true, email, name: null }, { userId: 'u2', isActive: false, email: 'other@example.com', name: 'Other' }] }),
    }),
  );
}
const STEPS: Step[] = [
  { name: 'home', path: '/' },
  { name: 'articles', path: '/articles/' },
  { name: 'videos', path: '/videos/' },
  { name: 'about', path: '/about/' },
  // CMS blocks incl. the primary call-to-action block (e2e/stub-blocks.ts; en only is primary)
  { name: 'stories', path: '/stories/' },
  { name: 'search', path: '/search?q=salah' },
  { name: '404', path: '/this/does/not/exist/' },
  { name: 'header', path: '/', root: '.site-header' },
  { name: 'footer', path: '/', root: '.site-footer', open: async (p) => p.locator('.site-footer').scrollIntoViewIfNeeded() },
  { name: 'hero-signed-in', path: '/', root: '.hero', signedIn: true },
  {
    name: 'account-menu-signed-in',
    path: '/',
    root: '.site-header',
    signedIn: true,
    open: async (p) => {
      await p.locator('#account .account-button').click();
      await p.locator('#account-menu').waitFor();
    },
  },
  {
    name: 'search-popup',
    path: '/',
    root: '.site-header',
    open: async (p) => {
      await p.route('**/api/public/v1/search/suggest**', (route) =>
        route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(SUGGESTIONS) }),
      );
      const input = p.locator('.site-header input[type=search]').first();
      await input.click();
      await input.fill('sa');
      await p.waitForTimeout(600);
    },
  },
];

/** Report texts under this ratio (SWEEP_MIN=100 lists every measured text, to check the probe). */
const MIN_RATIO = Number(process.env.SWEEP_MIN || 4.5);
const withTheme = (path: string, theme: string) => `${path}${path.includes('?') ? '&' : '?'}theme=${theme}`;

for (const step of STEPS.filter((s) => !ONLY || ONLY.test(s.name))) {
  for (const l of LOCALES) {
    test(`sweep ${step.name} ${l}`, async ({ page }, info) => {
      test.setTimeout(300_000);
      const dir = `test-results-themes/sweep/${info.project.name}`;
      mkdirSync(dir, { recursive: true });
      const findings: unknown[] = [];
      if (step.signedIn) await signIn(page);
      for (const theme of THEME_IDS) {
        for (const scheme of SCHEMES) {
          await page.emulateMedia({ colorScheme: scheme });
          await page.goto(withTheme(`/${l}${step.path}`, theme));
          await page.evaluate(() => document.fonts.ready);
          if (step.open) await step.open(page).catch((e) => findings.push({ theme, scheme, error: String(e).slice(0, 160) }));
          await page.waitForTimeout(150);
          const shot = `${dir}/${step.name}-${theme}-${scheme}-${l}.png`;
          await page.screenshot({ path: shot });
          const root = step.root ?? 'body';
          for (const t of await measureText(page, root)) if (t.ratio < MIN_RATIO) findings.push({ theme, scheme, kind: 'pixels', ...t, shot });
          const axe = await new AxeBuilder({ page }).include(root).withRules(['color-contrast']).analyze();
          for (const v of axe.violations) {
            for (const n of v.nodes) findings.push({ theme, scheme, kind: 'axe', target: n.target.join(' '), summary: n.failureSummary?.split('\n').slice(1).join(' ').slice(0, 200), shot });
          }
        }
      }
      writeFileSync(`${dir}/${step.name}-${l}.json`, JSON.stringify(findings, null, 1));
    });
  }
}

interface Contrast { text: string; ratio: number; fg: string; bg: string; selector: string }

async function measureText(page: Page, root: string): Promise<Contrast[]> {
  // A text with no glyph pixels is either invisible (stays so) or was caught mid-repaint: look again
  let out = await measureOnce(page, root);
  for (let i = 0; i < 2 && out.some((t) => t.fg === '?'); i++) {
    await page.waitForTimeout(300);
    out = await measureOnce(page, root);
  }
  return out;
}

/** One screenshot as is, one with all text transparent: the differing pixels are the glyphs. */
async function measureOnce(page: Page, root: string): Promise<Contrast[]> {
  const boxes = await page.evaluate((rootSel) => {
    const out: { text: string; x: number; y: number; w: number; h: number; selector: string }[] = [];
    const rootEl = document.querySelector(rootSel);
    if (!rootEl) return out;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent?.trim()) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width < 4 || r.height < 6 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top || !(el === top || el.contains(top) || top.contains(el))) continue;
      const own = el.getBoundingClientRect();
      if (own.width <= 1 || own.height <= 1) continue;
      let clipped = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a);
        if (o.overflow === 'visible' && o.overflowY === 'visible') continue;
        const ar = a.getBoundingClientRect();
        if (r.top < ar.top - 1 || r.bottom > ar.bottom + 1 || r.left < ar.left - 1 || r.right > ar.right + 1) {
          clipped = true;
          break;
        }
      }
      if (clipped) continue;
      const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '';
      out.push({ text: n.textContent.trim().slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, selector: `${el.tagName.toLowerCase()}${cls}` });
    }
    return out;
  }, root);
  if (!boxes.length) return [];
  const shown = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.dataset.sweep = 'hide';
    s.textContent = '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}';
    document.head.append(s);
  });
  const hidden = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
  await page.evaluate(() => document.querySelectorAll('style[data-sweep]').forEach((s) => s.remove()));
  return page.evaluate(
    async ({ a, b, boxes }) => {
      const load = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      };
      const [A, B] = await Promise.all([load(a), load(b)]);
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const lum = (d: Uint8ClampedArray, i: number) => 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!);
      const hex = (d: Uint8ClampedArray, i: number) => `#${[d[i]!, d[i + 1]!, d[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      return boxes.map((bx) => {
        const ratios: { r: number; i: number }[] = [];
        for (let y = Math.max(0, Math.floor(bx.y)); y < Math.min(A.height, Math.ceil(bx.y + bx.h)); y++) {
          for (let x = Math.max(0, Math.floor(bx.x)); x < Math.min(A.width, Math.ceil(bx.x + bx.w)); x++) {
            const i = (y * A.width + x) * 4;
            if (Math.abs(A.data[i]! - B.data[i]!) + Math.abs(A.data[i + 1]! - B.data[i + 1]!) + Math.abs(A.data[i + 2]! - B.data[i + 2]!) < 6) continue;
            const la = lum(A.data, i);
            const lb = lum(B.data, i);
            ratios.push({ r: (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05), i });
          }
        }
        if (!ratios.length) return { text: bx.text, ratio: 1, fg: '?', bg: '?', selector: bx.selector };
        ratios.sort((p, q) => q.r - p.r);
        // The glyph core: ignore the few strongest pixels (subpixel fringes)
        const core = ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * 0.05))]!;
        return { text: bx.text, ratio: Math.round(core.r * 100) / 100, fg: hex(A.data, core.i), bg: hex(B.data, core.i), selector: bx.selector };
      });
    },
    { a: shown.toString('base64'), b: hidden.toString('base64'), boxes },
  );
}
