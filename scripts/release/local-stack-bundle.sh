#!/usr/bin/env bash
# Assembles the local-stack bundle of this commit into dist/local-stack for AlUmmahNow's local E2E
# stack (AlUmmahNow scripts/local-stack): the prebuilt www Worker (bundles/www), its wrangler config
# and its static assets at apps/www/dist/client, the same paths as in this repo, so the stack runs a
# released www without checking out or installing this repo. Needs `npm ci` and the www build done.
set -euo pipefail
OUT=dist/local-stack
rm -rf "$OUT" && mkdir -p "$OUT/bundles" "$OUT/apps/www"
(cd apps/www && npx wrangler deploy --dry-run -c wrangler.jsonc --env= --outdir "../../$OUT/bundles/www" >/dev/null)
# The stack looks for bundles/<app>/index.js; wrangler names the bundle after main (dist/server/entry.mjs)
B="$OUT/bundles/www"
mv "$B/entry.js" "$B/index.js"
if [ -f "$B/entry.js.map" ]; then
  mv "$B/entry.js.map" "$B/index.js.map"
  sed -i.bak 's|sourceMappingURL=entry\.js\.map|sourceMappingURL=index.js.map|' "$B/index.js" && rm -f "$B/index.js.bak"
fi
cp apps/www/wrangler.jsonc "$OUT/apps/www/"
# Static assets only (dist/client): the server bundle is bundles/www
mkdir -p "$OUT/apps/www/dist"
rsync -a apps/www/dist/client "$OUT/apps/www/dist/"
printf '{"sha":"%s","built":"%s"}\n' "$(git rev-parse HEAD)" "$(date -u +%FT%TZ)" > "$OUT/local-stack.json"
echo "local-stack bundle: $(du -sh "$OUT" | cut -f1)"
