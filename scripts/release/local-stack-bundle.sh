#!/usr/bin/env bash
# Assembles the local-stack bundle of this commit into dist/local-stack for AlUmmahNow's local E2E
# stack (AlUmmahNow scripts/local-stack): the prebuilt www Worker (bundles/www), its wrangler config
# and its static assets at apps/www/dist, the same paths as in this repo, so the stack runs a
# released www without checking out or installing this repo. Needs `npm ci` and the www build done.
set -euo pipefail
OUT=dist/local-stack
rm -rf "$OUT" && mkdir -p "$OUT/bundles" "$OUT/apps/www"
(cd apps/www && npx wrangler deploy --dry-run --env= --outdir "../../$OUT/bundles/www" >/dev/null)
cp apps/www/wrangler.jsonc "$OUT/apps/www/"
# Static assets only: the server bundle is bundles/www
rsync -a --exclude '_worker.js' apps/www/dist "$OUT/apps/www/"
printf '{"sha":"%s","built":"%s"}\n' "$(git rev-parse HEAD)" "$(date -u +%FT%TZ)" > "$OUT/local-stack.json"
echo "local-stack bundle: $(du -sh "$OUT" | cut -f1)"
