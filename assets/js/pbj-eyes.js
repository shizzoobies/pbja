(function () {
  'use strict';

  var allowed = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  var rigs = new Map();
  var pointer = null;
  var frame = 0;
  var assets = new Map();
  var svgNS = 'http://www.w3.org/2000/svg';

  function register() {
    document.querySelectorAll('.pbj-cameo svg, .pbj-button-mascot svg, .pbj-jelly-perch svg').forEach(function (svg) {
      if (rigs.has(svg)) return;
      var pupil = svg.querySelector('ellipse[fill="#18394f"]');
      if (!pupil) return;
      var eyes = pupil.parentElement;
      var group = document.createElementNS(svgNS, 'g');
      group.setAttribute('data-pbj-pupils', '');
      eyes.querySelectorAll('ellipse[fill="#18394f"], circle[fill="#fff"]').forEach(function (part) {
        group.appendChild(part);
      });
      eyes.appendChild(group);
      rigs.set(svg, {eyes: eyes, pupils: group});
    });
    schedule();
  }

  function update() {
    frame = 0;
    rigs.forEach(function (rig, svg) {
      if (!svg.isConnected) { rigs.delete(svg); return; }
      var x = 0;
      var y = 0;
      var rect = svg.getBoundingClientRect();
      var moving = svg.closest('[data-pbj-moving], .pbj-jelly-arriving, .pbj-jelly-leaving');
      if (allowed.matches && pointer && !moving && rect.width && rect.bottom > 0 && rect.top < innerHeight && getComputedStyle(svg).visibility === 'visible') {
        var matrix = rig.eyes.getScreenCTM();
        if (matrix) {
          var point = new DOMPoint(pointer.x, pointer.y).matrixTransform(matrix.inverse());
          var dx = point.x - 120;
          var dy = point.y - 132;
          var distance = Math.hypot(dx, dy);
          // Keep the pupils comfortably inside their blue irises.
          var reach = Math.min(1, distance / 100);
          if (distance) { x = dx / distance * 1.7 * reach; y = dy / distance * 1.6 * reach; }
        }
      }
      rig.pupils.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)';
    });
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function reset() { pointer = null; schedule(); }

  function prepareImages() {
    if (!allowed.matches) return;
    document.querySelectorAll('.pbj-cameo > img, .pbj-button-mascot > img').forEach(function (img) {
      if (img.dataset.pbjEyesLoading || !/\/jelly-corner-seated\.svg$/.test(img.src)) return;
      img.dataset.pbjEyesLoading = 'true';
      if (!assets.has(img.src)) assets.set(img.src, fetch(img.src).then(function (response) {
        if (!response.ok) throw new Error('Jar artwork unavailable');
        return response.text();
      }));
      assets.get(img.src).then(function (source) {
        if (!img.isConnected) return;
        var svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
        if (svg.localName !== 'svg') return;
        // This is our own static asset; remove document IDs before inserting a copy.
        svg.querySelectorAll('[id]').forEach(function (part) { part.removeAttribute('id'); });
        svg.querySelectorAll('title, desc').forEach(function (part) { part.remove(); });
        svg.removeAttribute('role');
        svg.removeAttribute('aria-labelledby');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        img.replaceWith(document.importNode(svg, true));
        register();
      }).catch(function () { /* Keep the original image if enhancement is unavailable. */ });
    });
  }

  document.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch') { reset(); return; }
    if (!allowed.matches) return;
    pointer = {x: event.clientX, y: event.clientY};
    schedule();
  }, {passive: true});
  document.documentElement.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);
  document.addEventListener('scroll', schedule, {capture: true, passive: true});
  window.addEventListener('resize', schedule, {passive: true});
  allowed.addEventListener('change', function () { reset(); prepareImages(); });
  new MutationObserver(function (records) {
    if (records.some(function (record) {
      return Array.from(record.addedNodes).some(function (node) {
        return node.nodeType === 1 && (node.matches('svg') || node.querySelector('svg'));
      });
    })) register();
  }).observe(document.body, {childList: true, subtree: true});
  register();
  prepareImages();
})();
