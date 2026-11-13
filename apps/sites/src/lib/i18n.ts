/**
 * The scholar sites' own interface strings (en + ar). Site content (names, About, posts, videos) is
 * the scholar's. Arabic uses «مرئي / مرئيات» for video and «المقاطع القصيرة» for Shorts (glossary).
 */
import type { Locale } from '../../../../packages/render/src/locale';

const en = {
  skip: 'Skip to content',
  mainNav: 'Main',
  footerNav: 'Site links',
  language: 'العربية',
  modeToLight: 'Switch to light mode',
  modeToDark: 'Switch to dark mode',
  signIn: 'Sign in',
  signOut: 'Sign out',
  signedInAs: 'Signed in as {name}',
  account: 'Your account',
  nav: { home: 'Home', videos: 'Videos', shorts: 'Shorts', posts: 'Posts', about: 'About', url: 'Link' },
  latestVideos: 'Latest videos',
  latestPosts: 'Latest posts',
  allVideos: 'All videos',
  allPosts: 'All posts',
  more: 'More',
  moreCards: '{n} more cards',
  noVideos: 'No videos yet.',
  noPosts: 'No posts yet.',
  watchOn: 'Watch on Al Ummah Now',
  joinDiscussion: 'Join the discussion on Al Ummah Now',
  openOnPlatform: 'Open on Al Ummah Now',
  readArticle: 'Read the article',
  pollOnPlatform: 'Vote on Al Ummah Now',
  quizOnPlatform: 'Answer on Al Ummah Now',
  likes: '{n} likes',
  comments: '{n} comments',
  views: '{n} views',
  links: 'Links',
  channel: 'Channel on Al Ummah Now',
  previous: 'Newer',
  next: 'Older',
  page: 'Page {n}',
  preview: 'Preview: only you can see these unsaved settings.',
  unavailableTitle: 'This site is not available',
  unavailableBody: 'Please try again later.',
  notFoundTitle: 'Page not found',
  notFoundBody: 'This page doesn’t exist on this site.',
  backHome: 'Go to the home page',
  platformBand: 'Videos and posts on Al Ummah Now',
  platformMinimal: 'On Al Ummah Now',
  guidelines: 'Community guidelines',
  report: 'Report content',
  accountNote: 'You sign in with your Al Ummah Now account.',
  duration: 'Duration',
  published: 'Published',
};

type Strings = typeof en;
type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

const ar: DeepString<Strings> = {
  skip: 'انتقل إلى المحتوى',
  mainNav: 'الرئيسية',
  footerNav: 'روابط الموقع',
  language: 'English',
  modeToLight: 'التبديل إلى الوضع الفاتح',
  modeToDark: 'التبديل إلى الوضع الداكن',
  signIn: 'تسجيل الدخول',
  signOut: 'تسجيل الخروج',
  signedInAs: 'تم تسجيل الدخول باسم {name}',
  account: 'حسابك',
  nav: { home: 'الرئيسية', videos: 'المرئيات', shorts: 'المقاطع القصيرة', posts: 'المنشورات', about: 'نبذة', url: 'رابط' },
  latestVideos: 'أحدث المرئيات',
  latestPosts: 'أحدث المنشورات',
  allVideos: 'كل المرئيات',
  allPosts: 'كل المنشورات',
  more: 'المزيد',
  moreCards: 'بطاقات أخرى: {n}',
  noVideos: 'لا توجد مرئيات بعد.',
  noPosts: 'لا توجد منشورات بعد.',
  watchOn: 'شاهده على الأمة الآن',
  joinDiscussion: 'شارك في النقاش على الأمة الآن',
  openOnPlatform: 'افتحه على الأمة الآن',
  readArticle: 'اقرأ المقال',
  pollOnPlatform: 'صوّت على الأمة الآن',
  quizOnPlatform: 'أجب على الأمة الآن',
  likes: '{n} إعجاب',
  comments: '{n} تعليق',
  views: '{n} مشاهدة',
  links: 'روابط',
  channel: 'القناة على الأمة الآن',
  previous: 'الأحدث',
  next: 'الأقدم',
  page: 'الصفحة {n}',
  preview: 'معاينة: لا يرى هذه الإعدادات غير المحفوظة أحد غيرك.',
  unavailableTitle: 'هذا الموقع غير متاح',
  unavailableBody: 'يُرجى المحاولة لاحقًا.',
  notFoundTitle: 'الصفحة غير موجودة',
  notFoundBody: 'هذه الصفحة غير موجودة في هذا الموقع.',
  backHome: 'الذهاب إلى الصفحة الرئيسية',
  platformBand: 'المرئيات والمنشورات على الأمة الآن',
  platformMinimal: 'على الأمة الآن',
  guidelines: 'إرشادات المجتمع',
  report: 'الإبلاغ عن محتوى',
  accountNote: 'تسجّل الدخول بحسابك في الأمة الآن.',
  duration: 'المدة',
  published: 'تاريخ النشر',
};

export function strings(locale: Locale): Strings {
  return locale === 'ar' ? (ar as Strings) : en;
}

export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}

export const STRINGS = { en, ar };
