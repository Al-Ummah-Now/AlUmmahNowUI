# Vendored icons: sources, licences, brand notes

Every service node in the System design diagrams shows a real product icon, unmodified (scaled
only, no recolouring of brand marks). Files live under `src/assets/icons/<vendor>/<name>.svg`.
Colours are applied at render time via CSS `color` where the source set is designed for it
(Simple Icons and Lucide are single-path, `currentColor`-ready); the official brand hex per mark
is listed here and used as-is. Where a mark only exists in black/white (GitHub, Next.js, Resend,
Apple), dark mode renders its inverse so the contrast passes — an inversion, not a recolour.

## Simple Icons (`src/assets/icons/simple-icons/`) — v13.0.0

Source: `https://unpkg.com/simple-icons@13.0.0/icons/<slug>.svg` (package `simple-icons`;
icons CC0, each mark still subject to its vendor's brand terms — see
https://simpleicons.org/?q= for per-icon brand pages). Files are unmodified.

| file | product | official brand colour used |
|---|---|---|
| `cloudflare.svg` | Cloudflare (main mark — used for all Cloudflare products: Workers, R2, D1, KV, Queues, Durable Objects, Workers AI, Containers, Images, Stream, CDN/cache, WAF, Secrets Store, Turnstile) | `#F6821F` (Cloudflare orange) |
| `githubactions.svg` | GitHub Actions (CI/CD) | `#2088FF` |
| `resend.svg` | Resend (email) | `#000000` (dark mode: `#ffffff`) |
| `ffmpeg.svg` | FFmpeg (transcode) | `#007808` |
| `docker.svg` | Docker/OCI container images | `#2496ED` |
| `openai.svg` | OpenAI — Whisper models served on Workers AI (`@cf/openai/whisper-large-v3-turbo`) | `#000000` (dark mode: `#ffffff`) |
| `nextjs.svg` | Next.js (videos site, admin-web) | `#000000` (dark mode: `#ffffff`) |
| `astro.svg` | Astro (www, scholar sites, this site) | `#FF5D01` |
| `apple.svg` | Apple platforms | `#000000` (dark mode: `#ffffff`) |
| `android.svg` | Android | `#3DDC84` |
| `windows.svg` | Windows (simple-icons `windows` from v11, the four-pane mark) | `#0078D6` |
| `linux.svg` | Linux | `#FCC624` |
| `github.svg` | GitHub | `#181717` (dark mode: `#ffffff`) |
| `google.svg` | Google (Move from YouTube sign-in) | `#4285F4` |

## Cloudflare product icons (`src/assets/icons/cloudflare/`) — OFFICIAL

Source: Cloudflare's own docs repository, the exact SVGs developers.cloudflare.com serves:
`https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/icons/<product>.svg`
(repo `cloudflare/cloudflare-docs`, branch `production`). Files are unmodified. They are the
monochrome product marks; as on Cloudflare's docs site they are rendered in Cloudflare orange
(`#F6821F`) — the fill is applied by CSS at render time, the file is untouched.

Vendored: workers, r2, d1, kv, queues, durable-objects, workers-ai, containers, images, stream,
pages, cache, waf, zero-trust-networks, secrets-store, turnstile, hyperdrive, vectorize,
notifications, logs (Workers Logs), analytics (Analytics Engine), web-analytics, dns, rules,
network, health-checks, ddos-protection, security, email-service. (Not vendored: the set's `cf.svg`,
which is a CLI prompt glyph, not the Cloudflare logo; the logo is `simple-icons/cloudflare.svg`.) (Also available in the same directory if needed later: r2-data-catalog, r2-sql,
realtime-*, workflows, logs, and the rest of the set.)

The `simple-icons/cloudflare.svg` main cloud mark remains vendored for the boundary corner and
for the CDN/edge cloud itself.

## Bunny.net (`src/assets/icons/brand/`) — OFFICIAL

bunny.net publishes no downloadable press kit (bunny.net/media-kit, /press and /brand all 404 on
2026-11-19), so these are the marks bunny.net itself serves on its own site, fetched unmodified:

| file | source | used for |
|---|---|---|
| `bunny-stream.svg` | `https://bunny.net/images/bunny-stream-icon-orange.svg` (the Stream product icon) | Bunny Stream (encode + storage) |
| `bunny-cdn.svg` | `https://bunny.net/images/bunny-cdn-icon-modern.svg` (the CDN product icon) | Bunny CDN (signed HLS) |
| `bunnynet-logo-dark.svg` | `https://bunny.net/static/bunnynet-dark-d6a41260b1e4b665cb2dc413e3eb84ca.svg` (site header wordmark) | the bunny.net platform tag; drawn on a white chip in both modes because the wordmark is made for light backgrounds |

## Lucide (`src/assets/icons/lucide/`) — lucide-static 0.545.0

Source: `https://unpkg.com/lucide-static@0.545.0/icons/<name>.svg` (ISC Licence). Used as the
one consistent open set for generic actors and concepts: browser, smartphone, tv, user,
database, server, box, key-round, mail, bell, book-open, activity, chart-line, shield-check,
settings, search, cloud-upload, play, circle-dot, arrow-right, container, layers,
message-square, rabbit, users, cpu, film, radio, git-branch, gauge, hard-drive, scroll-text,
sparkles, timer, workflow, globe, monitor, laptop, layers-3, list-ordered, bell-ring, lock. Strokes take the diagram's text colour (they are not brand marks).

## Diagram type (`public/fonts/inter-*`) — SIL Open Font License 1.1

Architecture, flow and isometric diagrams set Latin text in Inter (400, 600, 700, 800; from
`@fontsource/inter@5.2.5`, licence `inter-OFL.txt`) and Arabic in the site's Noto Naskh Arabic. The
fonts are bundled, not the system's, so a diagram lays out the same on every platform: the system
font differs per OS, and on Linux (CI's) it is wider and taller, which broke tight layouts.

## Handwriting fonts (`public/fonts/`) — SIL Open Font License 1.1

The hand-drawn explainers (style sample 1) use Kalam (Latin) and Aref Ruqaa (Arabic: Ruqaa is the
everyday Arabic hand), from `@fontsource/kalam@5.2.5` and `@fontsource/aref-ruqaa@5.2.5` on jsDelivr.
Licences: `kalam-OFL.txt`, `aref-ruqaa-OFL.txt`.

## How icons are drawn in diagrams (src/lib/arch)

Each vendored file becomes a `<symbol>` in the diagram's own `<defs>` (internal ids such as
gradients and clip paths are prefixed per diagram) and is placed with `<use width height>`, so the
mark is exactly the size asked for (40px in architecture nodes, 28–32px on hero cards, 18px in
tags) and can never spill out. `e2e/diagram-gate.ts` fails a page if any icon leaves its node or is
larger than 48px.

## Rules honoured

- Files are vendored byte-for-byte from the sources above; only `width/height` are applied by
  CSS at render time. No path edits, no recolouring of brand marks.
- Clear space: icons render at 44px on node cards with ≥8px padding; labels sit beneath.
- Nothing here is committed from `docs/style-samples/` (git-ignored).
