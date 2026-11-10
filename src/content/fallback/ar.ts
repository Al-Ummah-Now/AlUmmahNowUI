import type { SiteSettings } from '../../lib/cms-types';
import type { Builtin } from './types';

const settings: SiteSettings = {
  locale: 'ar',
  site_title: 'الأمة الآن',
  tagline: 'مرئيات إسلامية ومجتمع',
  hero_title: 'العلم النافع، في متناول يدك',
  hero_body:
    'دروس ومحاضرات وتذكيرات من علماء ودعاة تثق بهم، بالعربية والإنجليزية. شاهد، وتابع القنوات، وواصل التعلّم بحساب واحد.',
  social: [],
};

const headerNav = [
  { label: 'المقالات', url: '/articles/' },
  { label: 'المرئيات', url: '/videos/' },
  { label: 'من نحن', url: '/about/' },
];
const footerNav = [
  { label: 'من نحن', url: '/about/' },
  { label: 'المقالات', url: '/articles/' },
  { label: 'المرئيات', url: '/videos/' },
];

export const ar: Builtin = {
  site: { settings, nav: { header: headerNav, footer: footerNav } },
  home: { settings, videos: [], posts: [] },
  headerNav,
  footerNav,
  pillars: [
    {
      title: 'دروس ومحاضرات',
      body: 'تفسير وحديث وفقه وسيرة وتذكيرات يومية، مرتّبة في سلاسل تتابعها من الدرس الأول إلى الأخير.',
    },
    {
      title: 'قنوات تثق بها',
      body: 'ينشر العلماء والمساجد وصنّاع المحتوى على قنواتهم. تابع من تتعلّم منهم، واطّلع على كل جديد.',
    },
    {
      title: 'حساب واحد لكل التطبيقات',
      body: 'سجّل دخولك مرة واحدة لتشاهد وتحفظ قوائم التشغيل وتدير ملفك الشخصي في كل تطبيقات الأمة الآن، بالعربية أو الإنجليزية.',
    },
  ],
  pages: {
    about: {
      slug: 'about',
      locale: 'ar',
      title: 'عن الأمة الآن',
      summary: 'منصة إسلامية للمرئيات والمجتمع، بالعربية والإنجليزية.',
      body: [
        'الأمة الآن بيتٌ للمحتوى الإسلامي النافع: دروس ومحاضرات وسلاسل وتذكيرات من العلماء والمساجد وصنّاع المحتوى.',
        '',
        '## ماذا نبني',
        '',
        '- **مرئيات** تشاهدها، وتتابع قنواتها، وتحفظ قوائم تشغيلها.',
        '- **حساب واحد** يعمل في كل تطبيقات الأمة الآن.',
        '- **العربية والإنجليزية** منذ البداية، ليصل العلم نفسه إلى عدد أكبر من الناس.',
        '',
        '## ابدأ الآن',
        '',
        'تصفّح مكتبة المرئيات، أو أنشئ حسابًا لتتابع القنوات وتحفظ ما تريد الرجوع إليه.',
      ].join('\n'),
      seo_title: null,
      seo_description: null,
      cover: null,
      published_at: '2026-11-01T00:00:00.000Z',
      updated_at: '2026-11-01T00:00:00.000Z',
      alternates: [{ locale: 'en', slug: 'about' }],
    },
  },
};
