(function () {
  'use strict';

  var cameos = document.querySelectorAll('[data-pbj-motion]');
  var canAnimate = window.matchMedia('(min-width: 769px) and (prefers-reduced-motion: no-preference)');
  if (!cameos.length || !canAnimate.matches || !('IntersectionObserver' in window)) return;

  // The existing contact handler creates this status before deferred scripts run.
  var sent = !!document.getElementById('form-status');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      if (canAnimate.matches) entry.target.classList.add('is-greeting');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.65 });

  cameos.forEach(function (cameo) {
    if (cameo.hasAttribute('data-pbj-after-send') && !sent) return;
    observer.observe(cameo);
  });

  // A preference change immediately stops any greeting already in progress.
  canAnimate.addEventListener('change', function () {
    if (canAnimate.matches) return;
    observer.disconnect();
    cameos.forEach(function (cameo) { cameo.classList.remove('is-greeting'); });
  });
})();

(function () {
  'use strict';

  var notes = document.querySelectorAll('.pbj-note');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!notes.length || reduced.matches || !('IntersectionObserver' in window)) return;

  // Observe the unclipped paragraph so an unwritten note can still intersect.
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-written');
      observer.unobserve(entry.target);
    });
  }, {threshold: 0, rootMargin: '0px 0px -8% 0px'});

  notes.forEach(function (note) {
    var delay = 0;
    var fragment = document.createDocumentFragment();
    Array.from(note.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) { fragment.appendChild(node.cloneNode(true)); return; }
      node.textContent.split(/(\s+)/).forEach(function (word) {
        if (!word.trim()) { fragment.appendChild(document.createTextNode(word)); return; }
        var span = document.createElement('span');
        var duration = Math.max(140, word.length * 45);
        span.className = 'pbj-ink-word';
        span.textContent = word;
        span.style.setProperty('--ink-delay', delay + 'ms');
        span.style.setProperty('--ink-duration', duration + 'ms');
        fragment.appendChild(span);
        delay += duration;
      });
    });
    note.replaceChildren(fragment);
    note.style.setProperty('--ink-finish', delay + 'ms');
    note.setAttribute('data-pbj-ink', '');
    observer.observe(note);
  });

  reduced.addEventListener('change', function () {
    if (!reduced.matches) return;
    observer.disconnect();
    notes.forEach(function (note) { note.removeAttribute('data-pbj-ink'); });
  });
})();
