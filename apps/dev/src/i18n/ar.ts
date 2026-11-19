/**
 * Arabic copy for alummahnow.dev: the same keys as en.ts (tests/i18n.test.ts) and the wiki glossary's
 * terms («مرئي / مرئيات» for video, «المقاطع القصيرة» for Shorts, «اشترك» for subscribe).
 */
import { WIKI, GH, VIDEOS, WWW, STATUS_PAGE } from '../lib/links.ts';
import type { Item, Strings } from './en.ts';

export const ar: Strings = {
  meta: {
    siteName: 'الأمة الآن',
    siteNameAlt: 'Al Ummah Now',
    description:
      'الأمة الآن مجتمع إسلامي لمشاركة المرئيات بالعربية والإنجليزية: كيف يعمل، وكيف بُني، والتوجّه الذي ندرسه ليكون وقفًا.',
  },
  nav: {
    skip: 'تخطَّ إلى المحتوى',
    primary: 'الرئيسية',
    home: 'الرئيسية',
    community: 'المجتمع',
    technology: 'التقنية',
    infrastructure: 'البنية التحتية',
    'system-design': 'تصميم النظام',
    'open-source': 'المصدر المفتوح',
    waqf: 'الوقف',
    contact: 'تواصل معنا',
    /** The header lockup's second line (NAV.md: every app but www names itself) */
    appName: 'المطوّرون',
  },
  status: {
    live: 'يعمل الآن',
    ready: 'جاهز، لم يُستخدم بعد',
    rolling: 'مكتمل، قيد الإطلاق',
    building: 'قيد التطوير',
    planned: 'مخطط له',
  },
  common: {
    source: 'المصدر',
    sources: 'المصادر',
    external: '(يفتح موقعًا آخر)',
  },
  footer: {
    tagline: 'شارك ما يهمّ الأمة',
    rights: '© {year} الأمة الآن',
    line: 'مجتمع إسلامي لمشاركة المرئيات بالعربية والإنجليزية.',
    sites: 'مواقعنا',
    project: 'المشروع',
    wiki: 'الويكي',
    github: 'GitHub',
    status: 'حالة الخدمات',
    www: 'www.alummahnow.net',
    videos: 'videos.alummahnow.net',
    note: 'المعلومات في هذا الموقع مأخوذة من الشيفرة ومن الويكي العام. إن اختلفا فالشيفرة هي الصحيحة.',
  },

  home: {
    title: 'الأمة الآن',
    description:
      'مجتمع إسلامي لمشاركة المرئيات: شارك المرئيات والأخبار بلا رقابة، وتفاعل، وتعلّم، بالعربية والإنجليزية. مبني بشيفرة مفتوحة على Cloudflare.',
    heroTitle: 'مجتمع إسلامي لمشاركة المرئيات، مبنيّ في العلن',
    heroLead:
      'الأمة الآن مكان تشارك فيه الأمة المرئيات والأخبار بلا رقابة، وتتفاعل، وتتعلّم، بالعربية والإنجليزية. يشرح هذا الموقع الغاية من المنصة، وكيف بُنيت، والتوجّه الذي ندرسه لتكون وقفًا.',
    ctaDevelopers: 'كيف بُنيت المنصة',
    ctaPartners: 'تواصل معنا',
    pillarsTitle: 'لماذا هذا المجتمع',
    pillars: [
      { title: 'شارك المرئيات', body: 'ترفع القنوات المرئيات والمقاطع القصيرة، وتنشر المنشورات، وتنشئ قوائم التشغيل.' },
      { title: 'شارك الأخبار بلا رقابة', body: 'مكان لمشاركة ما يحدث، بقواعد منشورة وإبلاغ مفتوح للجميع، والقرار الأخير فيه للبشر لا للخوارزميات.' },
      { title: 'تفاعل', body: 'علّق واشترك وتلقَّ الإشعارات، وشارك في أي مكان عبر التضمين والروابط القصيرة.' },
      { title: 'تعلّم', body: 'تشارك القنوات تلاوات القرآن والتفسير والفقه والكلمات، ويمكن أن يكون للعلماء مواقعهم الخاصة.' },
    ],
    pillarsMore: 'المزيد عن المجتمع',
    liveTitle: 'يعمل اليوم',
    readyTitle: 'جاهز، لم يُستخدم بعد',
    readyLead: 'وصل إلى بيئة الإنتاج وجاهز للاستخدام، لكن لا شيء هناك يستخدمه بعد.',
    live: [
      { title: 'www.alummahnow.net', body: 'الموقع العام: الخط الزمني للرئيسية، والمقالات، وصفوف المرئيات.', href: WWW, feature: 'www-and-sites' },
      { title: 'videos.alummahnow.net', body: 'شاهد وارفع وعلّق واشترك.', href: VIDEOS, feature: 'videos-site' },
      { title: 'مواقع العلماء', body: 'مواقع بهوية مستقلة للعلماء على alummahnow.org، تعمل من المنصة نفسها.', href: '/ar/technology/#feature-scholar-sites', feature: 'scholar-sites' },
    ],
    systemTitle: 'المنظومة في لمحة',
    systemLead: 'كل ما يعمل على الخادم يعمل على Cloudflare Workers، وخدمة دخول واحدة تخدم كل التطبيقات.',
    systemLayers: [
      { title: 'الناس والتطبيقات', body: 'المتصفحات، والتطبيقات الأصلية للهواتف والتلفاز وأجهزة الحاسوب' },
      { title: 'تسجيل الدخول', body: 'خدمة دخول موحّد واحدة لكل التطبيقات، مع مفاتيح المرور' },
      { title: 'المواقع', body: 'www، وموقع المرئيات، ومواقع العلماء، ونظام إدارة المحتوى، ولوحة الإدارة' },
      { title: 'الواجهات البرمجية والعمّال', body: 'واجهة المرئيات، وواجهة الإدارة، والمعالجة في الخلفية، والتحديثات الفورية، والمجدول' },
      { title: 'البيانات والوسائط', body: 'D1 وR2 وKV وQueues؛ وFFmpeg على Cloudflare Containers؛ وBunny.net' },
    ],
    systemMore: 'اطّلع على البنية التحتية',
    audiencesTitle: 'من أين تبدأ',
    developers: {
      title: 'المطوّرون والمساهمون',
      body: 'كل المستودعات عامة على GitHub، ومعها ويكي يشرح كيف تترابط الأجزاء.',
      links: [
        { label: 'التقنية', href: 'technology' },
        { label: 'البنية التحتية ومسار المرئيات', href: 'infrastructure' },
        { label: 'المستودعات والمساهمة', href: 'open-source' },
      ],
    },
    partners: {
      title: 'المستثمرون والداعمون والشركاء',
      body: 'الغاية من المنصة، وما هو موجود اليوم، وكيف نريد أن تكون محبوسة لخدمة المجتمع.',
      links: [
        { label: 'المجتمع', href: 'community' },
        { label: 'توجّه الوقف', href: 'waqf' },
        { label: 'تواصل معنا', href: 'contact' },
      ],
    },
    waqfTitle: 'لخدمة الأمة',
    waqfBody:
      'ندرس أن تُدار الأمة الآن وقفًا أو من خلال جهة خيرية، لتخدم المنصة المجتمع بدل أن تكون ملكًا يُبتغى منه الربح. لا يوجد كيان قانوني حتى الآن. هذا توجّه، ونقول بوضوح أين وصل.',
    waqfMore: 'اقرأ عن توجّه الوقف',
  },

  community: {
    title: 'المجتمع',
    description:
      'شارك المرئيات والأخبار بلا رقابة، وتفاعل، وتعلّم، بالعربية والإنجليزية. الغاية من مجتمع الأمة الآن وكيف يعمل الإشراف.',
    heroTitle: 'مجتمع للمشاركة والحوار والتعلّم',
    heroLead:
      'الأمة الآن موقع لمشاركة المحتوى: تنشر القنوات المرئيات والمقاطع القصيرة والمنشورات وقوائم التشغيل، ويشاهد الجمهور ويعلّق ويشترك ويشارك. وكل ذلك بالعربية والإنجليزية.',
    sections: [
      {
        id: 'share',
        title: 'شارك المرئيات',
        lead: 'تنشر القنوات بكل الأشكال التي تدعمها المنصة.',
        items: [
          { title: 'المرئيات والمقاطع القصيرة', body: 'المقطع القصير مدته ثلاث دقائق أو أقل، وهو عمودي أو مربع، ويمكن لصاحبه أن يغيّر ذلك.', feature: 'videos-and-shorts', sources: [{ label: 'قاعدة المقاطع القصيرة', href: `${WIKI}/epics/CHAT-SHORTS-shorts-rule.md` }] },
          { title: 'البث المباشر', body: 'صفحات البث في الاستوديو وزر «ابدأ البث» وصفحة مشاهدة البث مبنية وضمن إصدار. لكن بيئة الإنتاج لا تستقبل بثًا بعد: ما زال Bunny Stream Live ينتظر الانضمام إلى نسخته التجريبية، والمسار المستضاف ذاتيًا ليس له عنوان في الإنتاج ولا يستقبل RTMP.', feature: 'live-streams', sources: [{ label: 'D3 مزوّد البث', href: `${WIKI}/epics/D3-live-provider.md` }] },
          { title: 'المنشورات وقوائم التشغيل وأقسام القناة', body: 'منشورات المجتمع، وقوائم تشغيل شخصية وغير مدرجة، وصفحات قنوات مرتّبة في أقسام.', feature: 'posts-playlists-sections', sources: [{ label: 'أقسام القناة', href: `${WIKI}/epics/AUN-CHANNEL-SECTIONS-channel-sections.md` }] },
          { title: 'الرفع بدعوة حاليًا', body: 'رفع المرئيات وإنشاء القنوات بدعوة فقط. يمنح المشرفون صنّاع المحتوى مستوى، وقد تفتح الاشتراكات هذا لاحقًا.', feature: 'creator-tiers', sources: [{ label: 'O25', href: `${WIKI}/epics/decisions.md#o25-invite-only-uploads-with-admin-assigned-creator-tiers` }] },
        ] as Item[],
      },
      {
        id: 'news',
        title: 'شارك الأخبار بلا رقابة',
        lead:
          'من حق الناس أن يشاركوا ما يحدث للأمة دون أن يختفي بصمت. هذه هي الغاية. وهي تعني عمليًا قواعد واضحة، وإبلاغًا مفتوحًا، وقرارات يتخذها البشر لا الأنظمة الآلية.',
        items: [
          { title: 'قواعد منشورة', body: 'إرشادات المجتمع منشورة بالعربية والإنجليزية. هي القواعد، ولا توجد قائمة خفية.', feature: 'community-rules', sources: [{ label: 'E06', href: `${WIKI}/epics/E06-community-moderation.md` }] },
          { title: 'الإبلاغ متاح للجميع', body: 'يمكن الإبلاغ عن المرئيات والتعليقات والقنوات، مع حماية من البرامج الآلية في نموذج الإبلاغ.', feature: 'reporting', sources: [{ label: 'الحماية من البرامج الآلية', href: `${WIKI}/guides/bot-protection.md` }] },
          { title: 'الذكاء الاصطناعي يوقف، والبشر يقررون', body: 'الإشراف الآلي لا يحذف شيئًا أبدًا، بل يوقف المحتوى فقط ليراجعه إنسان. ويعمل في بيئة الإنتاج في وضع الظل: يسجّل ما كان سيوقفه، ويفعّل المشرف الإيقاف لكل فئة على حدة.', feature: 'ai-moderation', sources: [{ label: 'E28 الإشراف بالذكاء الاصطناعي', href: `${WIKI}/epics/E28-ai-moderation.md` }] },
          { title: 'لا تسامح مع مواد إساءة معاملة الأطفال', body: 'تُزال، وتُحفظ الأدلة تحت حجز قانوني، ويُبلَّغ عنها للجهات المختصة.', feature: 'csam-intake', sources: [{ label: 'مواصفة الاستجابة', href: `${GH}/AlUmmahNow/blob/main/docs/specs/CSAM-RESPONSE.md` }] },
          { title: 'تقارير الإشراف', body: 'ندرس نشر إحصاءات دورية عن الإشراف بالعربية والإنجليزية، ولم يُتخذ قرار بعد.', feature: 'transparency-reports', sources: [{ label: 'M6', href: `${WIKI}/epics/decisions.md#m6-transparency-reporting` }] },
        ] as Item[],
      },
      {
        id: 'interact',
        title: 'تفاعل',
        lead: 'أن يتحدث الناس بعضهم مع بعض هو جوهر المجتمع.',
        items: [
          { title: 'التعليقات والاشتراكات', body: 'علّق واشترك باسمك، دون أن تحتاج إلى قناة خاصة بك.', feature: 'comments-subscriptions', sources: [{ label: 'AlUmmahNow', href: `${WIKI}/repos/AlUmmahNow.md` }] },
          { title: 'الإشعارات', body: 'جرس للمرئيات الجديدة من القنوات التي اشتركت فيها، وشارة تختفي على كل أجهزتك حين تفتحه.', feature: 'notifications', sources: [{ label: 'AlUmmahNow', href: `${WIKI}/repos/AlUmmahNow.md#notification-badge-and-read-state` }] },
          { title: 'التضمين', body: 'يمكن تضمين المرئيات والمقاطع القصيرة وقوائم التشغيل في مواقع أخرى، مع oEmbed ونافذة مشاركة.', feature: 'embeds', sources: [{ label: 'E25', href: `${WIKI}/epics/E25-sharing-embeds.md` }] },
          { title: 'روابط المشاركة القصيرة', body: 'روابط قصيرة على alummahnow.link للمرئيات والقنوات والمنشورات وقوائم التشغيل.', feature: 'short-links', sources: [{ label: 'AUN-SHORT-LINKS', href: `${WIKI}/epics/AUN-SHORT-LINKS-short-share-links.md` }] },
        ] as Item[],
      },
      {
        id: 'learn',
        title: 'تعلّم',
        lead: 'كثير مما تشاركه القنوات يُتعلَّم منه. وتحفظ المنصة كلمات صنّاع المحتوى وتصنيفاتهم كما هي.',
        items: [
          { title: 'تصنيفات المحتوى', body: 'تحتفظ تصنيفات مثل التفسير والفقه وتلاوة القرآن والمحاضرات الإسلامية بأسمائها.', feature: 'content-categories', sources: [{ label: 'دليل أسلوب النصوص', href: `${WIKI}/guides/copy-tone.md` }] },
          { title: 'صفحات العلماء ومواقعهم', body: 'صفحات للعلماء على www، ومواقع بهوية مستقلة للعلماء على alummahnow.org.', feature: 'scholar-sites', sources: [{ label: 'AUN-SEO', href: `${WIKI}/epics/AUN-SEO-search-visibility.md` }] },
          { title: 'تفريغ النصوص والترجمة النصية', body: 'يفرّغ صنّاع المحتوى نصوص مرئياتهم في الاستوديو، بدقائق يحددها مستواهم. وتُطابَق آيات القرآن مع النص الرسمي ويؤكدها صاحب المرئي. والترجمة إلى لغات أخرى مخطط لها.', feature: 'transcripts', sources: [{ label: 'AUN-CAPTIONS', href: `${WIKI}/epics/AUN-CAPTIONS-transcription-translation.md` }] },
        ] as Item[],
      },
      {
        id: 'languages',
        title: 'العربية والإنجليزية في كل مكان',
        lead: 'كل شاشة موجودة باللغتين، والعربية من اليمين إلى اليسار في كل مكان، لا ترجمة لاحقة.',
        items: [
          { title: 'اللغتان في كل التطبيقات', body: 'الموقع العام، وموقع المرئيات، وتسجيل الدخول، ونظام إدارة المحتوى، والتطبيقات الأصلية.', feature: 'bilingual', sources: [{ label: 'E03', href: `${WIKI}/epics/E03-i18n-enhancement.md` }] },
          { title: 'مصطلحات واحدة', body: 'الكلمات نفسها في كل التطبيقات، فلا يصادف المشاهد اسمين لشيء واحد.', sources: [{ label: 'المسرد', href: `${WIKI}/guides/glossary.md` }] },
        ] as Item[],
      },
    ],
  },

  technology: {
    title: 'التقنية',
    description:
      'كيف بُنيت الأمة الآن: Cloudflare Workers، وNext.js وAstro، ودخول موحّد مبني على OpenAuth مع مفاتيح المرور، ونظام إدارة محتوى bknd، وتطبيقات أصلية على نواة Rust مشتركة، ونظام التصميم فانوس.',
    heroTitle: 'منصة واحدة، وتطبيقات كثيرة، وكلها على Cloudflare',
    heroLead:
      'كل ما يعمل على الخادم في الأمة الآن يعمل على Cloudflare Workers. وتتشارك التطبيقات خدمة دخول واحدة، ونظام تصميم واحدًا، وقواعد واحدة لتنفيذ الأعمال في الخلفية.',
    groups: [
      {
        title: 'تطبيقات الويب',
        items: [
          { title: 'موقع المرئيات', body: 'Next.js على Cloudflare Workers: صفحات المشاهدة، والاستوديو، والقنوات، وأدوات صنّاع المحتوى.', feature: 'videos-site', sources: [{ label: 'AlUmmahNow', href: `${WIKI}/repos/AlUmmahNow.md` }] },
          { title: 'الموقع العام ومواقع العلماء', body: 'Astro على Workers، بحزمة عرض واحدة مشتركة والسمات نفسها.', feature: 'www-and-sites', sources: [{ label: 'AlUmmahNowUI', href: `${WIKI}/repos/AlUmmahNowUI.md` }] },
          { title: 'لوحة الإدارة', body: 'أدوات الفريق مع تحديثات فورية عبر عامل للاتصال اللحظي، وصندوق رسائل التواصل، ولوحة لتوصيل المرئيات، وصفحة للأخطاء فيها زر إعادة المحاولة.', feature: 'videos-admin', sources: [{ label: 'خريطة المنظومة', href: `${WIKI}/README.md#system-map` }] },
          { title: 'نظام إدارة المحتوى', body: 'bknd على عامل Worker، بشاشات إدارة من صنعنا بدل شاشات bknd. يدير صفحات www والمقالات والخط الزمني للرئيسية.', feature: 'cms', sources: [{ label: 'AlUmmahNowCMS', href: `${WIKI}/repos/AlUmmahNowCMS.md` }] },
        ] as Item[],
      },
      {
        title: 'الهوية',
        items: [
          { title: 'الدخول الموحّد', body: 'نسختنا من OpenAuth: OAuth 2.0 وOpenID Connect مع PKCE. سجّل الدخول مرة تكن مسجّلًا في كل التطبيقات، وتسجيل الخروج ينهيه في كل مكان.', feature: 'sso', sources: [{ label: 'المصادقة', href: `${WIKI}/guides/authentication.md` }] },
          { title: 'رموز قصيرة العمر', body: 'رمز الوصول صالح {accessTokenMinutes} دقيقة. ورموز التحديث تتجدد، وإعادة استخدام رمز قديم تُلغي العائلة كلها.', feature: 'short-lived-tokens', sources: [{ label: 'الرموز', href: `${WIKI}/guides/authentication.md#tokens` }] },
          { title: 'مفاتيح المرور', body: 'الدخول بمفاتيح المرور متاح على الويب وفي التطبيقات الأصلية. واشتراطها على فريق العمل مكتمل، ويبقى معطّلًا حتى يفعّله المشرف العام.', feature: 'passkeys', sources: [{ label: 'AUTH-PASSKEYS', href: `${WIKI}/epics/AUTH-PASSKEYS-passkeys-everywhere.md` }] },
        ] as Item[],
      },
      {
        title: 'التطبيقات الأصلية',
        items: [
          { title: 'نواة Rust مشتركة', body: 'عميل الواجهة البرمجية، وتسجيل الدخول، والمزامنة، والرفع، ومحرّك وسائط بلغة Rust، مع ربط بلغات Swift وKotlin وC#.', feature: 'rust-core', sources: [{ label: 'AlUmmahNowCore', href: `${WIKI}/repos/AlUmmahNowCore.md` }] },
          { title: 'Apple وAndroid وWindows وLinux والتلفاز', body: 'تطبيقات الاستوديو تعمل على أجهزة Apple وAndroid وWindows وLinux، ولتطبيقات Android وسطح المكتب إصدارات تجريبية على GitHub. تطبيقات المشاهدة والتلفاز قيد التطوير، ولا يوجد أي تطبيق في متجر عام بعد.', feature: 'native-apps', sources: [{ label: 'E23 هندسة الإصدارات', href: `${WIKI}/epics/E23-release-engineering.md` }] },
        ] as Item[],
      },
      {
        title: 'التصميم والذكاء الاصطناعي',
        items: [
          { title: 'نظام التصميم فانوس', body: 'أربع سمات مبنية على هوية الفانوس، ومجموعة رموز واحدة للويب والتطبيقات الأصلية، وتباين مفحوص في كل سمة.', feature: 'fanous-themes', sources: [{ label: 'السمات', href: `${WIKI}/guides/theming.md` }] },
          { title: 'الإشراف بالذكاء الاصطناعي على Cloudflare', body: 'يفحص Workers AI المحتوى ولا يملك إلا إيقافه للمراجعة. ويعمل في بيئة الإنتاج في وضع الظل.', feature: 'ai-moderation', sources: [{ label: 'E28', href: `${WIKI}/epics/E28-ai-moderation.md` }] },
          { title: 'تفريغ النصوص', body: 'يجري التفريغ في مهام خلفية، وتُطابَق آيات القرآن مع فهرس محلي للنص الرسمي قبل أن يؤكدها صاحب المرئي.', feature: 'transcripts', sources: [{ label: 'AUN-CAPTIONS', href: `${WIKI}/epics/AUN-CAPTIONS-transcription-translation.md` }] },
        ] as Item[],
      },
    ],
    features: {
      title: 'كل الميزات وأين وصلت',
      lead: 'مبنية من سجل الميزات في الويكي، المرجع المعتمد للمشروع. كل حالة هنا هي حالتها في السجل. «يعمل الآن» يعني أنه في بيئة الإنتاج ومستخدم فيها، و«جاهز» يعني أنه وصل إلى الإنتاج ولا شيء يستخدمه بعد. وكلاهما يذكر إصدار الإنتاج الذي وصل فيه.',
      source: 'سجل الميزات، إيداع الويكي {sha}',
      before: 'قبل {tag}',
      wiki: 'الويكي',
    },
    principlesTitle: 'كيف نبني',
    principles: [
      { title: 'غير متزامن دائمًا', body: 'الأعمال الثقيلة تمر عبر طوابير مع إعادة المحاولة وطوابير للرسائل المتعذّرة. وإذا فشل شيء ظهر في صفحة الأخطاء في لوحة الإدارة مع زر إعادة المحاولة.', sources: [{ label: 'O26', href: `${WIKI}/epics/decisions.md#o26-always-async-with-admin-visible-errors` }] },
      { title: 'مواصفة، ثم خطة، ثم شيفرة', body: 'تبدأ الميزات مواصفةً في الويكي، ثم خطة، ثم طلبات دمج مع اختباراتها.', sources: [{ label: 'المساهمة', href: `${WIKI}/guides/contributing.md` }] },
      { title: 'الخصوصية افتراضيًا', body: 'يمكن التراجع عن الحذف خلال {undoDays} يومًا ثم يُمحى نهائيًا. ويمكن محو الحسابات. وتُحصى الزيارات دون ملفات تعريف الارتباط أو معرّفات.', sources: [{ label: 'دورة حياة البيانات', href: `${WIKI}/guides/data-lifecycle.md` }] },
      { title: 'سهولة الوصول في الاتجاهين', body: 'استخدام بلوحة المفاتيح وقارئات الشاشة، وتباين بمستوى AA في كل سمة، وقوائم لا تخرج من الشاشة، من اليسار إلى اليمين ومن اليمين إلى اليسار.', sources: [{ label: 'السمات', href: `${WIKI}/guides/theming.md#menus-never-leave-the-screen` }] },
    ] as Item[],
  },

  infrastructure: {
    title: 'البنية التحتية ومسار المرئيات',
    description:
      'كيف ينتقل المرئي من الرفع إلى التشغيل في الأمة الآن: Bunny Stream وتحويلنا الخاص بـ FFmpeg على Cloudflare Containers إلى R2، ورابط تشغيل واحد تختاره الواجهة البرمجية، وإصدارات تمر عبر QA وstage.',
    heroTitle: 'من الرفع إلى التشغيل',
    heroLead:
      'كل مرئي يُرمَّز مرتين: مرة في Bunny Stream، ومرة بمحوّلنا الخاص إلى Cloudflare R2. وتختار الواجهة البرمجية أيهما يُستخدم في كل تشغيل، لنقارن السرعة والتكلفة على حركة حقيقية قبل أي تحويل.',
    pipelineTitle: 'مسار المرئيات',
    pipelineLabel: 'الخطوات التي يمر بها المرئي من الرفع إلى التشغيل',
    pipeline: [
      { title: 'الرفع', body: 'يرفع صاحب المحتوى عبر واجهة المرئيات برفع قابل للاستئناف (TUS).' },
      { title: 'نسختان', body: 'يذهب المرئي إلى Bunny Stream، ونحتفظ بنسختنا الأصلية في تخزين R2 خاص.' },
      { title: 'التحويل', body: 'يبدأ طابور تشغيل FFmpeg على Cloudflare Containers، فيكتب نسخ HLS إلى R2.' },
      { title: 'الاختيار', body: 'تُعيد الواجهة البرمجية رابط تشغيل واحدًا: Bunny أو R2 أو نسبة بينهما، تُضبط في صفحة التوصيل في لوحة الإدارة.' },
      { title: 'التشغيل', body: 'يشغّل المشغّل ذلك الرابط. وبعد خطأ قاتل أو توقف {stallSeconds} ثانية على R2 يعود إلى Bunny مرة واحدة.' },
    ],
    pipelineSources: [
      { label: 'توصيل المرئيات', href: `${WIKI}/guides/video-delivery.md` },
      { label: 'D2', href: `${WIKI}/epics/D2-video-delivery.md` },
      { label: 'O31', href: `${WIKI}/epics/decisions.md#o31-transcode-on-cloudflare-containers` },
      { label: 'O32', href: `${WIKI}/epics/decisions.md#o32-run-bunny-and-r2-side-by-side-before-switching` },
    ],
    details: [
      { title: 'مزوّدان جنبًا إلى جنب', body: 'يعمل Bunny وR2 في بيئة الإنتاج خلف مفتاح في الإدارة، ويُشغَّل Bunny أولًا. ويُبلغ المشغّل عن زمن البدء والتقطّع والأخطاء لكل منهما، وتقارن الإدارة بينهما قبل تقرير التحويل.', feature: 'media-providers', sources: [{ label: 'O32', href: `${WIKI}/epics/decisions.md#o32-run-bunny-and-r2-side-by-side-before-switching` }] },
      { title: 'روابط موقّعة لا تُحفظ', body: 'روابط التشغيل تُوقَّع مع كل استجابة ولا تُحفظ أبدًا. وصور المشاركة تبقى على نطاقنا فلا تنكسر معاينات الشبكات الاجتماعية.', feature: 'signed-urls', sources: [{ label: 'الروابط الموقّعة', href: `${WIKI}/guides/video-delivery.md#signed-urls` }] },
      { title: 'مزوّدان للبث المباشر، لم يصلا إلى الإنتاج بعد', body: 'بُني Bunny Stream Live ومسار مستضاف ذاتيًا ليعملا معًا وتُوزَّع البثوث الجديدة بينهما، فيكون الاختيار مبنيًا على البيانات. ولا يستقبل أيٌّ منهما بثًا في الإنتاج بعد: Bunny Live نسخة تجريبية مغلقة لم تُقبل مكتباتنا فيها، والمسار المستضاف ذاتيًا يستقبل الرفع عبر HTTPS فقط وليس له عنوان في الإنتاج.', feature: 'live-streams', sources: [{ label: 'D3', href: `${WIKI}/epics/D3-live-provider.md` }] },
      { title: 'الأعطال ظاهرة', body: 'يُسجَّل كل تحويل فاشل مع مكانه وسببه. وبعد ثلاث محاولات فاشلة يظهر في صفحة الأخطاء مع زر إعادة المحاولة، ويواصل المشاهدون التشغيل من Bunny.', feature: 'error-reporting', sources: [{ label: 'توصيل المرئيات', href: `${WIKI}/guides/video-delivery.md` }] },
    ] as Item[],
    environmentsTitle: 'ثلاث بيئات',
    environmentsLead: 'QA للاختبار، وstage مرشّحة للإصدار بشكل الإنتاج وبيانات خاصة بها، ثم الإنتاج.',
    environments: [
      { name: 'QA', body: 'تُحدَّث مع كل دمج في الفرع الرئيسي.', host: 'videos.qa.alummahnow.net' },
      { name: 'Stage', body: 'إعدادات الإنتاج ببيانات ومفاتيح منفصلة. كل إصدار يمر بها أولًا.', host: 'videos.stage.alummahnow.net' },
      { name: 'الإنتاج', body: 'لا يُصدَر إليها إلا من وسم مؤرّخ على الفرع الرئيسي، ولا يُنشر يدويًا أبدًا.', host: 'videos.alummahnow.net' },
    ],
    environmentsSources: [{ label: 'البيئات', href: `${WIKI}/guides/environments.md` }],
    releaseTitle: 'كيف يصل الإصدار إلى الإنتاج',
    releaseLabel: 'خطوات الإصدار بالترتيب',
    release: [
      { title: 'الوسم', body: 'وسم مؤرّخ على التزام في الفرع الرئيسي يبدأ الإصدار.' },
      { title: 'بناء واحد', body: 'البناء نفسه يذهب إلى stage وإلى الإنتاج.' },
      { title: 'Stage', body: 'النشر على stage وتشغيل الاختبارات الشاملة هناك.' },
      { title: 'الإنتاج بنسبة {rolloutStart}', body: 'تُرفع النسخة الجديدة دون حركة ويُجرى عليها فحص سريع.' },
      { title: '{rolloutFull} أو التراجع', body: 'تنتقل الحركة إليها، ويُعاد الفحص، وأي فشل يُرجعها تلقائيًا.' },
    ],
    releaseSources: [{ label: 'عملية الإصدار', href: `${WIKI}/guides/release-process.md` }],
    costTitle: 'مبنية ضمن سقف للتكلفة',
    costBody:
      'صُممت المنصة كلها لتبقى تحت سقف شهري ثابت للتكلفة حدده المالك. وحاويات التحويل لا تُحتسب إلا أثناء تشغيل المهمة، وبنود التكلفة مثل زمن الحاويات والتخزين والطلبات تُقاس في صفحتي التوصيل والتشغيل في لوحة الإدارة.',
    costSources: [
      { label: 'O1', href: `${WIKI}/epics/decisions.md#o1-whole-platform-cost-cap` },
      { label: 'AUN-COST', href: `${WIKI}/epics/AUN-COST-cost-monitoring.md` },
    ],
    statusTitle: 'صفحة حالة عامة',
    statusBody: 'تفحص status.alummahnow.net الخدمات العامة كل دقيقتين، وتعرض الأعطال والصيانة، بالعربية والإنجليزية.',
    statusLink: { label: 'افتح صفحة الحالة', href: STATUS_PAGE },
  },

  systemDesign: {
    title: 'تصميم النظام',
    description:
      'كيف بُنيت الأمة الآن: النظام كاملًا في مخطط واحد — الناس والتطبيقات، وحافة Cloudflare، وعمال Workers، ومخازن البيانات، والعمل في الخلفية، والمزوّدون — وكل جزء باسمه الحقيقي كما هو منشور.',
    heroTitle: 'النظام كاملًا، كما يعمل',
    heroLead:
      'كل عامل وربط وقائمة انتظار ومستودع في هذه المخططات هو الاسم الحقيقي من النشر عندنا. الشيفرة تعمل على Cloudflare Workers، والتحويل يجري على حاويات Cloudflare، وتُسلَّم المرئيات من Bunny Stream ومن تخزيننا في R2 جنبًا إلى جنب.',
    diagramTitle: 'النظام في لمحة',
    diagramLead:
      'تجمّع المناطق ما يُنشر معًا. وتحمل الأسهم ما يعبر الحدود فعلًا: طلبات HTTP، وروابط خدمة، ورسائل قوائم انتظار، ومشغّلات دورية.',
    legendTitle: 'كيف تقرأ المخطط',
    legend: [
      { term: 'سهم متصل', body: 'تدفّق طلب أو بيانات، مكتوب عليه ما يعبر الحدود' },
      { term: 'لوح مدوّر', body: 'مكوّن باسمه من إعداداتنا: عامل أو مستودع أو قائمة انتظار أو مزوّد' },
      { term: 'صندوق ناعم', body: 'منطقة: موضع في الحكاية لا جهاز واحد — فعمّال Workers يتوسعون وحدهم' },
    ],
    walkthroughTitle: 'المناطق السبع',
    zones: [
      {
        title: 'الناس والتطبيقات',
        body: 'تصل المتصفحات إلى الموقع العام (Astro) وموقع المرئيات (Next.js) وإدارة الطاقم. تطبيقات المشاهدة والاستوديو للهواتف والتلفاز والحاسوب قيد التطوير على نواة Rust مشتركة، وأداة .NET تنقل مكتبات المرئيات القائمة كتلًا.',
        sources: [
          { label: 'خريطة النظام', href: `${WIKI}/README.md#system-map` },
          { label: 'البيئات', href: `${WIKI}/guides/environments.md` },
        ],
      },
      {
        title: 'حافة Cloudflare',
        body: 'تخدم شبكة التوزيع كل موقع ومستضيف المرئيات العام، بقواعد تخزين مؤقت تُطبَّق كشيفرة. وتخدم شبكة Bunny المرئيات التي رمّزتها Bunny بعناوين موقّعة. أما Turnstile فيفحص الزوار في وضع المراقبة اليوم.',
        sources: [
          { label: 'تسليم المرئيات', href: `${WIKI}/guides/video-delivery.md` },
          { label: 'الحماية من البرامج الآلية', href: `${WIKI}/guides/bot-protection.md` },
        ],
      },
      {
        title: 'التطبيقات',
        body: 'مستودع منصة المرئيات ينشر أحد عشر عاملًا: موقع المرئيات وواجهته البرمجية، وزوج الإدارة، والمعالج، وخادم الزمن الحقيقي، والمجدول، وعامل المرئيات، ومراقب التكاليف، والروابط القصيرة، وصفحة الحالة. ويضيف تسجيل الدخول ثلاثة عمال آخرين (المُصدر والملف الشخصي والإدارة)، والـ CMS عاملًا واحدًا على bknd بشاشات إدارتنا.',
        sources: [
          { label: 'مستودع AlUmmahNow', href: `${WIKI}/repos/AlUmmahNow.md` },
          { label: 'مستودع AlUmmahNowAuth', href: `${WIKI}/repos/AlUmmahNowAuth.md` },
          { label: 'مستودع AlUmmahNowCMS', href: `${WIKI}/repos/AlUmmahNowCMS.md` },
        ],
      },
      {
        title: 'غير المتزامن والحاويات',
        body: 'العمل الثقيل لا يجري أبدًا داخل طلب: المعالج يستهلك قوائم الأحداث والمراجعة، والمجدول ينشر المرئيات المجدولة كل دقيقة، وعامل المرئيات يشغّل تحويلات FFmpeg على حاويات Cloudflare، ومراقب التكاليف يجمع تحليلات المنصة كل ساعة.',
        sources: [
          { label: 'O26 غير متزامن دائمًا', href: `${WIKI}/epics/decisions.md#o26-always-async-with-admin-visible-errors` },
          { label: 'O31 الحاويات', href: `${WIKI}/epics/decisions.md#o31-transcode-on-cloudflare-containers` },
        ],
      },
      {
        title: 'البيانات',
        body: 'مستودعات R2 تحفظ سجلات المحتوى (المرئيات والقنوات والملفات الشخصية) وخط المرئيات (العام والخاص والأصول). وسبع قواعد D1 تحفظ الحسابات والإشعارات وفهرس البحث والتقارير والتكاليف والحالة. ويحفظ KV الجلسات والإلغاءات والإعداد البعيد؛ وتحمل الكائنات الدائمة المقابس وفتحات التحويل والأقفال.',
        sources: [
          { label: 'سجل الميزات', href: `${WIKI}/features/registry.json` },
          { label: 'مستودع AlUmmahNow', href: `${WIKI}/repos/AlUmmahNow.md` },
        ],
      },
      {
        title: 'المزوّدون',
        body: 'Bunny Stream يرمّز نسخة من كل رفع ويحفظها. وWorkers AI يجري فحوص المراجعة والتحويل الصوتي والترجمة داخل ميزانيات يومية من النيورونات. ومؤسسة القرآن تمدّ نص القرآن الرسمي وترجماته، وResend يرسل البريد، وAPNs وFCM وWNS توصل الإشعارات.',
        sources: [
          { label: 'O5 الذكاء على Cloudflare', href: `${WIKI}/epics/decisions.md#o5-ai-moderation-on-cloudflare` },
          { label: 'AUN-CAPTIONS', href: `${WIKI}/epics/AUN-CAPTIONS-transcription-translation.md` },
        ],
      },
      {
        title: 'المراقبة',
        body: 'سجلات Workers تحفظ كل تحذير وخطأ (معاينة كاملة وكتابة مقتصدة — الإنتاج يسجّل التحذيرات فقط). الأعطال والوظائف الفاشلة تصل صفحة الأخطاء في الإدارة بزر إعادة المحاولة، وتحميل واحد من كل عشرين يبلّغ مقاييس الويب الأساسية، وصفحة الحالة تفحص الخدمات العامة كل دقيقتين، ولوحة تكاليف تراقب الميزانية.',
        sources: [
          { label: 'صفحة الحالة', href: `${WIKI}/guides/status-page.md` },
          { label: 'AUN-COST', href: `${WIKI}/epics/AUN-COST-cost-monitoring.md` },
        ],
      },
    ] as Item[],
    pipelineCard: {
      title: 'تابع مرئيًا واحدًا',
      body: 'رافق رفعًا من استوديو صانع المحتوى إلى مشغّل المشاهد: ترميزان، وعنوان تشغيل واحد يُختار، ومسارا الترجمة والمراجعة في الطريق.',
      link: { label: 'افتح مسار المرئيات', href: 'video-pipeline/' },
    },
    diagram: {
      title: 'نظام الأمة الآن في مخطط واحد',
      desc: 'الناس والتطبيقات في جهة، وحافة Cloudflare وتطبيقات Workers في الوسط، وعمّال الخلفية بجانبها، ومخازن البيانات على طول الأسفل، والمزوّدون في الجهة الأخرى، والمراقبة في الزاوية.',
      narrowDesc: 'النظام نفسه مرتّبًا للهاتف: الناس والتطبيقات، ثم الحافة، ثم التطبيقات، ثم عمّال الخلفية، ثم المزوّدون، ثم مخازن البيانات، ثم المراقبة.',
      zone: {
        clients: 'الناس والتطبيقات',
        edge: 'حافة Cloudflare',
        apps: 'التطبيقات · Workers',
        async: 'غير المتزامن · الحاويات',
        data: 'البيانات',
        providers: 'المزوّدون',
        obs: 'المراقبة',
      },
      node: {
        browser: { title: 'متصفحات الويب', sub: ['www · المرئيات · الإدارة'] },
        native: { title: 'التطبيقات + التلفاز', sub: ['قيد التطوير'] },
        tools: { title: 'AlUmmahNowTools', sub: ['مستورد كتل'] },
        cdn: { title: 'شبكة Cloudflare', sub: ['المواقع · media/pub'] },
        bunnyCdn: { title: 'شبكة Bunny', sub: ['HLS · موقّعة'] },
        turnstile: { title: 'Turnstile', sub: ['فحص البرامج · مراقبة'] },
        www: { title: 'www', sub: ['Astro · alummahnow.net'] },
        videosWeb: { title: 'موقع المرئيات', sub: ['Next.js على Workers'] },
        adminWeb: { title: 'admin-web', sub: ['Next.js على Workers'] },
        cms: { title: 'CMS · bknd', sub: ['cms.alummahnow.net'] },
        apiVideos: { title: 'api-videos', sub: ['videos.api', 'الواجهة الأساسية'] },
        adminApi: { title: 'admin-api', sub: ['admin.api'] },
        auth: { title: 'مُصدر المصادقة', sub: ['OpenAuth · auth.*'] },
        profileAdmin: { title: 'الملف وإدارة المصادقة', sub: ['profile.auth · admin.auth'] },
        shortLinks: { title: 'short-links', sub: ['alummahnow.link'] },
        status: { title: 'عامل الحالة', sub: ['status.alummahnow.net'] },
        processor: { title: 'المعالج processor', sub: ['قوائم الانتظار · ذكاء'] },
        scheduler: { title: 'المجدول scheduler', sub: ['دوري · كل دقيقة'] },
        media: { title: 'عامل المرئيات media', sub: ['مستهلك التحويل'] },
        container: { title: 'حاوية التحويل', sub: ['FFmpeg · standard-4'] },
        costMonitor: { title: 'مراقب التكاليف', sub: ['جامع كل ساعة'] },
        r2: { title: 'سجلات R2', sub: ['المرئيات · القنوات', 'الملفات · قوائم التشغيل…'] },
        mediaBuckets: { title: 'وسائط R2', sub: ['pub · priv · الأصول'] },
        d1: { title: 'قواعد D1', sub: ['سبع قواعد: المصادقة', 'البحث · الإشعارات…'] },
        kv: { title: 'مساحات KV', sub: ['مصادقة · إلغاءات · إعداد'] },
        queues: { title: 'قوائم الانتظار', sub: ['قوائم · DLQ'] },
        do: { title: 'الكائنات الدائمة', sub: ['المقابس · التحويل · الأقفال'] },
        analytics: { title: 'Analytics Engine', sub: ['RUM · الإساءة · المصادقة'] },
        bunnyStream: { title: 'Bunny Stream', sub: ['ترميز + تخزين'] },
        workersAi: { title: 'Workers AI', sub: ['المراجعة · الترجمة الصوتية'] },
        qf: { title: 'مؤسسة القرآن', sub: ['نص القرآن · الترجمات'] },
        resend: { title: 'Resend', sub: ['البريد'] },
        push: { title: 'APNs · FCM · WNS', sub: ['الإشعارات'] },
        googleOauth: { title: 'Google OAuth', sub: ['النقل من يوتيوب'] },
        logs: { title: 'سجلات Workers', sub: ['تحذير وأخطاء فقط'] },
        errorsPage: { title: 'صفحة الأخطاء', sub: ['الإدارة · إعادة المحاولة'] },
        rum: { title: 'مقاييس الويب', sub: ['عينة من كل عشرين'] },
        statusPage: { title: 'صفحة الحالة', sub: ['فحص كل دقيقتين'] },
        costDash: { title: 'لوحة التكاليف', sub: ['الميزانية · التوقّع'] },
      },
      edge: {
        https: 'HTTPS',
        native: 'HTTPS · تطبيقات/تلفاز',
        bindings: 'روابط',
        serviceQueues: 'قوائم · روابط',
        bunnyEmail: 'واجهة Bunny · بريد',
        aiQf: 'ذكاء · قرآن',
        logsErrors: 'سجلات · أخطاء',
      },
    },
  },

  videoPipeline: {
    title: 'مسار المرئيات',
    description:
      'كيف يسير المرئي من الرفع إلى التشغيل في الأمة الآن: رفع قابل للاستكمال، وترميزان جنبًا إلى جنب — Bunny Stream وترميزنا FFmpeg على حاويات Cloudflare إلى R2 — وعنوان تشغيل واحد تختاره الواجهة البرمجية.',
    heroTitle: 'من استوديو الصانع إلى مشغّل المشاهد',
    heroLead:
      'رفع واحد، وترميزان، وعنوان واحد مختار. يرمّز Bunny Stream الرفع كما كان، بينما يبني محوّلنا نسختنا المحفوظة في درجات HLS داخل R2 — يعمل المساران معًا لتُقارن السرعة والتكلفة على حركة حقيقية قبل أي تحويل.',
    diagramTitle: 'المسار في لمحة',
    diagramLead:
      'يتفرّع الرفع عند الواجهة البرمجية (tee): البايتات نفسها إلى Bunny وإلى أصلنا الخاص. ومن الأصل تبني قائمة التحويل وعامل المرئيات وحاوية FFmpeg درجات R2. ثم تُرجع الواجهة عنوان تشغيل واحدًا لكل تشغيل.',
    legendTitle: 'كيف تقرأ المخطط',
    legend: [
      { term: 'سهم متصل', body: 'طلب أو بايتات أو رسالة قائمة انتظار، مكتوب عليه ما هو' },
      { term: 'سهم متقطع', body: 'مسارات Workers AI (الترجمة والمراجعة) والاحتياط لمرة واحدة' },
      { term: 'لوح مدوّر', body: 'مكوّن باسمه من إعداداتنا' },
    ],
    stagesTitle: 'مرحلة بمرحلة',
    stages: [
      {
        title: 'الرفع، متفرّعًا عند الواجهة',
        body: 'يرفع الصانع المرئي عبر واجهة المرئيات برفع قابل للاستكمال (TUS). يُفصل كل جزء: فرع يذهب إلى Bunny Stream دون تغيير — وجواب Bunny هو ما يراه الرافع — وفرع يُحفظ أصلًا لنا في مستودع R2 خاص، فلا ينتظر تحويل R2 Bunny أبدًا. تُحفظ الأصول ثلاثين يومًا على الأقل، ولا تتجاوز تسعين يومًا أبدًا.',
        feature: 'upload-resilience',
        sources: [
          { label: 'الاحتفاظ بأصولنا', href: `${GH}/AlUmmahNow/blob/main/docs/media-delivery/ORIGINALS.md` },
          { label: 'تسليم المرئيات', href: `${WIKI}/guides/video-delivery.md` },
        ],
      },
      {
        title: 'ترميزان جنبًا إلى جنب',
        body: 'يرمّز Bunny Stream نسخته كما كان. وبالتوازي تسلّم قائمة التحويل المرئي إلى عامل المرئيات: كائن Transcoder دائم واحد لكل مرئي (آمن للتكرار)، وكائن فتحات يطبّق حدّ الإدارة للتحويلات المتزامنة، وحاوية FFmpeg ‏(standard-4، بلا إنترنت — تقرأ وتكتب عبر العامل وحده).',
        feature: 'media-providers',
        sources: [
          { label: 'خطة التسليم عبر R2', href: `${GH}/AlUmmahNow/blob/main/docs/media-delivery/R2-DELIVERY-PLAN.md` },
          { label: 'O31', href: `${WIKI}/epics/decisions.md#o31-transcode-on-cloudflare-containers` },
        ],
      },
      {
        title: 'الدرجات في R2',
        body: 'تمريرة FFmpeg واحدة تبني سلّم HLS بجانب الصورة القصير — ‏360p و480p و720p و1080p، ولا يعلو المصدر أبدًا — بقطع من ست ثوانٍ، مع ملف MP4 تقدمي واحد تعرضه المرئيات العامة لمحركات البحث. تهبط الدرجات في مستودع عام (تخدمه الشبكة) أو خاص (يخدمه عامل المرئيات برمز في المسار)، وتقدّر الدرجات تظهر في بطاقة المعالجة عند الإدارة.',
        sources: [
          { label: 'سلّم HLS', href: `${GH}/AlUmmahNow/blob/main/apps/media/container/ladder.mjs` },
          { label: 'ملف MP4 العام', href: `${WIKI}/guides/video-delivery.md#public-mp4` },
        ],
      },
      {
        title: 'عنوان تشغيل واحد تختاره الواجهة',
        body: 'المشغّلات لا تختار: ‎GET /api/videos/:id‎ يُرجع playUrl واحدًا. تجري القواعد من العام إلى القناة إلى المرئي، والإنتاج يقرأ Bunny أولًا اليوم. تُوقّع عناوين التشغيل عند كل استجابة ولا تُحفظ أبدًا. وإن أصاب المشغّل خطأ قاتل أو توقف R2 خمس عشرة ثانية، فسيطلب عنوان Bunny مرة واحدة ويشغّله.',
        feature: 'signed-urls',
        sources: [
          { label: 'أي مصدر يستخدمه التشغيل', href: `${WIKI}/guides/video-delivery.md#which-source-a-play-uses` },
          { label: 'O32', href: `${WIKI}/epics/decisions.md#o32-run-bunny-and-r2-side-by-side-before-switching` },
        ],
      },
      {
        title: 'الأعطال ظاهرة، والمشاهد لا يتوقف',
        body: 'التحويل الذي يفشل ثلاث مرات يُعلَّم فاشلًا ويظهر في صفحة الأخطاء عند الإدارة مع إعادة المحاولة. والوظيفة التي لا تنطلق يعاد إيقاظها بتباعد متزايد نحو أربع وعشرين دقيقة قبل أن تفشل؛ والنشر لا يقتل تحويلًا جاريًا (مهلة حتى ساعة)، والوظيفة العالكة يعاد إدراجها بكنس كل ساعة. ويظل المشاهدون يشغّلون Bunny طوال ذلك.',
        feature: 'error-reporting',
        sources: [
          { label: 'إخفاقات الانطلاق والنشر', href: `${WIKI}/guides/video-delivery.md#two-sources-side-by-side` },
          { label: 'صفحة الأخطاء', href: `${WIKI}/repos/AlUmmahNow.md` },
        ],
      },
      {
        title: 'الترجمة الصوتية: لا شيء تلقائي',
        body: 'الترجمة الصوتية فعل يقوم به الصانع في الاستوديو، لا تلقائية أبدًا. وظيفة في الخلفية تشغّل whisper-large-v3-turbo على Workers AI وتُرجع مسودة يحرّرها الصانع؛ ومقاطع القرآن تُطابق النص الرسمي ولا تُعرض منه إلا بعد تأكيد الصانع. ودقائق الترجمة من مستوى الصانع؛ والترجمة اللغوية قيد التطوير.',
        feature: 'transcripts',
        sources: [
          { label: 'AUN-CAPTIONS', href: `${WIKI}/epics/AUN-CAPTIONS-transcription-translation.md` },
          { label: 'D10 موضع الترجمة', href: `${WIKI}/epics/decisions.md#d10-transcription-location` },
        ],
      },
      {
        title: 'المراجعة قبل النشر (قيد الإطلاق)',
        body: 'قبل أن يُنشر المرئي، يستخرج المحوّل أيضًا إطارات (كل ثانيتين مع قطاعات المشهد، بسقف) ويفحصها خط المراجعة بنماذج أوزان مفتوحة على Workers AI — ‏clef-flash للمحتوى الفاضح وWhisper للنص. لا يفعل سوى إيقاف المرئي لشخص يراجعه؛ لا ينشر ولا يحذف شيئًا. وتُحفظ الإطارات والنصوص ثلاثين يومًا.',
        feature: 'video-review',
        sources: [
          { label: 'AUN-VIDEO-REVIEW', href: `${WIKI}/epics/AUN-VIDEO-REVIEW-pre-publication-review.md` },
          { label: 'قائمة النماذج', href: `${GH}/AlUmmahNow/blob/main/packages/shared-types/src/video-review.ts` },
        ],
      },
    ] as Item[],
    diagram: {
      title: 'مسار المرئيات في الأمة الآن على مخطط واحد',
      desc: 'يتفرّع الرفع عند واجهة المرئيات إلى Bunny Stream وإلى أصلنا في R2. قائمة التحويل وعامل المرئيات وحاوية FFmpeg تبني درجات HLS في مستودعين عام وخاص، تخدمهما الشبكة وعامل المرئيات. وتُرجع الواجهة عنوان تشغيلًا واحدًا؛ ويحتاط المشغّل إلى Bunny مرة واحدة.',
      narrowDesc: 'المسار نفسه مرتّبًا للهاتف: الرفع، والتفرّع إلى Bunny وأصلنا، وسلسلة التحويل، ومسارا التسليم، والعنوان الواحد المختار.',
      zone: {
        upload: 'الرفع',
        ai: 'مسارات Workers AI',
        transcode: 'تحويلنا',
        delivery: 'التسليم',
        choice: 'عنوان تشغيل واحد',
      },
      node: {
        creator: { title: 'الصانع', sub: ['الاستوديو · الويب'] },
        tus: { title: 'api-videos · TUS', sub: ['رفع قابل للاستكمال'] },
        bunny: { title: 'Bunny Stream', sub: ['ترميز + HLS'] },
        bunnyCdn: { title: 'شبكة Bunny', sub: ['playUrl موقّع'] },
        originals: { title: 'أصول R2', sub: ['خاص · نسختنا'] },
        queue: { title: 'قائمة التحويل', sub: ['al-ummah-now-transcode'] },
        media: { title: 'عامل المرئيات media', sub: ['مستهلك القائمة'] },
        slots: { title: 'TranscodeSlots', sub: ['بوابة حد أدنى–أقصى'] },
        container: { title: 'حاوية FFmpeg', sub: ['standard-4 · بلا إنترنت'] },
        pub: { title: 'R2 العام', sub: ['pub/<id>/<rev>/ · HLS + MP4'] },
        priv: { title: 'R2 الخاص', sub: ['priv/… · رمز في المسار'] },
        cdn: { title: 'شبكة Cloudflare', sub: ['قاعدة تخزين'] },
        privRoute: { title: 'عامل المرئيات /priv/*', sub: ['يفحص الرمز'] },
        choose: { title: 'api-videos', sub: ['يختار المصدر'] },
        players: { title: 'المشغّلات', sub: ['الويب · التضمين · التطبيقات'] },
        whisper: { title: 'whisper…turbo', sub: ['مسودات الترجمة'] },
        quran: { title: 'طبقة القرآن', sub: ['النص الرسمي'] },
        clef: { title: 'clef-flash', sub: ['إطارات محتوى فاضح'] },
      },
      edge: {
        https: 'HTTPS',
        bytes: 'بايتات',
        encode: 'ترميز',
        tee: 'تفرّع · بايتات',
        ready: 'اكتمل الرفع',
        consume: 'استهلاك',
        slot: 'فتحة',
        run: 'تشغيل',
        writePub: 'درجات HLS + MP4',
        writePriv: 'خاص · غير مدرج',
        serve: 'تقديم',
        servePriv: 'تقديم · رمز',
        ifR2: 'إن كان R2',
        ifBunny: 'إن كان Bunny',
        playUrl: 'playUrl واحد',
        fallback: 'توقف ← Bunny مرة',
        aiFeeds: 'صوت · إطارات',
      },
    },
  },

  'open-source': {
    title: 'المصدر المفتوح',
    description:
      'كل مستودعات الأمة الآن عامة على GitHub: منصة المرئيات، وتسجيل الدخول، والمواقع العامة، ونظام إدارة المحتوى، والتطبيقات الأصلية، والويكي. كيف تساهم وكيف تبلّغ عن مشكلة أمنية.',
    heroTitle: 'الشيفرة كلها عامة',
    heroLead:
      'كل المستودعات عامة على GitHub. مستودع AlUmmahNowAuth ونسختنا من OpenAuth مرخّصان بترخيص MIT. أما بقية المستودعات فلم يُختر لها ترخيص بعد، فشيفرتها متاحة للقراءة لكنها غير مرخّصة لإعادة الاستخدام بعد.',
    licenceSource: { label: 'قرار الترخيص (مفتوح)', href: `${WIKI}/epics/decisions.md#lic-repo-licence-for-core-and-the-app-repos` },
    reposTitle: 'المستودعات',
    repoLanguage: 'اللغة',
    repoLicence: 'الترخيص',
    noLicence: 'لم يُختر بعد',
    repos: [
      { name: 'AlUmmahNow', body: 'منصة المرئيات: الويب، والواجهات البرمجية، والمعالجة في الخلفية، والاتصال اللحظي، والوسائط، والإدارة.', lang: 'TypeScript', licence: '' },
      { name: 'AlUmmahNowAuth', body: 'الدخول الموحّد، والملف الشخصي، وإدارة الحسابات.', lang: 'TypeScript', licence: 'MIT' },
      { name: 'openauth', body: 'نسختنا من OpenAuth، المكتبة التي يقوم عليها تسجيل الدخول.', lang: 'TypeScript', licence: 'MIT' },
      { name: 'AlUmmahNowUI', body: 'الموقع العام، ومواقع العلماء، وهذا الموقع.', lang: 'TypeScript', licence: '' },
      { name: 'AlUmmahNowCMS', body: 'إدارة المحتوى للموقع العام.', lang: 'TypeScript', licence: '' },
      { name: 'AlUmmahNowCore', body: 'نواة Rust المشتركة للتطبيقات الأصلية.', lang: 'Rust', licence: '' },
      { name: 'AlUmmahNowApple', body: 'تطبيقات iPhone وiPad وApple TV وMac.', lang: 'Swift', licence: '' },
      { name: 'AlUmmahNowAndroid', body: 'تطبيقات هواتف Android وأجهزته اللوحية والتلفاز وFire TV وAuto.', lang: 'Kotlin', licence: '' },
      { name: 'AlUmmahNowDesktop', body: 'تطبيقات Windows وLinux وتلفاز Samsung.', lang: 'C#', licence: '' },
      { name: 'AlUmmahNowTools', body: 'أدوات استيراد المرئيات بالجملة.', lang: 'C#', licence: '' },
      { name: 'AlUmmahNowWiki', body: 'كيف يترابط كل شيء، مع صفحة لكل مستودع، والملاحم والقرارات.', lang: 'Markdown', licence: '' },
    ],
    contributeTitle: 'كيف تساهم',
    contributeLabel: 'خطوات أول مساهمة بالترتيب',
    contribute: [
      { title: 'اقرأ الويكي', body: 'ابدأ بخريطة المنظومة وبصفحة المستودع الذي تريد تعديله.' },
      { title: 'افتح مسألة أو اختر واحدة', body: 'صِف الخلل أو التعديل في المستودع الذي يخصه.' },
      { title: 'مواصفة، خطة، شيفرة', body: 'التعديلات الكبيرة تبدأ مواصفةً، ثم افتح طلب دمج مع اختباراته.' },
      { title: 'دع التكامل المستمر يفحصه', body: 'التدقيق والأنواع واختبارات الوحدات والاختبارات الشاملة تعمل على كل طلب دمج.' },
    ],
    contributeLink: { label: 'اقرأ دليل المساهمة', href: `${WIKI}/guides/contributing.md` },
    wikiLink: { label: 'افتح الويكي', href: `${GH}/AlUmmahNowWiki` },
    securityTitle: 'وجدت مشكلة أمنية؟',
    securityBody:
      'من فضلك لا تفتح مسألة عامة. استخدم Security ← Report a vulnerability في المستودع المعني. نسعى إلى الرد على البلاغات خلال {reportDays} أيام عمل.',
    securityLink: { label: 'أبلغ عن ثغرة', href: `${GH}/AlUmmahNow/security/advisories/new` },
  },

  waqf: {
    title: 'الوقف والعمل الخيري',
    description:
      'ندرس أن تُدار الأمة الآن وقفًا أو من خلال جهة خيرية، محبوسةً لنفع الأمة. أين وصل هذا اليوم، وما الذي لم يُقرَّر بعد.',
    heroTitle: 'لنفع الأمة، لا للربح',
    heroLead:
      'ندرس أن تُدار الأمة الآن وقفًا، أو من خلال جهة خيرية، لتكون المنصة محبوسة لنفع المجتمع. هذه الصفحة عن توجّه، لا عن أمر قائم بالفعل.',
    whatTitle: 'ما الوقف',
    whatBody:
      'الوقف في التراث الإسلامي مال يُحبس أصله على وجه من وجوه البر على الدوام. فلا يُباع ولا يُوهب ولا يُورث، وتذهب منفعته إلى الغاية التي وُقف لها. وبهذه الطريقة حُبست المساجد والمدارس والآبار والمستشفيات قرونًا.',
    whyTitle: 'لماذا نريد ذلك',
    why: [
      { title: 'المجتمع أولًا', body: 'المنصة المحبوسة لنفع الأمة تخضع لهذه الغاية، لا لمشترٍ ولا لمساهمين.' },
      { title: 'لا يمكن بيعها', body: 'الوقف لا يُباع. فالمجتمع الذي يُبنى هنا يبقى للمجتمع.' },
      { title: 'مفتوحة افتراضيًا', body: 'الشيفرة عامة بالفعل. والبنية الخيرية تتيح أن تكون طريقة إدارة المنصة عامة كذلك.' },
    ],
    todayTitle: 'أين نحن اليوم',
    today: [
      { title: 'لا كيان قانونيًا بعد', body: 'لا توجد اليوم شركة ولا جمعية خيرية ولا وقف وراء الأمة الآن.', sources: [{ label: 'SM-4', href: `${WIKI}/epics/decisions.md#sm-4-legal-entity` }] },
      { title: 'لا مدفوعات عند الإطلاق', body: 'لا اشتراكات ولا مدفوعات مفعّلة. وإن جاءت الخطط لاحقًا فستكون عبر مزوّدي دفع قابلين للاستبدال.', sources: [{ label: 'D4', href: `${WIKI}/epics/decisions.md#d4-monetisation` }, { label: 'O4', href: `${WIKI}/epics/decisions.md#o4-pluggable-payment-providers-never-stripe-admin-managed-plans` }] },
      { title: 'لا نقبل التبرعات بعد', body: 'لا يوجد زر للتبرع. والتبرعات تنتظر وجود بنية تحفظها وتنشر كيف تُصرف.' },
      { title: 'مبنية ضمن سقف للتكلفة', body: 'صُممت المنصة كلها لتبقى تحت سقف شهري ثابت للتكلفة حدده المالك.', sources: [{ label: 'O1', href: `${WIKI}/epics/decisions.md#o1-whole-platform-cost-cap` }] },
    ] as Item[],
    openTitle: 'ما لم يُقرَّر بعد',
    open: [
      'أي بنية: وقف، أم جمعية خيرية، أم مؤسسة، أم مزيج منها.',
      'أين تُسجَّل، ووفق أي قانون.',
      'من يتولى إدارتها، وكيف تُدوَّن القرارات وتُنشر.',
      'كيف تُقبل التبرعات وتُصرف ويُفصح عنها.',
    ],
    helpTitle: 'ساعدنا على أن نُحسن هذا',
    helpBody:
      'إن كانت لديك خبرة في أحكام الوقف أو قوانين العمل الخيري، أو في الحوكمة، أو في تمويل المشاريع المجتمعية، أو كنت تودّ دعم المنصة حين تقوم البنية، فيسعدنا أن نسمع منك.',
    helpLink: 'تواصل معنا بشأن الوقف',
  },

  contact: {
    title: 'تواصل معنا',
    description: 'كيف تتواصل مع فريق الأمة الآن بشأن الشراكات، أو توجّه الوقف، أو الشيفرة، أو مشكلة أمنية.',
    heroTitle: 'تحدّث إلينا',
    heroLead: 'تصل الرسائل عبر نموذج التواصل في موقع المرئيات إلى صندوق رسائل الفريق. لا حاجة إلى حساب.',
    cards: [
      { title: 'الشراكات والداعمون والوقف', body: 'للعمل معًا، أو دعم المنصة، أو تقديم المشورة في بنية الوقف أو الجهة الخيرية.', action: 'راسلنا', topic: 'partnership' },
      { title: 'أسئلة عامة', body: 'أي شيء آخر عن الأمة الآن.', action: 'راسلنا', topic: 'general' },
    ],
    codeTitle: 'الشيفرة والأخطاء',
    codeBody: 'افتح مسألة في المستودع المعني على GitHub.',
    codeLink: { label: 'اذهب إلى GitHub', href: GH },
    securityTitle: 'المشكلات الأمنية',
    securityBody: 'أبلغ بشكل خاص عبر Security ← Report a vulnerability. من فضلك لا تفتح مسألة عامة.',
    securityLink: { label: 'أبلغ عن ثغرة', href: `${GH}/AlUmmahNow/security/advisories/new` },
  },

  notFound: {
    title: 'الصفحة غير موجودة',
    body: 'لا توجد صفحة على هذا العنوان. ربما نُقلت، أو أن الرابط غير صحيح.',
    home: 'اذهب إلى الصفحة الرئيسية',
    other: 'Home page in English',
  },
};
