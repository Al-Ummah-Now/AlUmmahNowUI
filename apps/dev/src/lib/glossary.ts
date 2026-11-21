/**
 * Abbreviations on alummahnow.dev and what each one means, in both languages (owner, 2026-11-19:
 * every abbreviation is spelled out where a page first uses it).
 *
 * src/middleware.ts applies it to every built page: the first use in prose gets its meaning in
 * parentheses, unless the copy already says it close by; a figure that uses one before any prose
 * does gets a short "In this figure" line above it. The browser gate (e2e/diagram-gate.ts) checks
 * the result with the same list. Headings and navigation are left as they are.
 */
export interface Term {
  /** as written, case-sensitive */
  abbr: string;
  en: string;
  ar: string;
  /** singular and plural count as one term (API / APIs) */
  same?: string;
}

export const GLOSSARY: Term[] = [
  { abbr: 'R2', en: 'Cloudflare’s object storage', ar: 'تخزين الكائنات لدى Cloudflare' },
  { abbr: 'KV', en: 'Cloudflare’s key-value store', ar: 'مخزن المفاتيح والقيم لدى Cloudflare' },
  { abbr: 'D1', en: 'Cloudflare’s relational database', ar: 'قاعدة البيانات العلائقية لدى Cloudflare' },
  { abbr: 'CDN', en: 'content delivery network', ar: 'شبكة توصيل المحتوى' },
  { abbr: 'API', en: 'application programming interface', ar: 'واجهة برمجة التطبيقات' },
  { abbr: 'APIs', en: 'application programming interfaces', ar: 'واجهات برمجة التطبيقات', same: 'API' },
  { abbr: 'JSON', en: 'a plain-text data format', ar: 'صيغة نصية للبيانات' },
  { abbr: 'AI', en: 'artificial intelligence', ar: 'الذكاء الاصطناعي' },
  { abbr: 'GB', en: 'gigabytes', ar: 'غيغابايت' },
  { abbr: 'MiB', en: 'mebibytes', ar: 'ميبيبايت' },
  { abbr: '/M', en: 'per million', ar: 'لكل مليون' },
  { abbr: '/h', en: 'per hour', ar: 'في الساعة' },
  { abbr: 'HTTPS', en: 'the encrypted web protocol', ar: 'بروتوكول الويب المشفّر' },
  { abbr: 'HTTP', en: 'the web’s request protocol', ar: 'بروتوكول طلبات الويب' },
  { abbr: 'SQL', en: 'the database query language', ar: 'لغة استعلام قواعد البيانات' },
  { abbr: 'CMS', en: 'content management system', ar: 'نظام إدارة المحتوى' },
  { abbr: 'FFmpeg', en: 'the open-source video tool', ar: 'أداة المرئيات مفتوحة المصدر' },
  { abbr: 'TUS', en: 'an open protocol for resumable uploads', ar: 'بروتوكول مفتوح للرفع القابل للاستئناف' },
  { abbr: 'HLS', en: 'a streaming format that serves video in short segments', ar: 'صيغة بثّ تقدّم المرئي في أجزاء قصيرة' },
  { abbr: 'DLQ', en: 'dead-letter queue', ar: 'طابور الرسائل الفاشلة' },
  { abbr: 'QA', en: 'our test environment', ar: 'بيئة الاختبار' },
  { abbr: 'E2E', en: 'end-to-end', ar: 'الاختبارات الشاملة' },
  { abbr: 'CI', en: 'continuous integration', ar: 'التكامل المستمر' },
  { abbr: 'PKCE', en: 'Proof Key for Code Exchange', ar: 'مفتاح إثبات لتبادل الرمز' },
  { abbr: 'OIDC', en: 'OpenID Connect', ar: 'بروتوكول OpenID Connect' },
  { abbr: 'JWT', en: 'JSON Web Token', ar: 'رمز ويب بصيغة JSON' },
  { abbr: 'JWTs', en: 'JSON Web Tokens', ar: 'رموز ويب بصيغة JSON', same: 'JWT' },
  { abbr: 'RUM', en: 'real user monitoring', ar: 'مراقبة تجربة الزوار الفعلية' },
  { abbr: 'CSAM', en: 'child sexual abuse material', ar: 'مواد الاعتداء الجنسي على الأطفال' },
  { abbr: 'FTS5', en: 'SQLite full-text search', ar: 'البحث النصي الكامل في SQLite' },
  { abbr: 'GDPR', en: 'the EU data-protection law', ar: 'قانون حماية البيانات الأوروبي' },
  { abbr: 'MP4', en: 'a common video file format', ar: 'صيغة ملفات مرئيات شائعة' },
  { abbr: 'URL', en: 'web address', ar: 'عنوان ويب' },
  { abbr: 'vCPU', en: 'virtual processor cores', ar: 'أنوية معالجة افتراضية' },
  { abbr: 'QoE', en: 'quality of experience', ar: 'جودة التجربة' },
  { abbr: 'TTL', en: 'time to live', ar: 'مدة الصلاحية' },
  { abbr: 'HMAC', en: 'a keyed signature', ar: 'توقيع بمفتاح' },
  { abbr: 'OAuth', en: 'the open authorization standard', ar: 'معيار التفويض المفتوح' },
  { abbr: 'SSO', en: 'single sign-on', ar: 'الدخول الموحّد' },
  { abbr: 'RBAC', en: 'role-based access control', ar: 'التحكم بالوصول حسب الدور' },
  { abbr: 'M2M', en: 'machine to machine', ar: 'بين الخوادم' },
  { abbr: 'DNS', en: 'the internet’s naming system', ar: 'نظام أسماء النطاقات' },
  { abbr: 'TLS', en: 'transport encryption', ar: 'تشفير النقل' },
  { abbr: 'WAF', en: 'web application firewall', ar: 'جدار حماية تطبيقات الويب' },
  { abbr: 'SEO', en: 'search engine optimisation', ar: 'تحسين الظهور في محركات البحث' },
];

/** Units read inside rates: "$0.015/GB-month", "$4.50/M requests", "$0.40/h". */
const UNITS = new Set(['GB', 'MiB', 'vCPU', '/M', '/h']);

/**
 * Where a term counts as used: a whole word, not part of an identifier (api-videos, MEDIA_ORIGINALS),
 * and not inside a name ("Workers AI", "JSON Web Token"). A unit may follow a number or a slash.
 */
export function termPattern(abbr: string): RegExp {
  const esc = abbr.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const unit = UNITS.has(abbr);
  const before = abbr.startsWith('/') ? '' : unit ? '(?<![A-Za-z_])' : '(?<![\\w\\-./@])';
  const after = unit ? '(?![A-Za-z_])' : '(?![\\w\\-])';
  const name = abbr === 'AI' ? '(?<!Workers )' : '';
  const notName = abbr === 'JSON' ? '(?! Web Token)' : '';
  return new RegExp(`${before}${name}${esc}${after}${notName}`);
}

/** The glossary as the browser gate takes it: each term with its pattern's source. */
export const GATE_GLOSSARY = () => GLOSSARY.map((t) => ({ ...t, re: termPattern(t.abbr).source }));

/** How near (in characters) a term's meaning must be to its first use to count as spelling it out. */
export const NEAR = 220;
