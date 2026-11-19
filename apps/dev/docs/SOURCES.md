# System design section — sources

Every claim on the System design pages must be traceable to a file below. This list is the
review contract: if a claim on a page has no line here, it does not go on the page.

Read from each repo's `origin/main` (local checkouts were stale; detached read worktrees were used):

| Short | Repo | Commit read |
|---|---|---|
| AUN | AlUmmahNow (monorepo) | `1a802a69d` |
| WIKI | AlUmmahNowWiki | `efdf459` |
| AUTH | AlUmmahNowAuth | `974734f` |
| CMS | AlUmmahNowCMS | `819f3ca` |
| UI | AlUmmahNowUI (this repo, base of this branch) | `d5f838d` |

Feature statuses shown on the pages come only from the wiki feature registry
(`WIKI features/registry.json`), fetched at build time by `apps/dev/scripts/registry.ts` into
`src/data/registry.json`; `src/lib/registry.ts` fails the build for an unknown id or a status
that is neither `live` nor `ready` in a "running in production" list. Numbers with a source are
quoted; nothing else is invented. No secrets, account ids, tokens or non-public hostnames appear
on the pages (Secrets Store *names* and public hostnames only).

Not used as fact: `AUN docs/INFRASTRUCTURE_COST_ANALYSIS.md` — a 2026-11 modelling exercise with
hypothetical 1M-user figures and no R2 pipeline; superseded by the wiki guides and the wrangler
configs. Cited only where marked "historic analysis".

---

## 1. Overview (`/{lang}/system-design/`)

- Three environments QA / stage / production, hostnames per service — `WIKI guides/environments.md:5-37` (table incl. www, cms, videos, videos.api, realtime, admin, admin.api, media, short links, status, auth, profile.auth, admin.auth; `processor`, `scheduler`, `cost-monitor`, auth `audit-consumer` have no public hostname, line 33).
- System map (clients → auth / public site / monorepo apps → Cloudflare data services → Bunny; who binds to what) — `WIKI README.md:61-117` (mermaid "System map") and `README.md:119-125` ("How the pieces work together").
- Monorepo apps list: web, admin-web, admin-api, api-videos, log-service, processor, scheduler, websocket-server, media, cost-monitor, short-links, status — directory listing `AUN apps/` (each has `wrangler*.jsonc`).
- Worker names in production: `videos` (AUN apps/api-videos/wrangler.jsonc `"name"`), `al-ummah-now-production` (apps/web/wrangler.production.jsonc), `al-ummah-admin-web` (apps/admin-web/wrangler.production.jsonc), `al-ummah-admin-api` (apps/admin-api/wrangler.jsonc + scripts/release/apps.ts:391-398), `al-ummah-now-processor`, `al-ummah-now-comms` (apps/websocket-server/wrangler.jsonc), `al-ummah-scheduler` (apps/scheduler/wrangler.jsonc), `al-ummah-now-media` (apps/media/wrangler.jsonc), `al-ummah-cost-monitor`, `al-ummah-now-short-links`, `al-ummah-status` (apps/status/wrangler.jsonc).
- Auth workers: issuer `al-ummah-now-auth` on `auth.alummahnow.net`, profile `al-ummah-now-profile` on `profile.auth.*` + `account.*`, admin `al-ummah-now-auth-admin` on `admin.auth.*` — `AUTH apps/auth/wrangler.json:91-99,146-158`, `apps/profile/wrangler.json`, `apps/admin/wrangler.json`; components table `WIKI guides/authentication.md:13-19`.
- CMS worker `al-ummah-now-cms` on `cms.alummahnow.net`, D1 `al-ummah-now-cms`, R2 `al-ummah-now-cms`, KV `FEED`, AI binding, crons `*/30` and `* * * * *` — `CMS wrangler.jsonc` (name/routes/d1/r2/kv/ai/triggers).
- www is Astro with a service binding `CMS → al-ummah-now-cms` and KV `FEED` (home timeline, written only by the CMS feed job) — `UI apps/www/wrangler.jsonc:33,42,46`.
- Videos site is Next.js on Workers via OpenNext — `AUN apps/web/wrangler.production.jsonc` (`main: worker.ts`, assets `.open-next/assets`), `apps/web/open-next.config.ts`; admin-web same shape (`apps/admin-web/wrangler.production.jsonc`).
- Short links zone `alummahnow.link` → redirect worker; vars point at videos/www/API — `AUN apps/short-links/wrangler.jsonc` (route + vars).
- Status page `status.alummahnow.net`, checks every 2 min (`*/2 * * * *`), daily prune 03:40 — `AUN apps/status/wrangler.jsonc:16`; never calls services while serving a page — `apps/status/src/index.ts:4-6`.
- Service bindings between workers: api-videos → media + processor (`apps/api-videos/wrangler.jsonc` `services`); media → videos; processor → videos; admin-api → videos/processor/scheduler (`apps/admin-api/wrangler.jsonc` `services`; production vars in `scripts/release/apps.ts:391-430`).
- Cross-script Durable Object binding: api-videos binds `VIEW_COUNTER → WebSocketDurableObject` in `al-ummah-now-comms` — `AUN apps/api-videos/wrangler.jsonc:40-43`.
- Observability band: Workers Logs with `head_sampling_rate 1`, `invocation_logs false`, `LOG_LEVEL warn` on production workers — e.g. `AUN apps/api-videos/wrangler.jsonc` (observability block + vars), `apps/processor/wrangler.jsonc` (top-level observability), logging policy `AUN docs/operations/logging.md:1-60`; error reports to admin Errors page via `ERRORS_INGEST_URL` (api-videos, processor, websocket-server, scheduler, status, cost-monitor, short-links, admin-api, auth vars); RUM beacon 1-in-20 to Analytics Engine `al_ummah_now_rum` — `AUN docs/operations/rum.md` (whole doc; sample rate, fields, datasets); Abuse counters Analytics Engine `al_ummah_now_abuse` (api-videos analytics_engine_datasets).
- Providers zone: Bunny Stream libraries (primary 498994 `vz-25839d05-80d.b-cdn.net`, legacy 400189) — `AUN apps/api-videos/wrangler.jsonc` vars `bunny_hostname`, `BUNNY_LEGACY_*` + secrets comments; QA/stage share test library 553336 — `WIKI guides/video-delivery.md:54-55`. Quran Foundation hosts — api-videos/processor vars `QF_OAUTH_HOST`/`QF_API_HOST`. Resend (status alerts + contact mail + auth email codes) — `WIKI guides/authentication.md:41`, `AUN apps/status/wrangler.jsonc` RESEND_API_KEY, `apps/admin-api/wrangler.jsonc:118-121`. Push: APNs/FCM/WNS + Web Push VAPID secrets — `AUN apps/processor/wrangler.jsonc` secrets list. Google OAuth (Move from YouTube) — api-videos secrets `GOOGLE_OAUTH_CLIENT_SECRET`.
- "Everything server-side runs on Cloudflare Workers" phrasing — `WIKI README.md:117`; the transcoker exception (Cloudflare Containers) is `WIKI guides/video-delivery.md:26` and `AUN apps/media/wrangler.jsonc` containers block.

