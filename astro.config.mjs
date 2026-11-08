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
    // src/worker.ts wraps Astro: apex redirect, `/` locale redirect, HTML edge cache,
    // security headers (applied to static assets too, see run_worker_first in wrangler.jsonc).
    workerEntryPoint: { path: 'src/worker.ts' },
    platformProxy: { enabled: true },
    imageService: 'passthrough',
  }),
  build: {
    // CSP has no 'unsafe-inline': never inline stylesheets
    inlineStylesheets: 'never',
  },
  security: { checkOrigin: false },
  devToolbar: { enabled: false },
  vite: {
    // @tailwindcss/vite is typed against Vite 7, Astro 5 bundles Vite 6; the plugin works with both
    plugins: [/** @type {any} */ (tailwindcss())],
    build: {
      // CSP has no 'unsafe-inline': never inline scripts or assets as data: URIs
      assetsInlineLimit: 0,
    },
  },
});
