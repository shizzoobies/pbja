(function () {
  'use strict';
  var control = document.getElementById('footer-motion-toggle');
  if (!control) return;
  var video = document.querySelector('.hero-full video');
  var ticker = document.querySelector('.reviews-ticker');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var paused = reduced.matches;
  control.hidden = false;

  function sync() {
    control.textContent = paused ? 'Resume motion' : 'Pause motion';
    control.setAttribute('aria-pressed', String(paused));
    if (ticker) ticker.classList.toggle('is-paused', paused);
    if (video && paused) video.pause();
  }
  control.addEventListener('click', function () {
    paused = !paused;
    if (!paused && video) video.play().catch(function () {});
    sync();
  });
  reduced.addEventListener('change', function () {
    if (reduced.matches) { paused = true; sync(); }
  });
  sync();
})();
