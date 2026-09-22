/**
 * PB&J bread cards + jelly mascot — progressive enhancement for /pricing.
 *
 * Adapted from the PBJ-Jelly-Handoff reference module (revision 3).
 * Differences from the reference, all deliberate:
 *   - Missing templates are a silent no-op instead of a thrown error, so the
 *     page can never be broken by the enhancement failing to find its art.
 *   - `pbj-jelly-arriving` is cleared when the arrival animation finishes, so
 *     no stale animation class is left on a card.
 *   - A `pbj-jelly-root` class is put on the root and `pbj-jelly-ready` is
 *     added one frame later, so the resting tilt is painted without a
 *     transition on first load (the brief forbids any intro motion).
 *   - The ResizeObserver draws width-scaled crust and crown geometry, extends the straight sides for content, and reserves matching padding.
 *   - The resting tilt is budgeted against the page gutter beside each card
 *     rather than a flat fraction of its width, so ordinary cards rest at the
 *     brief's full 2.2 degrees and only tall or edge-hugging ones are reduced.
 *   - It clears the inline script's .pbj-jelly-pending size reservation on
 *     every exit path, and warns once (rather than throwing, or failing
 *     silently) when it has nothing to work with.
 *
 * Only ever feed this trusted, author-written SVG templates.
 * Returns a cleanup function that restores the original DOM exactly.
 * Calling it twice on the same root tears the first instance down first.
 */

const pbjJellyInstances = new WeakMap();
let pbjJellySerial = 0;
let pbjJellyWarned = false;