## 2. Video pipeline (`/{lang}/system-design/video-pipeline/`)

- Upload is resumable TUS through the videos API — `WIKI guides/video-delivery.md:15` (mermaid), `AUN apps/api-videos` TUS_SESSIONS KV binding; feature `upload-resilience` (registry).
- Dual write: every upload goes to Bunny Stream and the bytes are `tee()`d into the private originals bucket `al-ummah-now-media-originals` (`src/<videoId>/<uploadId>/<offset>`), Bunny's answer is the response — `AUN docs/media-delivery/ORIGINALS.md` (Design + "Writing: every path that receives the bytes" table); buckets bound `MEDIA_ORIGINALS` in api-videos (`apps/api-videos/wrangler.jsonc:147`) and media (`apps/media/wrangler.jsonc` r2_buckets).
- Originals retention: at least 30 days and until the R2 rendition is ready, never past 90 — api-videos vars `ORIGINALS_RETENTION_DAYS=30`, `ORIGINALS_MAX_DAYS=90`.
- Transcode queue `al-ummah-now-transcode` produced by api-videos (`TRANSCODE_QUEUE`), consumed by apps/media batch 1, concurrency 10, retries 8, DLQ `al-ummah-now-transcode-dlq` — `AUN apps/api-videos/wrangler.jsonc:269` area + `apps/media/wrangler.jsonc` queues block.
- One container per video: `Transcoder` Durable Object id = video id (idempotent); container has no internet, reads source and writes renditions through Worker handlers (`http://source.internal/`, `media.internal`, `control.internal`) — `AUN docs/media-delivery/R2-DELIVERY-PLAN.md:17-45` (architecture diagram), `WRANGLER containers` (outbound interception note in plan §"Why these choices").
- Instance type `standard-4`, `max_instances 3371` production (account quota math in the comment), stage/QA 2; deploy grace 1 h for running transcodes — `AUN apps/media/wrangler.jsonc:20-36` + env.stage; ceiling var `MEDIA_TRANSCODE_CEILING` in api-videos + media.
- Admin min–max concurrent transcodes enforced by the `TranscodeSlots` Durable Object (`acquire/renew/release`, snapshot inUse/waiting/allowed) — `AUN apps/media/src/slots.ts:7-36`, `src/slot-state.ts`; setting `global_settings/ops/media-transcode-limit.json` (api-videos var comment).
- FFmpeg ladder by short side 360p/480p/720p/1080p (maxrate 0.8/1.4/2.8/5 Mbps, audio 96/128k), never above source, CRF 23, 6 s segments, GOP 2 s, single decode pass, fMP4 HLS; >30 fps capped at 30 — `AUN apps/media/container/ladder.mjs:7-14,32-60` (RUNGS, SEGMENT_SECONDS, ladderFor, ffmpegArgs).
- Output layout: public `pub/<videoId>/<rev>/…` and private `priv/…` buckets (`al-ummah-now-media`, `al-ummah-now-media-private`) — `AUN apps/media/wrangler.jsonc` r2_buckets comments; plus progressive MP4 `pub/<id>/<rev>/video.mp4` (stream copy of the 480p rung, 360p for smaller sources) as SEO `contentUrl` — `WIKI guides/video-delivery.md:84-86`.
- Per-rung progress reported to api-videos (at most every 10 s except state changes) — `AUN apps/media/src/jobs.ts:311-341`; admin Processing card shows Bunny and R2 side by side — `WIKI guides/video-delivery.md:66`.
- Failures: 3 attempts → `r2.status failed` → admin Errors page with Retry, viewers keep Bunny; start-failure backoff 15 s→5 min, 9 tries ≈ 24 min; deploy-cut jobs retry without using an attempt; hourly sweep re-queues stuck jobs — `WIKI guides/video-delivery.md:28,30-31`; media wrangler comment `rollout_active_grace_period`.
- The API decides the play URL, players never choose; delivery switch (Bunny / R2 / split by percentage, per video or per view); editors get Bunny for the thumbnail picker; fallback `?exclude=r2` after fatal error or 15 s stall — `WIKI guides/video-delivery.md:33-43`; provider-adapter model and settings v2 (`global_settings/ops/media-delivery.json`, priority/weighted, per-channel overrides ≤200, video pinning, health fallback; defaults both on, ingest [bunny,r2], playback priority [bunny]) — `AUN docs/media-delivery/PROVIDERS.md:1-60` (model + settings); registry: `media-providers` live, `providers-page`/`transcode-troubleshooting`/`transcode-concurrency-limit` building.
- Readiness = first encoded resolution, not 1080p — `WIKI guides/video-delivery.md:63`.
- Captions lane (live): transcription is a creator action, Workers AI Whisper large-v3-turbo (`CAPTION_MODEL` — `AUN apps/api-videos/src/lib/captions/jobs.ts:41`), draft edited in Studio, Quran spans confirmed by creator, zero-mistake rules — `WIKI epics/AUN-CAPTIONS-transcription-translation.md:1-60` (status, goal, measured table); Quran index from Quran Foundation Content Sync in the private media bucket — `AUN apps/processor/src/quran/` (build.ts, sync.ts) + review-matcher.ts:1-31; registry `transcripts` live, `caption-translation`/`transcript-search` building.
- Review lane (rolling): pre-publication checks extract frames every 2 s + cuts capped at 1200 — `WIKI epics/AUN-VIDEO-REVIEW-pre-publication-review.md:81-93,244-315`; models per `AUN packages/shared-types/src/video-review.ts:181-183`.
- Backfill of the existing catalogue into R2 is an admin action with cost estimate and budget cap, in review — `WIKI guides/video-delivery.md:90` + registry.

