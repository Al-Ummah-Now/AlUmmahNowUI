import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';

// getViteConfig compiles .astro files, so components render in tests (Astro's container API,
// tests/*-render.test.ts). Without the Cloudflare adapter (configFile: false): plain SSR.
// Astro bundles its own Vite types, which vitest's `test` augmentation doesn't reach: hence the cast.
// `cloudflare:workers` (lib/context.ts reads the bindings from it) only exists in workerd: a stub here.
const config: Parameters<typeof getViteConfig>[0] = {
  resolve: { alias: { 'cloudflare:workers': fileURLToPath(new URL('./tests/stubs/cloudflare-workers.ts', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
} as Parameters<typeof getViteConfig>[0];

export default getViteConfig(config, { configFile: false });
