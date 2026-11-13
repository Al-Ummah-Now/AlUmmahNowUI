/**
 * Light / Dark on a scholar site: per viewer and per device (localStorage `aun_mode`), as on www
 * (no "System" option; first visit follows the device). The theme itself is the site's.
 * MODE_SCRIPT runs in <head> before first paint; the CSP allows it by MODE_SCRIPT_HASH (checked in
 * tests/theme-mode.test.ts). It also marks a browser with a site session (`aun_site_si`).
 */
export const MODE_SCRIPT =
  '(function(){var d=document.documentElement;d.setAttribute("data-js","");try{var m=localStorage.getItem("aun_mode");if(m==="light"||m==="dark")d.setAttribute("data-mode",m)}catch(e){}if(/(?:^|; )aun_site_si=1/.test(document.cookie))d.setAttribute("data-signed-in","")})();';

export const MODE_SCRIPT_HASH = "'sha256-XwjIa6wSPAXeAUqxAvJBpbeyovxbMfHIunz6UmC4DWU='";
