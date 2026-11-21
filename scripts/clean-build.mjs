// After `astro build` (www and sites `npm run build`, run in the app folder): the Cloudflare Vite plugin
// copies .dev.vars (local secrets) next to the built Worker. Deploys read wrangler.jsonc, never that
// copy, and a build artifact must never carry a secret.
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
rmSync(resolve(process.cwd(), 'dist/server/.dev.vars'), { force: true });
