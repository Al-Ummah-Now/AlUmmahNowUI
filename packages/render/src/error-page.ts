/**
 * The Al Ummah Now error card (wiki guides/error-pages.md) for www, scholar sites and the dev site:
 * the same card, words, icons and actions as the videos site, admin, Auth and the CMS. Its styles are
 * the vendored family sheet (styles/aun-error-page.css, from the monorepo's
 * packages/fanous-tokens/errors/aun-error-page.css; never edit it here). The words are a copy of the
 * monorepo's ERROR_SCREEN_STRINGS (@al-ummah/shared-types error-reporting/i18n.ts): keep them in step.
 * Never a stack trace or a raw error message.
 */
import { escapeHtml } from './html';
import { formatNumber } from './format';
import type { Locale } from './locale';

export type ErrorCardKind = 'notFound' | 'gone' | 'server' | 'unavailable';

interface Copy {
  title: string;
  body: string;
}

export interface ErrorCardStrings {
  kinds: Record<ErrorCardKind, Copy>;
  goHome: string;
  goBack: string;
  tryAgain: string;
  search: string;
  searchLabel: string;
  searchPlaceholder: string;
  needHelp: string;
  contactUs: string;
  reference: string;
  referenceHint: string;
  copy: string;
  copied: string;
  errorCode: string;
  /** The tab title: "{title} | Al Ummah Now" (the same format on every app) */
  pageTitle: string;
}

/**
 * A reference the visitor can quote: ERR-XXXX-XXXX in Crockford base32 (no I, L, O, U), the same
 * format the videos site, the admin and Auth show (AlUmmahNow shared-types error-reporting), so it
 * reads the same over the phone and inside Arabic text on every app.
 */