## 3. Delivery & caching (`/{lang}/system-design/delivery-caching/`)

- Public HLS never touches a Worker: R2 custom domain `media.<env>.alummahnow.net` + Cache Rule caches everything; only `/priv/*` runs the media Worker (route pattern `media.alummahnow.net/priv/*`) — `AUN docs/media-delivery/R2-DELIVERY-PLAN.md:34-35,65-70` + `apps/media/wrangler.jsonc` routes.
- Cache Rule: segments/init immutable 1 year, playlists 10 s, manifest.json bypass; Smart Tiered Cache on; applied as code by `scripts/media-cdn/apply.ts` / `media-cdn.yml` — `AUN docs/media-delivery/R2-DELIVERY-PLAN.md:103-114`; `WIKI guides/video-delivery.md:29`.
- 512 MB maximum cacheable file; segments ≈ 0.5–4 MB — `R2-DELIVERY-PLAN.md:98-99`. Zone on the Free plan (checked 2026-11-11), 10 Cache Rules on Free — `R2-DELIVERY-PLAN.md:103`.
- Private/unlisted: token in the path (HMAC via `MEDIA_SIGN_KEY`), Worker caches by object key not by token so all viewers share one cached copy — `R2-DELIVERY-PLAN.md:66-68`; visibility changes move objects `pub/ ↔ priv/` and purge the old prefix — `R2-DELIVERY-PLAN.md:75` area + api-videos `MEDIA`/`MEDIA_PRIVATE` binding comments; CDN purge on private via `MEDIA_CDN_API_TOKEN`.
- Bunny: CDN token auth on in every library, URLs signed per response and never stored (tokens stripped on write, signed on read; repair script for old stored copies) — `WIKI guides/video-delivery.md:45-50`; "Block Direct Url File Access" must stay off — line 50.
- Share images stable on our own domain `https://videos.alummahnow.net/thumb/<videoId>.jpg` — `WIKI guides/video-delivery.md:49`.
- MP4 downloads limited per IP by a zone rate-limit rule (10 per 10 s, block) in `scripts/media-cdn/apply.ts` — `WIKI guides/video-delivery.md:86`.
- App-level caches: media settings cached 30 s per isolate — `AUN docs/media-delivery/PROVIDERS.md` (settings section) and `R2-DELIVERY-PLAN.md:148-151`; JWKS/discovery edge-cached with last-good copy if D1 stalls — `WIKI guides/authentication.md:59`; vitals summary cached 5 min — `AUN docs/operations/rum.md`.
- Tokens revocation read from KV `TOKEN_REVOCATIONS` by videos services for short-lived access tokens — `WIKI guides/authentication.md:60`.
- Cache invalidation on deploy: `rev` in rendition paths makes playlists immutable per revision — `R2-DELIVERY-PLAN.md:113` (playlists 10 s, rev immutability).

## 4. Data (`/{lang}/system-design/data/`)

