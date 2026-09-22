(function () {
  'use strict';

  // Pricing keeps its original single jar travelling between bread slices.
  if (document.getElementById('pbj-jelly-template')) return;

  var selector = '.btn, .btn-secondary, .btn-gold';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mascot = document.createElement('span');
  mascot.className = 'pbj-button-mascot';
  mascot.setAttribute('aria-hidden', 'true');
  mascot.hidden = true;
  var image = document.createElement('img');
  image.src = new URL('../img/pbj/jelly-corner-seated.svg', document.currentScript.src).href;
  image.alt = '';
  image.width = 240;
  image.height = 250;
  mascot.appendChild(image);
  document.body.appendChild(mascot);

  var target = null;
  var flight = null;
  var frame = 0;
  var resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(schedule) : null;
  var positionObserver = new MutationObserver(schedule);

  function clippingBounds(button) {
    var clip = {top: 0, left: 0, right: document.documentElement.clientWidth, bottom: innerHeight};
    for (var parent = button.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      var style = getComputedStyle(parent);
      var rect = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        clip.top = Math.max(clip.top, rect.top);
        clip.bottom = Math.min(clip.bottom, rect.bottom);
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        clip.left = Math.max(clip.left, rect.left);
        clip.right = Math.min(clip.right, rect.right);
      }
    }
    return clip;
  }

  function visible(button) {
    if (!button || !button.isConnected || button.matches(':disabled, [aria-disabled="true"]')) return false;
    if (button.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    var style = getComputedStyle(button);
    var rect = button.getBoundingClientRect();
    var clip = clippingBounds(button);
    return style.visibility === 'visible' && rect.width > 0 && rect.height > 0 &&
      rect.top >= clip.top && rect.top < clip.bottom && rect.right > clip.left && rect.left < clip.right;
  }

  function position(button) {
    var rect = button.getBoundingClientRect();
    var clip = clippingBounds(button);
    var tilt = parseFloat(getComputedStyle(button).rotate) || 0;
    var cornerY = rect.top + Math.max(0, Math.sin(tilt * Math.PI / 180) * rect.width);
    var size = innerWidth <= 768 ? 48 : 64;
    if (rect.width < 70 || rect.height < 38) size = Math.min(size, 42);
    // Shrink near the top edge so the jar stays above the button's label.
    size = Math.min(size, Math.max(16, (cornerY - clip.top - 2) / .82));
    var x = Math.max(clip.left + 2, Math.min(clip.right - size - 2, rect.right - size * .5 - 5));
    var y = Math.max(clip.top + 2, cornerY - size * .82);
    return {x: x, y: y, size: size};
  }

  function transform(x, y, rotate, scaleX, scaleY) {
    return 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + (rotate || 0) + 'deg) scale(' + (scaleX || 1) + ',' + (scaleY || 1) + ')';
  }

  function stopFlight() {
    if (flight) { flight.cancel(); flight = null; }
    mascot.removeAttribute('data-pbj-moving');
  }

  function hide() {
    stopFlight();
    if (resizeObserver) resizeObserver.disconnect();
    positionObserver.disconnect();
    if (target) target.classList.remove('pbj-button-occupied');
    target = null;
    mascot.hidden = true;
    document.documentElement.classList.remove('pbj-button-active');
  }

  function update() {
    frame = 0;
    if (!target) return;
    if (!visible(target)) { hide(); return; }
    stopFlight();
    var dest = position(target);
    mascot.style.width = dest.size + 'px';
    mascot.style.transform = transform(dest.x, dest.y);
  }

  function schedule() {
    if (target && !frame) frame = requestAnimationFrame(update);
  }

  function select(button, animate) {
    if (!visible(button) || target === button) return;
    var previous = !mascot.hidden ? mascot.getBoundingClientRect() : null;
    if (!previous) {
      var resting = document.querySelector('.pbj-cameo');
      if (resting && visible(resting)) previous = resting.getBoundingClientRect();
    }
    stopFlight();
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (resizeObserver) resizeObserver.disconnect();
    positionObserver.disconnect();
    if (target) target.classList.remove('pbj-button-occupied');
    target = button;
    target.classList.add('pbj-button-occupied');
    var dest = position(button);
    mascot.hidden = false;
    mascot.style.width = dest.size + 'px';
    mascot.style.transform = transform(dest.x, dest.y);
    document.documentElement.classList.add('pbj-button-active');

    if (animate && !reduced.matches && typeof mascot.animate === 'function') {
      mascot.setAttribute('data-pbj-moving', '');
      var startX = previous ? previous.left : dest.x - 28;
      var startY = previous ? previous.top : dest.y + 18;
      if (Math.hypot(startX - dest.x, startY - dest.y) > 800) { startX = dest.x - 28; startY = dest.y + 18; }
      var apex = Math.max(3, Math.min(startY, dest.y) - 55);
      flight = mascot.animate([
        {transform: transform(startX, startY, -8), offset: 0},
        {transform: transform((startX + dest.x) / 2, apex, 7, .94, 1.06), offset: .43},
        {transform: transform(dest.x, dest.y + 2, -3, 1.1, .9), offset: .78},
        {transform: transform(dest.x, dest.y), offset: 1}
      ], {duration: 620, easing: 'ease-in-out'});
      var currentFlight = flight;
      flight.onfinish = function () {
        if (flight !== currentFlight) return;
        flight = null;
        mascot.removeAttribute('data-pbj-moving');
        if (resizeObserver && target) resizeObserver.observe(target);
        update();
      };
    } else if (resizeObserver) resizeObserver.observe(target);
    // Follow layout changes only along the selected action's ancestor chain.
    for (var node = target; node && node !== document.body; node = node.parentElement) {
      positionObserver.observe(node, {attributes: true, attributeFilter: ['style', 'class']});
    }
  }

  document.addEventListener('pointerover', function (event) {
    if (event.pointerType === 'touch') return;
    var button = event.target.closest(selector);
    if (button) select(button, true);
    else if (event.target.closest('.price-card')) hide();
  });
  document.addEventListener('focusin', function (event) {
    var button = event.target.closest(selector);
    if (button) select(button, true);
    else if (event.target.closest('[role="dialog"]') && target && !event.target.closest('[role="dialog"]').contains(target)) hide();
  });
  document.addEventListener('pointerdown', function (event) {
    var button = event.target.closest(selector);
    if (button && event.pointerType === 'touch') select(button, false);
  }, {passive: true});

  // Follow sticky controls and nested scrolling panels, and discard removed controls.
  document.addEventListener('scroll', schedule, {capture: true, passive: true});
  window.addEventListener('resize', schedule, {passive: true});
  window.addEventListener('pagehide', hide);
  reduced.addEventListener('change', schedule);
  new MutationObserver(function (records) {
    if (!target) return;
    if (records.some(function (record) { return !mascot.contains(record.target) && record.target !== mascot; })) schedule();
  }).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'aria-hidden', 'aria-disabled', 'open']});
})();
