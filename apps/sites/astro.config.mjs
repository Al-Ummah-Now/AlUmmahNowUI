// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// The scholar sites Worker (AUN-SCHOLAR-SITES SS3). SSR on Cloudflare Workers; one bundle serves
// every site: the site comes from the request's host (src/worker.ts), never from build config.
export default defineConfig({
  output: 'server',
  trailingSlash: 'ignore',
  adapter: cloudflare({
    // wrangler.build.jsonc's main is src/worker.ts, which wraps Astro: host → site lookup, redirects,
    // HTML edge cache, security headers
    configPath: 'wrangler.build.jsonc',
    imageService: 'passthrough',
  }),
  build: {
    // CSP has no 'unsafe-inline': never inline stylesheets
    inlineStylesheets: 'never',
  },
  security: { checkOrigin: false },
  devToolbar: { enabled: false },
  vite: {
    // packages/render is imported by relative path (TypeScript source, shared with www)
    server: { fs: { allow: ['../..'] } },
    build: {
      // CSP has no 'unsafe-inline': never inline scripts or assets as data: URIs
      assetsInlineLimit: 0,
    },
  },
});