- R2 content-record buckets bound in api-videos (videos, profiles, channels, playlists, reports, watch-history, channel-sections, community-posts, channel-tabs, upload-defaults, subtitles, scheduled-videos ×2 bindings, global-settings) — `AUN apps/api-videos/wrangler.jsonc` r2_buckets (each with its comment); media buckets (al-ummah-now-media, -private, -originals), analytics rollups read from `al-ummah-now-messages`, admin backups `admin-backups`, CSAM evidence `al-ummah-now-csam-evidence` (encrypted, legal hold), live `al-ummah-now-live` — same file, each binding comment.
- api-videos metadata pattern: "stores metadata in R2 and D1" — `WIKI README.md:122`.
- D1 databases (production): `al-ummah-now-notifications` (notification centre + library indexes; migrations in processor), `al-ummah-now-search` (search index, migrations/search), `al-ummah-now-d1` (auth DB; api-videos reads it read-only for legacy profile restore) — `AUN apps/api-videos/wrangler.jsonc` d1_databases comments; `al-ummah-now-reports` (moderation/reports + AI usage/budget) + processor bindings — `apps/processor/wrangler.jsonc` d1_databases, `apps/admin-api/wrangler.jsonc` d1_databases; `al-ummah-now-costs` (cost-monitor + admin-api read) — `apps/cost-monitor/wrangler.jsonc`, `apps/admin-api/wrangler.jsonc` COSTS_DB; `al-ummah-now-status` (status page) — `apps/status/wrangler.jsonc`; `al-ummah-now-cms` (CMS content) — `CMS wrangler.jsonc`; auth D1 `al-ummah-now-d1` (accounts, clients, roles, refresh token store) — `AUTH apps/auth/wrangler.json` + `WIKI guides/authentication.md:46,60`.
- Search index: FTS5 per entity (videos/channels/…), Arabic normalisation in code, `popularity` column; written by api-videos on every R2 write and by the processor; backfill endpoint — `AUN apps/api-videos/migrations/search/0001_search_index.sql:1-36`; wiki `WIKI README.md:122`.
- KV namespaces: api-videos `TOKEN_REVOCATIONS` (written by auth), `HUMAN_VERIFIED` (Turnstile pass, 180-day TTL), `APP_CONFIG` (native remote config, edited in videos admin), `TUS_SESSIONS`; scheduler `SCHEDULER_LOCKS`, `SCHEDULER_METRICS`; auth `AUTH_STORAGE`, `TOKEN_REVOCATIONS`, `AUTH_THEMES`; www `FEED` (home timeline buckets) — `AUN apps/api-videos/wrangler.jsonc:203-214`, `apps/scheduler/wrangler.jsonc` kv block, `AUTH apps/auth/wrangler.json` kv block, `UI apps/www/wrangler.jsonc:46`; home timeline in weekly KV buckets — `WIKI epics/decisions.md` O28.
- Durable Objects: `WebSocketDurableObject` (socket shards `sockets:<n>`, topic directories `topic:<channel>`, admin coalescers `coalesce:admin:<topic>`, view counters `views:<videoId>:<shard>`) — `AUN apps/websocket-server/src/shards.ts:4-26`, `apps/websocket-server/wrangler.jsonc` durable_objects; `Transcoder` + `TranscodeSlots` — `apps/media/wrangler.jsonc` durable_objects; `SchedulerLock` — `apps/scheduler/wrangler.jsonc` durable_objects.
- Analytics Engine datasets: `al_ummah_now_rum` (web vitals), `al_ummah_now_abuse` (abuse counters), `auth_events` (auth analytics) — `AUN apps/web/wrangler.production.jsonc` analytics_engine_datasets, api-videos wrangler, `AUTH apps/auth/wrangler.json` env.production analytics_engine_datasets.
- Queues inventory — see §5 sources (queue names are in each wrangler `queues` block).
- Erasure/retention: GDPR retention sweep cron `17 3 * * *` in api-videos — api-videos wrangler triggers comment (`src/lib/privacy/retention.ts`); soft delete 30 days then purge — `WIKI guides/data-lifecycle.md`.

## 5. Async work (`/{lang}/system-design/async/`)

- Rule "Always async, with admin-visible errors" — `WIKI epics/decisions.md` O26; Errors page with Retry — registry `error-reporting` live.
- Queues and consumers (production, from wrangler `queues` blocks):
  - `al-ummah-now-videos`: produced by api-videos, admin-api, scheduler; consumed by processor (batch 10, retries 3, DLQ `al-ummah-now-dlq`) — api-videos/processor/admin-api/scheduler wrangler files.
  - `al-ummah-now-processing-check`: api-videos consumer (batch 10, retries 5, DLQ) — per-video encode check loop `src/lib/processing/loop.ts` (wrangler comment).
  - `al-ummah-now-admin-jobs`, `al-ummah-now-yt-import`: api-videos consumers, batch 1 (full subrequest budget per job), yt retry delay 60 s — api-videos wrangler comments.
  - `al-ummah-now-moderation`, `al-ummah-now-review-alerts`: processor consumers (moderation batch 5; alerts batch 1) — processor wrangler:82-95.
  - `al-ummah-now-dlq`: consumed by the processor itself (batch 10, retries 10, no DLQ) — processor wrangler:96 area; DLQ items surface on admin Errors page with Retry — `AUN apps/admin-api/wrangler.jsonc:118-155` (errors queue + DLQ consumed by admin-api) and `WIKI guides/video-delivery.md:28`.
  - `al-ummah-now-transcode`: media consumer (batch 1, concurrency 10, retries 8, own DLQ) — media wrangler queues.
  - `al-ummah-now-contact-mail`, `al-ummah-now-status-notify`, `auth-moderation-requests` (+dlq), `al-ummah-now-errors` (+dlq): admin-api producers/consumers — admin-api wrangler:118-155; auth moderation requests decided by auth admins — `WIKI guides/authentication.md:78`.
  - `al-ummah-cost-jobs` (+dlq): cost-monitor producer/consumer — cost-monitor wrangler queues.
  - QA-only `al-ummah-now-run-erase-qa` (E2E account erasures, concurrency 3) — api-videos wrangler.qa.jsonc comment (2026-11-11 incident note).
  - Auth: `audit-events` producer, `moderation-actions`(+dlq) consumer — `AUTH apps/auth/wrangler.json` queues.
- Cron triggers: api-videos `17 3 * * *` (GDPR sweep), `47 * * * *`, `*/10`, `* * * *` (stage: live sweep every 5 min) — api-videos wrangler:16 + env.stage:465; processor `41 3 * * *` (rollup import) + `17 * * * *` — processor wrangler:31; scheduler every minute (stage every 5) — scheduler wrangler:17,120; admin-api `*/5` + `17 3`; status `*/2` + `40 3`; cost-monitor `10 * * * *` + `30 3`; auth `0 * * * *` + `*/10` (production env) — each wrangler `triggers`.
- Scheduler: publishes scheduled videos through queue `al-ummah-now-videos`, `SchedulerLock` DO + KV locks/metrics, batch 50, retries 3 — `AUN apps/scheduler/wrangler.jsonc` (bindings + vars), `WIKI README.md` map edge `scheduler --> queues`.
- Queue consumers are registered by a release script because version promotion does not register them — `WIKI guides/release-process.md:66`.
- Messages archive: processor vars `MESSAGE_ARCHIVE=all` (production) into `al-ummah-now-messages` bucket — processor wrangler vars + MESSAGES_BUCKET binding.

