# www.alummahnow.net

The public front door of **Al Ummah Now / الأمة الآن**, an Islamic video and community
platform. It shows what the platform is, where to go next (videos, profile, sign-in), and
editorial content (pages, news, curated videos) written by staff in the CMS
([AlUmmahNowCMS](https://github.com/Al-Ummah-Now/AlUmmahNowCMS)).

Astro 5 (SSR) on Cloudflare Workers, Tailwind 4, English and Arabic (RTL) throughout.

- Spec: [`docs/SPEC.md`](docs/SPEC.md). Plan: [`docs/PLAN.md`](docs/PLAN.md).
- CMS contract consumed here: [`docs/CMS_PUBLIC_API.md`](docs/CMS_PUBLIC_API.md).

## Environments

| Env | URL | Worker | CMS | Auth |
|---|---|---|---|---|
| production | https://www.alummahnow.net (apex `alummahnow.net` 301s here, path and query kept) | `al-ummah-now-www` | `al-ummah-now-cms` | https://auth.alummahnow.net |
| stage | https://www.stage.alummahnow.net | `al-ummah-now-www-stage` | `al-ummah-now-cms-stage` | https://auth.stage.alummahnow.net |
| QA | https://www.qa.alummahnow.net | `al-ummah-now-www-qa` | `al-ummah-now-cms-qa` | https://auth.qa.alummahnow.net |

`wrangler.jsonc`: the top level is **production**; `env.stage` and `env.qa` below it. Custom
domains only (`workers_dev: false`). `npm run check:config` checks the file against
`scripts/environments.ts`.

Bindings per env: `CMS` (service binding to the env's CMS Worker), `CONTENT_SNAPSHOT` (KV,
last-known-good CMS JSON, written only by the `*/5 * * * *` cron), `FEED` (KV, the home timeline,
written only by the CMS feed job; www only reads it), `ASSETS`, `CF_VERSION_METADATA`. Vars: `APP_ENV`, `SITE_URL`,
`AUTH_URL`, `WWW_CLIENT_ID`, `VIDEOS_WEB_URL`, `VIDEOS_API_URL`, `PROFILE_URL`, `CMS_PUBLIC_URL`.

### Secrets

| Where | Name | Purpose |
|---|---|---|
| each www Worker | `SESSION_SECRET` | 64 hex chars (`openssl rand -hex 32`); AES-GCM key of the session and sign-in cookies. `npx wrangler secret put SESSION_SECRET [--env stage\|qa]`. Never printed or committed. |
| GitHub Actions | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | deploys, promotes, rollbacks, secrets check |
| GitHub Actions | `QA_SEED_PASSWORD`, `STAGE_SEED_PASSWORD` | optional E2E sign-in with the seeded QA/stage accounts |

The list lives in `scripts/secrets-manifest.ts`; `npm run check:secrets -- --env <env>` runs before
every QA deploy and every promote.

## How it works

- **Content** comes from the CMS public API v1, server-side, through the service binding (local
  dev: `CMS_PUBLIC_URL`). The chain when the CMS is slow or down: fresh Cache API entry (60 s) →
  CMS (2.5 s timeout) → stale Cache API entry (≤ 10 min) → KV snapshot → built-in content
  (`src/content/fallback/{en,ar}.ts`). Pages still render 200; `X-Content-Source` says which
  (`cms|cache|snapshot|builtin`) and `/healthz` reports `cms: degraded`.
- **Home timeline** (`src/lib/feed.ts`, `src/components/Timeline.astro`): the CMS-managed feed of
  posts and videos, newest first under day headings. It is read from the `FEED` KV namespace, never
  from the CMS on the request path: the first page is one KV read (the head), "Load more"
  (`?before=<cursor>`, a plain link without JS) normally one more. The CMS rebuilds only the
  week buckets a change touches (docs/CMS_PUBLIC_API.md "Home timeline feed"). A missing or
  unreadable head → the CMS posts list (the fallback chain below); `/healthz` reports
  `feed: ok|missing` and `X-Feed-Source: feed|fallback` says which a page used. `FEED` is its own
  namespace, not a prefix in `CONTENT_SNAPSHOT`: one writer per namespace (the CMS writes `FEED`,
  www's cron writes `CONTENT_SNAPSHOT`), each can be purged or rebuilt alone, and the config check
  pins each binding separately.
- **HTML** for locale pages is edge-cached (Cache API, `s-maxage=60`, `stale-while-revalidate=600`).
  Signed-in state is fetched client-side from `/auth/me`, so the HTML is the same for everyone.
- **Videos**: metadata from the videos API; only items it returns as public render (others are
  skipped and logged). `src/lib/embeds.ts` is the only place that builds videos-site URLs. Embeds
  are facades: thumbnail plus a real play button; the iframe loads on click. CMS markdown can embed
  a video with `::video[VIDEO_ID]` on its own line. Raw HTML in markdown is never rendered.
- **Sign-in**: public OAuth client with PKCE (S256). `/auth/login` → auth `/authorize` →
  `/auth/callback` (token exchange, JWKS verification) → an encrypted `__Host-aun_www` cookie
  holding `{ sub, name, email, roles, exp }` for 8 h; no tokens are stored. The header menu shows
  Profile, Videos, CMS (Super Admin, Admin, Moderator only) and Sign out.
- **Draft preview** (`src/lib/preview.ts`, `src/pages/preview/`): the CMS editor's "Preview on
  site" lands on `/preview?token=…`, which moves the token into an HttpOnly cookie for that one row
  (`__Host-aun_preview_{kind}_{id}`, until the token's expiry) and 303s to `/preview/{kind}/{id}`,
  so the token never stays in the address bar, history, links or analytics. That page fetches the
  row from the CMS preview API (the CMS verifies the token every time) and renders it with the same
  article components and layout as the live page, plus a "Preview — not published" banner.
  Responses are `private, no-store, no-transform` (no edge cache, no analytics beacon injection),
  `noindex`, `Referrer-Policy: no-referrer`; broken, expired or deleted links get friendly pages.
- **Edge** (`src/worker.ts`): apex → www 301, `/` → `/en/` or `/ar/` (cookie, then
  `Accept-Language`), CSP without `unsafe-inline`, HSTS, `frame-ancestors 'none'`, and
  `X-Robots-Tag: noindex` off production.

```
src/
  worker.ts            edge wrapper around Astro
  pages/               [locale]/ (home, news, videos, CMS pages, rss), auth/, healthz, sitemap, robots, 404, 500
  lib/                 cms (fallback chain), videos, embeds, markdown, auth, session, edge, seo
  i18n/                en.ts, ar.ts (same keys, tested)
  content/fallback/    built-in content
  scripts/             the only client JS: account menu, language cookie, video facade
scripts/               dev-vars, config check, secrets manifest, release/ (promote, smoke, rollback)
e2e/                   Playwright (render, routing, sign-in redirect, axe, screenshots)
```

## Develop

Node 22+.

```sh
npm ci
npm run dev          # astro dev on http://localhost:4321 (no edge wrapper)
npm run preview      # build output in wrangler dev on :4321, the real Worker (writes .dev.vars on first run)
```

`npm run preview` creates `.dev.vars` (git-ignored) with a random `SESSION_SECRET` and local
overrides: `SITE_URL=http://localhost:4321`, QA auth with the QA client
(redirect `http://localhost:4321/auth/callback`), QA videos, and `CMS_PUBLIC_URL=http://localhost:8585`.
With no CMS running locally, every page renders from built-in content.

```sh
npm run lint
npm run typecheck    # astro check + the TypeScript release scripts
npm test             # Vitest unit tests
npm run check:config
npx playwright install chromium webkit
npm run e2e          # Playwright against local wrangler dev (starts it), or WWW_URL=https://www.qa.alummahnow.net
```

E2E writes full-page screenshots to `e2e-artifacts/{desktop,pixel-7,iphone}/{en,ar}-{page}.png`.
Set `E2E_EXPECT_TITLE` to also check that an item published in the CMS appears on www.
Against another env set `E2E_AUTH_URL` and `E2E_CLIENT_ID`.

## Release

- **CI** (`ci.yml`, every PR and push): lint, typecheck, unit, config check, build, dry-run bundles
  per env, Playwright against local `wrangler dev`, screenshots as an artifact.
- **QA** (`deploy-qa.yml`, every push to main): secrets check, `wrangler deploy --env qa`, smoke,
  Playwright against QA.
- **Stage → production** (`release.yml`, from a release tag `vYYYY.MM.DD` on `main`; a manual run on
  `main` is stage only): resolve (valid tag on `main`?) → build once
  → stage (`scripts/release/promote.ts --env stage`: upload a version, 0 % traffic, smoke through
  `Cloudflare-Workers-Version-Overrides`, 100 %, smoke; then Playwright against stage) →
  production (environment `production`, tag-still-on-this-commit guard, the same promote with automatic
  rollback, smoke including apex → www, `release-result.json`, rollback dry run).
- **Deploy rules:** production is released only by CI, only from `main`, only from a `vYYYY.MM.DD`
  tag (`vYYYY.MM.DD.N` for a later release that day). Merging to `main` deploys QA only. No hand
  deploys to stage or production; if CI blocks, fix CI. Never move a tag: re-run its run or cut a new one.
- **Rollback** (`rollback.yml`, manual): previous or given version, then smoke. Locally:
  `npm run release:rollback -- --env production [--to <version-id>] [--dry-run]`.
