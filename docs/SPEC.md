# www.alummahnow.net — Spec

**Status:** v1, 2026-11-08
**Owner intent:** "The UI should be for www and CMS its admin."
**Related:** AlUmmahNowCMS `docs/SPEC.md` (content API, admin), AlUmmahNowAuth (SSO, client registry),
AlUmmahNow `docs/embeds/README.md` (embed player contract, owned by the embeds work, epics 25/26).

## 1. Purpose

The public front door of Al Ummah Now: what the platform is, where to go next (videos, profile,
sign-in), and editorial content (pages, articles, curated videos) written by staff in the CMS.

Non-goals for v1: comments/discussions (epic 26), "continue watching", search across videos,
newsletter sign-up. Each becomes a `queue` issue.

## 2. Hosts and environments

| Env | Canonical host | Also served | Worker | CMS it reads |
|---|---|---|---|---|
| prod | `https://www.alummahnow.net` | `alummahnow.net` → 301 to www | `al-ummah-now-www` | `al-ummah-now-cms` |
| stage | `https://www.stage.alummahnow.net` | — | `al-ummah-now-www-stage` | `al-ummah-now-cms-stage` |
| QA | `https://www.qa.alummahnow.net` | — | `al-ummah-now-www-qa` | `al-ummah-now-cms-qa` |

**Canonical: www.** The apex 301s to `https://www.alummahnow.net` with the path and query kept.
Why www: the apex can't take a CNAME at most providers, so www keeps hosting moves cheap. It also
keeps www-scoped cookies (the www session) off every other subdomain. Both the apex and www are
Worker custom domains on the same Worker, so Cloudflare creates their DNS records and certificates.

The old `al-ummah-now-ui` Worker (workers.dev only) is retired after cutover (queue issue).

## 3. Information architecture

All pages exist in `en` and `ar` under a locale prefix: `/en/…` and `/ar/…`.

| Route | Content |
|---|---|
| `/` | 302 to `/en/` or `/ar/` (`aun_locale` cookie, then `Accept-Language`, default `en`). `Vary: Cookie, Accept-Language`, `Cache-Control: private` |
| `/{l}/` | Home: the hero, then one timeline (Workers KV feed: articles, card posts, videos, playlists, channels; pinned first, newest first, "Load more"). No rail, no tabs (AlUmmahNowCMS docs/specs/WWW-PAGES.md) |
| `/{l}/articles/` | List page `articles` (CMS `/lists/articles`, timeline cards, numbered `?page=`); built-in fallback from `/posts` |
| `/{l}/articles/{slug}/` | Article |
| `/{l}/news/…` | 301 to the same `/{l}/articles/…` url, query kept (the section was called News until 2026-11; src/lib/edge.ts `legacyArticlesRedirect`) |
| `/{l}/{slug}/` | CMS page (about, contact, privacy, terms…); a page with `list_kind` (curated or filter) is a list page (`/lists/:slug`) |
| `/{l}/scholars/` | Scholars directory (CMS `/scholars`), by name, paginated `?page=` |
| `/{l}/scholars/{slug}/` | A scholar's page: photo, name, bio; **Articles** (every live post they wrote, card posts included, `?page=`) and **Videos** (their first channel's latest public videos from the videos API, `?after=<cursor>`, facade embeds). `ProfilePage`/`Person` JSON-LD, hreflang (same slug), `rss.xml` per scholar. Paged views are `noindex`. AlUmmahNowCMS `docs/SCHOLARS.md` |
| `/{l}/videos/` | List page `videos` (CMS `/lists/videos`: the CMS video library, newest added first; channels as channel cards), plus a link to videos.alummahnow.net; built-in fallback: the empty state |
| `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/me` | Sign-in (§7) |
| `/sitemap.xml`, `/robots.txt`, `/{l}/rss.xml` | SEO |
| `/healthz` | `{ ok, version, cms: "ok"|"degraded" }` |

Unknown slug: localized 404 page with links home, to articles and to videos (status 404).