## 6. Realtime (`/{lang}/system-design/realtime/`)

- Worker `al-ummah-now-comms` on `realtime.alummahnow.net`, WebSocket endpoint `/ws`, health at `/health` reporting the version id — `AUN apps/websocket-server/wrangler.jsonc` (name, routes env), `src/index.ts:78-110`.
- A random shard takes the socket; full shard 503 → next shard — `AUN apps/websocket-server/src/index.ts:101-115`; shards `sockets:<n>`, default 8, max 64 — `src/shards.ts:26-30`.
- Topic directories `topic:<channel>` forward broadcasts only to shards with a subscriber; fallback to all-shards (big batch, dead directory, rollout) — `src/shards.ts:1-24`; routing state in `GET /stats` (`topic` vs `all-shards`) — `src/index.ts:247-249`.
- Hibernation API: per-socket state in attachments (<2 KiB, ≤12 channels) — `AUN docs/architecture/SCALABILITY-AUDIT.md` "Realtime (WS-1..WS-6)" section (lines 87-133).
- Admin updates coalesced per topic (`coalesce:admin:<topic>`, at most one per second) — `src/index.ts:167-203`, `admin-coalescer.ts`.
- View counter: `views:<videoId>:<shard>` (4 shards), DO-serialised increments, CAS write-back to the video JSON at most every 10 s, self-healing rewrites, exact-count test with 1000 parallel views — `SCALABILITY-AUDIT.md` "View counter (AV-1)" (lines 33-59); cross-script binding from api-videos — api-videos wrangler:40-43.
- Rate limits: `WS_CONNECT_LIMITER` 120/min per IP, `WS_MESSAGE_LIMITER` 600/min — websocket-server wrangler ratelimits.
- Auth: tokens verified against the issuer; admin channels gated by token roles; revocation KV checked — websocket-server wrangler TOKEN_REVOCATIONS + `src/auth.ts`, `token-revocation.ts`; `WIKI guides/authentication.md:63`.
- Consumers: live viewers per video (`live-viewers.ts`, LIVE_VIEWER_LIMITER 60/min per IP in api-videos), QoE beacons live (`qoe-live.ts`), post view counter (`post-view-counter.ts`) — websocket-server src file list + api-videos ratelimits comments.

## 7. Identity & security (`/{lang}/system-design/identity/`)

- Components and hosts — `WIKI guides/authentication.md:13-19`; auth depends on no app — lines 7-9.
- OAuth 2.0/OIDC with PKCE (S256) required for first-party web clients; public clients must send PKCE; auth admin is a confidential client — `guides/authentication.md:41-44`.
- Access tokens 15 min (`ACCESS_TOKEN_TTL 900` production) — `AUTH apps/auth/wrangler.json:158` + `guides/authentication.md:58`; legacy 30-day tokens rejected — line 64.
- Refresh rotation in atomic D1 store; reuse revokes that token family — `guides/authentication.md:46`.
- Revocations in D1 + KV; videos services read the KV copy — `guides/authentication.md:60`.
- Signing-key rotation without sign-out (publish-1 h-sign-1 day-retire; job queue + DLQ; hourly cron; 90-day successor where scheduled) — `guides/authentication.md:61-62`.
- Per-device sign-out via `sid` — `guides/authentication.md:63`.
- Sessions: auth host multi-account browser session + account picker; per-app sessions; front-channel logout across apps — `guides/authentication.md:67-73`; FRONTCHANNEL_LOGOUT_URLS lists all six apps — `AUTH apps/auth/wrangler.json:163` area.
- Passkeys: prompt on in production (`PASSKEY_PROMPT on`), native passkey rate limiter — `AUTH apps/auth/wrangler.json:146`, ratelimits; registry `passkeys` live, `staff-passkeys` rolling.
- Roles: site roles in auth RBAC (Member, Scholar, Moderator, Admin, Super Admin) issued in tokens; channel roles (owner/admin/editor/moderator, ≤50 members) in the R2 channel record, never in tokens; `can(role, capability)` matrix — `WIKI guides/roles.md:7-35`; ownership transfer only by super admin — lines 45-49.
- Auth admins decide account actions via moderation-request queue from the videos admin — `guides/authentication.md:78`, admin-api AUTH_REQUESTS_QUEUE.
- Rate limiters on auth endpoints (token, send-code, password IP/email, admin, native passkey) — `AUTH apps/auth/wrangler.json` ratelimits; Workers Rate Limiting binding not KV — `guides/authentication.md:52`.
- Bot protection: Turnstile `monitor` in production (auth + api-videos vars), human-verified KV 180-day, Abuse page — api-videos vars TURNSTILE_MODE/SITE_KEY, `WIKI guides/bot-protection.md`.
- Worker-to-worker auth: `INTERNAL_API_KEY` (Secrets Store) on api-videos, admin-api, processor, websocket-server, scheduler, status, cost-monitor, short-links, media — each wrangler secrets_store_secrets.
- CSAM evidence encrypted AES-256-GCM in `al-ummah-now-csam-evidence`, legal hold — api-videos wrangler CSAM comments; registry `csam-intake` live.

## 8. AI usage (`/{lang}/system-design/ai/`)

