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
}

export const GLOSSARY: Term[] = [
  { abbr: 'R2', en: 'Cloudflare’s object storage', ar: 'تخزين الكائنات لدى Cloudflare' },
  { abbr: 'KV', en: 'Cloudflare’s key-value store', ar: 'مخزن المفاتيح والقيم لدى Cloudflare' },
  { abbr: 'D1', en: 'Cloudflare’s relational database', ar: 'قاعدة البيانات العلائقية لدى Cloudflare' },
  { abbr: 'CDN', en: 'content delivery network', ar: 'شبكة توصيل المحتوى' },
  { abbr: 'API', en: 'application programming interface', ar: 'واجهة برمجة التطبيقات' },
  { abbr: 'APIs', en: 'application programming interfaces', ar: 'واجهات برمجة التطبيقات' },
  { abbr: 'JSON', en: 'a plain-text data format', ar: 'صيغة نصية للبيانات' },
  { abbr: 'AI', en: 'artificial intelligence', ar: 'الذكاء الاصطناعي' },
  { abbr: 'GB', en: 'gigabytes', ar: 'غيغابايت' },
  { abbr: 'MiB', en: 'mebibytes', ar: 'ميبيبايت' },
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
  { abbr: 'JWTs', en: 'JSON Web Tokens', ar: 'رموز ويب بصيغة JSON' },
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

/** Where a term counts as used: whole word, not part of an identifier, and not inside a name ("Workers AI", "JSON Web Token"). */
export const termPattern = (abbr: string) =>
  new RegExp(`(?<![\\w\\-./@])${abbr === 'AI' ? '(?<!Workers )' : ''}${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w\\-])${abbr === 'JSON' ? '(?! Web Token)' : ''}`);

/** How near (in characters) a term's meaning must be to its first use to count as spelling it out. */
export const NEAR = 220;