## 4. Bilingual and RTL

- `<html lang="ar" dir="rtl">` for Arabic, `lang="en" dir="ltr"` for English. The layout uses CSS
  logical properties (`ms-`/`me-`/`ps-`/`pe-`, `start`/`end`), so nothing is mirrored by hand. Icons
  that indicate direction (arrows) flip in RTL.
- UI strings live in `src/i18n/{en,ar}.ts`, typed, with a unit test that both have the same keys.
- Content comes from the CMS per locale. Missing translation: the page is served in the other locale
  with a notice ("This page is not yet available in Arabic") and `hreflang` pointing only at
  versions that exist.
- Articles in one language (`/{l}/articles/{slug}/` with no post in `{l}`), decided 2026-11-10:
  1. www looks up the same slug in the other locale. If that post's `alternates` names a
     translation in `{l}` under another slug, it answers 301 to that translation.
  2. Otherwise it shows the post in its own language, never a 404. A notice says "This article is
     only available in العربية." (in Arabic: "…متاحة بالإنجليزية فقط"), with a "Read it in …" link to
     the post's own URL. That URL is the canonical, and the borrowed copy is `noindex`.
  3. The Articles list stays per locale. When `{l}` has no articles but the other locale does, the
     empty list says "Articles are published in العربية" and links to that list. Neither page
     claims there is nothing while the other shows something.
  4. Neither the list nor this rule shows a post in both languages twice.
- Language switcher on every page, keeping the equivalent page (via the CMS `translation_key`).
- Fonts: system UI stack for Latin; "Noto Naskh Arabic" (self-hosted woff2, `font-display: swap`,
  subset) for Arabic.

## 5. Content from the CMS

- Server-side fetch through a **service binding** `CMS` to the env's CMS Worker. It falls back to
  `CMS_URL` over HTTPS when the binding is absent (local dev). Read-only public API:
  `GET /api/public/v1/*` (CMS spec §6). Only published content ever leaves the CMS.
- Videos metadata (title, thumbnail, duration, visibility) is fetched server-side from the videos
  API (`VIDEOS_API_URL`). Only items the API returns as **public** render. Anything else (private,
  unlisted, deleted, API error) is skipped silently and logged.
- **Edge cache:** HTML for anonymous GETs is cached in the Workers Cache API, keyed by URL, `s-maxage=60`,
  `stale-while-revalidate=600`. Signed-in state is fetched client-side from `/auth/me`, so the HTML
  is identical for everyone and always cacheable. CMS JSON is cached the same way (60 s).
- **Fallback when the CMS is down** (timeout 2.5 s, 5xx, or bad JSON), in order:
  1. stale entry from the Cache API (SWR);
  2. last-known-good JSON in KV `CONTENT_SNAPSHOT`, written only by the Worker's cron every 5 min
     (`src/lib/snapshot-writer.ts`: one writer, unchanged content not rewritten, never older over
     newer); the request path only reads it;
  3. built-in content bundled in the Worker (`src/content/fallback/{en,ar}.ts`): home hero, about
     blurb, app links.
  The page still renders (200) with `X-Content-Source: cms|cache|snapshot|builtin`. `/healthz` reports
  `cms: degraded`.

## 6. Video embeds (consumer of the embeds contract)

- A single adapter, `src/lib/embeds.ts`, builds every embed URL:
  `embedUrl({ kind: 'video'|'playlist', id, lang, start? })` and `watchUrl(...)`, plus `channelUrl(id)`.
  The base is `VIDEOS_WEB_URL` per env. The path and parameter names come from AlUmmahNow
  `docs/embeds/README.md`. Until it lands, they are placeholders in this one file:
  `/embed/{id}`, `/embed/playlist/{id}`, `lang`, `start`.
- **Facade by default:** the thumbnail, title and a play button render server-side; the
  `<iframe loading="lazy" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin">`
  is injected on click. A keyboard-operable `<button>` carries an accessible name ("Play: {title}").
