/**
 * Small inline-SVG product marks for the reference-style diagrams (wiki AUN-DEV-SITE; style
 * sample 5: recognisable product icons ~44px, name in plain text under the icon). Simplified but
 * recognisable; brand colours where they exist, line marks take the text colour. Rendered by
 * Reference.astro and LogoPipeline.astro — never baked into paths as text.
 */
export type LogoKind =
  | 'workers' | 'r2' | 'd1' | 'kv' | 'queues' | 'do' | 'containers' | 'workersAi' | 'images' | 'turnstile'
  | 'bunny' | 'resend' | 'apns' | 'fcm' | 'ghActions' | 'nextjs' | 'astro' | 'bknd' | 'openauth' | 'ffmpeg'
  | 'cloudflare' | 'person' | 'browser' | 'device' | 'tv' | 'chart' | 'pulse' | 'lock' | 'book' | 'mail' | 'bell' | 'gear' | 'search' | 'upload';

/** Each mark is a list of path/shape specs drawn in a 44×44 box. */
export interface MarkPart {
  d?: string;
  fill?: string;
  stroke?: string;
  text?: string;
  tx?: number;
  ty?: number;
  size?: number;
  weight?: number;
  flip?: boolean;
  strokeOnly?: boolean;
}
export const LOGOS: Record<LogoKind, MarkPart[]> = {
  // Cloudflare products: the brand orange, white glyphs
  workers: [{ d: 'M8 4h28a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z', fill: '#F6821F' }, { d: 'M25 10 14 25h6l-4 10 12-16h-7l4-9z', fill: '#fff' }],
  r2: [{ d: 'M8 4h28a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z', fill: '#F6821F' }, { text: 'R2', tx: 22, ty: 28, size: 15, fill: '#fff', weight: 700 }],
  d1: [{ d: 'M6 12c0-3.3 7.2-6 16-6s16 2.7 16 6-7.2 6-16 6-16-2.7-16-6z', fill: '#F6821F' }, { d: 'M6 12v20c0 3.3 7.2 6 16 6s16-2.7 16-6V12', stroke: '#F6821F', fill: 'none' }, { d: 'M6 22c0 3.3 7.2 6 16 6s16-2.7 16-6', stroke: '#F6821F', fill: 'none' }, { text: 'D1', tx: 22, ty: 26, size: 10, fill: '#fff', weight: 700 }],
  kv: [{ d: 'M6 4h32a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', fill: '#F6821F' }, { text: 'KV', tx: 22, ty: 16, size: 11, fill: '#fff', weight: 700 }, { d: 'M22 21v19M22 36l-5-4M22 32l4-4', stroke: '#F6821F', fill: 'none' }],
  queues: [{ d: 'M5 9h34v7H5zM5 18.5h34v7H5zM5 28h34v7H5z', fill: '#F6821F' }, { d: 'M13 6v32M31 6v32', stroke: '#fff', fill: 'none' }],
  do: [{ d: 'M22 3 39 12.5v19L22 41 5 31.5v-19z', fill: '#F6821F' }, { d: 'M22 14a8 8 0 1 0 .01 0', stroke: '#fff', fill: 'none' }, { d: 'M22 18.5a3.5 3.5 0 1 0 .01 0', fill: '#fff' }],
  containers: [{ d: 'M8 15 22 7l14 8-14 8z', fill: '#F6821F' }, { d: 'M8 15v14l14 8V23zM22 37l14-8V15L22 23z', fill: '#DA5C0D', stroke: '#F6821F' }],
  workersAi: [{ d: 'M22 4 26 18l14 4-14 4-4 14-4-14L4 22l14-4z', fill: '#F6821F' }, { d: 'M35 6l1.6 4.4L41 12l-4.4 1.6L35 18l-1.6-4.4L29 12l4.4-1.6z', fill: '#F6821F', flip: true }],
  images: [{ d: 'M5 8h34a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', fill: '#F6821F' }, { d: 'M9 30l7-8 5 5 6-9 8 12z', fill: '#fff' }, { d: 'M14 13a3 3 0 1 0 .01 0', fill: '#fff' }],
  turnstile: [{ d: 'M22 3 6 8v10c0 10 6.8 17.6 16 22 9.2-4.4 16-12 16-22V8z', fill: '#F6821F' }, { d: 'M14 21l6 6 10-12', stroke: '#fff', fill: 'none' }],
  cloudflare: [{ d: 'M12 33a7 7 0 0 1-1-14 10 10 0 0 1 19-2 7 7 0 0 1 1 16z', fill: '#F6821F' }, { d: 'M16 33h17', stroke: '#F6821F', fill: 'none' }],
  // Third parties in their brand colours
  bunny: [{ d: 'M13 6c3 0 4.5 6 4 11 1.5-2 4-3.5 5.5-3 2.5.8 1.5 4.5-.5 7 6 2.5 9 7 9 11H8c0-4 2-8 7-11-3-3-5-8-5-11 0-2.5 1-4 3-4z', fill: '#FAAB1E' }, { d: 'M16 9.5v4M20.5 11l-1 3.5', stroke: '#C77C0A', fill: 'none' }],
  resend: [{ d: 'M5 12h34a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z', fill: '#000', flip: true }, { d: 'M10 17l12 8 12-8', stroke: '#7FEE64', fill: 'none' }],
  apns: [{ d: 'M22 6a10 10 0 0 1 10 10c0 9 3.5 12 3.5 12H8.5S12 25 12 16A10 10 0 0 1 22 6z', fill: '#0070F0' }, { d: 'M17 32a5 5 0 0 0 10 0z', fill: '#0070F0' }],
  fcm: [{ d: 'M6 10h24a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z', fill: '#4285F4' }, { d: 'M24 22h14M32 16l6 6-6 6', stroke: '#4285F4', fill: 'none' }],
  ghActions: [{ d: 'M22 4a18 18 0 1 0 .01 0', fill: '#24292E', flip: true }, { d: 'M13 23l6 6 11-13', stroke: '#fff', fill: 'none' }],
  nextjs: [{ d: 'M22 4a18 18 0 1 0 .01 0', fill: '#111', flip: true }, { d: 'M15 30V15l13 17', stroke: '#fff', fill: 'none' }, { d: 'M28 15v11', stroke: '#fff', fill: 'none' }],
  astro: [{ d: 'M22 3 34 33l-6 3-4.5-11h-3L16 36l-6-3z', fill: '#FF5D01' }, { d: 'M17 38a5 5 0 0 0 10 0z', fill: '#7C3AED' }],
  bknd: [{ d: 'M8 4h28a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z', fill: '#3178C6' }, { text: 'b', tx: 22, ty: 31, size: 22, fill: '#fff', weight: 700 }],
  openauth: [{ d: 'M22 4 36 11v14c0 8-6 12.6-14 16-8-3.4-14-8-14-16V11z', fill: 'var(--gold, #f4ae3a)' }, { d: 'M17 22.5a5 5 0 1 0 .01 0M22 22.5V35M18 31l4 4 4-4', stroke: '#1e293b', fill: 'none' }],
  ffmpeg: [{ d: 'M8 4h28a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z', fill: '#007808' }, { d: 'M17 13l16 9-16 9z', fill: '#fff' }],
  // Generic line marks: take the diagram's text colour
  person: [{ d: 'M22 10a6 6 0 1 0 .01 0M11 38c1.5-7 5.5-10.5 11-10.5S31.5 31 33 38', strokeOnly: true }],
  browser: [{ d: 'M6 9h32a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z', strokeOnly: true }, { d: 'M4 16h36M8.5 12.5h.01M12 12.5h.01', strokeOnly: true }],
  device: [{ d: 'M14 5h16a2 2 0 0 1 2 2v30a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', strokeOnly: true }, { d: 'M19 34h6', strokeOnly: true }],
  tv: [{ d: 'M6 9h32a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z', strokeOnly: true }, { d: 'M16 35h12M22 31v4', strokeOnly: true }],
  chart: [{ d: 'M7 37V8M7 37h31M12 32V24M19 32V15M26 32v-6M33 32V12', strokeOnly: true }],
  pulse: [{ d: 'M5 22h8l4-11 7 22 4-11h10', strokeOnly: true }],
  lock: [{ d: 'M13 19V14a9 9 0 0 1 18 0v5', strokeOnly: true }, { d: 'M10 19h24a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V21a2 2 0 0 1 2-2z', strokeOnly: true }, { d: 'M22 25v6', strokeOnly: true }],
  book: [{ d: 'M7 10c5-2.5 10-2.5 15 1 5-3.5 10-3.5 15-1v24c-5-2.5-10-2.5-15 1-5-3.5-10-3.5-15-1z', strokeOnly: true }, { d: 'M22 11v24', strokeOnly: true }],
  mail: [{ d: 'M6 10h32a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z', strokeOnly: true }, { d: 'M5 13l17 12 17-12', strokeOnly: true }],
  bell: [{ d: 'M22 7a9 9 0 0 1 9 9c0 8 3 10 3 10H10s3-2 3-10a9 9 0 0 1 9-9z', strokeOnly: true }, { d: 'M18 32a4 4 0 0 0 8 0', strokeOnly: true }],
  gear: [{ d: 'M22 16.5a5.5 5.5 0 1 0 .01 0M22 6v5M22 33v5M6 22h5M33 22h5M10.7 10.7l3.5 3.5M29.8 29.8l3.5 3.5M33.3 10.7l-3.5 3.5M14.2 29.8l-3.5 3.5', strokeOnly: true }],
  search: [{ d: 'M20 8a11 11 0 1 0 .01 0M29 29l9 9', strokeOnly: true }],
  upload: [{ d: 'M22 34V10M13 19l9-9 9 9M8 39h28', strokeOnly: true }],
};