const REF_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newErrorRef(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const chars = Array.from(random(new Uint8Array(8)), (b) => REF_ALPHABET[b & 31]).join('');
  return `ERR-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export const ERROR_CARD_STRINGS: Record<Locale, ErrorCardStrings> = {
  en: {
    kinds: {
      notFound: { title: 'Page not found', body: 'We couldn’t find this page. The link may be wrong, or the page may have moved.' },
      gone: { title: 'This was removed', body: 'It’s no longer on Al\u00a0Ummah\u00a0Now. Search for something else, or go to the home\u00a0page.' },
      server: { title: 'We could not load this page', body: 'Our server had a problem with this request. It has been reported. Please try again in a\u00a0moment.' },
      unavailable: { title: 'We’ll be back shortly', body: 'Our server is not responding right now. Try again in a few\u00a0minutes.' },
    },
    goHome: 'Home page',
    goBack: 'Go back',
    tryAgain: 'Try again',
    search: 'Search',
    searchLabel: 'Search Al Ummah Now',
    searchPlaceholder: 'Search articles, scholars and videos',
    needHelp: 'Still stuck?',
    contactUs: 'Contact us',
    reference: 'Reference',
    referenceHint: 'Quote this reference if you contact us, so we can find what happened.',
    copy: 'Copy reference',
    copied: 'Copied',
    errorCode: 'Error {code}',
    pageTitle: '{title} | Al Ummah Now',
  },
  ar: {
    kinds: {
      notFound: { title: 'الصفحة غير موجودة', body: 'لم نعثر على هذه الصفحة. ربما الرابط غير صحيح أو نُقلت الصفحة.' },
      gone: { title: 'حُذف هذا المحتوى', body: 'لم يعد موجودًا على الأمة الآن. ابحث عن شيء آخر أو انتقل إلى الصفحة\u00a0الرئيسية.' },
      server: { title: 'تعذّر تحميل هذه الصفحة', body: 'واجه الخادم مشكلة في هذا الطلب، وقد أُبلغ عنها. يُرجى المحاولة بعد قليل.' },
      unavailable: { title: 'سنعود بعد قليل', body: 'الخادم لا يستجيب حاليًا. حاول مرة أخرى بعد دقائق.' },
    },
    goHome: 'الصفحة الرئيسية',
    goBack: 'رجوع',
    tryAgain: 'حاول مرة أخرى',
    search: 'بحث',
    searchLabel: 'ابحث في الأمة الآن',
    searchPlaceholder: 'ابحث في المقالات والعلماء والمرئيات',
    needHelp: 'ما زلت تواجه المشكلة؟',
    contactUs: 'تواصل معنا',
    reference: 'الرقم المرجعي',
    referenceHint: 'اذكر هذا الرقم المرجعي عند التواصل معنا لنعرف ما حدث.',
    copy: 'انسخ الرقم المرجعي',
    copied: 'نُسخ',
    errorCode: 'خطأ {code}',
    pageTitle: '{title} | الأمة الآن',
  },
};

export const ERROR_CARD_STATUS: Record<ErrorCardKind, number> = { notFound: 404, gone: 410, server: 500, unavailable: 503 };

/** The shared lucide shapes (monorepo ERROR_PAGE_ICONS), 24×24, stroke currentColor. */
export const ERROR_CARD_ICONS = {
  notFound: '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>',
  gone: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m14.5 12.5-5 5"/><path d="m9.5 12.5 5 5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  retry: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
} as const;
export type ErrorCardIcon = keyof typeof ERROR_CARD_ICONS;

export const errorCardIcon = (name: ErrorCardIcon): string =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-icon="${name}">${ERROR_CARD_ICONS[name]}</svg>`;

/** "Error 404" / «خطأ ٤٠٤» (Eastern Arabic digits in Arabic, never implicit 'ar'). */
export function errorCodeLabel(locale: Locale, code: number): string {
  const digits = formatNumber(code, locale, { useGrouping: false });
  return ERROR_CARD_STRINGS[locale].errorCode.replace('{code}', digits);
}

/** "Page not found | Al Ummah Now" / «الصفحة غير موجودة | الأمة الآن»: the error pages' tab title. */
export function errorPageTitle(locale: Locale, title: string): string {
  return ERROR_CARD_STRINGS[locale].pageTitle.replace('{title}', title);
}

export interface ErrorCardAction {
  label: string;
  href: string;
  icon?: ErrorCardIcon;
}

export interface ErrorCardOptions {
  locale: Locale;
  kind: ErrorCardKind;
  primary: ErrorCardAction;
  secondary?: ErrorCardAction[];
  /** The site search form (GET action?q=), on 404 and 410 */
  search?: { action: string; placeholder?: string };
  /** Go back: shown by the page's script when there is history (data-ep-back) */
  back?: boolean;
  contactHref?: string;
  /** 500/503: the reference the server logged with the failure (the videos card's Reference box) */
  reference?: string;
  /** Override the shared words */
  title?: string;
  body?: string;
  /** 2 for a second card on the page (the dev site's 404 shows both languages) */
  headingLevel?: 1 | 2;
}

/** The family's own buttons (aun-error-page.css), never the app's: the same on every app. */
const PRIMARY = 'ep-btn ep-btn-primary';
const SECONDARY = 'ep-btn ep-btn-secondary';

const button = (a: ErrorCardAction, cls: string): string =>
  `<a class="${cls}" href="${escapeHtml(a.href)}">${a.icon ? errorCardIcon(a.icon) : ''}<span>${escapeHtml(a.label)}</span></a>`;

/** The card's HTML (every value escaped). */
export function errorCardHtml(o: ErrorCardOptions): string {
  const t = ERROR_CARD_STRINGS[o.locale];
  const copy = t.kinds[o.kind];
  const status = ERROR_CARD_STATUS[o.kind];
  const icon: ErrorCardIcon = o.kind === 'notFound' || o.kind === 'gone' ? o.kind : 'alert';
  const dir = o.locale === 'ar' ? 'rtl' : 'ltr';
  const h = o.headingLevel === 2 ? 'h2' : 'h1';
  const id = `ep-title-${o.locale}`;
  const search = o.search
    ? `<form class="ep-search" role="search" action="${escapeHtml(o.search.action)}" method="get">` +
      `<label class="ep-sr" for="ep-search-q-${o.locale}">${escapeHtml(t.searchLabel)}</label>` +
      `<input id="ep-search-q-${o.locale}" class="ep-search-input" type="search" name="q" placeholder="${escapeHtml(o.search.placeholder ?? t.searchPlaceholder)}" autocomplete="off" enterkeyhint="search">` +
      `<button type="submit" class="${SECONDARY} ep-search-btn">${errorCardIcon('search')}<span>${escapeHtml(t.search)}</span></button></form>`
    : '';
  const back = o.back
    ? `<button type="button" class="${SECONDARY}" data-ep-back hidden>${errorCardIcon('back')}<span>${escapeHtml(t.goBack)}</span></button>`
    : '';
  // The Reference box, as on the videos card: the code, a Copy button (shown by ep-back.js when the
  // clipboard is there) and the hint. The code is lang="zxx" (no language): it is a code in any
  // locale, and an Arabic page's `:lang(ar) { font-family }` rule (www global.css) would otherwise
  // tie the monospace rule and win by load order
  const ref = o.reference
    ? `<div class="ep-ref"><div class="ep-ref-row"><span class="ep-ref-label">${escapeHtml(t.reference)}</span>` +
      `<code class="ep-ref-code" dir="ltr" lang="zxx" translate="no" data-testid="error-ref">${escapeHtml(o.reference)}</code>` +
      `<button type="button" class="ep-ref-copy" data-ep-copy="${escapeHtml(o.reference)}" data-copied="${escapeHtml(t.copied)}" hidden>${errorCardIcon('copy')}<span aria-live="polite">${escapeHtml(t.copy)}</span></button></div>` +
      `<p class="ep-ref-hint">${escapeHtml(t.referenceHint)}</p></div>`
    : '';
  const help = o.contactHref ? `<p class="ep-help">${escapeHtml(t.needHelp)} <a href="${escapeHtml(o.contactHref)}">${escapeHtml(t.contactUs)}</a></p>` : '';
  return (
    `<div class="ep" lang="${o.locale}" dir="${dir}" data-error-status="${status}" data-testid="error-screen"${o.kind === 'server' || o.kind === 'unavailable' ? ' role="alert"' : ''}>` +
    `<section class="ep-card" aria-labelledby="${id}">` +
    `<div class="ep-head"><span class="ep-badge" aria-hidden="true">${errorCardIcon(icon)}</span>` +
    `<div class="ep-heading"><p class="ep-code">${escapeHtml(errorCodeLabel(o.locale, status))}</p><${h} class="ep-title" id="${id}">${escapeHtml(o.title ?? copy.title)}</${h}></div>` +
    `<p class="ep-body">${bodySentencesHtml(o.body ?? copy.body)}</p></div>` +
    search +
    ref +
    `<footer class="ep-foot">${help}<div class="ep-actions">${back}${(o.secondary ?? []).map((a) => button(a, SECONDARY)).join('')}${button(o.primary, PRIMARY)}</div></footer>` +
    `</section></div>`
  );
}

/** Go back: each app serves public/ep-back.js (external: the dev site's and www's CSP have no inline scripts). */
export const ERROR_CARD_BACK_SCRIPT = '/ep-back.js';

/**
 * The body one `.ep-s` span (an inline block) a sentence: two sentences share a line only when both
 * fit, so no line ends on the next sentence's first words («… الصفحة. ربما» / “… a problem. Try”).
 * The same split as shared-types' errorBodySentences in the videos app.
 */
export function bodySentencesHtml(body: string): string {
  return body
    .split(/(?<=[.!?؟])\s+(?=\S)/u)
    .filter(Boolean)
    .map((s) => `<span class="ep-s">${escapeHtml(s)}</span>`)
    .join(' ');
}