- Channels render as cards linking to the channel on the videos site (no embed).
- CSP on www: `frame-src` = the videos web origin; `img-src` = self, the CMS media origin and the
  videos image CDN.
- Inline video in CMS markdown: `::video[VIDEO_ID]` on its own line renders the same facade.

## 7. Sign-in (decision: yes, minimal)

Registering www as an auth client is in scope (owner). v1 uses it for one signed-in feature: the
header shows the user's name and a menu with Profile, Videos, **CMS (only for Super Admin, Admin,
Moderator, Scholar)** and Sign out. Without a client, www could only link to the profile app and could never
show signed-in state. Epic 26 (embedded discussions) and "continue watching" will reuse this session.

- **Public client with PKCE (S256)**, no secret. `client_id` per env (§10). Redirect URIs (exact):
  `https://www.alummahnow.net/auth/callback`, `https://www.stage.alummahnow.net/auth/callback`
  (stage, rewritten by auth's stage seed), `https://www.qa.alummahnow.net/auth/callback`, and
  `http://localhost:4321/auth/callback`.
- `/auth/login?return=/ar/articles/` → state plus verifier in a short-lived (10 min), `__Host-`, HttpOnly,
  Secure, SameSite=Lax cookie → `${AUTH_URL}/authorize`. The return path must be a same-site
  relative path (open-redirect guard).
- `/auth/callback` → exchange the code at `${AUTH_URL}/token` → verify the access token (JWKS at
  `${AUTH_URL}/.well-known/jwks.json`, `iss`, `exp`) → a session cookie `__Host-aun_www`, AES-GCM
  encrypted with `SESSION_SECRET`, holding `{ sub, name, email, roles, exp }`, 8 h. Tokens are not
  stored.
- `/auth/login` forwards `prompt=none` (silent) and `prompt=login` (add account) only; the normal
  sign-in sends no prompt, so auth signs the browser's active account in silently or shows its form.
  A `prompt=none` callback that fails (`error=login_required`, bad state, token error) returns to
  the page signed out, never to an error page.
- `/auth/me` → `{ signedIn, sub, name, email, roles, canEditContent }` with `Cache-Control: private, no-store`.
- `/auth/logout` (POST, same-origin check) clears the cookie and redirects to auth's logout with a
  `return` to www. GET `?next=` is auth's front-channel single sign-out.
- **Signed in elsewhere = signed in here.** The header (src/scripts/site.ts, decisions in
  src/lib/account-sync.ts) fetches `${AUTH_URL}/session/accounts` with credentials (CSP
  `connect-src` allows the auth origin). Without a www session, and once per tab (sessionStorage),
  an active auth account triggers `/auth/login?prompt=none`. With a session, the menu lists every
  account in the browser: switch (`POST /session/switch`, then silent sign-in), add another
  account, sign out of one (`DELETE /session/accounts/:id`; the last one is the normal sign-out).
  If auth's active account differs from www's (switched in another app), www follows once per tab.
  CORS/401/network failures keep the plain "Sign in" link (or the single-account menu).
- Session lifetime: www keeps no tokens, so the 15-minute access token does not limit it; when the
  8 h session ends while auth still has the browser, the probe signs in again silently.

## 8. SEO

`<title>`, meta description, canonical, `hreflang` en/ar/x-default, Open Graph and Twitter cards,
JSON-LD (`Organization` + `WebSite` on home, `Article` on posts (a scholar's post names them as a
`Person` author by `@id`, linked from the byline), `ProfilePage` + `Person` on scholar pages,
`VideoObject` for embedded videos), `sitemap.xml` from the CMS slugs (scholar pages in both locales),
`robots.txt`. Search suggestions list matching scholars first (CMS `/search/scholars`). QA and stage serve
`X-Robots-Tag: noindex` and `Disallow: /`.

## 9. Quality bars

- **Performance:** home ≤ 100 KB of JS before interaction (target ~0: Astro islands only for the
  header menu, language switcher and facade). LCP < 2.5 s on 4G (Lighthouse CI in the PR job,
  warn-only at first).
- **Accessibility:** WCAG 2.1 AA. Skip link, landmarks (`header`, `nav` with labels, `main`,
  `footer`), visible focus, contrast ≥ 4.5:1, keyboard-complete menus, `prefers-reduced-motion`.
  axe-core in E2E: zero serious or critical violations on home/articles/page in en and ar, desktop
  and mobile.
- **Security headers:** CSP (no nonce: HTML is edge-cached; the only inline script is the
  light/dark head script, allowed by its sha256 hash, see src/lib/theme-mode.ts), HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`.
- **Site theme:** www renders the theme the admin chose for the whole site (videos admin → Site
  theme), the same one the videos app and the CMS use: the Worker reads `GET <ADMIN_API_URL>/public/site-theme`
  (30 s per isolate, served stale while it refreshes, 500 ms timeout, Fawanees on failure, and such a
  page is never stored in the HTML cache) and renders `<html data-theme>`, so the first paint is right.
  The theme is in the HTML cache key, so a switch reaches every page within about a minute, no deploy.
  Colours are the videos app's Fanous tokens for all four themes (Fawanees, Lantern, Zujaj, Nahas),
  vendored by `npm run sync:fanous` at a pinned AlUmmahNow commit (`fanous.lock.json`, checked in CI);
  Light / Dark / System on top (src/lib/theme-mode.ts). The header is dark in every theme and mode;
  its menus are surfaces of their own. QA, stage and local preview any built-in theme with `?theme=<id>`
  (uncached; production ignores it). A theme package made in the admin's theme builder is not vendored
  yet and renders the default. Contrast: `SWEEP=1 npx playwright test e2e/theme-sweep.spec.ts`.
- **Empty and error states:** no articles yet; no curated videos; CMS down (builtin); a video removed
  upstream; 404; 500 (a localized error page, never a stack trace).

## 10. Configuration per env (wrangler `env.qa`, `env.stage`, top level = production)

Vars: `APP_ENV`, `SITE_URL`, `AUTH_URL`, `WWW_CLIENT_ID`, `VIDEOS_WEB_URL`, `VIDEOS_API_URL`,
`PROFILE_URL`, `CMS_PUBLIC_URL`, `ADMIN_API_URL` (the videos admin API, for the site theme). Bindings: `CMS` (service), `CONTENT_SNAPSHOT` (KV), `ASSETS`.
Secret: `SESSION_SECRET` (64 hex characters, `openssl rand -hex 32`, set with `wrangler secret put`,
never printed).

| Env | WWW_CLIENT_ID | AUTH_URL |
|---|---|---|
| prod and stage | `d34701ed-03de-43f8-95a8-91cd1e1874bb` | `https://auth.alummahnow.net` / `https://auth.stage.alummahnow.net` |
| QA | `ecda6f18-89cb-415c-b746-7e77184d75a2` | `https://auth.qa.alummahnow.net` |

## 11. Tests and release

- Unit (Vitest): i18n parity, locale negotiation, the embeds adapter, the CMS client fallback chain,
  markdown rendering and sanitizing (no raw HTML, `::video` directive), the return-path guard,
  session crypto, the apex redirect.
- E2E (Playwright, against QA in CI and against stage in the release): en and ar render (lang, dir,
  key headings); apex → www (prod smoke only); a CMS-published item appears on www (seeded by
  the CMS E2E, polled ≤ 90 s); sign-in redirects to auth with the exact registered `redirect_uri`;
  axe on desktop and mobile; screenshots stored as artifacts.
- Release: the same shape as AlUmmahNowAuth `release.yml`: build once → stage (deploy, smoke, E2E) →
  production (candidate at 0 %, smoke through `Cloudflare-Workers-Version-Overrides`, 100 %, smoke,
  auto-rollback) → rollback dry run, started by a `vYYYY.MM.DD` tag on `main` (a manual run is stage
  only). QA deploys from `main` on every push. Details in `docs/PLAN.md`.
