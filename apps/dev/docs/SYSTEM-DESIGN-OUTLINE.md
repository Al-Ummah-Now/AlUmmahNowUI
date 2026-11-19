# System design section — Stage 1 outline

Worktree `wt-sysdesign-UI`, branch `feat/dev-system-design` (from AlUmmahNowUI `origin/main`
`d5f838d`). Claim sources are in [`SOURCES.md`](./SOURCES.md); each section below points at the
SOURCES section that backs it. Statuses come from the wiki feature registry via
`src/lib/registry.ts` (an unknown id or a bad status fails the build).

Owner rules applied throughout: en + ar (RTL, Eastern Arabic digits ٠–٩ in Arabic, «مرئي/مرئيات»
for video), light + dark via the Fanous tokens already loaded by the site, phone-first, no
"coming soon" filler, never call a ready feature live, no invented numbers.

## 0. Audit of the current Technology / Infrastructure pages

What the code and wiki show, item by item (current copy in `apps/dev/src/i18n/en.ts` at `d5f838d`):

**Wrong or drifted (fix in Stage 3):**

1. *Infrastructure → release steps* lists Tag → Build once → Stage → Production 0% → 100%/rollback,
   but omits the **local E2E** gate (every spec placed `local`, own stack per job) and the
   **secrets checks** of stage + production, which `release-process.md:50-61` lists as production
   gates. As written the page understates the gate set. SOURCES §12.
2. *Infrastructure → pipeline "Transcode"* + details "After three failures… Errors page": correct
   for transcode **failures** (3 attempts) but incomplete — **start** failures retry 15 s→5 min,
   9 tries ≈ 24 min, then fail; deploy-cut jobs retry without using an attempt; an hourly sweep
   re-queues stuck jobs (`video-delivery.md:30-31`). SOURCES §2.
3. *Infrastructure → "The choice comes from the per-environment delivery switch … Bunny, R2, or a
   split by percentage"*: still today's live behaviour, but the mechanism in code is now the
   provider model (`docs/media-delivery/PROVIDERS.md`: settings v2, priority/weighted, per-channel
   overrides, per-video pinning, health fallback; admin "Video providers" page is `building` in the
   registry). The page should keep describing what runs today and link to the new Video pipeline
   page for the model, not present the legacy switch as the whole design. SOURCES §2.
4. *Infrastructure → cost*: "measured on the admin Delivery and Operations pages" — the admin also
   has the **Costs** page (budget meter, forecast, alerts; `cost-budget` live v2026.11.14.3) fed by
   the `cost-monitor` worker. Missing. SOURCES §9.
