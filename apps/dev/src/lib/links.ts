/** External addresses used in the copy. Production hosts only: this site has no environment-specific links. */
export const GH = 'https://github.com/Al-Ummah-Now';
export const WIKI = `${GH}/AlUmmahNowWiki/blob/main`;
export const WWW = 'https://www.alummahnow.net';
export const VIDEOS = 'https://videos.alummahnow.net';
export const STATUS_PAGE = 'https://status.alummahnow.net';

/** The platform's Contact us form (wiki CHAT-CONTACT): its topics are general, account, problem, content, partnership. */
export type ContactTopic = 'general' | 'partnership';
export const contactUrl = (locale: 'en' | 'ar', topic: ContactTopic): string => `${VIDEOS}/${locale}/contact?topic=${topic}`;
