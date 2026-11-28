/** The API body includes the full passage and its source. Render the short
 * credit once as a link, and accept older bodies with the former raw URL. */
export function quranCardCredit(content: string | null | undefined, fallback: 'ar' | 'en') {
  const credits = {
    ar: 'المصدر: مؤسسة القرآن',
    en: 'Source: Quran Foundation',
  };
  const legacy = {
    ar: 'بيانات القرآن مقدَّمة من مؤسسة القرآن (https://quran.foundation/\u200e)',
    en: 'Quran data provided by Quran Foundation (https://quran.foundation/)',
  };
  const text = content ?? '';
  for (const locale of ['ar', 'en'] as const) {
    for (const label of [credits[locale], legacy[locale]]) {
      const suffix = '\n\n' + label;
      if (text.endsWith(suffix)) return { body: text.slice(0, -suffix.length), label: credits[locale] };
    }
  }
  return { body: text, label: credits[fallback] };
}
