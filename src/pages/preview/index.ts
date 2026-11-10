/** /preview?token=… from the CMS editor → token into a cookie, 303 to a token-free URL (src/lib/preview.ts). */
import type { APIRoute } from 'astro';
import { enterPreview } from '../../lib/preview';

export const prerender = false;
export const GET: APIRoute = ({ url }) => enterPreview(url);
