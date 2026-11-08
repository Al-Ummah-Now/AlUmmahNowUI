/** CMS markdown body → safe HTML with ::video facades (only public videos render). */
import { facadeHtml } from './facade';
import type { RequestContext } from './context';
import type { Locale } from './locale';
import { extractVideoIds, renderMarkdown } from './markdown';
import { fetchVideoItem, localizeItem, type VideoItem } from './videos';
import type { Alternate } from './cms-types';

export async function renderBody(rc: RequestContext, markdown: string, lang: Locale): Promise<{ html: string; videos: VideoItem[] }> {
  const ids = extractVideoIds(markdown).slice(0, 12);
  const items = await Promise.all(ids.map((id) => fetchVideoItem(rc.videos, 'video', id)));
  const shown = items.map((v) => (v ? localizeItem(v, lang) : null));
  const byId = new Map(ids.map((id, i) => [id, shown[i]]));
  const html = renderMarkdown(markdown, {
    renderVideo: (id) => {
      const item = byId.get(id);
      return item ? facadeHtml(item, { videosWebUrl: rc.cfg.videosWebUrl, lang, headingLevel: 3 }) : '';
    },
  });
  return { html, videos: shown.filter((v): v is VideoItem => v !== null) };
}

/** Paths of a CMS document in every locale it is published in. */
export function documentAlternates(own: { locale: Locale; slug: string }, alternates: Alternate[], path: (l: Locale, slug: string) => string) {
  const out: Partial<Record<Locale, string>> = { [own.locale]: path(own.locale, own.slug) };
  for (const a of alternates) if (a.locale !== own.locale && (a.locale === 'en' || a.locale === 'ar')) out[a.locale] = path(a.locale, a.slug);
  return out;
}
