// The error card's Go back (packages/render/src/error-page.ts): shown only when there is a page to go back to.
(function () {
  var b = document.querySelector('[data-ep-back]');
  if (!b || window.history.length < 2) return;
  b.hidden = false;
  b.addEventListener('click', function () { window.history.back(); });
})();
