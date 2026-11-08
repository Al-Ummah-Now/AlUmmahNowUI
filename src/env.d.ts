/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<import('./lib/env').WwwEnv>;

declare namespace App {
  interface Locals extends Runtime {
    /** Set by pages before rendering a 404/500 so the error page speaks the right language. */
    locale?: import('./lib/locale').Locale;
  }
}