export function initPbjJelly({
  root = document,
  cardSelector = '.price-card',
  characterTemplate = document.getElementById('pbj-jelly-template'),
  breadTemplate = document.getElementById('pbj-bread-template')
} = {}) {
  const noop = () => {};
  const rootEl = root ? (root.nodeType === 1 ? root : root.documentElement) : null;
  // The inline reservation script pre-sizes the cards before first paint; give
  // that back whenever this function declines to enhance, so a page with JS on
  // but the enhancement unavailable renders exactly like a page with JS off.
  const clearPending = () => rootEl?.classList.remove('pbj-jelly-pending');

  const decline = reason => {
    clearPending();
    if (!pbjJellyWarned) {
      pbjJellyWarned = true;
      console.warn(`PB&J jelly: ${reason} — leaving the original pricing cards untouched.`);
    }
    return noop;
  };

  // Without both SVG templates the original cards are the (perfectly good) result.
  if (!root) return decline('no root element was given');
  if (!characterTemplate?.content?.querySelector('svg') || !breadTemplate?.content?.querySelector('svg')) {
    return decline('the #pbj-jelly-template / #pbj-bread-template SVG templates are missing');
  }

  pbjJellyInstances.get(root)?.();

  const cards = Array.from(root.querySelectorAll(cardSelector));
  if (!cards.length) return decline(`no "${cardSelector}" cards were found inside the root`);

  const controller = new AbortController();
  const signal = controller.signal;
  const timers = new Map();
  const inserted = [];
  const surfaces = [];
  const priorSafeTilts = new Map();
  const group = ++pbjJellySerial;
  let current = null;
  let readyFrame = 0;

  function select(card) {
    // Any interaction ends the welcome wave for the rest of the page session.
    cards.forEach(item => item.classList.remove('pbj-jelly-welcome'));
    if (card === current) return;

    if (current) {
      const previous = current;
      previous.classList.remove('pbj-jelly-active', 'pbj-jelly-arriving');
      previous.classList.add('pbj-jelly-leaving');
      clearTimeout(timers.get(previous));
      timers.set(previous, setTimeout(() => {
        previous.classList.remove('pbj-jelly-leaving');
        timers.delete(previous);
      }, 180));
    }

    clearTimeout(timers.get(card));
    timers.delete(card);
    card.classList.remove('pbj-jelly-leaving');
    card.classList.add('pbj-jelly-active', 'pbj-jelly-arriving');
    current = card;

    // The arrival keyframes end exactly on the static seated/tilted values,
    // so dropping the class when they finish is visually seamless.
    timers.set(card, setTimeout(() => {
      if (current === card) card.classList.remove('pbj-jelly-arriving');
      timers.delete(card);
    }, 1000));
  }

  cards.forEach((card, index) => {
    const perch = document.createElement('span');
    perch.className = 'pbj-jelly-perch';
    perch.setAttribute('aria-hidden', 'true');

    const character = characterTemplate.content.querySelector('svg').cloneNode(true);
    character.removeAttribute('aria-labelledby');
    character.removeAttribute('role');
    character.setAttribute('aria-hidden', 'true');
    character.setAttribute('focusable', 'false');
    // Per-instance id prefix keeps the document free of duplicate ids while
    // the stylesheet targets the stable data-jelly-part names.
    character.querySelectorAll('[id]').forEach(part => {
      part.dataset.jellyPart = part.id;
      part.id = `pbj-${group}-${index}-${part.id}`;
    });
    perch.append(character);

    const bread = breadTemplate.content.querySelector('svg').cloneNode(true);
    bread.classList.add('pbj-bread-art');
    bread.removeAttribute('aria-labelledby');
    bread.removeAttribute('role');
    bread.setAttribute('aria-hidden', 'true');
    bread.setAttribute('focusable', 'false');
    bread.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

    const shadow = document.createElement('span');
    shadow.className = 'pbj-jelly-shadow';
    shadow.setAttribute('aria-hidden', 'true');

    const surface = document.createElement('div');
    surface.className = 'pbj-card-surface';
    // Move (never re-create) the original nodes: identity, listeners and the
    // article's accessible name association all survive untouched.
    while (card.firstChild) surface.append(card.firstChild);
    surface.prepend(bread, shadow, perch);
    card.append(surface);

    surfaces.push({ card, surface, bread });
    inserted.push(bread, shadow, perch);
    card.classList.add('pbj-bread-card');

    card.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') select(card);
    }, { signal });
    card.addEventListener('focusin', () => select(card), { signal });
    // Passive: never blocks a quote link's first tap, nor vertical scrolling.
    card.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') select(card);
    }, { signal, passive: true });
  });

  // Size the crown and crust from width; only the straight sides grow with copy.
  const quantise = value => Math.ceil(value / 4) * 4;

  function fit() {
    const docWidth = document.documentElement.clientWidth;
    surfaces.forEach(({ card, surface, bread }) => {
      const height = surface.offsetHeight;
      const width = surface.offsetWidth;
      if (!height || !width) return;

      /* Resting tilt. Rotating about 50% 96% swings the card's top-right
         corner — and the character riding above it — to the right by about
         (0.96 * height + 116) * sin(angle); measured against the real box,
         0.96 * height is the corner and the +116 covers the character. The
         arrival overshoots to 1.6x the resting angle, so the peak is what has
         to fit inside the page gutter beside the card, or the page grows a
         horizontal scrollbar mid-hop. Ordinary desktop cards have 60px of
         gutter and rest at the brief's full 2.2 degrees; tall cards and cards
         whose container hugs the viewport are reduced. */
      const rect = card.getBoundingClientRect();
      const lift = height * 0.96 + 116;
      const gutter = Math.min(rect.left, docWidth - rect.right) - 2;
      const budget = Math.min(46, Math.max(6, gutter));
      const peak = Math.asin(Math.min(1, budget / lift)) * 180 / Math.PI;
      card.style.setProperty('--pbj-safe-tilt', `${Math.min(2.2, peak / 1.6).toFixed(3)}deg`);

      card.style.setProperty('--pbj-card-padding-top', `${quantise(Math.max(76, width * .21))}px`);
      card.style.setProperty('--pbj-card-padding-bottom', `${quantise(Math.max(36, width * .1))}px`);
      card.style.setProperty('--pbj-crown-y', `${(width * .065).toFixed(2)}px`);

      const h = +(height / width * 300).toFixed(2);
      bread.setAttribute('viewBox', `0 0 300 ${h}`);
      const [crust, crumb] = bread.querySelectorAll('path');
      crust.setAttribute('d', `M18 92 C-4 79 -1 46 17 30 C45 6 98 5 150 15 C202 5 255 6 283 30 C301 46 304 79 282 92 L275 ${h-36} Q274 ${h-10} 252 ${h-9} Q150 ${h-2} 48 ${h-9} Q26 ${h-10} 25 ${h-36}Z`);
      crumb.setAttribute('d', `M28 87 C10 73 12 52 27 39 C52 17 99 16 150 26 C201 16 248 17 273 39 C288 52 290 73 272 87 L265 ${h-36} Q264 ${h-20} 250 ${h-19} Q150 ${h-12} 50 ${h-19} Q36 ${h-20} 35 ${h-36}Z`);
      const flecks = bread.querySelectorAll('ellipse');
      [[29, 115], [271, h*.48], [30, h*.7], [270, h-39], [68, h-15]].forEach(([x, y], i) => {
        flecks[i]?.setAttribute('cx', x);
        flecks[i]?.setAttribute('cy', y);
      });
    });
  }

  cards.forEach(card => priorSafeTilts.set(card, {
    tilt: card.style.getPropertyValue('--pbj-safe-tilt'),
    top: card.style.getPropertyValue('--pbj-card-padding-top'),
    bottom: card.style.getPropertyValue('--pbj-card-padding-bottom'),
    crown: card.style.getPropertyValue('--pbj-crown-y')
  }));

  rootEl?.classList.add('pbj-jelly-root');
  clearPending();

  // Seated before the first paint the visitor sees: no intro hop, and the
  // recommended card already carries its resting tilt.
  current = cards.find(card => card.classList.contains('price-card--featured')) || cards[0];
  current.classList.add('pbj-jelly-active', 'pbj-jelly-welcome');

  fit();
  const sizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
  surfaces.forEach(({ surface }) => sizeObserver?.observe(surface));

  // Surface transitions only start once the resting state has been painted.
  readyFrame = requestAnimationFrame(() => {
    readyFrame = 0;
    rootEl?.classList.add('pbj-jelly-ready');
  });

  function destroy() {
    controller.abort();
    sizeObserver?.disconnect();
    if (readyFrame) cancelAnimationFrame(readyFrame);
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
    inserted.forEach(node => node.remove());
    surfaces.forEach(({ card, surface }) => {
      while (surface.firstChild) card.insertBefore(surface.firstChild, surface);
      surface.remove();
    });
    cards.forEach(card => card.classList.remove(
      'pbj-bread-card', 'pbj-jelly-active', 'pbj-jelly-leaving', 'pbj-jelly-arriving', 'pbj-jelly-welcome'
    ));
    priorSafeTilts.forEach((prior, card) => {
      const restore = (name, value) => {
        if (value) card.style.setProperty(name, value);
        else card.style.removeProperty(name);
      };
      restore('--pbj-safe-tilt', prior.tilt);
      restore('--pbj-card-padding-top', prior.top);
      restore('--pbj-card-padding-bottom', prior.bottom);
      restore('--pbj-crown-y', prior.crown);
      if (!card.getAttribute('style')) card.removeAttribute('style');
    });
    rootEl?.classList.remove('pbj-jelly-root', 'pbj-jelly-ready', 'pbj-jelly-pending');
    current = null;
    pbjJellyInstances.delete(root);
  }

  pbjJellyInstances.set(root, destroy);
  return destroy;
}
