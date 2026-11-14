// @ts-check
import { defineConfig } from 'astro/config';

// alummahnow.dev (wiki AUN-DEV-SITE). Fully static: every page is prerendered and served by
// Cloudflare Workers static assets with no Worker script, so an idle site costs nothing and a
// visit runs no code. The HTML is the same in every environment; only robots.txt and _headers
// differ (scripts/env-files.ts), so QA and stage are noindex without a rebuild.
export default defineConfig({
  site: 'https://alummahnow.dev',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // CSP has no 'unsafe-inline': never inline stylesheets
    inlineStylesheets: 'never',
  },
  devToolbar: { enabled: false },
  vite: {
    // packages/render (the Fanous themes shared with www and the scholar sites) is imported by relative path
    server: { fs: { allow: ['../..'] } },
    build: {
      // CSP has no 'unsafe-inline': never inline scripts or assets as data: URIs
      assetsInlineLimit: 0,
    },
  },
});
