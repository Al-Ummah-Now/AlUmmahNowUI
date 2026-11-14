/* The Dark mode toggle: flips the current mode (saved or the device's) and remembers it on this device. */
(function () {
  var d = document.documentElement;
  var dark = function () {
    var m = d.getAttribute('data-mode');
    return m ? m === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  var buttons = document.querySelectorAll('[data-mode-toggle]');
  var sync = function () {
    for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', dark() ? 'true' : 'false');
  };
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function () {
      var next = dark() ? 'light' : 'dark';
      d.setAttribute('data-mode', next);
      try { localStorage.setItem('aun_mode', next); } catch (e) {}
      sync();
    });
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync);
  sync();
})();
/* The phone menu: the nav is always visible without JS; with JS it opens from the Menu button. */
(function () {
  var b = document.querySelector('[data-menu-toggle]');
  if (!b) return;
  var close = function () { b.setAttribute('aria-expanded', 'false'); };
  b.addEventListener('click', function () {
    b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && b.getAttribute('aria-expanded') === 'true') { close(); b.focus(); }
  });
})();
