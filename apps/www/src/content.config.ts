import { defineCollection } from 'astro:content';

// src/content/fallback holds the built-in content as TypeScript modules (SPEC §5), not a
// content collection. Declaring it with an empty loader stops Astro auto-generating one.
export const collections = {
  fallback: defineCollection({ loader: () => [] }),
};
