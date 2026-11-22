// The error card's Go back (packages/render/src/error-page.ts): shown only when there is a page to go back to.
// Every card on the page (the dev site's 404 has one per language).
(function () {
  if (window.history.length < 2) return;
  var all = document.querySelectorAll('[data-ep-back]');
  for (var i = 0; i < all.length; i++) {
    all[i].hidden = false;
    all[i].addEventListener('click', function () { window.history.back(); });
  }
})();
