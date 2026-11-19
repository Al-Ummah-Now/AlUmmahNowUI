/**
 * The Al Ummah Now error card (wiki guides/error-pages.md) for www, scholar sites and the dev site:
 * the same card, words, icons and actions as the videos site, admin, Auth and the CMS. Its styles are
 * the vendored family sheet (styles/aun-error-page.css, from the monorepo's
 * packages/fanous-tokens/errors/aun-error-page.css; never edit it here). The words are a copy of the
 * monorepo's ERROR_SCREEN_STRINGS (@al-ummah/shared-types error-reporting/i18n.ts): keep them in step.
 * Never a stack trace or a raw error message.
 */
import { escapeHtml } from './html';
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
  errorCode: string;
}

export const ERROR_CARD_STRINGS: Record<Locale, ErrorCardStrings> = {
  en: {
    kinds: {
      notFound: { title: 'Page not found', body: "We couldn't find this page. The link may be wrong, or the page may have moved." },
      gone: { title: 'This was removed', body: "It's no longer on Al Ummah Now. Search for something else, or go to the home page." },
      server: { title: 'We could not load this page', body: 'Our server had a problem with this request. Please try again in a moment.' },
      unavailable: { title: 'This page is temporarily unavailable', body: 'Our content service is not responding. Try again in a few minutes.' },
    },
    goHome: 'Go to home',
    goBack: 'Go back',
    tryAgain: 'Try again',
    search: 'Search',
    searchLabel: 'Search Al Ummah Now',
    searchPlaceholder: 'Search articles, scholars and videos',
    needHelp: 'Still stuck?',
    contactUs: 'Contact us',
    errorCode: 'Error {code}',
  },
  ar: {
    kinds: {
      notFound: { title: 'الصفحة غير موجودة', body: 'لم نعثر على هذه الصفحة. ربما الرابط غير صحيح أو نُقلت الصفحة.' },
      gone: { title: 'حُذف هذا المحتوى', body: 'لم يعد موجودًا على الأمة الآن. ابحث عن شيء آخر أو انتقل إلى الصفحة الرئيسية.' },
      server: { title: 'تعذّر تحميل هذه الصفحة', body: 'واجه الخادم مشكلة في هذا الطلب. يُرجى المحاولة بعد قليل.' },
      unavailable: { title: 'هذه الصفحة غير متاحة مؤقتًا', body: 'خدمة المحتوى لا تستجيب حاليًا. حاول مرة أخرى بعد دقائق.' },
    },
    goHome: 'الصفحة الرئيسية',
    goBack: 'رجوع',
    tryAgain: 'حاول مرة أخرى',
    search: 'بحث',
    searchLabel: 'ابحث في الأمة الآن',
    searchPlaceholder: 'ابحث في المقالات والعلماء والمرئيات',
    needHelp: 'ما زلت تواجه المشكلة؟',
    contactUs: 'تواصل معنا',
    errorCode: 'خطأ {code}',
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
} as const;
export type ErrorCardIcon = keyof typeof ERROR_CARD_ICONS;

export const errorCardIcon = (name: ErrorCardIcon): string =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-icon="${name}">${ERROR_CARD_ICONS[name]}</svg>`;

/** "Error 404" / «خطأ ٤٠٤» (Eastern Arabic digits in Arabic, never implicit 'ar'). */
export function errorCodeLabel(locale: Locale, code: number): string {
  const digits = new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-arab' : 'en-US', { useGrouping: false }).format(code);
  return ERROR_CARD_STRINGS[locale].errorCode.replace('{code}', digits);
}

export interface ErrorCardAction {
  label: string;
  href: string;
  icon?: ErrorCardIcon;
}

export interface ErrorCardOptions {
  locale: Locale;
  kind: ErrorCardKind;
  /** The app's own button classes: [main action, other actions] */
  buttonClass: { primary: string; secondary: string };
  primary: ErrorCardAction;
  secondary?: ErrorCardAction[];
  /** The site search form (GET action?q=), on 404 and 410 */
  search?: { action: string; placeholder?: string };
  /** Go back: shown by the page's script when there is history (data-ep-back) */
  back?: boolean;
  contactHref?: string;
  /** Override the shared words */
  title?: string;
  body?: string;
  /** 2 for a second card on the page (the dev site's 404 shows both languages) */
  headingLevel?: 1 | 2;
}

const button = (a: ErrorCardAction, cls: string, attrs = ''): string =>
  `<a class="${escapeHtml(cls)} ep-btn" href="${escapeHtml(a.href)}"${attrs}>${a.icon ? errorCardIcon(a.icon) : ''}<span>${escapeHtml(a.label)}</span></a>`;

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
      `<button type="submit" class="${escapeHtml(o.buttonClass.secondary)} ep-btn ep-search-btn">${errorCardIcon('search')}<span>${escapeHtml(t.search)}</span></button></form>`
    : '';
  const back = o.back
    ? `<button type="button" class="${escapeHtml(o.buttonClass.secondary)} ep-btn" data-ep-back hidden>${errorCardIcon('back')}<span>${escapeHtml(t.goBack)}</span></button>`
    : '';
  const help = o.contactHref ? `<p class="ep-help">${escapeHtml(t.needHelp)} <a href="${escapeHtml(o.contactHref)}">${escapeHtml(t.contactUs)}</a></p>` : '';
  return (
    `<div class="ep" lang="${o.locale}" dir="${dir}" data-error-status="${status}" data-testid="error-screen"${o.kind === 'server' || o.kind === 'unavailable' ? ' role="alert"' : ''}>` +
    `<section class="ep-card" aria-labelledby="${id}">` +
    `<div class="ep-head"><span class="ep-badge" aria-hidden="true">${errorCardIcon(icon)}</span>` +
    `<div class="ep-heading"><p class="ep-code">${escapeHtml(errorCodeLabel(o.locale, status))}</p><${h} class="ep-title" id="${id}">${escapeHtml(o.title ?? copy.title)}</${h}></div>` +
    `<p class="ep-body">${escapeHtml(o.body ?? copy.body)}</p></div>` +
    search +
    `<footer class="ep-foot">${help}<div class="ep-actions">${back}${(o.secondary ?? []).map((a) => button(a, o.buttonClass.secondary)).join('')}${button(o.primary, o.buttonClass.primary)}</div></footer>` +
    `</section></div>`
  );
}

/** Go back: each app serves public/ep-back.js (external: the dev site's and www's CSP have no inline scripts). */
export const ERROR_CARD_BACK_SCRIPT = '/ep-back.js';
