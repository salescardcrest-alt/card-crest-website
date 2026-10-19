/* ============================================================
   Card Crest — hero.js
   Pointer parallax for the hero card stack.

   If you are dropping this into the existing Card Crest project
   that already ships a Three.js hero, replace mount() below with
   your existing initialiser and keep the same element id
   (#heroStage). Nothing else in the app touches the hero.
   ============================================================ */
(function (w, d) {
  'use strict';

  var Hero = {
    mount: function (root) {
      var stage = (root || d).querySelector('#heroStage');
      if (!stage) return;
      var deck = stage.querySelector('.stage__deck');
      if (!deck) return;
      if (w.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (w.matchMedia('(hover: none)').matches) return; // skip on touch

      var raf = null;
      function move(e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = stage.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - r.top) / r.height - 0.5;
          deck.style.animation = 'none';
          deck.style.transform =
            'rotateY(' + (-14 + x * 16).toFixed(2) + 'deg) ' +
            'rotateX(' + (7 - y * 12).toFixed(2) + 'deg)';
        });
      }
      function leave() {
        deck.style.animation = '';
        deck.style.transform = '';
      }
      stage.addEventListener('mousemove', move);
      stage.addEventListener('mouseleave', leave);
    }
  };

  w.CC.Hero = Hero;
})(window, document);
