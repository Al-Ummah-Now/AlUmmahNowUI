/**
 * English copy for alummahnow.dev. ar.ts has exactly the same keys (tests/i18n.test.ts).
 *
 * Every claim here comes from the code on main, the wiki, or the owner's words (wiki AUN-DEV-SITE
 * §Wording rules). No user counts, money figures or dates that aren't already in the wiki. Plans are
 * not described: the site shows only what exists and runs today. docs/SOURCES.md records where each
 * technical claim comes from; the pages themselves carry no citation lists.
 */
import { WIKI, GH, VIDEOS, WWW, STATUS_PAGE } from '../lib/links.ts';
import { diagramsEn } from './diagrams.en.ts';

export type Status = 'live' | 'ready' | 'rolling' | 'building' | 'planned';
/** A feature's status is never written here: `feature` is its id in the wiki's feature registry (src/lib/registry.ts). */
export interface Link {
  label: string;
  href: string;
}
export interface Item {
  title: string;
  body: string;
  feature?: string;
}

export const en = {
  meta: {
    siteName: 'Al Ummah Now',
    siteNameAlt: 'الأمة الآن',
    description:
      'Al Ummah Now is an Islamic video-sharing community in Arabic and English. How it works and how it is built, for developers and partners.',
  },
  nav: {
    skip: 'Skip to content',
    primary: 'Main',
    home: 'Home',
    community: 'Community',
    technology: 'Technology',
    infrastructure: 'Infrastructure',
    'system-design': 'System design',
    'open-source': 'Open source',
    contact: 'Contact',
    /** The header lockup's second line (NAV.md: every app but www names itself) */
    appName: 'Developers',
  },
  status: {
    live: 'Live',
    ready: 'Ready, not in use yet',
  },
  common: {
    external: '(opens another site)',
  },
  footer: {
    // www's tagline (apps/www/src/content/fallback/en.ts) and rights line
    tagline: 'Share what matters to the Ummah',
    rights: '© {year} Al Ummah Now',
    line: 'An Islamic video-sharing community in Arabic and English.',
    sites: 'Our sites',
    project: 'The project',
    wiki: 'Wiki',
    github: 'GitHub',
    status: 'Status',
    www: 'www.alummahnow.net',
    videos: 'videos.alummahnow.net',
    note: 'Facts on this site come from our code and our public wiki. If they disagree, the code is right.',
  },

  home: {
    title: 'Al Ummah Now',
    description:
      'An Islamic video-sharing community: share videos and news without censorship, interact and get educated, in Arabic and English. Built in the open on Cloudflare.',
    heroTitle: 'An Islamic video-sharing community, built in the open',
    heroLead:
      'Al Ummah Now is a place for the Ummah to share videos and news without censorship, to interact, and to get educated, in Arabic and English. This site explains what it is for and how it is built.',
    ctaDevelopers: 'How it is built',
    ctaPartners: 'Talk to us',
    pillarsTitle: 'What the community is for',
    pillars: [
      { title: 'Share videos', body: 'Channels upload videos and Shorts, post updates and build playlists.' },
      { title: 'Share news without censorship', body: 'A place to share what is happening, with published rules, open reporting and people, not algorithms, making the final call.' },
      { title: 'Interact', body: 'Comment, subscribe, get notified and share anywhere with embeds and short links.' },
      { title: 'Get educated', body: 'Channels share Quran recitation, Tafsir, Fiqh and talks, and scholars can have their own sites.' },
    ],
    pillarsMore: 'More about the community',
    /** Each item names its registry feature: only `live` ones are listed as live today, `ready` ones under readyTitle. */
    liveTitle: 'Live today',
    readyTitle: 'Ready, not in use yet',
    readyLead: 'Shipped to production and ready to use, but nothing there uses it yet.',
    live: [
      { title: 'www.alummahnow.net', body: 'The public site: the home timeline, articles and video rails.', href: WWW, feature: 'www-and-sites' },
      { title: 'videos.alummahnow.net', body: 'Watch, upload, comment and subscribe.', href: VIDEOS, feature: 'videos-site' },
      { title: 'Scholar sites', body: 'White-label sites for scholars on alummahnow.org, run from the same platform.', href: '/en/technology/#feature-scholar-sites', feature: 'scholar-sites' },
    ],
    systemTitle: 'The system at a glance',
    systemLead: 'Code runs on Cloudflare Workers and transcoding on Cloudflare Containers. One sign-in service serves every app.',
    systemLayers: [
      { title: 'People and apps', body: 'Browsers, and native apps for phones, TVs and desktops' },
      { title: 'Sign-in', body: 'One single sign-on service for every app, with passkeys' },
      { title: 'Sites', body: 'www, the videos site, scholar sites, the CMS and the admin' },
      { title: 'APIs and workers', body: 'Videos API, admin API, background processing, realtime updates, scheduler' },
      { title: 'Data and media', body: 'D1 databases, R2 file storage, the KV key-value store and Queues; FFmpeg on Cloudflare Containers; Bunny.net' },
    ],
    systemMore: 'See the system design',
    audiencesTitle: 'Where to start',
    developers: {
      title: 'Developers and contributors',
      body: 'Every repository is public on GitHub, with a wiki that explains how the pieces fit together.',
      links: [
        { label: 'Technology', href: 'technology' },
        { label: 'Infrastructure and video pipeline', href: 'infrastructure' },
        { label: 'System design', href: 'system-design' },
        { label: 'Repositories and contributing', href: 'open-source' },
      ],
    },
    partners: {
      title: 'Investors, donors and partners',
      body: 'What the platform is for, what exists today, and how we want it to be held for the community.',
      links: [
        { label: 'The community', href: 'community' },
        { label: 'Contact', href: 'contact' },
      ],
    },
  },

  community: {
    title: 'The community',
    description:
      'Share videos and news without censorship, interact and get educated, in Arabic and English. What the Al Ummah Now community is for and how moderation works.',
    heroTitle: 'A community to share, talk and get educated',
    heroLead:
      'Al Ummah Now is a content-sharing site: channels publish videos, Shorts, posts and playlists, and viewers watch, comment, subscribe and share. Everything works in Arabic and English.',
    sections: [
      {
        id: 'share',
        title: 'Share videos',
        lead: 'Channels publish in every format the platform supports.',
        items: [
          { title: 'Videos and Shorts', body: 'A Short is three minutes or less and vertical or square; the uploader can override it.', feature: 'videos-and-shorts' },
          { title: 'Live streams', body: 'Studio Live, Go live and the live watch page are built and in a release. Production cannot take a stream yet: Bunny Stream Live is still waiting for preview access, and the self-hosted edge has no production host and no RTMP ingest.', feature: 'live-streams' },
          { title: 'Posts, playlists and channel sections', body: 'Community posts, personal and unlisted playlists, and channel pages arranged in sections.', feature: 'posts-playlists-sections' },
          { title: 'Uploads by invitation', body: 'Uploading and creating channels are invite-only. Admins give creators a tier.', feature: 'creator-tiers' },
        ] as Item[],
      },
      {
        id: 'news',
        title: 'Share news without censorship',
        lead:
          'People should be able to share what is happening to the Ummah without it quietly disappearing. That is the aim. In practice it means clear rules, open reporting, and people, not automated systems, making the decisions.',
        items: [
          { title: 'Published rules', body: 'The Community Guidelines are public in Arabic and English. They are the rules; there is no hidden list.', feature: 'community-rules' },
          { title: 'Anyone can report', body: 'Videos, comments and channels can be reported, with bot protection on the report form.', feature: 'reporting' },
          { title: 'AI holds, people decide', body: 'Automated moderation never deletes anything. It can only hold content for a person to review. In production it runs in shadow mode: it records what it would hold, and an admin switches holding on per category.', feature: 'ai-moderation' },
          { title: 'No tolerance for child abuse material', body: 'It is removed, the evidence is preserved under a legal hold, and it is reported to the authorities.', feature: 'csam-intake' },
        ] as Item[],
      },
      {
        id: 'interact',
        title: 'Interact',
        lead: 'Talking to each other is the point of a community.',
        items: [
          { title: 'Comments and subscriptions', body: 'Comment and subscribe as yourself, without needing a channel of your own.', feature: 'comments-subscriptions' },
          { title: 'Notifications', body: 'A bell for new videos from channels you subscribe to, with a badge that clears on every device when you open it.', feature: 'notifications' },
          { title: 'Embeds', body: 'Videos, Shorts and playlists can be embedded on other sites, with oEmbed and a share dialog.', feature: 'embeds' },
          { title: 'Short share links', body: 'Short links on alummahnow.link for videos, channels, posts and playlists.', feature: 'short-links' },
        ] as Item[],
      },
      {
        id: 'learn',
        title: 'Get educated',
        lead: 'Much of what channels share is there to learn from. The platform keeps the creators’ own words and categories.',
        items: [
          { title: 'Content categories', body: 'Categories such as Tafsir, Fiqh, Quran recitation and Islamic Lectures keep their names.', feature: 'content-categories' },
          { title: 'Scholar pages and scholar sites', body: 'Scholar pages on www, and white-label sites for scholars on alummahnow.org.', feature: 'scholar-sites' },
          { title: 'Transcripts and captions', body: 'Creators transcribe their videos in Studio, with caption minutes set by their tier. Quran passages are matched to the official text and confirmed by the creator.', feature: 'transcripts' },
        ] as Item[],
      },
      {
        id: 'languages',
        title: 'Arabic and English, everywhere',
        lead: 'Every screen exists in both languages, and Arabic is right-to-left throughout, not a translated afterthought.',
        items: [
          { title: 'Both languages on every app', body: 'The public site, the videos site, sign-in, the CMS and the native apps.', feature: 'bilingual' },
          { title: 'One vocabulary', body: 'The same words in every app, so a viewer never meets two names for one thing.' },
        ] as Item[],
      },
    ],
  },

  technology: {
    title: 'Technology',
    description:
      'How Al Ummah Now is built: Cloudflare Workers, Next.js and Astro, an OpenAuth-based single sign-on with passkeys, a bknd CMS, native apps on a shared Rust core, and the Fanous design system.',
    heroTitle: 'One platform, many apps, all on Cloudflare',
    heroLead:
      'Al Ummah Now’s code runs on Cloudflare Workers and its transcoding on Cloudflare Containers. The apps share one sign-in service, one design system and one set of rules for how background work is done.',
    groups: [
      {
        title: 'Web apps',
        items: [
          { title: 'Videos site', body: 'Next.js on Cloudflare Workers: watch pages, Studio, channels and the creator tools.', feature: 'videos-site' },
          { title: 'Public site and scholar sites', body: 'Astro on Workers, sharing one rendering package and the same themes.', feature: 'www-and-sites' },
          { title: 'Admin', body: 'Staff tools with live updates over a realtime Worker, a contact inbox, a delivery dashboard and an errors page with Retry.', feature: 'videos-admin' },
          { title: 'CMS', body: 'bknd on a Worker, with our own admin screens in place of bknd’s. It runs the www pages, articles and the home timeline.', feature: 'cms' },
        ] as Item[],
      },
      {
        title: 'Identity',
        items: [
          { title: 'Single sign-on', body: 'Our fork of OpenAuth: OAuth 2.0 and OpenID Connect with PKCE, a one-time proof that makes an intercepted sign-in code useless. Sign in once and you are signed in on every app; sign out ends it everywhere.', feature: 'sso' },
          { title: 'Short-lived tokens', body: 'Access tokens last {accessTokenMinutes} minutes. Refresh tokens rotate, and reusing an old one revokes the whole family.', feature: 'short-lived-tokens' },
          { title: 'Passkeys', body: 'Passkey sign-in is live on the web and in the native apps. Requiring passkeys for staff is built and stays off until a super admin switches it on.', feature: 'passkeys' },
        ] as Item[],
      },
      {
        title: 'Native apps',
        items: [
          { title: 'Shared Rust core', body: 'API client, sign-in, sync, uploads and a media engine in Rust, with bindings for Swift, Kotlin and C#.', feature: 'rust-core' },
          { title: 'Studio pre-releases', body: 'Studio, the creator app, has pre-releases for Android and desktop on GitHub.', feature: 'native-apps' },
        ] as Item[],
      },
      {
        title: 'Design and AI',
        items: [
          { title: 'Fanous design system', body: 'Four themes built on the lantern identity, one set of tokens for web and native, and contrast checked in every theme.', feature: 'fanous-themes' },
          { title: 'AI moderation on Cloudflare', body: 'Workers AI checks content and can only hold it for review. Production runs it in shadow mode.', feature: 'ai-moderation' },
          { title: 'Transcripts', body: 'Transcription runs as background jobs, and Quran passages are matched against a local index of the official text before the creator confirms them.', feature: 'transcripts' },
        ] as Item[],
      },
    ],
    features: {
      title: 'Every feature and where it stands',
      lead: 'Built from the feature registry in the wiki, the project’s source of record. Each status is the registry’s own. Live means in production and in use; ready means shipped to production with nothing using it yet. Both name the production release they shipped in.',
      source: 'Feature registry, wiki commit {sha}',
      before: 'before {tag}',
      wiki: 'Wiki',
    },
    systemLink: { label: 'See the whole system on one diagram', href: 'system-design' },
    principlesTitle: 'How we build',
    principles: [
      { title: 'Always asynchronous', body: 'Heavy work goes through queues with retries and dead-letter queues. When something fails, it shows up on the admin Errors page with a Retry button.' },
      { title: 'Spec, then plan, then code', body: 'Features start as a spec in the wiki, then a plan, then pull requests with tests.' },
      { title: 'Privacy by default', body: 'Deletes can be undone for {undoDays} days and are then purged. Accounts can be erased. Site visits are counted without cookies or IDs.' },
      { title: 'Accessible in both directions', body: 'Keyboard and screen-reader use, AA contrast in every theme, and menus that never leave the screen, in left-to-right and right-to-left.' },
    ] as Item[],
  },

  infrastructure: {
    title: 'Infrastructure and video pipeline',
    description:
      'How a video travels from upload to playback on Al Ummah Now: Bunny Stream and our own FFmpeg transcoding on Cloudflare Containers into R2, one play URL chosen by the API, and releases through QA and stage.',
    heroTitle: 'From upload to playback',
    heroLead:
      'Every upload is encoded twice: by Bunny Stream, and by our own transcoder into Cloudflare R2. The API chooses which one each play uses, so we can compare speed and cost on real traffic before switching.',
    pipelineTitle: 'The video pipeline',
    pipelineLabel: 'The steps a video takes, from upload to playback',
    pipeline: [
      { title: 'Upload', body: 'The creator uploads through the videos API with resumable uploads (TUS).' },
      { title: 'Two copies', body: 'The upload goes to Bunny Stream, and our own original is kept in private R2 storage.' },
      { title: 'Transcode', body: 'A queue starts FFmpeg on Cloudflare Containers, which writes HLS renditions (streams cut into short segments) to R2.' },
      { title: 'Choose', body: 'The API returns one play URL: Bunny, R2 or a split by percentage, set on the admin Delivery page.' },
      { title: 'Play', body: 'Players play that URL. After a fatal error or a {stallSeconds}-second stall on R2, they fall back to Bunny once.' },
    ],
    deepLink: { label: 'The pipeline on one diagram, stage by stage', href: 'system-design/video-pipeline' },
    details: [
      { title: 'Two providers, side by side', body: 'Bunny and R2 both run in production behind an admin switch, and production plays Bunny first. Players report startup time, rebuffering and errors for each, and the admin compares them before deciding whether to switch. The switch itself is growing into a general provider model — priority or weighted order, per channel, per video — built and not in use yet.', feature: 'media-providers' },
      { title: 'Signed, never stored', body: 'Playback URLs are signed for each response and never saved. Share images stay on our own domain so previews on social networks don’t break.', feature: 'signed-urls' },
      { title: 'Two live providers, not on production yet', body: 'Bunny Stream Live and a self-hosted path are built to run together and share new streams, so the choice can be made on data. Neither takes production streams yet: Bunny Live is a closed preview our libraries are not admitted to, and the self-hosted edge takes HTTPS push only and has no production host.', feature: 'live-streams' },
      { title: 'Failures are visible', body: 'A failed transcode is recorded with where and why. After three attempts it appears on the admin Errors page with Retry; a job that cannot even start retries on a growing backoff for about 24 minutes before it fails, and viewers keep playing from Bunny throughout.', feature: 'error-reporting' },
    ] as Item[],
    environmentsTitle: 'Three environments',
    environmentsLead: 'QA for testing, stage as the release candidate with production’s shape and its own data, and production.',
    environments: [
      { name: 'QA', body: 'Updated on every merge to main.', host: 'videos.qa.alummahnow.net' },
      { name: 'Stage', body: 'Production configuration, separate data and keys. Every release passes here first.', host: 'videos.stage.alummahnow.net' },
      { name: 'Production', body: 'Released only from a dated tag on main, never by hand.', host: 'videos.alummahnow.net' },
    ],
    releaseTitle: 'How a release reaches production',
    releaseLabel: 'Release steps, in order',
    release: [
      { title: 'Tag', body: 'A dated tag on a commit on main starts the release.' },
      { title: 'Build once', body: 'The same build goes to stage and to production.' },
      { title: 'Local end-to-end tests', body: 'Every end-to-end spec that runs locally, each job on its own stack, on the tagged commit.' },
      { title: 'Stage', body: 'Deploy to stage with migrations and a smoke, then the stage end-to-end tests.' },
      { title: 'Secrets checks', body: 'Every worker has its required secrets; no test-only secret is in production.' },
      { title: 'Production at {rolloutStart}', body: 'The new version is uploaded with no traffic and smoke-tested.' },
      { title: '{rolloutFull} or roll back', body: 'Traffic moves over, the smoke runs again, a failure rolls back automatically, and a dry run proves the rollback target.' },
    ],
    costTitle: 'Built to a cost cap',
    costBody:
      'The whole platform is designed to stay under a fixed monthly cost cap set by the owner. Transcoding containers are billed only while a job runs, and cost lines such as container time, storage and requests are measured on the admin Delivery, Operations and Costs pages — with a budget meter, a forecast and opt-in alerts.',
    statusTitle: 'Public status page',
    statusBody: 'status.alummahnow.net checks the public services every two minutes and lists incidents and maintenance, in Arabic and English.',
    statusLink: { label: 'Open the status page', href: STATUS_PAGE },
  },

  systemDesign: {
    title: 'System design',
    description:
      'How Al Ummah Now is built: the whole system on one diagram — people and apps, the Cloudflare edge, Workers, data stores, background workers and providers — with every part named as it is deployed.',
    heroTitle: 'The whole system, as it runs',
    heroLead:
      'Every worker, binding, queue and bucket in these diagrams is the real name from our deployment. Code runs on Cloudflare Workers, transcoding runs on Cloudflare Containers, and video is delivered by Bunny Stream and our own R2 storage side by side.',
    diagramTitle: 'The system at a glance',
    diagramLead:
      'Zones group what deploys together. Arrows carry what actually crosses a boundary: HTTP requests, service bindings, queue messages, cron triggers.',
    walkthroughTitle: 'The seven zones',
    zones: [
      {
        title: 'People and apps',
        body: 'Browsers reach the public site (Astro), the videos site (Next.js) and the staff admin. A .NET importer moves existing catalogues in bulk.',
      },
      {
        title: 'Cloudflare edge',
        body: 'Cloudflare’s content delivery network (CDN) serves every site and the public media host, with cache rules applied as code. Bunny’s CDN serves the videos Bunny encoded, with token-signed addresses. Turnstile checks visitors in monitor mode today.',
      },
      {
        title: 'Apps',
        body: 'The videos platform’s monorepo deploys eleven Workers: the videos site, its API, the admin pair, the processor, the realtime server, the scheduler, the media worker, the cost monitor, short links and the status page. Sign-in is three more (issuer, profile, admin) and the CMS one, on bknd under our own admin screens.',
      },
      {
        title: 'Async and containers',
        body: 'Heavy work never runs on a request: the processor consumes the event and moderation queues, the scheduler publishes scheduled videos every minute, the media worker runs FFmpeg transcodes on Cloudflare Containers, and the cost monitor collects platform analytics hourly.',
      },
      {
        title: 'Data',
        body: 'R2 buckets hold the content records (videos, channels, profiles) and the media pipeline (public, private, originals). Seven D1 databases hold accounts, notifications, the search index, reports, costs and status. KV, a key-value store, keeps sessions, revocations and remote config; Durable Objects hold sockets, transcode slots and locks.',
      },
      {
        title: 'Providers',
        body: 'Bunny Stream encodes and stores one copy of every upload. Workers AI runs moderation checks, transcription and translation within daily neuron budgets. The Quran Foundation supplies the official Quran text and translations, Resend sends the email, and APNs, FCM and WNS deliver push.',
      },
      {
        title: 'Observability',
        body: 'Workers Logs keep every warning and error (sampled fully, logged sparingly — production logs warn only). Crashes and failed jobs reach the admin Errors page with a Retry button, one page load in twenty reports Core Web Vitals, the status page checks the public services every two minutes, and a cost dashboard watches the budget.',
      },
    ] as Item[],
    pagesTitle: 'Pages in this section',
    pagesLead: 'One page per part of the system, written for developers: the Workers, bindings, queues and tables involved, how they connect, and why they are built that way.',
    pages: [
      { title: 'Video pipeline', body: 'Upload to playback: two encodes, one chosen play address.', href: 'video-pipeline/' },
      { title: 'Delivery & caching', body: 'Three rails to the viewer, and the caches that keep them fast.', href: 'delivery-caching/' },
      { title: 'Data', body: 'Which bucket, database, namespace or object holds what.', href: 'data/' },
      { title: 'Async work', body: 'Queues, consumers, retries and the admin Errors page.', href: 'async/' },
      { title: 'Realtime', body: 'Socket shards, topic directories and view counters.', href: 'realtime/' },
      { title: 'Identity & security', body: 'One sign-in, short-lived tokens, two permission systems.', href: 'identity/' },
      { title: 'AI usage', body: 'Where AI runs, which models, and the budget that bounds it.', href: 'ai/' },
      { title: 'Cost', body: 'A fixed monthly budget, watched hourly, with alerts.', href: 'cost/' },
      { title: 'Scaling', body: 'What scales by itself, and the work that keeps it safe.', href: 'scaling/' },
      { title: 'Clients', body: 'The web apps, embeds on other sites and the bulk importer.', href: 'clients/' },
      { title: 'Release & quality', body: 'Tags, gates, stage, a {N0}% promotion and automatic rollback.', href: 'release/' },
    ],
  },
  systemDesignPages: {
    deliveryCaching: {
      title: 'Delivery & caching',
      description: 'How a video reaches a viewer quickly: public HLS straight from R2 through the CDN with cache rules applied as code, private HLS through the media Worker with a token in the path, and Bunny’s signed CDN — plus the caches inside the API.',
      heroTitle: 'Every rendition, two doors',
      heroLead: 'Public videos stream from R2 through Cloudflare’s content delivery network (CDN) without touching a Worker. Private and unlisted videos go through the media Worker, which checks a token that lives in the path itself. Bunny’s CDN serves its own copies with addresses signed on every response.',
      stagesTitle: 'Layer by layer',
      stages: [
        { title: 'Public: the CDN, not a Worker', body: 'Public HLS (the streaming format: a playlist and short segments) never runs code. An R2 custom domain serves pub/… and a Cache Rule caches everything: segments and init files for a year (they are immutable, addressed by revision), playlists for ten seconds, manifest.json bypassed. Smart Tiered Cache keeps one upper tier per region warm. The zone is on the Free plan; its ten cache rules are enough because the rules ship as code with every release.' },
        { title: 'Private: a token in the path', body: 'Private and unlisted renditions sit in a bucket with no public access. The media Worker serves them at /priv/&lt;token&gt;/&lt;videoId&gt;/… — the token is part of the path, like Bunny’s directory token, so the relative URLs inside a playlist inherit it. The Worker caches by object key, not by token, so every viewer of one private video shares a single cached copy. When visibility changes, objects move between the buckets and the old prefix is purged.', feature: 'signed-urls' },
        { title: 'Signed on every response, stored never', body: 'Bunny token authentication is on in every library. Playback addresses are signed per response and never stored — a stored signed URL simply expires and breaks. The API strips tokens on write and signs on read, and share images stay on our own domain (videos.alummahnow.net/thumb/&lt;id&gt;.jpg) so previews on social networks never break.', feature: 'signed-urls' },
        { title: 'Caches inside the API', body: 'The delivery settings are cached for thirty seconds per isolate, so a thousand requests cost one read. The auth issuer’s public keys are edge-cached, with the last good copy served if its D1 database stalls; token revocations are read from KV, a key-value store, on the request path of every videos service.' },
        { title: 'Downloads play fair', body: 'Each rendition set carries one progressive MP4 for search engines and downloads, rate-limited per IP by a zone rule — ten downloads per ten seconds, then a block — applied as code like the cache rules.' },
      ] as Item[],
    },

    data: {
      title: 'Data',
      description: 'What holds what on Al Ummah Now: R2 buckets for records and media, seven D1 databases for everything that needs queries, KV namespaces, Durable Objects and Analytics Engine datasets.',
      heroTitle: 'Records in R2, questions in D1',
      heroLead: 'A video, channel or profile is a JSON object in R2 — written through compare-and-swap, read as a whole. Everything that needs a query — notifications, the search index, reports, costs — lives in D1. Sessions and fast flags live in KV; sockets, counters and gates in Durable Objects.',
      stagesTitle: 'What holds what',
      stages: [
        { title: 'R2: the records', body: 'One bucket per record type: videos, channels, profiles, playlists, channel sections and tabs, community posts, subtitles, scheduled videos, upload defaults, and one global-settings bucket the workers share as a tiny document store (the delivery settings and the transcode limit live there).' },
        { title: 'R2: media and system stores', body: 'The media pipeline has three buckets — public renditions, private renditions, and the kept originals. Beside them: the processor’s message archive, private admin backups, the encrypted evidence store for child sexual abuse material (CSAM) under legal hold, and self-hosted live recordings.' },
        { title: 'D1: seven databases', body: 'Auth has its own (accounts, clients, roles, the refresh-token store). The videos platform keeps notifications, the search index, reports and AI usage, costs, and status. The CMS keeps its content. Each has stage and QA copies, so a stage token never opens production.' },
        { title: 'The search index', body: 'Search is D1 with SQLite FTS5 tables per entity. Text is normalised in code — Arabic diacritics folded, articles stripped — so the tokenizer only splits words; a popularity column orders what matches. Rows are written on every record change and by the processor; a backfill endpoint rebuilds it.' },
        { title: 'KV and Durable Objects', body: 'KV holds the auth session store, token revocations, sign-in themes, the native apps’ remote config, human-verified marks, upload sessions, scheduler locks — and the www home timeline in weekly buckets. Durable Objects hold the socket shards and topic directories, the admin coalescers, the view counters, one Transcoder per video, the TranscodeSlots gate and the scheduler lock.' },
        { title: 'Analytics Engine', body: 'Three datasets keep the numbers without cookies: page-speed measurements from real visits (real user monitoring, RUM) sampled one page load in twenty, abuse counters for the admin Abuse panel, and auth sign-in events. Analytics Engine keeps three months.' },
      ] as Item[],
    },

    asyncWork: {
      title: 'Async work',
      description: 'How background work runs on Al Ummah Now: Cloudflare Queues between producers and consumers, retries with dead-letter queues, the admin Errors page with Retry, and the cron triggers that sweep.',
      heroTitle: 'Nothing heavy rides a request',
      heroLead: 'Counters, notifications, moderation scans, transcodes, imports and mail all run after the response, on queues with retries and dead-letter queues. When something fails for good it lands on the admin Errors page with a Retry button — the owner’s standing rule.',
      stagesTitle: 'The rules of the queue',
      stages: [
        { title: 'Always async, always visible', body: 'Heavy work never runs on a request. The videos platform’s events (a video published, a comment added) go to the videos queue; moderation scans to their own; heavy admin actions and YouTube imports get one job per invocation so each has the full subrequest budget.', feature: 'error-reporting' },
        { title: 'Retries, then dead letters', body: 'Every consumer declares its retries (three to eight depending on the queue) and a dead-letter queue, where messages that keep failing wait. The processor reads its own dead letters too, in small batches, so nothing sits unread. A give-up shows on the Errors page with the video, the reason and Retry.', feature: 'error-reporting' },
        { title: 'The crons', body: 'The scheduler runs every minute to publish scheduled videos; api-videos sweeps uploads, processing checks and the GDPR (EU data-protection law) retention daily, hourly and every ten minutes; the processor rolls analytics hourly and imports legacy documents daily; status checks every two minutes; cost-monitor collects hourly; auth cleans up hourly.' },
        { title: 'One consumer is registered by script', body: 'Promoting a new version of a Worker never registers queue consumers, so the release pipeline registers them itself — a step that once ate an afternoon, now just a line in the run.' },
        { title: 'The message archive', body: 'In production the processor archives every message it consumes into a messages bucket, so an incident can be replayed message by message.' },
      ] as Item[],
    },

    realtime: {
      title: 'Realtime',
      description: 'The realtime service behind live updates on Al Ummah Now: one Worker takes each socket onto a random Durable Object shard, channel directories route broadcasts, and sharded counters keep views exact.',
      heroTitle: 'Sockets on shards, broadcasts by topic',
      heroLead: 'One Worker, realtime.alummahnow.net, carries every live update: the notification bell, admin dashboards, live viewer counts and player quality beacons. Connections land on a random shard; each channel has a directory that knows which shards hold a subscriber.',
      stagesTitle: 'How it stays correct',
      stages: [
        { title: 'Hibernating shards', body: 'Sockets are spread over shard objects named {tkSocketsZero}…n — eight by default, sixty-four at most. Each socket’s state (session, channels, rate-limit window) lives in its hibernation attachment, under two kilobytes, at most twelve channels; the runtime can hibernate and rebuild without losing anyone.' },
        { title: 'Directories, not shouting', body: 'Before a shard confirms its first local subscriber to a channel it joins that channel’s directory object. A broadcast goes to the directory, which forwards it only to the shards that hold a subscriber. When a directory cannot answer, or a batch is bigger than the shard count, or a shard is still on older code mid-rollout, the broadcast falls back to every shard — so a deploy never loses messages.' },
        { title: 'Views that add up', body: 'Each view increments a counter object views:&lt;videoId&gt;:&lt;shard&gt; — four shards, chosen at random. A shard flushes its total back into the video record at most every ten seconds with a compare-and-swap, merging by maximum; a blind writer can hide a count only briefly. The API reads the record plus the unflushed shards, and a test replays a thousand parallel views to an exact count.' },
        { title: 'Coalesced admin updates', body: 'Admin pages subscribe to admin topics; producers send updates through a coalescer object that lets at most one through per second, so a busy job never floods the dashboard.' },
        { title: 'Limits at the door', body: 'Opening sockets is capped per IP and messages per user (or per IP before sign-in) with the Workers rate-limiting binding, so more sockets buy no extra messages. Tokens are checked against the issuer, revocations included, and admin channels need the token’s admin level.', feature: 'notifications' },
      ] as Item[],
    },
    identity: {
      title: 'Identity & security',
      description: 'Sign-in on Al Ummah Now: an OpenAuth-based issuer with PKCE everywhere, fifteen-minute access tokens that rotate and revoke, and two permission systems that never mix.',
      heroTitle: 'One sign-in, two permission systems',
      heroLead: 'Every app is a client of one issuer, auth.alummahnow.net, built on our OpenAuth fork. Tokens are short and rotate; signing out ends every app at once. Site roles live in the token; channel roles never do.',
      stagesTitle: 'The guarantees',
      stages: [
        { title: 'PKCE for every client', body: 'Every first-party web client signs in with PKCE (S256) — the issuer refuses their codes without the verifier. A client registered without a secret must send a challenge too, so its code cannot be swapped in transit; the auth admin is a confidential client with a secret on exchange and refresh.', feature: 'sso' },
        { title: 'Fifteen minutes, then rotate', body: 'Access tokens are JSON Web Tokens (JWTs) carrying the user’s identity and site roles; they last fifteen minutes in production. Refresh tokens rotate in one atomic D1 store, and reusing an old one revokes that token family. The videos APIs reject the old thirty-day tokens outright.', feature: 'short-lived-tokens' },
        { title: 'Signing out, everywhere or one device', body: 'Signing out walks every app’s front-channel logout and revokes the refresh tokens. Revocations are written to D1 and KV; the videos services read the KV copy on the request path. Each token carries its sign-in id, so one device can be signed out alone — from the auth admin, or the videos admin for staff devices.' },
        { title: 'Keys that rotate quietly', body: 'A new signing key is published an hour before it signs; the old one keeps verifying until the new has signed for a day. Every verifier refetches the keys when a token names one it does not hold, so rotation signs nobody out.' },
        { title: 'Site roles ≠ channel roles', body: 'Site roles (Member, Scholar, Moderator, Admin, Super Admin) are managed in auth and travel in the token. Channel roles (owner, admin, editor, moderator — up to fifty members) live in the channel record on the videos side and never enter a token. Neither grants the other; only a super admin transfers channel ownership.' },
        { title: 'Asking auth to act', body: 'The videos admin never suspends or deletes an auth account itself: it files a moderation request on a queue, and auth admins decide in their own admin. Approved actions run from a queue with retries. Between workers, service-to-service calls carry an internal key from the Secrets Store.' },
      ] as Item[],
    },

    ai: {
      title: 'AI usage',
      description: 'Where AI runs on Al Ummah Now: moderation, transcription, translation, pre-publication review and the CMS writing assist — all open-weight models on Workers AI, inside daily neuron budgets, never deleting anything.',
      heroTitle: 'AI at the edges, people at the centre',
      heroLead: 'AI reads and drafts; people decide. Every model runs on Workers AI with open weights, every call is metered in neurons against a daily budget reserved before the call and settled after it, and moderation can only hold content for review — never delete it.',
      stagesTitle: 'What runs where',
      stages: [
        { title: 'Moderation: translate, guard, score', body: 'Text is translated to English ({tkGemma}) so {tkGuard} can read it, and Gemma scores the platform categories. Everything starts in shadow mode: policies live in a D1 database and an admin switches a category to enforce; only spam and charity-scam may hide, and religious-authenticity flags go to scholars only. Production runs it in shadow mode today.', feature: 'ai-moderation' },
        { title: 'The budget that bounds it', body: 'Before any call, the scan reserves its worst-case cost for today in one conditional update; afterwards it settles to what it really spent. The daily caps are settings — moderation and categorising each have one, and the Costs page shows the spend against them. Unit tests never call a model: they pass a mock binding.' },
        { title: 'Captions: Whisper plus the Quran layer', body: 'Transcription is a creator action. Whisper large-v3-turbo returns a draft; Quran passages are matched against the official text and rendered from it only after the creator confirms — an uncertain match shows a reference, never guessed text. Quran is never machine-translated or machine-spoken.', feature: 'transcripts' },
        { title: 'Review before publication', body: 'For videos under pre-publication review, the transcoder also extracts frames (every two seconds plus scene cuts, capped) and the pipeline checks them with clef-flash for NSFW imagery and Whisper for the transcript. It can only hold the video for a person. Frames and transcripts are kept thirty days, signals twelve months.', feature: 'video-review' },
        { title: 'Categories, translation, writing help', body: 'Category suggestions run on {tkScout}; caption translation runs DeepSeek’s flash model on Workers AI; the CMS writing assist helps staff draft articles. Titles translate inline under the same AI budget.', feature: 'content-categories' },
        { title: 'Open weights only', body: 'The owner’s rule for review applies to AI generally: open-weight models only, hosted on Workers AI first, no proprietary model APIs — so behaviour and cost stay inspectable.' },
      ] as Item[],
    },

    cost: {
      title: 'Cost',
      description: 'How Al Ummah Now stays within a fixed monthly budget: per-second containers, warn-only logs, sampled analytics, bounded retention — and an hourly collector feeding the admin Costs page with a forecast and alerts.',
      heroTitle: 'A fixed budget, watched hourly',
      heroLead: 'The platform runs under a fixed monthly budget cap set by the owner. A collector reads usage every hour into its own database, and the admin Costs page shows the month against the budget, a forecast, and opt-in alerts. No figures are published here; the mechanisms are what matter.',
      stagesTitle: 'The choices that keep it small',
      stages: [
        { title: 'The dashboard', body: 'Super admins set a read-only Cloudflare token on the Costs page (sealed, audited, tested). The page shows month-to-date against the budget, the forecast, products, environments and top movers; budget, spike and weekly-digest alerts go by email to admins who opt in, and to the Errors page.', feature: 'cost-budget' },
        { title: 'Pay for work, not for idleness', body: 'Transcoding runs on Cloudflare Containers, billed per second while a job runs; instances that are not running cost nothing. Code runs on Workers, where idle is free and requests are cheap. An idle site — like this one, static assets only — costs nothing at all.' },
        { title: 'Logs that whisper', body: 'Production logs warn and error only, one line per request or job, with full sampling so no error is dropped but nothing chatty is written. Under test load QA, our test environment, serves about ten million requests a day — a talkative log level would be the biggest line on the bill.' },
        { title: 'Measured, not modelled', body: 'Page speed from real visits is sampled one page load in twenty; the AI budget reserves before it spends; test accounts are never transcoded; kept originals expire (thirty days minimum, ninety at most); QA’s own usage was cut deliberately. Every choice here is visible on an admin page, not a hunch.' },
      ] as Item[],
    },

    scaling: {
      title: 'Scaling',
      description: 'What scales on its own on Al Ummah Now — Workers, queues, Durable Objects — and the work that keeps many copies safe: sharding, slot gates, compare-and-swap and batched upserts.',
      heroTitle: 'Many copies, one truth',
      heroLead: 'Workers, queues and Durable Objects spread over as many copies as traffic needs without anyone sizing a server. The platform’s real scaling work is correctness under many copies at once: sharded counters, single writers, and gates that keep the container bill honest.',
      stagesTitle: 'The discipline',
      stages: [
        { title: 'What scales by itself', body: 'Workers run per request, per queue message and per cron, in as many places as needed. Queues buffer and retry; consumers scale with the backlog. Nothing here is “sized” — the nearest thing to capacity planning is the account-wide container quota.' },
        { title: 'Shards with names', body: 'Sockets spread over eight shard objects (sixty-four at most) and broadcasts route through per-channel directories. Views count on four shards per video and merge monotonically. Each piece is a named Durable Object — the platform’s own unit of “just one of me”.' },
        { title: 'A gate under a ceiling', body: 'Concurrent transcodes are an admin-set range enforced by one TranscodeSlots object, under a hard ceiling: the account’s container quota is shared, so production’s ceiling is computed from it: fifteen thousand vCPU account-wide, less ten percent kept free and less the share stage and QA use, checked before every release.' },
        { title: 'One writer per fact', body: 'The audit that fixed this platform’s concurrency classes: record writes compare-and-swap; analytics fold into a D1 database with one upsert statement per batch, its dimension lists capped in SQL; blind writers were catalogued and retired. A thousand parallel views now count to exactly a thousand.' },
        { title: 'Budgets inside a request', body: 'Full-bucket scans that could fan out past the subrequest budget were replaced by indexes and queues; heavy admin jobs run one per invocation so each has the full budget. Pages open during a deploy keep working through skew protection.' },
      ] as Item[],
    },

    clients: {
      title: 'Clients',
      description: 'The clients of Al Ummah Now: the web apps in the browser, embeds on other sites, TV apps through the device grant, and the .NET bulk importer.',
      heroTitle: 'Every screen, one API',
      heroLead: 'Browsers get www, the videos site and the admin; other sites get the embeddable player. ',
      stagesTitle: 'The clients',
      stages: [
        { title: 'The web trio', body: 'www (Astro) for the public site and scholar sites, the videos site (Next.js on Workers) for watching and Studio, and the admin. All three are the same design system, both languages, light and dark.', feature: 'videos-site' },
        { title: 'Embeds and short links', body: 'Videos, Shorts and playlists embed away from the platform with oEmbed and a share dialog; alummahnow.link short links work in both directions with the full site.', feature: 'embeds' },
        { title: 'Native, on one core', body: 'Viewer and Studio apps for Apple, Android, Windows, Linux and TVs share a Rust core — API client, sign-in, sync, uploads, a media engine. Android and desktop have pre-releases on GitHub; none is in a public store yet.', feature: 'native-apps' },
        { title: 'TVs sign in with a code', body: 'TVs use the device authorization grant from our OpenAuth fork: a code on the screen, a sign-in on the phone. Remote config and feature flags for the apps come from the videos admin through KV.' },
        { title: 'The importer', body: 'AlUmmahNowTools, a .NET toolset, moves existing catalogues in bulk into the platform — the only client that pushes to storage directly besides the upload path.' },
      ] as Item[],
    },

    release: {
      title: 'Release & quality',
      description: 'How code reaches production on Al Ummah Now: no hand deploys, a dated tag builds once, local end-to-end tests and stage gate it, production promotes at {N0}% before {N100}%, and rollback is automatic.',
      heroTitle: 'No hand deploys',
      heroLead: 'Stage and production move only through CI, the automated runs on GitHub Actions. A dated tag on main builds once; the same build passes local end-to-end tests and the stage environment; production takes it at zero percent, smoke-tests it, then goes to full — or rolls back on its own.',
      stagesTitle: 'The gates, in order',
      stages: [
        { title: 'A tag, not a button', body: 'Merging to main deploys QA, the test environment, only. Production moves when someone pushes a dated tag (the date is US Eastern, never UTC, and the next free number is printed by a script). Auth is the exception: it releases on every merge to main.' },
        { title: 'Build once', body: 'The same build goes to stage and production, so what was tested is what serves. Database migrations are expand-only and run before new code takes traffic.' },
        { title: 'The gates', body: 'Production waits for stage deploy, migrations and smoke; the stage end-to-end (E2E) suite; local E2E — every spec placed local, each job on its own stack; and secrets checks that every worker has its required secrets and no test-only secret is in production.' },
        { title: 'Zero, then a hundred', body: 'The new version uploads with no traffic and is smoke-tested through an override. Traffic then moves to it, the smoke runs again, and a failure rolls back automatically. After every promote, a dry run proves the rollback target resolves.' },
        { title: 'Media and the rest', body: 'The media worker and its container deploy after the other apps, with a smoke that starts one real transcoder — over sixty seconds and it rolls back. Queue consumers are registered by script; translations sync; a signed-in check with throwaway accounts confirms production holds no test data.' },
        { title: 'And this site', body: 'The dev site follows the same shape on its own pipeline: CI on every PR, QA on main, a tag for stage and production, rollback if the production smoke fails — its jobs separate, so a dev-site failure never blocks the others.', feature: 'status-page' },
      ] as Item[],
    },
  },

  sdNav: {
    label: 'System design pages',
    overview: 'Overview',
    pager: 'Previous and next page',
    prev: 'Previous',
    next: 'Next',
  },
  videoPipeline: {
    title: 'Video pipeline',
    description:
      'How a video moves through Al Ummah Now, for developers: the videos and al-ummah-now-media Workers, every binding and queue between them, the upload, transcode and play calls in order, and where the state is kept.',
    heroTitle:
      'The video pipeline, call by call',
    heroLead:
      'Two Workers and one container carry every video: videos (apps/api-videos) takes the upload and answers players, and al-ummah-now-media (apps/media) runs the FFmpeg transcode. The figures below use the names in the code of the [AlUmmahNow repository](https://github.com/Al-Ummah-Now/AlUmmahNow); the design notes are in [docs/media-delivery](https://github.com/Al-Ummah-Now/AlUmmahNow/tree/main/docs/media-delivery).',
    diagramTitle: 'The pipeline at a glance',
    diagramLead:
      'The same path as one animation, numbered in the order the work happens: the upload is copied at the API, Bunny Stream encodes one copy, and our own queue, media Worker and container build the other in R2. The API then picks one play address per request.',
    stagesTitle: 'Stage by stage',
    stages: [] as Item[],
    logoFlow: {
      title: 'The pipeline, step by step',
    },
  },

  'open-source': {
    title: 'Open source',
    description:
      'Every Al Ummah Now repository is public on GitHub: the videos platform, sign-in, the public sites, the CMS, the native apps and the wiki. How to contribute and how to report a security problem.',
    heroTitle: 'All of the code is public',
    heroLead:
      'Every repository is public on GitHub. AlUmmahNowAuth and our OpenAuth fork are MIT-licensed. The other repositories carry no licence: their code is public to read, not licensed for reuse.',
    reposTitle: 'Repositories',
    repoLanguage: 'Language',
    repoLicence: 'Licence',
    noLicence: 'Not chosen yet',
    repos: [
      { name: 'AlUmmahNow', body: 'The videos platform: web, APIs, background processing, realtime, media and admin.', lang: 'TypeScript', licence: '' },
      { name: 'AlUmmahNowAuth', body: 'Single sign-on, account profile and the accounts admin.', lang: 'TypeScript', licence: 'MIT' },
      { name: 'openauth', body: 'Our fork of OpenAuth, the library behind sign-in.', lang: 'TypeScript', licence: 'MIT' },
      { name: 'AlUmmahNowUI', body: 'The public site, the scholar sites and this site.', lang: 'TypeScript', licence: '' },
      { name: 'AlUmmahNowCMS', body: 'Content management for the public site.', lang: 'TypeScript', licence: '' },
      { name: 'AlUmmahNowCore', body: 'The shared Rust core for the native apps.', lang: 'Rust', licence: '' },
      { name: 'AlUmmahNowApple', body: 'Apps for iPhone, iPad, Apple TV and Mac.', lang: 'Swift', licence: '' },
      { name: 'AlUmmahNowAndroid', body: 'Apps for Android phones, tablets, TV, Fire TV and Auto.', lang: 'Kotlin', licence: '' },
      { name: 'AlUmmahNowDesktop', body: 'Apps for Windows, Linux and Samsung TVs.', lang: 'C#', licence: '' },
      { name: 'AlUmmahNowTools', body: 'Bulk video import tools.', lang: 'C#', licence: '' },
      { name: 'AlUmmahNowWiki', body: 'How everything fits together, with a page for every repository, epics and decisions.', lang: 'Markdown', licence: '' },
    ],
    contributeTitle: 'How to contribute',
    contributeLabel: 'Steps to a first contribution, in order',
    contribute: [
      { title: 'Read the wiki', body: 'Start with the system map and the page for the repository you want to change.' },
      { title: 'Open or pick an issue', body: 'Describe the bug or the change in the repository it belongs to.' },
      { title: 'Spec, plan, code', body: 'Larger changes start as a spec. Then open a pull request with tests.' },
      { title: 'Let the automated checks run', body: 'Lint, types, unit and end-to-end tests run on every pull request.' },
    ],
    contributeLink: { label: 'Read the contributing guide', href: `${WIKI}/guides/contributing.md` },
    wikiLink: { label: 'Open the wiki', href: `${GH}/AlUmmahNowWiki` },
    securityTitle: 'Found a security problem?',
    securityBody:
      'Please don’t open a public issue. Use Security → Report a vulnerability in the repository concerned. We aim to acknowledge reports within {reportDays} working days.',
    securityLink: { label: 'Report a vulnerability', href: `${GH}/AlUmmahNow/security/advisories/new` },
  },


  contact: {
    title: 'Contact',
    description: 'How to reach the Al Ummah Now team about partnerships, the code or a security problem.',
    heroTitle: 'Talk to us',
    heroLead: 'Messages go through the contact form on the videos site, which reaches the team’s inbox. No account is needed.',
    cards: [
      { title: 'Partnerships', body: 'Integrating with the platform, working together, or supporting it.', action: 'Write to us', topic: 'partnership' },
      { title: 'General questions', body: 'Anything else about Al Ummah Now.', action: 'Write to us', topic: 'general' },
    ],
    codeTitle: 'Code and bugs',
    codeBody: 'Open an issue in the repository concerned on GitHub.',
    codeLink: { label: 'Go to GitHub', href: GH },
    securityTitle: 'Security problems',
    securityBody: 'Report privately with Security → Report a vulnerability. Please don’t open a public issue.',
    securityLink: { label: 'Report a vulnerability', href: `${GH}/AlUmmahNow/security/advisories/new` },
  },

  notFound: {
    title: 'Page not found',
    body: 'There is no page at this address. It may have moved, or the link may be wrong.',
    home: 'Go to the home page',
    other: 'الصفحة الرئيسية بالعربية',
  },
  diagrams: diagramsEn,
};

export type Strings = typeof en;
