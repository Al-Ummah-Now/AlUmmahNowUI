# alummahnow.dev: domain setup (owner steps)

The dev site deploys as Cloudflare Workers static assets with a **custom domain** per environment
(`wrangler.jsonc`):

| Environment | Host | Worker |
|---|---|---|
| production | `alummahnow.dev` | `al-ummah-now-dev` |
| stage | `stage.alummahnow.dev` | `al-ummah-now-dev-stage` |
| QA | `qa.alummahnow.dev` | `al-ummah-now-dev-qa` |

`wrangler deploy` creates each custom domain, its DNS record and its certificate. For that, the zone
must be on the Al Ummah Now Cloudflare account, and the release token must be allowed to work there.
Until then every deploy step **skips with a notice**; nothing fails. The CI job "Dev site zone check"
says on every PR which part is missing (`scripts/release/zone-check.ts`, read-only).

## 1. The zone on the account

Public DNS (checked 2026-11-14): `alummahnow.dev` already uses Cloudflare nameservers
(`jill.ns.cloudflare.com`, `miles.ns.cloudflare.com`), the same pair as `alummahnow.org`. That suggests
it is already a zone on this account. If the zone check says it isn't:

1. Cloudflare dashboard → **Add a domain** → `alummahnow.dev` → Free plan, on the Al Ummah Now account.
2. If Cloudflare shows other nameservers than the ones above, set them at the registrar.
3. Wait until the zone says **Active**.

## 2. The release token

The org secret `CLOUDFLARE_API_TOKEN` (the release token) needs these on the `alummahnow.dev` zone:

- **Zone → Zone: Read**
- **Zone → DNS: Edit** (custom domains add their own records)
- **Zone → Workers Routes: Edit**

Dashboard → My Profile → API Tokens → the release token → Edit → Zone Resources → include
`alummahnow.dev` (or "All zones from the account") with the three permissions. No new secret is needed.

## 3. www → apex (optional)

`www.alummahnow.dev` isn't served by the Worker. To send it to the apex:

1. DNS → add `AAAA` `www` → `100::`, **Proxied**.
2. Rules → Redirect Rules → Create: when *Hostname equals* `www.alummahnow.dev`, then *Dynamic*
   redirect to `concat("https://alummahnow.dev", http.request.uri.path)`, status **301**, preserve query string.

## After that

The next push to `main` deploys QA (`deploy-qa.yml` → job "Deploy dev site, smoke (QA)"). The next
release tag deploys stage and then production (`release.yml` → the `dev-*` jobs). No other step.
