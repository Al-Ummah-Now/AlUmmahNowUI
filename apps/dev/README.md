# alummahnow.dev

The project site for developers, contributors, investors, donors and partners (wiki
[AUN-DEV-SITE](https://github.com/Al-Ummah-Now/AlUmmahNowWiki/blob/main/epics/AUN-DEV-SITE-developer-and-partner-site.md)).
Static Astro, English and Arabic (RTL), light and dark, using the Fanous Fawanees tokens from `packages/render`.

- **Hosting:** Cloudflare Workers static assets with no Worker script: no code runs per request, no bindings,
  no secrets, no cookies. `scripts/env-files.ts` writes `robots.txt`, `_headers` (CSP, noindex off production)
  and `_redirects` per environment onto the same build.
- **Copy:** `src/i18n/en.ts` and `ar.ts` (same keys; `tests/i18n.test.ts`). Every claim comes from the code,
  the wiki or the owner's words, with its wiki source next to it. No numbers that aren't in the wiki.
- **Contact:** links to the videos site's Contact form (`?topic=partnership|general`). No form here.

| Command | |
|---|---|
| `npm run dev` | Astro dev server on :4323 |
| `npm run build` | Build + env files (`DEV_SITE_ENV=qa\|stage\|production`, default `local`) |
| `npm run preview` | `wrangler dev` on the built site (real `_headers`, `_redirects`, 404) |
| `npm test` / `npm run e2e` | Unit / Playwright with axe (builds and starts `wrangler dev`) |
| `npm run screenshots -- <dir>` | Every page, desktop 1440 and phone 390, en and ar, dark; light home |

Deploys: QA on every push to `main`, stage → production on a release tag (`.github/workflows`). The domain
setup is in [docs/DOMAIN.md](docs/DOMAIN.md).
