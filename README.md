# AlUmmahNowUI

The public sites of **Al Ummah Now**, as an npm workspace:

| Path | What | Worker |
|---|---|---|
| [`apps/www`](apps/www/README.md) | www.alummahnow.net (Astro on Cloudflare Workers) | `al-ummah-now-www[-qa\|-stage]` |

Install once at the root (`npm ci`), then run each app's scripts from its folder (`cd apps/www && npm run dev`).
Repo-wide checks live in `scripts/` (`check-committed-secrets.mjs`, `scan-artifacts-for-secrets.py`).
The scholar sites Worker (`apps/sites`) and the shared render package (`packages/render`) follow
(wiki AUN-SCHOLAR-SITES §5.2, SS3).
