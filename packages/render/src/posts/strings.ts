/** The shared post renderers' strings (en/ar; same keys, checked by apps/www/tests/post-kinds.test.ts). */
import type { Locale } from '../locale';

const en = {
  kindText: 'Post',
  kindImage: 'Images',
  kindPoll: 'Poll',
  kindQuiz: 'Quiz',
  kindVideo: 'Video',
  kindGif: 'GIF',
  kindLink: 'Link',
  voteOnChannel: 'Vote on the channel',
  answerOnChannel: 'Answer on the channel',
  joinDiscussion: 'Join the discussion',
  likes: '{count} likes',
  oneLike: '1 like',
  comments: '{count} comments',
  oneComment: '1 comment',
  watchVideo: 'Watch the video',
  opensOutside: 'Opens another website',
  moreImages: '+{count} more',
  pollOptions: 'Poll options',
  quizOptions: 'Answers',
  engagement: 'Likes and comments',
  onChannel: 'From the channel {name}',
};

const ar: typeof en = {
  kindText: 'منشور',
  kindImage: 'صور',
  kindPoll: 'استطلاع',
  kindQuiz: 'اختبار',
  kindVideo: 'مرئي',
  kindGif: 'صورة متحركة',
  kindLink: 'رابط',
  voteOnChannel: 'صوّت في القناة',
  answerOnChannel: 'أجب في القناة',
  joinDiscussion: 'شارك في النقاش',
  likes: '{count} إعجاب',
  oneLike: 'إعجاب واحد',
  comments: '{count} تعليق',
  oneComment: 'تعليق واحد',
  watchVideo: 'شاهد المرئي',
  opensOutside: 'يفتح موقعًا آخر',
  moreImages: '+{count} أخرى',
  pollOptions: 'خيارات الاستطلاع',
  quizOptions: 'الإجابات',
  engagement: 'الإعجابات والتعليقات',
  onChannel: 'من قناة {name}',
};

export type PostStrings = typeof en;
export const postStrings = (l: Locale): PostStrings => (l === 'ar' ? ar : en);
export const POST_STRINGS = { en, ar };

/** "{count} likes" etc. */
export const fill = (template: string, vars: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
