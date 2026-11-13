# Scholar sites: domains, DNS and certificates (owner steps)

The sites Worker serves every white-label site from the **`alummahnow.org`** zone (wiki
AUN-SCHOLAR-SITES SS9). The Worker's routes are in `wrangler.jsonc` and are attached by every deploy:

| Env | Route | Worker |
|---|---|---|
| production | `*.alummahnow.org/*`, `alummahnow.org/*` | `al-ummah-now-sites` |
| stage | `*.stage.alummahnow.org/*` | `al-ummah-now-sites-stage` |
| QA | `*.qa.alummahnow.org/*` | `al-ummah-now-sites-qa` |

Routes only receive traffic for hostnames that have a **proxied DNS record** and a certificate. The
release token (`CLOUDFLARE_API_TOKEN`) has DNS, SSL and Custom Hostnames edit on the zone since
2026-11-13, so steps 1 and 3 are automated. QA and stage subdomains (two levels deep) still need the
Advanced Certificate (step 2); until then the release smoke prints `SKIP` for them.

## 0. Automated: the Sites zone workflow

Actions → **Sites zone** → *check* lists what the release token (`CLOUDFLARE_API_TOKEN`) may do on
the zone (one TXT record is created and deleted to prove DNS Edit) and names each missing permission.
*apply* makes steps 1 and 3.2 below and turns Always Use HTTPS on (`apps/sites/scripts/sites-zone.ts`,
idempotent). The Advanced Certificate (step 2) and enabling Cloudflare for SaaS (step 3.1) stay in
the dashboard.

## 1. DNS records (zone alummahnow.org → DNS → Records)

All **Proxied** (orange cloud). `100::` is the conventional "Worker-only" origin: nothing behind it is
ever contacted, the Worker answers.

| Type | Name | Content | Why |
|---|---|---|---|
| AAAA | `*` | `100::` | every `<slug>.alummahnow.org` (production) |
| AAAA | `@` | `100::` | apex: the Worker 301s it to www.alummahnow.net |
| AAAA | `www` | `100::` | the Worker 301s it to www.alummahnow.net (a `*` record does not cover `www` once another record exists, so add it explicitly) |
| AAAA | `sites` | `100::` | Cloudflare for SaaS fallback origin (step 3) and the production smoke host |
| AAAA | `*.qa` | `100::` | every `<slug>.qa.alummahnow.org` |
| AAAA | `sites.qa` | `100::` | QA smoke host |
| AAAA | `*.stage` | `100::` | every `<slug>.stage.alummahnow.org` |
| AAAA | `sites.stage` | `100::` | stage smoke host |

## 2. Certificates (SSL/TLS → Edge Certificates)

- **Universal SSL** (free, on by default) covers `alummahnow.org` and `*.alummahnow.org`: production
  needs nothing more.
- **QA and stage hosts are two levels deep** (`<slug>.qa.alummahnow.org`), which Universal SSL does not
  cover. Recommended: **Advanced Certificate Manager** (about **$10/month** for the zone) → *Order
  Advanced Certificate* with the hostnames `qa.alummahnow.org`, `*.qa.alummahnow.org`,
  `stage.alummahnow.org`, `*.stage.alummahnow.org` (one certificate). Without it, QA/stage sites
  only work through a free Workers Custom Domain per test host (Workers → al-ummah-now-sites-qa →
  Settings → Domains & Routes → Add → Custom domain), one per test site.
- **Always Use HTTPS**: on. **HSTS**: enable with `includeSubDomains` once the hosts above answer
  (every name under alummahnow.org is ours; the Worker already sends HSTS itself).

## 3. Cloudflare for SaaS (scholars' own domains)

Done 2026-11-13: Cloudflare for SaaS is enabled on the zone and the fallback origin is
`sites.alummahnow.org` (Sites zone *apply*, run 43526824692).

**Routing.** Own-domain traffic reaches a Worker through Worker routes on `alummahnow.org` that match
the custom hostname itself:

| Env | Route | Own domains it serves |
|---|---|---|
| production | `*/*` | every scholar's own domain |
| stage | `*.stage-sites.alummahnow.com/*` | test domains only |
| QA | `*.qa-sites.alummahnow.com/*` | test domains only |

All three environments share the zone, so custom hostnames share one namespace: a hostname added
from QA could not be added from production any more. That is why QA and stage admin-api accept only
hosts under their test suffix, and production refuses those suffixes (videos `SITE_TEST_DOMAIN_SUFFIX`).

**What a scholar adds at their DNS provider** (Studio → Site → Domains shows the exact values):

| Type | Name | Value | Why |
|---|---|---|---|
| CNAME | their host (for example `www.example.com`) | `sites.alummahnow.org` | traffic |
| TXT | `_cf-custom-hostname.<host>` | shown in Studio | proves they own the host |
| TXT | `_acme-challenge.<host>` (usually two) | shown in Studio | the certificate |

All records can be added at once; the certificate is usually live within a few minutes. A bare
domain (`example.com`) needs a provider that allows CNAME flattening/ALIAS at the apex; otherwise use
`www.` and redirect the apex at the provider. The API token admin-api uses is the Secrets Store
`sites-saas-token` (SSL and Certificates: Edit on alummahnow.org only).

**End-to-end check:** Actions → **Sites zone** → *own-domain-smoke-qa* (or *-stage*) creates a
throwaway hostname `saas-smoke-<id>.<env>-sites.alummahnow.com`, adds the scholar's records in the
`alummahnow.com` zone (DNS only), routes it to the env's Worker, waits for validation, fetches
`/healthz` over HTTPS and removes everything. First run (QA, 2026-11-13): active after 77 s, `/healthz`
answered `"env":"qa"`.

## 4. Check

```bash
curl -s https://sites.alummahnow.org/healthz        # {"ok":true,"app":"sites","env":"production",...}
curl -s https://sites.qa.alummahnow.org/healthz     # needs the advanced certificate (step 2)
curl -sI https://alummahnow.org/                    # 301 → https://www.alummahnow.net/
curl -sI https://nobody.alummahnow.org/             # 404 (unknown site)
```
