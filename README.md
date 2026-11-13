# AlUmmahNowUI

The public sites of **Al Ummah Now**, as an npm workspace:

| Path | What | Worker |
|---|---|---|
| [`apps/www`](apps/www/README.md) | www.alummahnow.net (Astro on Cloudflare Workers) | `al-ummah-now-www[-qa\|-stage]` |
| [`apps/sites`](apps/sites/README.md) | White-label scholar sites on `<slug>.alummahnow.org` and own domains | `al-ummah-now-sites[-qa\|-stage]` |
| `packages/render` | Code both apps render with: themes, sealed cookies, embed URLs, markdown, HTML edge cache (imported by relative path, TypeScript source) | – |

Install once at the root (`npm ci`), then run each app's scripts from its folder (`cd apps/www && npm run dev`).
Repo-wide checks live in `scripts/` (`check-committed-secrets.mjs`, `scan-artifacts-for-secrets.py`).
Release check: `node scripts/check-cookie-domains.mjs` fails if any app sets a cookie `Domain`
(cookies stay host-only: never `.alummahnow.net` or `.alummahnow.org`).
