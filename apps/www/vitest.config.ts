import { getViteConfig } from 'astro/config';

// getViteConfig compiles .astro files, so components render in tests (Astro's container API,
// tests/*-render.test.ts). Without the Cloudflare adapter (configFile: false): plain SSR.
// Astro bundles its own Vite types, which vitest's `test` augmentation doesn't reach: hence the cast.
const config: Parameters<typeof getViteConfig>[0] = {
  test: {
    include: ['tests/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
} as Parameters<typeof getViteConfig>[0];

export default getViteConfig(config, { configFile: false });
