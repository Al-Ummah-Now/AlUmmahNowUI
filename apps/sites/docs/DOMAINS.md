# Scholar sites: domains, DNS and certificates (owner steps)

The sites Worker serves every white-label site from the **`alummahnow.org`** zone (wiki
AUN-SCHOLAR-SITES SS9). The Worker's routes are in `wrangler.jsonc` and are attached by every deploy:

| Env | Route | Worker |
|---|---|---|
| production | `*.alummahnow.org/*`, `alummahnow.org/*` | `al-ummah-now-sites` |
| stage | `*.stage.alummahnow.org/*` | `al-ummah-now-sites-stage` |
| QA | `*.qa.alummahnow.org/*` | `al-ummah-now-sites-qa` |

Routes only receive traffic for hostnames that have a **proxied DNS record** and a certificate. Our
Cloudflare API token can edit Worker routes on the zone but **cannot read or edit DNS, SSL or Custom
Hostnames** there (checked 2026-11-13), so these steps are the owner's. Until they are done, the
release smoke prints `SKIP … owner DNS step pending` instead of failing.

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

1. SSL/TLS → **Custom Hostnames** → enable Cloudflare for SaaS (the Free plan includes 100 custom
   hostnames; then $0.10 per hostname per month).
2. **Fallback origin**: `sites.alummahnow.org` (the proxied record from step 1).
3. Tell us when it is on: a Worker route `*/*` → `al-ummah-now-sites` is then added to
   `wrangler.jsonc` (custom-hostname traffic reaches the Worker through it; the more specific
   `*.qa.`/`*.stage.` routes keep winning for test hosts).
4. For automating own domains from Studio/admin later: an API token limited to the
   `alummahnow.org` zone with **SSL and Certificates: Edit** (custom hostnames), stored in the
   Secrets Store as `cf-saas-hostnames`. It must have no access to `alummahnow.net`.

## 4. Check

```bash
curl -s https://sites.alummahnow.org/healthz        # {"ok":true,"app":"sites","env":"production",...}
curl -s https://sites.qa.alummahnow.org/healthz     # needs the advanced certificate (step 2)
curl -sI https://alummahnow.org/                    # 301 → https://www.alummahnow.net/
curl -sI https://nobody.alummahnow.org/             # 404 (unknown site)
```
