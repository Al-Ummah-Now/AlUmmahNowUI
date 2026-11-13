# Scholar sites Worker (`apps/sites`)

White-label scholar sites (wiki **AUN-SCHOLAR-SITES**): one Worker serves every site on
`<slug>.alummahnow.org` (QA `<slug>.qa.alummahnow.org`, stage `<slug>.stage.alummahnow.org`) and,
through Cloudflare for SaaS, scholars' own domains. Astro on Cloudflare Workers; shares
`packages/render` with www (themes, sealed cookies, embed URLs, markdown, HTML edge cache).

## How a request works (`src/worker.ts`)

1. `/healthz` answers on any host.
2. The zone's own names (`alummahnow.org`, `www.`, `sites.`) 301 to www.alummahnow.net.
3. **Host → site**: `GET {VIDEOS_API_URL}/api/sites/by-host/:host` (api-videos reads its R2 host index
   and the site's `settings.json`). Memoised per isolate 60 s; the last good config is kept in www's
   `CONTENT_SNAPSHOT` KV (`site-config:<host>`) so an api-videos outage still renders each site **in its
   own theme**. Unknown host → bare 404 (never cached). Old subdomain / secondary host → 301 to the
   primary. Revoked → 301 to the channel. Suspended → neutral 503.
4. `/` → the site's first language; a language the site doesn't serve → its default (single-language sites).
5. Astro renders with the site (theme pinned `<id>@<version>`, name, logo, favicon, menu, About,
   platform mark). HTML edge cache key = URL (with host) + build + config version + theme.
6. Security headers: CSP (no inline script except the hashed mode script; frames only the videos
   embed; framed only by the videos site, for Studio previews), HSTS (`includeSubDomains` on
   alummahnow.org only), `noindex` outside production and for previews and sites in setup.

## Canonical URLs (SS7)

Posts, pages, About and lists are canonical on the site. Watch pages are canonical on the **videos
site** for a `<slug>.alummahnow.org` site and on the **site** for a scholar's own domain; each host's
`sitemap.xml` lists only what is canonical there.

## Sign-in (SS11)

No silent cross-site check. **Sign in** is a top-level redirect to auth `/authorize` (PKCE, the sites
client, this host's exact `/auth/callback`; Auth checks the host against the site registry). The
callback keeps a sealed, **host-only** `__Host-aun_site` session (8 h) with the refresh token, checked
with auth every 5 minutes (`/auth/me`), so a sign-out anywhere ends it within 5 minutes. Cookies never
carry a `Domain` (release check `scripts/check-cookie-domains.mjs` at the repo root).

## Commands

```bash
npm run dev          # astro dev
npm run preview      # build output under wrangler dev (wrangler.local.jsonc, keeps *.localhost hosts)
npm test             # unit
npx playwright test  # local E2E: built Worker + e2e/stub-api.ts (api-videos + auth stand-in)
npm run check:config # wrangler.jsonc vs scripts/environments.ts
```

Deploys: QA on every push to `main` (`deploy-qa.yml`), stage then production from a release tag
(`release.yml`, jobs `sites-*`). Owner DNS/certificate/SaaS steps: [`docs/DOMAINS.md`](docs/DOMAINS.md).
