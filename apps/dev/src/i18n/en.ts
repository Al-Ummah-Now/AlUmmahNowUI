/**
 * English copy for alummahnow.dev. ar.ts has exactly the same keys (tests/i18n.test.ts).
 *
 * Every claim here comes from the code on main, the wiki, or the owner's words (wiki AUN-DEV-SITE
 * §Wording rules). No user counts, money figures or dates that aren't already in the wiki. Plans are
 * written as plans. Each technical claim carries the wiki page it comes from in `sources`.
 */
import { WIKI, GH, VIDEOS, WWW, STATUS_PAGE } from '../lib/links.ts';

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
  sources?: Link[];
}

export const en = {
  meta: {
    siteName: 'Al Ummah Now',
    siteNameAlt: 'الأمة الآن',
    description:
      'Al Ummah Now is an Islamic video-sharing community in Arabic and English. How it works, how it is built, and the waqf direction we are exploring.',
  },
  nav: {
    skip: 'Skip to content',
    primary: 'Main',
    home: 'Home',
    community: 'Community',
    technology: 'Technology',
    infrastructure: 'Infrastructure',
    'open-source': 'Open source',
    waqf: 'Waqf',
    contact: 'Contact',
    /** The header lockup's second line (NAV.md: every app but www names itself) */
    appName: 'Developers',
  },
  status: {
    live: 'Live',
    ready: 'Ready, not in use yet',
    rolling: 'Built, rolling out',
    building: 'In development',
    planned: 'Planned',
  },
  common: {
    source: 'Source',
    sources: 'Sources',
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
      'Al Ummah Now is a place for the Ummah to share videos and news without censorship, to interact, and to get educated, in Arabic and English. This site explains what it is for, how it is built, and the waqf direction we are exploring.',
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
    systemLead: 'Every server-side part runs on Cloudflare Workers. One sign-in service serves every app.',
    systemLayers: [
      { title: 'People and apps', body: 'Browsers, and native apps for phones, TVs and desktops' },
      { title: 'Sign-in', body: 'One single sign-on service for every app, with passkeys' },
      { title: 'Sites', body: 'www, the videos site, scholar sites, the CMS and the admin' },
      { title: 'APIs and workers', body: 'Videos API, admin API, background processing, realtime updates, scheduler' },
      { title: 'Data and media', body: 'D1, R2, KV and Queues; FFmpeg on Cloudflare Containers; Bunny.net' },
    ],
    systemMore: 'See the infrastructure',
    audiencesTitle: 'Where to start',
    developers: {
      title: 'Developers and contributors',
      body: 'Every repository is public on GitHub, with a wiki that explains how the pieces fit together.',
      links: [
        { label: 'Technology', href: 'technology' },
        { label: 'Infrastructure and video pipeline', href: 'infrastructure' },
        { label: 'Repositories and contributing', href: 'open-source' },
      ],
    },
    partners: {
      title: 'Investors, donors and partners',
      body: 'What the platform is for, what exists today, and how we want it to be held for the community.',
      links: [
        { label: 'The community', href: 'community' },
        { label: 'The waqf direction', href: 'waqf' },
        { label: 'Contact', href: 'contact' },
      ],
    },
    waqfTitle: 'Held for the Ummah',
    waqfBody:
      'We are exploring running Al Ummah Now as a waqf or a charitable organisation, so that the platform serves the community rather than being owned for profit. No legal entity exists yet. This is a direction, and we say plainly where it stands.',
    waqfMore: 'Read about the waqf direction',
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
          { title: 'Videos and Shorts', body: 'A Short is three minutes or less and vertical or square; the uploader can override it.', feature: 'videos-and-shorts', sources: [{ label: 'Shorts rule', href: `${WIKI}/epics/CHAT-SHORTS-shorts-rule.md` }] },
          { title: 'Live streams', body: 'Studio Live, Go live and the live watch page are built and in a release. Production cannot take a stream yet: Bunny Stream Live is still waiting for preview access, and the self-hosted edge has no production host and no RTMP ingest.', feature: 'live-streams', sources: [{ label: 'D3 live provider', href: `${WIKI}/epics/D3-live-provider.md` }] },
          { title: 'Posts, playlists and channel sections', body: 'Community posts, personal and unlisted playlists, and channel pages arranged in sections.', feature: 'posts-playlists-sections', sources: [{ label: 'Channel sections', href: `${WIKI}/epics/AUN-CHANNEL-SECTIONS-channel-sections.md` }] },
          { title: 'Uploads by invitation for now', body: 'Uploading and creating channels are invite-only. Admins give creators a tier; subscriptions may open this up later.', feature: 'creator-tiers', sources: [{ label: 'O25', href: `${WIKI}/epics/decisions.md#o25-invite-only-uploads-with-admin-assigned-creator-tiers` }] },
        ] as Item[],
      },
      {
        id: 'news',
        title: 'Share news without censorship',
        lead:
          'People should be able to share what is happening to the Ummah without it quietly disappearing. That is the aim. In practice it means clear rules, open reporting, and people, not automated systems, making the decisions.',
        items: [
          { title: 'Published rules', body: 'The Community Guidelines are public in Arabic and English. They are the rules; there is no hidden list.', feature: 'community-rules', sources: [{ label: 'E06', href: `${WIKI}/epics/E06-community-moderation.md` }] },
          { title: 'Anyone can report', body: 'Videos, comments and channels can be reported, with bot protection on the report form.', feature: 'reporting', sources: [{ label: 'Bot protection', href: `${WIKI}/guides/bot-protection.md` }] },
          { title: 'AI holds, people decide', body: 'Automated moderation never deletes anything. It can only hold content for a person to review. In production it runs in shadow mode: it records what it would hold, and an admin switches holding on per category.', feature: 'ai-moderation', sources: [{ label: 'E28 AI moderation', href: `${WIKI}/epics/E28-ai-moderation.md` }] },
          { title: 'No tolerance for child abuse material', body: 'It is removed, the evidence is preserved under a legal hold, and it is reported to the authorities.', feature: 'csam-intake', sources: [{ label: 'CSAM response spec', href: `${GH}/AlUmmahNow/blob/main/docs/specs/CSAM-RESPONSE.md` }] },
          { title: 'Moderation reports', body: 'We are considering publishing regular moderation statistics in Arabic and English. No decision has been made yet.', feature: 'transparency-reports', sources: [{ label: 'M6', href: `${WIKI}/epics/decisions.md#m6-transparency-reporting` }] },
        ] as Item[],
      },
      {
        id: 'interact',
        title: 'Interact',
        lead: 'Talking to each other is the point of a community.',
        items: [
          { title: 'Comments and subscriptions', body: 'Comment and subscribe as yourself, without needing a channel of your own.', feature: 'comments-subscriptions', sources: [{ label: 'AlUmmahNow', href: `${WIKI}/repos/AlUmmahNow.md` }] },
          { title: 'Notifications', body: 'A bell for new videos from channels you subscribe to, with a badge that clears on every device when you open it.', feature: 'notifications', sources: [{ label: 'AlUmmahNow', href: `${WIKI}/repos/AlUmmahNow.md#notification-badge-and-read-state` }] },
          { title: 'Embeds', body: 'Videos, Shorts and playlists can be embedded on other sites, with oEmbed and a share dialog.', feature: 'embeds', sources: [{ label: 'E25', href: `${WIKI}/epics/E25-sharing-embeds.md` }] },
          { title: 'Short share links', body: 'Short links on alummahnow.link for videos, channels, posts and playlists.', feature: 'short-links', sources: [{ label: 'AUN-SHORT-LINKS', href: `${WIKI}/epics/AUN-SHORT-LINKS-short-share-links.md` }] },
        ] as Item[],
      },
      {
        id: 'learn',
        title: 'Get educated',
        lead: 'Much of what channels share is there to learn from. The platform keeps the creators’ own words and categories.',
        items: [
          { title: 'Content categories', body: 'Categories such as Tafsir, Fiqh, Quran recitation and Islamic Lectures keep their names.', feature: 'content-categories', sources: [{ label: 'Copy tone guide', href: `${WIKI}/guides/copy-tone.md` }] },
          { title: 'Scholar pages and scholar sites', body: 'Scholar pages on www, and white-label sites for scholars on alummahnow.org.', feature: 'scholar-sites', sources: [{ label: 'AUN-SEO', href: `${WIKI}/epics/AUN-SEO-search-visibility.md` }] },
          { title: 'Transcripts and captions', body: 'Creators transcribe their videos in Studio, with caption minutes set by their tier. Quran passages are matched to the official text and confirmed by the creator. Translation is planned.', feature: 'transcripts', sources: [{ label: 'AUN-CAPTIONS', href: `${WIKI}/epics/AUN-CAPTIONS-transcription-translation.md` }] },
        ] as Item[],
      },
      {
        id: 'languages',
        title: 'Arabic and English, everywhere',
        lead: 'Every screen exists in both languages, and Arabic is right-to-left throughout, not a translated afterthought.',
        items: [
          { title: 'Both languages on every app', body: 'The public site, the videos site, sign-in, the CMS and the native apps.', feature: 'bilingual', sources: [{ label: 'E03', href: `${WIKI}/epics/E03-i18n-enhancement.md` }] },
          { title: 'One vocabulary', body: 'The same words in every app, so a viewer never meets two names for one thing.', sources: [{ label: 'Glossary', href: `${WIKI}/guides/glossary.md` }] },
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
      'Every server-side part of Al Ummah Now runs on Cloudflare Workers. The apps share one sign-in service, one design system and one set of rules for how background work is done.',
    groups: [
      {
        title: 'Web apps',
        items: [
          { title: 'Videos site', body: 'Next.js on Cloudflare Workers: watch pages, Studio, channels and the creator tools.', feature: 'videos-site', sources: [{ label: 'AlUmmahNow', href: `${WIKI}/repos/AlUmmahNow.md` }] },
          { title: 'Public site and scholar sites', body: 'Astro on Workers, sharing one rendering package and the same themes.', feature: 'www-and-sites', sources: [{ label: 'AlUmmahNowUI', href: `${WIKI}/repos/AlUmmahNowUI.md` }] },
          { title: 'Admin', body: 'Staff tools with live updates over a realtime Worker, a contact inbox, a delivery dashboard and an errors page with Retry.', feature: 'videos-admin', sources: [{ label: 'System map', href: `${WIKI}/README.md#system-map` }] },
          { title: 'CMS', body: 'bknd on a Worker, with our own admin screens in place of bknd’s. It runs the www pages, articles and the home timeline.', feature: 'cms', sources: [{ label: 'AlUmmahNowCMS', href: `${WIKI}/repos/AlUmmahNowCMS.md` }] },
        ] as Item[],
      },
      {
        title: 'Identity',
        items: [
          { title: 'Single sign-on', body: 'Our fork of OpenAuth: OAuth 2.0 and OpenID Connect with PKCE. Sign in once and you are signed in on every app; sign out ends it everywhere.', feature: 'sso', sources: [{ label: 'Authentication', href: `${WIKI}/guides/authentication.md` }] },
          { title: 'Short-lived tokens', body: 'Access tokens last {accessTokenMinutes} minutes. Refresh tokens rotate, and reusing an old one revokes the whole family.', feature: 'short-lived-tokens', sources: [{ label: 'Tokens', href: `${WIKI}/guides/authentication.md#tokens` }] },
          { title: 'Passkeys', body: 'Passkey sign-in is live on the web and in the native apps. Requiring passkeys for staff is built and stays off until a super admin switches it on.', feature: 'passkeys', sources: [{ label: 'AUTH-PASSKEYS', href: `${WIKI}/epics/AUTH-PASSKEYS-passkeys-everywhere.md` }] },
        ] as Item[],
      },
      {
        title: 'Native apps',
        items: [
          { title: 'Shared Rust core', body: 'API client, sign-in, sync, uploads and a media engine in Rust, with bindings for Swift, Kotlin and C#.', feature: 'rust-core', sources: [{ label: 'AlUmmahNowCore', href: `${WIKI}/repos/AlUmmahNowCore.md` }] },
          { title: 'Apple, Android, Windows, Linux and TVs', body: 'Studio apps work on Apple devices, Android, Windows and Linux, and Android and desktop have pre-releases on GitHub. Viewer and TV apps are in development. None is in a public app store yet.', feature: 'native-apps', sources: [{ label: 'E23 release engineering', href: `${WIKI}/epics/E23-release-engineering.md` }] },
        ] as Item[],
      },
      {
        title: 'Design and AI',
        items: [
          { title: 'Fanous design system', body: 'Four themes built on the lantern identity, one set of tokens for web and native, and contrast checked in every theme.', feature: 'fanous-themes', sources: [{ label: 'Theming', href: `${WIKI}/guides/theming.md` }] },
          { title: 'AI moderation on Cloudflare', body: 'Workers AI checks content and can only hold it for review. Production runs it in shadow mode.', feature: 'ai-moderation', sources: [{ label: 'E28', href: `${WIKI}/epics/E28-ai-moderation.md` }] },
          { title: 'Transcripts', body: 'Transcription runs as background jobs, and Quran passages are matched against a local index of the official text before the creator confirms them.', feature: 'transcripts', sources: [{ label: 'AUN-CAPTIONS', href: `${WIKI}/epics/AUN-CAPTIONS-transcription-translation.md` }] },
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
    principlesTitle: 'How we build',
    principles: [
      { title: 'Always asynchronous', body: 'Heavy work goes through queues with retries and dead-letter queues. When something fails, it shows up on the admin Errors page with a Retry button.', sources: [{ label: 'O26', href: `${WIKI}/epics/decisions.md#o26-always-async-with-admin-visible-errors` }] },
      { title: 'Spec, then plan, then code', body: 'Features start as a spec in the wiki, then a plan, then pull requests with tests.', sources: [{ label: 'Contributing', href: `${WIKI}/guides/contributing.md` }] },
      { title: 'Privacy by default', body: 'Deletes can be undone for {undoDays} days and are then purged. Accounts can be erased. Site visits are counted without cookies or IDs.', sources: [{ label: 'Data lifecycle', href: `${WIKI}/guides/data-lifecycle.md` }] },
      { title: 'Accessible in both directions', body: 'Keyboard and screen-reader use, AA contrast in every theme, and menus that never leave the screen, in left-to-right and right-to-left.', sources: [{ label: 'Theming', href: `${WIKI}/guides/theming.md#menus-never-leave-the-screen` }] },
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
      { title: 'Transcode', body: 'A queue starts FFmpeg on Cloudflare Containers, which writes HLS renditions to R2.' },
      { title: 'Choose', body: 'The API returns one play URL: Bunny, R2 or a split by percentage, set on the admin Delivery page.' },
      { title: 'Play', body: 'Players play that URL. After a fatal error or a {stallSeconds}-second stall on R2, they fall back to Bunny once.' },
    ],
    pipelineSources: [
      { label: 'Video delivery', href: `${WIKI}/guides/video-delivery.md` },
      { label: 'D2', href: `${WIKI}/epics/D2-video-delivery.md` },
      { label: 'O31', href: `${WIKI}/epics/decisions.md#o31-transcode-on-cloudflare-containers` },
      { label: 'O32', href: `${WIKI}/epics/decisions.md#o32-run-bunny-and-r2-side-by-side-before-switching` },
    ],
    details: [
      { title: 'Two providers, side by side', body: 'Bunny and R2 both run in production behind an admin switch, and production plays Bunny first. Players report startup time, rebuffering and errors for each, and the admin compares them before deciding whether to switch.', feature: 'media-providers', sources: [{ label: 'O32', href: `${WIKI}/epics/decisions.md#o32-run-bunny-and-r2-side-by-side-before-switching` }] },
      { title: 'Signed, never stored', body: 'Playback URLs are signed for each response and never saved. Share images stay on our own domain so previews on social networks don’t break.', feature: 'signed-urls', sources: [{ label: 'Signed URLs', href: `${WIKI}/guides/video-delivery.md#signed-urls` }] },
      { title: 'Two live providers, not on production yet', body: 'Bunny Stream Live and a self-hosted path are built to run together and share new streams, so the choice can be made on data. Neither takes production streams yet: Bunny Live is a closed preview our libraries are not admitted to, and the self-hosted edge takes HTTPS push only and has no production host.', feature: 'live-streams', sources: [{ label: 'D3', href: `${WIKI}/epics/D3-live-provider.md` }] },
      { title: 'Failures are visible', body: 'A failed transcode is recorded with where and why. After three failures it appears on the admin Errors page with Retry, and viewers keep playing from Bunny.', feature: 'error-reporting', sources: [{ label: 'Video delivery', href: `${WIKI}/guides/video-delivery.md` }] },
    ] as Item[],
    environmentsTitle: 'Three environments',
    environmentsLead: 'QA for testing, stage as the release candidate with production’s shape and its own data, and production.',
    environments: [
      { name: 'QA', body: 'Updated on every merge to main.', host: 'videos.qa.alummahnow.net' },
      { name: 'Stage', body: 'Production configuration, separate data and keys. Every release passes here first.', host: 'videos.stage.alummahnow.net' },
      { name: 'Production', body: 'Released only from a dated tag on main, never by hand.', host: 'videos.alummahnow.net' },
    ],
    environmentsSources: [{ label: 'Environments', href: `${WIKI}/guides/environments.md` }],
    releaseTitle: 'How a release reaches production',
    releaseLabel: 'Release steps, in order',
    release: [
      { title: 'Tag', body: 'A dated tag on a commit on main starts the release.' },
      { title: 'Build once', body: 'The same build goes to stage and to production.' },
      { title: 'Stage', body: 'Deploy to stage and run the end-to-end tests there.' },
      { title: 'Production at {rolloutStart}', body: 'The new version is uploaded with no traffic and smoke-tested.' },
      { title: '{rolloutFull} or roll back', body: 'Traffic moves over, the smoke runs again, and a failure rolls back automatically.' },
    ],
    releaseSources: [{ label: 'Release process', href: `${WIKI}/guides/release-process.md` }],
    costTitle: 'Built to a cost cap',
    costBody:
      'The whole platform is designed to stay under a fixed monthly cost cap set by the owner. Transcoding containers are billed only while a job runs, and cost lines such as container time, storage and requests are measured on the admin Delivery and Operations pages.',
    costSources: [
      { label: 'O1', href: `${WIKI}/epics/decisions.md#o1-whole-platform-cost-cap` },
      { label: 'AUN-COST', href: `${WIKI}/epics/AUN-COST-cost-monitoring.md` },
    ],
    statusTitle: 'Public status page',
    statusBody: 'status.alummahnow.net checks the public services every two minutes and lists incidents and maintenance, in Arabic and English.',
    statusLink: { label: 'Open the status page', href: STATUS_PAGE },
  },

  'open-source': {
    title: 'Open source',
    description:
      'Every Al Ummah Now repository is public on GitHub: the videos platform, sign-in, the public sites, the CMS, the native apps and the wiki. How to contribute and how to report a security problem.',
    heroTitle: 'All of the code is public',
    heroLead:
      'Every repository is public on GitHub. AlUmmahNowAuth and our OpenAuth fork are MIT-licensed. The other repositories don’t have a licence yet, so their code is public to read but not yet licensed for reuse.',
    licenceSource: { label: 'Licence decision (open)', href: `${WIKI}/epics/decisions.md#lic-repo-licence-for-core-and-the-app-repos` },
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
      { title: 'Let CI check it', body: 'Lint, types, unit and end-to-end tests run on every pull request.' },
    ],
    contributeLink: { label: 'Read the contributing guide', href: `${WIKI}/guides/contributing.md` },
    wikiLink: { label: 'Open the wiki', href: `${GH}/AlUmmahNowWiki` },
    securityTitle: 'Found a security problem?',
    securityBody:
      'Please don’t open a public issue. Use Security → Report a vulnerability in the repository concerned. We aim to acknowledge reports within {reportDays} working days.',
    securityLink: { label: 'Report a vulnerability', href: `${GH}/AlUmmahNow/security/advisories/new` },
  },

  waqf: {
    title: 'Waqf and charity',
    description:
      'We are exploring running Al Ummah Now as a waqf or a charitable organisation, held for the benefit of the Ummah. Where this stands today and what is still to decide.',
    heroTitle: 'Held for the Ummah, not for profit',
    heroLead:
      'We are exploring running Al Ummah Now as a waqf, or through a charitable organisation, so that the platform is held for the benefit of the community. This page is about a direction, not something already in place.',
    whatTitle: 'What a waqf is',
    whatBody:
      'In Islamic tradition, a waqf is property dedicated permanently to a charitable purpose. It is not sold, given away or inherited, and what it produces goes to the purpose it was set up for. Mosques, schools, wells and hospitals have been held this way for centuries.',
    whyTitle: 'Why we want this',
    why: [
      { title: 'The community comes first', body: 'A platform held for the Ummah answers to that purpose, not to a buyer or to shareholders.' },
      { title: 'It can’t be sold off', body: 'A waqf can’t be sold. A community built here would stay with the community.' },
      { title: 'Open by default', body: 'The code is already public. A charitable structure would let the way the platform is run be public too.' },
    ],
    todayTitle: 'Where things stand today',
    today: [
      { title: 'No legal entity yet', body: 'There is no company, charity or waqf behind Al Ummah Now today.', sources: [{ label: 'SM-4', href: `${WIKI}/epics/decisions.md#sm-4-legal-entity` }] },
      { title: 'No payments at launch', body: 'No subscriptions or payments are switched on. If plans come later, they go through pluggable payment providers.', sources: [{ label: 'D4', href: `${WIKI}/epics/decisions.md#d4-monetisation` }, { label: 'O4', href: `${WIKI}/epics/decisions.md#o4-pluggable-payment-providers-never-stripe-admin-managed-plans` }] },
      { title: 'We are not taking donations yet', body: 'There is no donation button. Donations would wait until there is a structure to hold them and report on how they are used.' },
      { title: 'Built to a cost cap', body: 'The whole platform is designed to stay under a fixed monthly cost cap set by the owner.', sources: [{ label: 'O1', href: `${WIKI}/epics/decisions.md#o1-whole-platform-cost-cap` }] },
    ] as Item[],
    openTitle: 'Still to decide',
    open: [
      'Which structure: a waqf, a charity, a foundation, or a combination.',
      'Where it is registered, and under which law.',
      'Who governs it and how decisions are recorded and published.',
      'How donations would be accepted, used and reported.',
    ],
    helpTitle: 'Help us get this right',
    helpBody:
      'If you have experience with waqf or charity law, governance, or funding community projects, or you would like to support the platform once the structure exists, we would like to hear from you.',
    helpLink: 'Get in touch about the waqf',
  },

  contact: {
    title: 'Contact',
    description: 'How to reach the Al Ummah Now team about partnerships, the waqf direction, the code or a security problem.',
    heroTitle: 'Talk to us',
    heroLead: 'Messages go through the contact form on the videos site, which reaches the team’s inbox. No account is needed.',
    cards: [
      { title: 'Partnerships, donors and the waqf', body: 'Working together, supporting the platform, or advising on the waqf or charity structure.', action: 'Write to us', topic: 'partnership' },
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
};

export type Strings = typeof en;
