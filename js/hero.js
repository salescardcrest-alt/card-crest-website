/* ============================================================
   Card Crest — hero.js
   Hero card stage: smoothed pointer parallax (cards, chips and sheen
   all read --px/--py), a gentle idle drift when nobody is moving the
   pointer (also covers touch screens), and a count-up on the numbers.
   Everything is skipped for prefers-reduced-motion.
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
      if (w.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      countUp(scope.querySelector('.hero') || scope);

      var host = stage.closest('.hero') || stage;
      var tx = 0, ty = 0, cx = 0, cy = 0, lastMove = 0, raf = 0, alive = true;

      function onMove(e) {
        var r = stage.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
        ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
        lastMove = performance.now();
      }
      function onLeave() { lastMove = 0; }

      function tick(now) {
        if (!alive || !stage.isConnected) { host.removeEventListener('pointermove', onMove); return; }
        if (now - lastMove > 1800) { // idle drift
          tx = Math.sin(now / 2600) * 0.45;
          ty = Math.cos(now / 3300) * 0.25;
        }
        cx += (tx - cx) * 0.07; // ease toward the target
        cy += (ty - cy) * 0.07;
        stage.style.setProperty('--px', cx.toFixed(4));
        stage.style.setProperty('--py', cy.toFixed(4));
        raf = requestAnimationFrame(tick);
      }

      host.addEventListener('pointermove', onMove, { passive: true });
      host.addEventListener('pointerleave', onLeave);
      raf = requestAnimationFrame(tick);
    }
  };

  w.CC.Hero = Hero;
})(window, document);
