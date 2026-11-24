/** Every page's diagrams, by id (one module per page; see types.ts). */
import type { Builder } from './types.ts';
import { builders as delivery } from './delivery.ts';
import { builders as data } from './data.ts';
import { builders as async } from './async.ts';
import { builders as realtime } from './realtime.ts';
import { builders as identity } from './identity.ts';
import { builders as ai } from './ai.ts';
import { builders as cost } from './cost.ts';
import { builders as scaling } from './scaling.ts';
import { builders as clients } from './clients.ts';
import { builders as release } from './release.ts';
import { builders as hub } from './hub.ts';
import { builders as pipeline } from './pipeline.ts';
import { builders as auth } from './auth.ts';

export const PAGE_BUILDERS: Record<string, Builder> = {
  ...delivery,
  ...data,
  ...async,
  ...realtime,
  ...identity,
  ...ai,
  ...cost,
  ...scaling,
  ...clients,
  ...release,
  ...hub,
  ...pipeline,
  ...auth,
};
