// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// SSR on Cloudflare Workers. The site URL is per env (SITE_URL var at runtime), so
// nothing here depends on the environment: the same bundle ships to QA, stage and prod.
export default defineConfig({
  output: 'server',
  trailingSlash: 'ignore',
  adapter: cloudflare({
    // wrangler.build.jsonc's main is src/worker.ts, which wraps Astro: apex redirect, `/` locale redirect,
    // HTML edge cache, security headers (applied to static assets too, see run_worker_first in wrangler.jsonc).
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
    plugins: [tailwindcss()],
    build: {
      // CSP has no 'unsafe-inline': never inline scripts or assets as data: URIs
      assetsInlineLimit: 0,
    },
  },
});
