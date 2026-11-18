/**
 * Newsletter (AlUmmahNowUI#6): the sign-up form in every page's footer and on /{l}/newsletter/,
 * with and without JavaScript, the Turnstile check when the admin API asks for one, and the confirm
 * and unsubscribe pages from the emails (a button POST, never a GET change; the RFC 8058 one-click
 * POST). en and ar (rtl), axe clean.
 *
 * Local: www talks to e2e/stub-newsletter.ts. Deployed (QA, stage): only what changes nothing:
 * the form renders and an unknown link says so. Sign-ups there would store and email real rows.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import { LOCALES } from './env';
import { NL_TOKENS } from './stub-newsletter';

const local = !process.env.WWW_URL;
const T = { en: en.newsletter, ar: ar.newsletter };

/** `within`: only that part of the page, when the test scrolls and the sticky header would cover
 * whatever sits behind it (axe's target-size then measures the visible strip: AlUmmahNowUI#129) */
async function expectAxeClean(page: Page, within?: string) {
  // after a form POST the new page must be fully loaded (fonts and styles) before colours are measured
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  const results = await (within ? axe.include(within) : axe).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.failureSummary ?? ''}`).slice(0, 3).join(', ')}`)).toEqual([]);
}

for (const l of LOCALES) {
  const t = T[l];

  test(`${l}: the footer sign-up form is on the home page and is labelled`, async ({ page }) => {
    await page.goto(`/${l}/`);
    const footer = page.getByTestId('footer-newsletter');
    await expect(footer.getByRole('heading', { level: 2, name: t.title })).toBeVisible();
    const email = footer.getByLabel(t.emailLabel);
    await expect(email).toHaveAttribute('type', 'email');
    await expect(email).toHaveAttribute('dir', 'ltr');
    await expect(footer.getByRole('button', { name: t.submit })).toBeVisible();
    // the bot trap is out of sight and out of the tab order
    await expect(footer.locator('input[name="website"]')).not.toBeInViewport();
    await expect(footer.locator('input[name="website"]')).toHaveAttribute('tabindex', '-1');
  });

  test(`${l}: an unknown confirm link changes nothing and says it doesn't work`, async ({ page }) => {
    const res = await page.goto(`/${l}/newsletter/confirm?token=short`);
    expect(res?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('heading', { level: 1, name: t.invalidTitle })).toBeVisible();
    await expect(page.getByRole('link', { name: t.signUp })).toHaveAttribute('href', `/${l}/newsletter/`);
  });

  test.describe(() => {
    test.skip(!local, 'signs up and confirms against the stub admin API only');

    test(`${l}: signing up in the footer shows "check your inbox" in place, axe clean`, async ({ page }) => {
      await page.goto(`/${l}/`);
      const footer = page.getByTestId('footer-newsletter');
      await footer.getByRole('button', { name: t.submit }).click();
      await expect(footer.getByRole('status')).toHaveText(t.invalid);
      await expect(footer.getByLabel(t.emailLabel)).toHaveAttribute('aria-invalid', 'true');
      await footer.getByLabel(t.emailLabel).fill('reader@example.com');
      await footer.getByRole('button', { name: t.submit }).click();
      await expect(footer.getByRole('status')).toHaveText(t.checkEmail);
      await expect(footer.getByLabel(t.emailLabel)).toHaveValue('');
      await expect(page).toHaveURL(new RegExp(`/${l}/$`));
      await footer.scrollIntoViewIfNeeded();
      // the form itself: the whole page is checked unscrolled in a11y.spec.ts and header.spec.ts
      await expectAxeClean(page, '[data-testid="footer-newsletter"]');
    });

    test(`${l}: too many sign-ups say so`, async ({ page }) => {
      await page.goto(`/${l}/newsletter/`);
      const form = page.locator('main form[data-newsletter]');
      await form.getByLabel(t.emailLabel).fill('limit@example.com');
      await form.getByRole('button', { name: t.submit }).click();
      await expect(form.getByRole('status')).toHaveText(t.rateLimited);
    });

    test(`${l}: when the admin API asks for a check, Turnstile appears and the sign-up goes through with its token`, async ({ page }) => {
      // Cloudflare's script stood in for: renders a box and passes at once
      await page.route('https://challenges.cloudflare.com/**', (route) =>
        route.fulfill({
          contentType: 'text/javascript',
          body: `window.turnstile = { render(el, o) { el.textContent = 'turnstile ' + o.sitekey; setTimeout(() => o.callback('XXXX.DUMMY.TOKEN.XXXX'), 300); return 'w'; }, reset() {} };`,
        }),
      );
      await page.goto(`/${l}/newsletter/`);
      const form = page.locator('main form[data-newsletter]');
      await form.getByLabel(t.emailLabel).fill('human@example.com');
      await form.getByRole('button', { name: t.submit }).click();
      await expect(form.locator('[data-turnstile]')).toContainText('turnstile 1x00000000000000000000AA');
      await expect(form.getByRole('status')).toHaveText(t.checkEmail);
      await expect(form.locator('[data-turnstile]')).toBeHidden();
    });

    test.describe('without JavaScript', () => {
      test.use({ javaScriptEnabled: false });
      test(`${l}: the form posts and comes back with the answer on the sign-up page`, async ({ page }) => {
        await page.goto(`/${l}/`);
        const footer = page.getByTestId('footer-newsletter');
        await footer.getByLabel(t.emailLabel).fill('reader@example.com');
        await footer.getByRole('button', { name: t.submit }).click();
        await expect(page).toHaveURL(new RegExp(`/${l}/newsletter/\\?s=check_email$`));
        await expect(page.locator('main [role="status"]')).toHaveText(t.checkEmail);
        await expect(page.locator('html')).toHaveAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
      });
    });

    test(`${l}: the confirm link asks first, then confirms on the button; an old link has expired`, async ({ page }) => {
      await page.goto(`/${l}/newsletter/confirm?token=${NL_TOKENS.confirm}`);
      await expect(page.getByRole('heading', { level: 1, name: t.confirmTitle })).toBeVisible();
      await expectAxeClean(page);
      await page.getByRole('button', { name: t.confirmButton }).click();
      await expect(page.getByRole('heading', { level: 1, name: t.confirmedTitle })).toBeVisible();
      await expect(page.getByRole('button', { name: t.confirmButton })).toHaveCount(0);

      await page.goto(`/${l}/newsletter/confirm?token=${NL_TOKENS.expired}`);
      await page.getByRole('button', { name: t.confirmButton }).click();
      await expect(page.getByRole('heading', { level: 1, name: t.expiredTitle })).toBeVisible();
      await expect(page.getByRole('link', { name: t.signUp })).toBeVisible();
    });

    test(`${l}: the unsubscribe link asks first, then unsubscribes on the button, axe clean`, async ({ page }) => {
      await page.goto(`/${l}/newsletter/unsubscribe?token=${NL_TOKENS.unsubscribe}`);
      await expect(page.getByRole('heading', { level: 1, name: t.unsubscribeTitle })).toBeVisible();
      await page.getByRole('button', { name: t.unsubscribeButton }).click();
      await expect(page.getByRole('heading', { level: 1, name: t.unsubscribedTitle })).toBeVisible();
      await expectAxeClean(page);
    });
  });
}

test('one-click unsubscribe from a mail client (RFC 8058) gets a plain 200', async ({ request }) => {
  test.skip(!local, 'stub admin API only');
  const res = await request.post(`/en/newsletter/unsubscribe?token=${NL_TOKENS.unsubscribe}`, {
    form: { 'List-Unsubscribe': 'One-Click' },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe('OK');
});
