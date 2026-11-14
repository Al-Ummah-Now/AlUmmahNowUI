/* Light / Dark before first paint (wiki Theming: Light / Dark only, never "System"). Nothing saved: the
   device decides through CSS. A saved choice is forced with <html data-mode>. An old "system" is
   resolved once to the device's mode. Keep it tiny and ES5. */
(function () {
  var d = document.documentElement;
  try {
    var m = localStorage.getItem('aun_mode');
    if (m === 'system') {
      m = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      localStorage.setItem('aun_mode', m);
    }
    if (m === 'light' || m === 'dark') d.setAttribute('data-mode', m);
  } catch (e) {}
  d.setAttribute('data-js', '');
})();
