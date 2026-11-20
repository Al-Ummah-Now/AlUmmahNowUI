/** System design hub diagram copy (English). Same keys in hub.ar.ts. Facts: docs/SOURCES.md §1. */
export const hubEn = {
  pattern: {
    title: 'The common pattern, sketched',
    lead: 'Almost every feature follows the same shape: a request crosses Cloudflare’s edge to a Worker, which reads from a cache or a database and answers. Anything slow goes on a queue for background Workers. Logs, errors and real-user timings are collected around all of it.',
    desc: 'A hand-drawn sketch. People and apps reach the Cloudflare edge, with its content delivery network and Turnstile bot checks. The edge hands requests to Workers: the sites, the APIs and sign-in. Workers read and write the caches and the data: KV, D1 and R2, and video segments come back to viewers from R2 through the edge cache. Slow work goes on Queues, with retries and dead-letter queues, for background Workers such as processor and scheduler, which call Workers AI for moderation and captions and start transcodes in Cloudflare Containers. Along the bottom, observability surrounds everything: Workers Logs, the admin Errors page and real-user monitoring.',
    heading: 'How the pieces fit',
    around: 'observability surrounds everything',
    node: {
      clients: { title: 'People and apps', note: 'browsers · apps · embeds' },
      edge: { title: 'Cloudflare edge', note: 'cache · bot checks' },
      workers: { title: 'Workers', note: 'sites · APIs · sign-in' },
      data: { title: 'Cache and data', note: 'KV · D1 · R2 stores' },
      ai: { title: 'Workers AI', note: 'moderation · captions' },
      queue: { title: 'Queues', note: 'retry · dead letters' },
      bg: { title: 'Background Workers', note: 'processor · scheduler' },
      container: { title: 'Containers', note: 'FFmpeg transcodes' },
    },
    obs: { logs: 'Logs', errors: 'Errors', rum: 'Visitor page speed' },
    tag: { segments: 'video segments', later: 'queued' },
  },
};
