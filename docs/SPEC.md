# www.alummahnow.net — Spec

**Status:** v1, 2026-11-08
**Owner intent:** "The UI should be for www and CMS its admin."
**Related:** AlUmmahNowCMS `docs/SPEC.md` (content API, admin), AlUmmahNowAuth (SSO, client registry),
AlUmmahNow `docs/embeds/README.md` (embed player contract, owned by the embeds work, epics 25/26).

## 1. Purpose

The public front door of Al Ummah Now: what the platform is, where to go next (videos, profile,
sign-in), and editorial content (pages, news, curated videos) written by staff in the CMS.

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
| `/{l}/` | Home: hero (CMS `home` page or built-in default), the "What is Al Ummah Now" blocks, curated videos rail (CMS), latest news (CMS), app links (Videos, Profile, Sign in) |
| `/{l}/news/` | News list (CMS posts, paginated `?page=`) |
| `/{l}/news/{slug}/` | News article |
| `/{l}/{slug}/` | CMS page (about, contact, privacy, terms…) |
| `/{l}/videos/` | Curated videos (CMS curation: videos, playlists, channels), embeds plus a link to videos.alummahnow.net |
| `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/me` | Sign-in (§7) |
| `/sitemap.xml`, `/robots.txt`, `/{l}/rss.xml` | SEO |
| `/healthz` | `{ ok, version, cms: "ok"|"degraded" }` |

Unknown slug: localized 404 page with links home, to news and to videos (status 404).

## 4. Bilingual and RTL

- `<html lang="ar" dir="rtl">` for Arabic, `lang="en" dir="ltr"` for English. The layout uses CSS
  logical properties (`ms-`/`me-`/`ps-`/`pe-`, `start`/`end`), so nothing is mirrored by hand. Icons
  that indicate direction (arrows) flip in RTL.
- UI strings live in `src/i18n/{en,ar}.ts`, typed, with a unit test that both have the same keys.
- Content comes from the CMS per locale. Missing translation: the page is served in the other locale
  with a notice ("This page is not yet available in Arabic") and `hreflang` pointing only at
  versions that exist.
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
  2. last-known-good JSON in KV `CONTENT_SNAPSHOT`, written on each successful CMS fetch (at most
     once per key per 5 min);
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
Moderator)** and Sign out. Without a client, www could only link to the profile app and could never
show signed-in state. Epic 26 (embedded discussions) and "continue watching" will reuse this session.

- **Public client with PKCE (S256)**, no secret. `client_id` per env (§10). Redirect URIs (exact):
  `https://www.alummahnow.net/auth/callback`, `https://www.stage.alummahnow.net/auth/callback`
  (stage, rewritten by auth's stage seed), `https://www.qa.alummahnow.net/auth/callback`, and
  `http://localhost:4321/auth/callback`.
- `/auth/login?return=/ar/news/` → state plus verifier in a short-lived (10 min), `__Host-`, HttpOnly,
  Secure, SameSite=Lax cookie → `${AUTH_URL}/authorize`. The return path must be a same-site
  relative path (open-redirect guard).
- `/auth/callback` → exchange the code at `${AUTH_URL}/token` → verify the access token (JWKS at
  `${AUTH_URL}/.well-known/jwks.json`, `iss`, `exp`) → a session cookie `__Host-aun_www`, AES-GCM
  encrypted with `SESSION_SECRET`, holding `{ sub, name, email, roles, exp }`, 8 h. Tokens are not
  stored.
- `/auth/me` → `{ signedIn, name, roles, canEditContent }` with `Cache-Control: private, no-store`.
- `/auth/logout` (POST, same-origin check) clears the cookie and redirects to auth's logout with a
  `return` to www.

## 8. SEO

`<title>`, meta description, canonical, `hreflang` en/ar/x-default, Open Graph and Twitter cards,
JSON-LD (`Organization` + `WebSite` on home, `NewsArticle` on posts, `VideoObject` for embedded
videos), `sitemap.xml` from the CMS slugs, `robots.txt`. QA and stage serve
`X-Robots-Tag: noindex` and `Disallow: /`.

## 9. Quality bars

- **Performance:** home ≤ 100 KB of JS before interaction (target ~0: Astro islands only for the
  header menu, language switcher and facade). LCP < 2.5 s on 4G (Lighthouse CI in the PR job,
  warn-only at first).
- **Accessibility:** WCAG 2.1 AA. Skip link, landmarks (`header`, `nav` with labels, `main`,
  `footer`), visible focus, contrast ≥ 4.5:1, keyboard-complete menus, `prefers-reduced-motion`.
  axe-core in E2E: zero serious or critical violations on home/news/page in en and ar, desktop
  and mobile.
- **Security headers:** CSP (nonce not needed: no inline scripts), HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`.
- **Empty and error states:** no news yet; no curated videos; CMS down (builtin); a video removed
  upstream; 404; 500 (a localized error page, never a stack trace).

## 10. Configuration per env (wrangler `env.qa`, `env.stage`, top level = production)

Vars: `APP_ENV`, `SITE_URL`, `AUTH_URL`, `WWW_CLIENT_ID`, `VIDEOS_WEB_URL`, `VIDEOS_API_URL`,
`PROFILE_URL`, `CMS_PUBLIC_URL`. Bindings: `CMS` (service), `CONTENT_SNAPSHOT` (KV), `ASSETS`.
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
