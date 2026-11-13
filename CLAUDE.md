# CLAUDE.md

Guidance for Claude Code in the Al Ummah Now www site (Astro). See `README.md` for setup and commands.

## UI copy

- **Tone (en + ar)**: Al Ummah Now is a content-sharing site, not a lectures library. Describe it the way YouTube's interface does: videos, Shorts, live streams, posts, playlists, channels, creators, viewers, the community; verbs watch, upload, share, subscribe (never "follow" a channel), save, explore. Never describe the platform as lessons, lectures, courses, a library, "beneficial knowledge" or "keep learning" («دروس، محاضرات، مكتبة، العلم النافع، واصل التعلّم»), and no entertainment or hype words either. A creator's own titles and content categories keep their words. Keep "Islamic" factual. Full rules with examples: wiki page "Copy Tone Guide".
- **Arabic word for "video"**: «مرئي / مرئيات», never «فيديو» or «مقاطع» for videos; «المقاطع القصيرة» stays for Shorts. See the wiki page "Arabic glossary".
- Every string lives in `src/i18n/en.ts` and `src/i18n/ar.ts` (same keys). Texts that editors manage (hero, tagline, About, list intros) live in the CMS; `src/content/fallback/` holds the copy shown when the CMS is unreachable and must match it.