5. *Community → "Translation is planned"*: the registry says `caption-translation` is **building**
   (in review #1398). "Planned" understates it; statuses must track the registry. SOURCES §2.
6. *Technology → hero "Every server-side part of Al Ummah Now runs on Cloudflare Workers"* (and the
   same sentence shape on Home): transcoding runs on **Cloudflare Containers**, encoding also
   happens at **Bunny Stream**, and live HLS is served from R2 — "everything server-side runs on
   Cloudflare Workers" is the wiki's own shorthand (`README.md:117`) but as a flat sentence on a
   technology page it is not correct. Reword to "code runs on Cloudflare Workers, transcoding on
   Cloudflare Containers". SOURCES §1.

**Not wrong but misleading by omission (the likely "is not correct" complaint):**

7. Technology/Infrastructure never mention most of the system: the `media` Worker and its
   container transcoder (only one pipeline step hints at it), `processor` and what it consumes,
   `scheduler`, `cost-monitor`, `short-links`, the `status` worker, the D1/KV/R2/Queues/DO
   inventory, the search index, realtime sharding, observability (Workers Logs, Errors loop, RUM),
   or the AI model/budget story. The new System design section carries these; the two existing
   pages get corrected and link into it instead of duplicating it.
8. Infrastructure's pipeline says "our own original is kept in private R2 storage" (correct, #972)
   but never says the transcode now **starts from our original in parallel with Bunny** — that is
   the current design and the reason the R2 path is independent (`ORIGINALS.md`). SOURCES §2.

**Verified correct (kept as-is):** tokens 15 min; refresh rotation + family revocation; passkeys
live; four themes/Fanous; bknd CMS under our own admin; Next.js/OpenNext videos site; Astro
www/sites; TUS uploads; API-chooses-one-play-URL; 15 s stall fallback once; signed URLs per
response, never stored; share images on our own domain; live not on production (D3); QA/stage/
production table; status page every two minutes; cost cap exists (number deliberately not quoted
on the page — see open question 2).

## Open questions for the orchestrator

1. **Page placement.** Plan: a System design hub at `/{lang}/system-design/` + 12 subpages, one
   nav entry, cross-links from Technology and Infrastructure. Alternative: fold everything into
   the two existing pages (rejected: 12 topics × 2 languages on one page is unreadable on phones).
2. **The $500/month figure.** The brief asks for "the platform's budget … with numbers only from
   the wiki/code"; the wiki states ≤ $500/month (O1, D2, video-delivery guide). The dev-site epic's
   wording rule says the site may name the cap "without quoting the figure". Proposal: quote
   "US$500 per month" once on the Cost page with the O1/D2 citations (it is already public in the
   wiki this site links to), and keep it out of the other pages. Need the owner's/orchestrator's
   call.
3. **BunnyStream library numbers** (498994/400189/553336) and the CDN hostnames appear in public
   wrangler configs; I plan to show library *names/roles* without the numeric ids except where the
   wiki already prints them (553336 in `video-delivery.md:55`). Shout if you want no library ids
   at all.

## 1. Pages

All pages: `apps/dev/src/pages/[lang]/system-design/{slug}/index.astro` + hub
`system-design/index.astro`. Copy lives in `src/i18n/{en,ar}.ts` under a `systemDesign` key
(same keys both files; `tests/i18n.test.ts` enforces parity). Slugs are Latin in both languages
(product URLs stay Latin; only UI text is translated). `PAGES`/`static-paths.ts`/`sitemap.xml.ts`
gain the new routes; the header nav gains one "System design" entry (en) / «تصميم النظام» (ar);
Technology and Infrastructure get a link band into the section; the home "systemLayers" block
links to the hub (and its "Every server-side part" sentence is reworded per audit item 6).

### 1.1 Overview — `/{lang}/system-design/`
Master diagram (isometric-infrastructure style, zones: Clients / Edge & CDN / Apps / Data /
Async / Providers / Observability) + a short "one screen" text walkthrough.
- Zones and members exactly per SOURCES §1; arrows labelled (HTTP, service binding, queue, DO
  binding, cron, HLS/CDN).
- Simplified phone variant: stacked vertical zones, fewer boxes (same file, two `<svg>` layouts
  switched by CSS; Arabic mirrored with RTL labels; technical names Latin).
- Observability strip: Workers Logs policy (warn-only, sampling 1, no invocation logs), Errors
  page loop, RUM 1-in-20, Analytics Engine datasets, status page.
- Feature-status chips only via registry ids (`videos-site`, `sso`, `media-providers`, …).

### 1.2 Video pipeline — `video-pipeline/`
Diagram: sketch-flow style, upload → tee → (Bunny encode ‖ originals → transcode queue → media
Worker → Transcoder DO + slots → FFmpeg container ladder → pub/priv buckets) → choosePlayback →
players + one-shot fallback; captions and review lanes as side tracks.
- Claims per SOURCES §2 (TUS, tee'd originals with 30/90-day retention, queue + consumer settings,
  standard-4 containers, ceiling 3371 + slots DO, ladder 360–1080p/6 s segments, rev-addressed
  output, per-rung progress, failure/start-failure rules, readiness at first rung, play-URL
  choice, providers v2 as the model with the legacy switch as today's live admin surface, MP4
  `contentUrl`, captions lane models + Quran rules, review lane rolling).
- Statuses: `media-providers`, `transcripts`, `upload-resilience` live; `providers-page`,
  `transcode-troubleshooting`, `transcode-concurrency-limit`, `video-review`,
  `caption-translation` building/rolling per registry.

### 1.3 Delivery & caching — `delivery-caching/`
Diagram: two rails from the same rendition — public rail (R2 custom domain → Cache Rule → Smart
Tiered Cache → viewer) and private rail (Worker `/priv/*` → HMAC path token → edge cache keyed by
object); plus Bunny rail with token auth; a small inset for app-level caches.
- Claims per SOURCES §3 (cache rule durations, 512 MB cap, free-plan zone, token-in-path design,
  cache-by-object-key, pub↔priv moves + purge, signed-never-stored, share images on our domain,
  MP4 download rate rule, 30 s settings cache, JWKS edge cache + last-good, revocation KV).

### 1.4 Data — `data/`
Diagram: grouped zones — R2 (content records / media pipeline / system stores), D1 (one box per
database, annotated writer), KV, Durable Objects, Analytics Engine, Queues pointer to §5.
- Claims per SOURCES §4. Every bucket/database/namespace listed by binding name + bucket/database
  name + one-line "holds" from the wrangler comments; search FTS5 + Arabic normalisation +
  popularity; erasure/retention crons.

### 1.5 Async work — `async/`
Diagram: producers → queues → consumers table-as-flow with retry/DLQ annotations, the Errors-page
loop, and a cron strip per worker.
- Claims per SOURCES §5 (every queue with its consumer settings from the wrangler files; DLQ
  handling incl. the processor consuming its own DLQ; admin retry; scheduler minute-job; message
  archive; QA-only erasure queue with its incident note).

### 1.6 Realtime — `realtime/`
Diagram: Worker `/ws` → random shard → topic directory fan-out, coalescers, view-counter shards,
cross-script binding from api-videos.
- Claims per SOURCES §6 (8/64 shards, 503→next, hibernation + ≤12 channels/2 KiB attachments,
  directories + all-shards fallback + `/stats` routing, admin coalescing 1/s, view counter 4
  shards CAS/self-heal, rate limits 120/600, revocation check, live viewers + QoE lanes).

### 1.7 Identity & security — `identity/`
Diagram: OIDC sign-in sequence (browser/app/issuer) + token lifecycle (issue → 15 min → refresh
rotation → revocation D1+KV → per-device `sid`) + the two RBAC silos side by side.
- Claims per SOURCES §7 (PKCE everywhere, confidential admin client, 900 s TTL, family revocation,
  key rotation schedule, front-channel logout list, passkeys prompt on, site vs channel roles,
  auth-moderation queue, rate limiters, Turnstile monitor mode, INTERNAL_API_KEY mesh, CSAM
  evidence store).

### 1.8 AI usage — `ai/`
Diagram: one "where AI runs" map (processor moderation/categorize/captions, review lane, CMS
assist) with model names on the boxes and the budget gauge around them.
- Claims per SOURCES §8 (exact model ids, neuron caps 100 000/20 000 production + reserve/settle
  budget table, shadow-by-default policies + per-category enforce, AI never deletes, fixture/mocked
  in tests, Quran official-text rules, retention 30 d/12 m for review artefacts).
- The "open-weight models only, no proprietary APIs" rule is stated with its epic source.

### 1.9 Cost — `cost/`
Diagram: small flow of cost lines → cost-monitor → costs D1 → Costs page + alerts; a choices list
map (Workers vs servers, per-second containers, warn-only logs, sampled RUM, bounded originals,
no-transcode E2E, static dev site).
- Claims per SOURCES §9. The cap figure is behind open question 2. No other invented numbers; the
  historic 1M-user modelling exercise is cited as history if used at all.

### 1.10 Scaling — `scaling/`
Diagram: "many copies at once" — a request fan-out picture (Workers N instances, 8 socket shards,
4 view-counter shards, slots DO gate, queue consumers) + defect→fix table.
- Claims per SOURCES §10 (scalability audit fixed designs, blind-writer classes, subrequest budget,
  D1 write amplification, container quota math, skew protection).

### 1.11 Clients — `clients/`
Diagram: clients grid (browsers ×3 apps, native platforms, TVs, importer) → APIs/SSO/Core edges.
- Claims per SOURCES §11 (web stack trio, native building + pre-releases, Core Rust, O2 viewer/
  Studio split, remote config KV, device grant for TVs, Tools importer, embeds/short links).
- Arabic page calls native work «قيد التطوير» (building) — never "available".

### 1.12 Release & quality — `release/`
Diagram: release train (tag → build once → local E2E ‖ stage → stage E2E → secrets → prod 0% →
smoke → 100% → smoke → rollback path + dry run) + per-repo trigger table.
- Claims per SOURCES §12 (gates list incl. local E2E — the audit item 1 fix lives here), Auth
  merge-releases + local-stack bundle, media post-promote smoke starting a real container, queue
  consumer registration, translation sync, signed-in check, status page cadence, this site's own
  pipeline.

## 2. Diagrams (all hand-authored inline SVG)

- No external images, no Mermaid runtime, no CDN. One component per diagram family
  (`src/components/diagrams/*.astro`) so labels stay text nodes (`<text>`, never paths), every
  `<svg>` gets `role="img"` + `<title>` + `<desc>`, and colours come only from the Fanous CSS
  variables the site already loads (light/dark both correct; no hard-coded backgrounds).
- Three families, in the spirit of the style samples: (a) *master overview* — isometric zones;
  (b) *flow* pages (pipeline, delivery, async, release, identity) — clean sketch-flow with
  labelled arrows; (c) *map/table* pages (data, realtime, ai, cost, scaling, clients) — grouped
  zones with cardinality badges.
- Every box: real component name (worker/binding/queue/bucket names from the wrangler files).
  Arrow labels: HTTP, service binding, queue, DO binding, cron, HLS/CDN, tee, token.
- Arabic: mirrored composition (RTL), Arabic labels with Latin technical names kept as-is,
  Eastern Arabic digits only. Phone: each diagram renders a stacked variant under 480 px (CSS
  switches; both variants in the DOM is avoided — one `<svg>` per breakpoint via `<picture>`
  -free CSS `display` toggling of two `<svg>` elements is acceptable and axe-safe).
- Overview master diagram doubles as the hub hero (audit item: no diagram exists anywhere today).

## 3. Tests, build, integration

- `tests/i18n.test.ts` extended: new keys present and parity en/ar; digits rule (Arabic strings
  that contain 0-9 only inside Latin technical tokens).
- New `tests/system-design.test.ts` (vitest): every System design route renders en+ar; registry
  ids used on the pages exist; no `\$[0-9]` outside the agreed cost sentence.
- Playwright (`e2e/site.spec.ts` extended): each new page loads in en+ar, light+dark, no
  horizontal scroll at 320 px (`document.scrollingElement.scrollWidth <= innerWidth`), axe clean,
  every `<svg>` has title/desc; Arabic pages check `dir="rtl"` and one ٠–٩ sample.
- Build behind the shared lock (`../.build-lock`), `pnpm --filter dev build` + `pnpm --filter dev
  test` (exact scripts per `apps/dev/package.json`).
- Commit style: `git -c user.name=meywd -c user.email=3499969+meywd@users.noreply.github.com
  commit` with `Co-Authored-By: GLM 5.3 <noreply@z.ai>`; PR "dev: system design section with
  architecture diagrams" to AlUmmahNowUI main, not merged.

## 4. Stage plan

- **Stage 2:** hub + Overview master diagram + Video pipeline page, rendered; screenshots
  light/dark × en/ar × desktop/phone; report paths.
- **Stage 3:** remaining 10 pages + diagrams, corrections to Technology/Infrastructure/Home/
  Community copy per §0, tests, PR.
