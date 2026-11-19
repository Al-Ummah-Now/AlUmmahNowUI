/** System design hub diagram copy (Arabic): the same keys as hub.en.ts. */
import type { hubEn } from './hub.en.ts';

export const hubAr: typeof hubEn = {
  pattern: {
    title: 'النمط المشترك، مرسومًا',
    lead: 'تكاد كل ميزة تتبع الشكل نفسه: يعبر الطلب حافة Cloudflare إلى عامل Worker، فيقرأ من مخزن مؤقت أو قاعدة بيانات ويجيب. وكل عمل بطيء يذهب إلى طابور لعمّال الخلفية. وتُجمع السجلات والأخطاء وتوقيتات المستخدمين الحقيقيين حول ذلك كله.',
    desc: 'رسم يدوي. الناس والتطبيقات يصلون إلى حافة Cloudflare بشبكتها وTurnstile. وتسلّم الحافة الطلبات إلى عمّال Workers: المواقع والواجهات البرمجية وتسجيل الدخول. ويقرأ العمّال ويكتبون في المخازن المؤقتة والبيانات: KV وD1 وR2، وتعود مقاطع المرئيات إلى المشاهدين من R2 عبر تخزين الحافة. والعمل البطيء يذهب إلى Queues، مع إعادة المحاولة وطوابير الرسائل الميتة، لعمّال الخلفية مثل processor وscheduler، الذين يستدعون Workers AI للإشراف والنصوص المصاحبة ويبدؤون الترميز في Cloudflare Containers. وفي الأسفل المراقبة تحيط بكل شيء: Workers Logs وصفحة الأخطاء في الإدارة ومراقبة المستخدمين الحقيقيين.',
    heading: 'كيف تتكامل القطع',
    around: 'المراقبة تحيط بكل شيء',
    node: {
      clients: { title: 'الناس والتطبيقات', note: 'متصفحات · تطبيقات · تضمين' },
      edge: { title: 'حافة Cloudflare', note: 'CDN · Turnstile' },
      workers: { title: 'Workers', note: 'المواقع · الواجهات · الدخول' },
      data: { title: 'المخازن والبيانات', note: 'KV · D1 · R2' },
      ai: { title: 'Workers AI', note: 'الإشراف · النصوص المصاحبة' },
      queue: { title: 'Queues', note: 'إعادة · رسائل ميتة' },
      bg: { title: 'عمّال الخلفية', note: 'processor · scheduler' },
      container: { title: 'Containers', note: 'ترميز FFmpeg' },
    },
    obs: { logs: 'السجلات', errors: 'الأخطاء', rum: 'RUM' },
    tag: { segments: 'مقاطع المرئيات', later: 'لاحقًا' },
  },
};