- Moderation (registry `ai-moderation` rolling): Workers AI only; translate `@cf/google/gemma-4-26b-a4b-it`, guard `@cf/meta/llama-guard-3-8b`, extensions `@cf/google/gemma-4-26b-a4b-it` — `AUN apps/processor/src/moderation/pricing.ts:8-14`; Arabic → English translation before Llama Guard — `src/moderation/ai.ts:49-60`; runs in production in shadow mode since v2026.11.08.4, holding is a per-category admin setting — `WIKI epics/E28-ai-moderation.md:9`; policies default shadow, spam/charity_scam may hide, religious_authenticity flag-only and disabled — `src/moderation/config.ts:17-40`; kill switch env + D1 `moderation_config` — config.ts:1-12,80-90.
- Budgets: daily neuron cap reserved before calls and settled after (`ai_budget_daily`, conditional UPDATE) — `AUN apps/processor/src/moderation/budget.ts:1-30`; production caps `AI_MODERATION_DAILY_NEURON_CAP 100000`, `AI_CATEGORIZE_DAILY_NEURON_CAP 20000` — `apps/processor/wrangler.jsonc:125,128`; default cap 10 000 — config.ts:17; prices in neurons with catalog citations — pricing.ts:1-40.
- Tests never call Workers AI (mock binding; fixture providers) — `src/moderation/ai.ts:1-8`; captions "fixture" provider — `src/captions/job.ts:73`; review fixture provider with title markers — `WIKI epics/AUN-VIDEO-REVIEW…:293-300`.
- Transcripts (registry `transcripts` live): Whisper `@cf/openai/whisper-large-v3-turbo` — `AUN apps/api-videos/src/lib/captions/jobs.ts:41`; nothing automatic, draft-first, creator confirms — `WIKI epics/AUN-CAPTIONS…:18-22`; Quran zero-mistake rules (official Uthmani text for confirmed spans; uncertain → reference only; never machine-translated or spoken) — same file "Goal"; Quran text from Quran Foundation only, fetched live, edge cache ≤6 days — recommendation table + `AUN apps/processor/src/quran/`; Quran-aware matcher in review — `apps/processor/src/quran/review-matcher.ts:1-14`.
- Caption translation (building): DeepSeek `@cf/deepseek-ai/deepseek-v4.1-flash-1017` — `AUN packages/shared-types/src/caption-translation.ts:20`; DeepL API Pro priced — pricing.ts:30-33; per-language queue, counted in caption minutes — `WIKI epics/AUN-CAPTIONS…` status line (in review #1398).
- Category suggestions (registry `content-categories` live): `@cf/meta/llama-4-scout-17b-16e-instruct` — `AUN packages/shared-types/src/category-suggestion.ts:22`.
- Pre-publication review (registry `video-review` rolling): frames `@cf/cloudflare/clef-flash`, transcript whisper-turbo, plus Gemma 4 and Llama Guard checks — `AUN packages/shared-types/src/video-review.ts:181-183`, `WIKI epics/AUN-VIDEO-REVIEW…:81-93,313-315`; open-weight models only, no proprietary APIs — same epic:18-23; frames/transcripts kept 30 days, signals 12 months — :215-219.
- Inline title/description translation runs in the processor (Workers AI, AI budget) — `AUN apps/api-videos/wrangler.jsonc` services comment (AUN-CAPTIONS §5.8).
- CMS AI writing assist (registry `cms-ai-assist` live) on the CMS Workers AI binding — `CMS wrangler.jsonc` `ai` binding + registry.
- Owner decision O5 "AI moderation on Cloudflare" — `WIKI epics/decisions.md` O5.

## 9. Cost (`/{lang}/system-design/cost/`)

- Whole-platform cap ≤ $500/month — `WIKI epics/decisions.md` O1 ("more than 500 a month … is a no go") and D2; `WIKI guides/video-delivery.md:90` ("must stay under $500/month"). ⚠ wording decision: the dev-site epic's rule says "without quoting the figure" (`WIKI epics/AUN-DEV-SITE…` Costs bullet) — flagged for the orchestrator.
- Transcode on Containers billed per second while a job runs, not a VPS — O31 (`WIKI epics/decisions.md`); instances that are not running cost nothing — `AUN apps/media/wrangler.jsonc` comment.
- VPS ruled out: "NOT possible without major refactoring" — `AUN docs/INFRASTRUCTURE_COST_ANALYSIS.md:32-34` (historic analysis, cited as such).
- Observability economy: LOG_LEVEL warn in production, no invocation logs, head sampling 1 (errors kept) — `AUN docs/operations/logging.md:9-30` + wrangler observability blocks; "a chatty level is quickly the biggest line on the bill" (QA ~10M req/day) — logging.md:26-29.
- RUM sampled 1 page load in 20 — `AUN docs/operations/rum.md`; Analytics Engine includes 10M data points/month on Workers Paid — rum.md "Cost".
- E2E economy: other E2E accounts never transcoded to save container time; a transcode must start within 2 min — `WIKI guides/video-delivery.md:30`; QA usage cut (#863) — `WIKI epics/AUN-COST…` status note.
- Originals retention bounded (30/90 days) — api-videos vars (above).
- Dev site itself: static assets, no Worker script, idle site costs nothing — `UI apps/dev/wrangler.jsonc:1-3` + `WIKI epics/AUN-DEV-SITE…` Hosting table.
- Cost monitoring (registry `cost-budget` live): cost-monitor worker collects platform analytics hourly (`10 * * * *`) for production, stage, QA into D1 `al-ummah-now-costs`; Costs page month-to-date vs budget, forecast, products, environments, top movers; budget/spike/weekly-digest alerts opt-in by email; read-only Cloudflare token set by super admin, AES-GCM sealed; queue with retry + DLQ — `AUN apps/cost-monitor/wrangler.jsonc` (crons, COLLECT_ENVS, queues, COSTS_DB) + `WIKI epics/AUN-COST-cost-monitoring.md` (COST-1 #1400). Per-channel cost later — O24.
- AI spend bounded by daily neuron caps (above, §8).
- Workers static-assets requests not billed as Worker invocations — `apps/dev/wrangler.jsonc:1-3`.

## 9a. Pipeline costs, stage by stage (cost diagram on Video pipeline and Cost; AI meters on the overview and pipeline)

Owner request 2026-11-19: show each stage's rate and the running cost of both pipelines. Code:
`apps/dev/src/lib/arch/cost.ts` (every constant carries its source); tests `apps/dev/tests/cost.test.ts`
pin it to the sources below. Read at AlUmmahNow origin/main and AlUmmahNowWiki origin/main on 2026-11-19.

| Rate | Value | Source |
|---|---|---|
| Container `standard-4` per instance-second | 4 × $0.00002 (vCPU) + 12 × $0.0000025 (GiB) + 20 × $0.00000007 (GB disk) = $0.0001114 → about $0.40 per busy slot-hour | `AUN apps/api-videos/src/lib/media/costs.ts` `PRICES.containerInstanceSecond`; `apps/admin-api/src/lib/opsCost.ts:23`; `docs/media-delivery/RUNBOOK.md` ("about $0.40 an hour … same as lib/media/costs.ts") |
| Container-seconds per video-minute | 45 (≈ 0.75× real time) | `AUN apps/admin-web/src/app/(protected)/delivery/metrics.ts` `ASSUMED`; `docs/media-delivery/R2-DELIVERY-PLAN.md` "Cost model" |
| R2 storage / Class A / Class B / egress | $0.015 per GB-month · $4.50 per million · $0.36 per million · $0 | `lib/media/costs.ts` `PRICES`; `apps/cost-monitor/src/pricing.ts`; R2-DELIVERY-PLAN.md "Cost model" |
| Stored ladder, writes, reads, delivered | 0.04 GB and 40 writes per video-minute; 72 reads and 0.9 GB per viewer-hour | admin `delivery/metrics.ts` `ASSUMED` (same as the plan) |
| Bunny storage / delivery / encoding | $0.01 per GB-month per region × 2 regions · $0.01 per GB ($0.005 on the volume network) · encoding free | `lib/media/costs.ts` `PRICES`; admin `delivery/metrics.ts` `PRICES`; R2-DELIVERY-PLAN.md "Cost model" |
| Workers requests · Queues operations · Durable Object requests | $0.30 · $0.40 · $0.15 per million (Queues billed 3 operations per message) | `AUN apps/cost-monitor/src/pricing.ts:10-27,67` |
| Workers requests included | 10M a month (account allowance) | `AUN docs/cost-monitoring/README.md:323` |
| Workers AI | $0.011 per 1,000 neurons; first 10,000 neurons a day free | `AUN apps/processor/src/moderation/pricing.ts` (`USD_PER_NEURON`, citing developers.cloudflare.com/workers-ai/platform/pricing, checked 2026-11-08); admin-web `i18n/messages/en.ts:554` |
| Moderation scan neurons | Gemma 4 translate + one Llama Guard 3 run + Gemma 4 extensions, prompt sizes 450 / 700, outputs 20 / 300: ≈ 83 neurons for the example's 300-token title and description | `AUN apps/processor/src/moderation/budget.ts:15-31` + `pricing.ts` (neurons per M tokens) |
| Whisper transcription | $0.000513 per audio minute (`@cf/openai/whisper-large-v3-turbo`) | `pricing.ts`; `WIKI epics/AUN-VIDEO-REVIEW-pre-publication-review.md:93` |
| Pre-publication review | about $0.075 per video-hour (frames, stage 2, Whisper, text) — rolling out | `WIKI epics/AUN-VIDEO-REVIEW-pre-publication-review.md` "Cost and latency" (lines 144-156) |
| Quran detection | no AI call: the transcript is matched in code against the synced Quran index | `AUN apps/processor/src/quran/review-matcher.ts:1-9` |
| Thumbnails | R2 path: two FFmpeg stills inside the same container job (no extra line); Bunny makes its own | `AUN apps/media/container/ladder.mjs:150-151`, `server.mjs:524-525` |
| Originals kept | $0.015 per GB-month, 30–90 days | R2 price above; api-videos vars `ORIGINALS_RETENTION_DAYS`/`ORIGINALS_MAX_DAYS` |
| Transcoder reads our original first | Bunny's copy only if ours is unreadable | `AUN apps/media/src/transcoder.ts:58-69` |

Examples (not platform figures): one 10-minute video watched in full 1,000 times and kept a month; and
the admin cost page's **small** (20 h uploaded, 2,000 viewer-hours) and **medium** (200 h, 50,000
viewer-hours) presets, storage shown for the month after 12 months of uploads — `delivery/metrics.ts`
`SCALES` and `projectMonthlyCost`. **Unknown, left out of totals:** the cost of keeping originals (the
model doesn't track upload file sizes), and per-upload lines at scale (moderation scans, queue and slot
requests: the presets give hours, not uploads). The site never quotes `lib/media/costs.ts`'s account or
zone ids.

## 10. Scaling (`/{lang}/system-design/scaling/`)

- Workers/Queues/DO scale automatically per request/message; the platform's own scaling work is about *correctness under many copies at once* — `AUN docs/architecture/SCALABILITY-AUDIT.md:1-12`.
- Fixed designs: view counter shards (above §6), analytics rollups into D1 with `INSERT … ON CONFLICT DO UPDATE` batch upserts (≤500 rows/statement, dims capped at 50), legacy R2 rollup import cron — SCALABILITY-AUDIT.md "Analytics rollups (PR-1)" (lines 61-85).
- Realtime sharding and hibernation — SCALABILITY-AUDIT.md "Realtime (WS-1..WS-6)" (lines 87-133).
- Blind-writer defects catalogue (R2 JSON CAS, channel subscriptions, playlists, community posts/comments, handle claim, KV limiter, stale-index stampede, full-bucket scans vs 1000-subrequest budget, D1 write amplification on the view path) — SCALABILITY-AUDIT.md defect list headings (lines 134-505); "Fixed designs" section says what shipped (#504, #505, #507, #674).
- Transcode concurrency: admin min–max under the container ceiling 3371 (account quota: 15 000 vCPU account-wide shared, 10% headroom, stage+QA 16, (15000×0.9−16)/4 = 3371; quota checked before every release by `scripts/release/container-quota.ts`) — `AUN apps/media/wrangler.jsonc:20-32` comment; slots DO enforces the admin range — `apps/media/src/slots.ts`.
- Queue consumer concurrency (media transcode 10 per env; erasures 3 on QA) — wrangler queues blocks.
- Subrequest budget awareness: admin jobs run one per invocation "each gets the full subrequest budget" — api-videos wrangler comment; AV-16 full-bucket scans — SCALABILITY-AUDIT.md.
- Skew protection keeps pages open during deploys working — `WIKI guides/release-process.md:71`.
- Wiki scalability epic (audit page) — `WIKI epics/AUN-SCALABILITY-scalability-audit.md` (status/links).

## 11. Clients (`/{lang}/system-design/clients/`)

- Videos site: Next.js (OpenNext) on Workers — above §1; watch pages, Studio, channels — registry `videos-site`, `creator-studio` live.
- www + scholar sites: Astro on Workers, shared render package, themes — `UI apps/www/wrangler.jsonc`, `apps/sites` (this repo), registry `www-and-sites` live, `scholar-sites` ready.
- Admin: Next.js admin-web — `AUN apps/admin-web/wrangler.production.jsonc`; registry `videos-admin` live.
- Native apps (building; none in a public store): Apple Swift, Android Kotlin, Desktop C# (WinUI 3 / GTK 4 per the brief; local checkout absent — describe from `WIKI repos/*` pages only), shared Rust core — `WIKI repos/AlUmmahNowApple.md`, `AlUmmahNowAndroid.md`, `AlUmmahNowDesktop.md`, `AlUmmahNowCore.md`; registry `native-apps`, `rust-core` building; pre-releases on GitHub (technology page current copy, registry label).
- Viewer + Studio app pair, TV apps — `WIKI epics/decisions.md` O2.
- Native remote config from videos admin (APP_CONFIG KV, Epic 9.5, #413) — api-videos wrangler kv comment; registry `remote-config-editor` building.
- Device authorization grant for TVs from the openauth fork — `WIKI guides/authentication.md:47`.
- AlUmmahNowTools bulk importer (.NET) uploads to Bunny and R2 — `WIKI README.md:99-101` (map edges) + `repos/AlUmmahNowTools.md`.
- Embeds + oEmbed + short links — registry `embeds`, `short-links` live.
- One header/account menu across apps — registry `shared-header` live.

## 12. Release & quality (`/{lang}/system-design/release/`)

- No hand deploys; QA on merge to main; production only from `vYYYY.MM.DD[.N]` tags (US Eastern date rule) — `WIKI guides/release-process.md:5-18,24-31`.
- Gates: stage deploy+migrations+smoke, stage E2E (deployed specs), local E2E on the tagged commit (own stack per job), secrets checks stage+production — `guides/release-process.md:50-61`; E2E mostly local now, QA only on numbered releases — `WIKI guides/environments.md:45` + `guides/testing.md`.
- Flow: tag → build once → stage → production candidate at 0% smoke → 100% smoke → automatic rollback; rollback dry run after every promote — `guides/release-process.md:33-48,70`.
- Media app released after the others with its own smoke and rollback; one real transcoder container must start (≤60 s) or the media Worker rolls back; CDN settings applied as code — `guides/release-process.md:65`, `WIKI guides/video-delivery.md:29-30`.
- Auth releases on every merge to main with the same stage → 0% → 100% shape; local-stack bundle published per commit for the monorepo's local E2E — `guides/release-process.md:89-99`.
- Monorepo workflow files (release.yml, rollback.yml, local-e2e.yml, e2e-tests.yml, release-e2e.yml, player-e2e.yml, admin-e2e.yml, secrets-check.yml, prod-errors.yml, media-cdn.yml, …) — `AUN .github/workflows/` directory listing.
- Migrations expand-only before traffic; queue consumers registered by script; translation store sync each deploy; production signed-in check with throwaway accounts then test-data check — `guides/release-process.md:66-79`.
- Status page checks every 2 min, incidents + maintenance, email/webhook subscriptions building — `AUN apps/status/wrangler.jsonc:16`, registry `status-page` live / `status-subscriptions` building.
- Dev site pipeline (this site): PR CI (lint, typecheck, unit, config check, build, Playwright + axe vs `wrangler dev`), QA on main, tag → stage → production with rollback; jobs separate from www/sites — `WIKI epics/AUN-DEV-SITE…` Hosting "Pipeline"; `UI .github/workflows/` (ci.yml, deploy-qa.yml, release.yml, rollback.yml, dev-registry.yml).

---

### Sources for the audit of the current Technology / Infrastructure pages

- Current copy: `UI apps/dev/src/i18n/en.ts` (`technology`, `infrastructure`, `community`, `home` blocks) at `d5f838d`; rendered by `apps/dev/src/pages/[lang]/technology/index.astro` and `.../infrastructure/index.astro`.
- Registry cross-check: `WIKI features/registry.json` at `efdf459` (statuses quoted in the audit).
- Claim-by-claim verification references are inline in `SYSTEM-DESIGN-OUTLINE.md` §0.
