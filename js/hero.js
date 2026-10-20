/* ============================================================
   Card Crest — hero.js
   The circulation ring: cards revolve around a glowing core.
   - auto-rotates; slows when the pointer is over it
   - drag (mouse or touch) to spin, with momentum on release
   - scrolling the page nudges the rotation
   - the card nearest the front is brightened and described below the ring
   - a click (not a drag) opens that card
   Reduced-motion: no auto-rotation or scroll link, but dragging still works.
   ============================================================ */
(function (w, d) {
  'use strict';

  function format(el, n) {
    return el.hasAttribute('data-money') ? w.CC.UI.money(n) : String(Math.round(n));
  }

  function countUp(scope) {
    scope.querySelectorAll('[data-count]').forEach(function (el) {
      var end = Number(el.getAttribute('data-count')) || 0, t0 = null, dur = 1400;
      function step(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4); // easeOutQuart
        el.textContent = format(el, end * e);
        if (p < 1) requestAnimationFrame(step); else el.textContent = format(el, end);
      }
      el.textContent = format(el, 0);
      requestAnimationFrame(step);
      // animation frames pause in background tabs; make sure the real number always lands
      setTimeout(function () { el.textContent = format(el, end); }, dur + 400);
    });
  }

  var Hero = {
    mount: function (root) {
      var scope = root || d;
      var stage = scope.querySelector('#heroStage');
      if (!stage) return;
      var reduced = w.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!reduced) countUp(scope.querySelector('.hero') || scope);

      var ring = stage.querySelector('.ring');
      var cards = [].slice.call(ring.querySelectorAll('.rc'));
      var n = cards.length, step = 360 / n;
      var info = stage.querySelector('.stage__info');
      var elBank = info.querySelector('.stage__bank'), elName = info.querySelector('.stage__name'),
          elScore = info.querySelector('.stage__score b'), elGo = info.querySelector('.stage__go');

      var rot = 0, vel = 0, dragging = false, hover = false, lastX = 0, moved = 0, startCard = null;
      var front = -1, swapTimer = 0;

      function setFront(i) {
        front = i;
        var c = cards[i];
        info.classList.add('is-swap');
        clearTimeout(swapTimer);
        swapTimer = setTimeout(function () {
          elBank.textContent = c.getAttribute('data-bank');
          elName.textContent = c.getAttribute('data-name');
          elScore.textContent = c.getAttribute('data-score');
          info.classList.remove('is-swap');
        }, front === -1 ? 0 : 160);
      }

      stage.addEventListener('pointerdown', function (e) {
        // let the "View card" link behave like a normal link (pointer capture would swallow its click)
        if (e.target.closest && e.target.closest('.stage__go')) return;
        dragging = true; moved = 0; vel = 0; lastX = e.clientX;
        startCard = e.target.closest ? e.target.closest('.rc') : null;
        stage.classList.add('is-drag');
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      });
      stage.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dx = e.clientX - lastX; lastX = e.clientX;
        moved += Math.abs(dx);
        vel = dx * 0.32;
        rot += vel;
      });
      function release() {
        if (!dragging) return;
        dragging = false;
        stage.classList.remove('is-drag');
        if (moved < 6 && startCard) w.CC.Router.go('#/cards/' + startCard.getAttribute('data-id'));
        startCard = null;
      }
      stage.addEventListener('pointerup', release);
      stage.addEventListener('pointercancel', release);
      stage.addEventListener('pointerenter', function () { hover = true; });
      stage.addEventListener('pointerleave', function () { hover = false; });

      function tick() {
        if (!stage.isConnected) return; // page changed — stop
        if (!dragging) {
          rot += vel;
          vel *= 0.94;
          if (Math.abs(vel) < 0.01) vel = 0;
          if (!reduced) rot += hover ? 0.05 : 0.18; // idle spin
        }
        var total = rot + (reduced ? 0 : (w.scrollY || 0) * 0.1);
        ring.style.transform = 'rotateX(-12deg) rotateY(' + total.toFixed(2) + 'deg)';

        var best = 0, bestV = -1;
        for (var i = 0; i < n; i++) {
          var a = (((i * step + total) % 360) + 540) % 360 - 180; // -180..180, 0 = facing the camera
          var v = (Math.cos(a * Math.PI / 180) + 1) / 2;
          cards[i].style.setProperty('--v', (v * v).toFixed(3)); // squared so only the front few light up
          if (v > bestV) { bestV = v; best = i; }
        }
        if (best !== front) setFront(best);
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  };

  w.CC.Hero = Hero;
})(window, document);
