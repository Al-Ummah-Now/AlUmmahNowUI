// The error card's Go back and Copy reference (packages/render/src/error-page.ts). Go back shows only when
// there is a page to go back to; Copy shows only where the clipboard can be written.
// Every card on the page (the dev site's 404 has one per language).
(function () {
  var copies = document.querySelectorAll('[data-ep-copy]');
  if (window.navigator.clipboard && window.isSecureContext) {
    for (var c = 0; c < copies.length; c++) {
      copies[c].hidden = false;
      copies[c].addEventListener('click', function (e) {
        var btn = e.currentTarget;
        var label = btn.querySelector('span');
        window.navigator.clipboard.writeText(btn.getAttribute('data-ep-copy')).then(function () {
          if (label) label.textContent = btn.getAttribute('data-copied');
        }, function () {});
      });
    }
  }
  if (window.history.length < 2) return;
  var all = document.querySelectorAll('[data-ep-back]');
  for (var i = 0; i < all.length; i++) {
    all[i].hidden = false;
    all[i].addEventListener('click', function () { window.history.back(); });
  }
})();
