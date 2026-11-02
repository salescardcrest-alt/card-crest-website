/* ============================================================
   Card Crest — pages/home.js
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, C = w.CC.Cards, O = w.CC.Offers, DATA = w.CC.DATA;
  w.CC.Pages = w.CC.Pages || {};

  function ico(path) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }
  /* the four things Card Crest is for, in the order they are shown everywhere on this page */
  var PRODUCTS = [
    { key: 'lounge', name: 'Lounge Access', href: '#/market/new/lounge', cta: 'Get lounge access', price: '₹500 domestic · ₹1,000 international',
      blurb: 'Walk into an airport lounge without holding the card that unlocks it.',
      icon: ico('<path d="M21 15.5 13.5 11V5.5a1.5 1.5 0 0 0-3 0V11L3 15.5V17l7.5-2v3.5L9 20v1.2l3-.8 3 .8V20l-1.5-1.5V15L21 17z"/>') },
    { key: 'movie', name: 'Movie Tickets', href: '#/market/new/movie', cta: 'Book a movie offer', price: 'Buy 1 get 1 · ₹500 off on 2 seats',
      blurb: 'Use a card that carries the movie offer and pay a lot less at the box office.',
      icon: ico('<circle cx="7.5" cy="6.5" r="4"/><circle cx="16" cy="6.5" r="4"/><rect x="2.5" y="11.5" width="14" height="9" rx="1.8"/><path d="M16.5 14.5 21.5 12v8l-5-2.5"/>') },
    { key: 'pay', name: 'Pay & Earn', href: '#/market/pay-earn', cta: 'See open requests', price: 'Pay with your card, earn on every request',
      blurb: 'Open requests are waiting. Pay with your own card, get reimbursed and earn on top.',
      icon: ico('<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>') },
    { key: 'order', name: 'Order & Earn', href: '#/market/new/order', cta: 'Start Order & Earn', price: 'Delivered to your door, at a discount',
      blurb: 'A cardholder places the order with their card offer and ships it to you.',
      icon: ico('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6.4"/><path d="M9.6 9.2h4.8M9.6 11.4h4.8M10 9.2c3.2 0 3.2 4.4 0 4.4h-.4l3.4 2.2"/>') }
  ];


  /* ---- the app screen on the phone in the hero picture ----
     The picture is a low-resolution render, so its own screen text is soft. This draws the same screen as real text and
     icons (sharp at any size) and lays it over the phone using the four corners of the phone's screen in the picture. */
  var PHONE = { w: 390, h: 750, quad: [[527, 53], [853, 55], [791, 722], [423, 712]], imgW: 1307 };   // picture pixels: top-left, top-right, bottom-right, bottom-left
  function icon(path, extra) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (extra || '') + '>' + path + '</svg>'; }
  function phoneApp(name) {
    var stroke = ' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var plane = '<path d="M21 15.5 13.5 11V5.5a1.5 1.5 0 0 0-3 0V11L3 15.5V17l7.5-2v3.5L9 20v1.2l3-.8 3 .8V20l-1.5-1.5V15L21 17z" fill="currentColor"/>';
    var nav = [
      ['Home', '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" fill="currentColor"/>', true],
      ['Cards', '<rect x="3" y="5" width="18" height="14" rx="2.5"' + stroke + '/><path d="M3 10h18M7 15h4"' + stroke + '/>'],
      ['Earn', '<circle cx="12" cy="12" r="9"' + stroke + '/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 17h.01"' + stroke + '/>'],
      ['Rewards', '<rect x="4" y="9" width="16" height="11" rx="2"' + stroke + '/><path d="M12 9v11M4 13h16M12 9c-3 0-4.5-2-3.4-3.4S12 5 12 9zM12 9c3 0 4.5-2 3.4-3.4S12 5 12 9z"' + stroke + '/>'],
      ['Profile', '<circle cx="12" cy="8" r="4"' + stroke + '/><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"' + stroke + '/>']
    ];
    return '<div class="ph3">' +
      '<span class="ph3__notch"></span>' +
      '<span class="ph3__time">9:41</span>' +
      '<span class="ph3__sys"><svg viewBox="0 0 20 14" aria-hidden="true"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/></svg>' +
        '<svg viewBox="0 0 20 14" aria-hidden="true"><path d="M10 13.2 7.4 10.4a3.7 3.7 0 0 1 5.2 0zM4.7 7.8a7.5 7.5 0 0 1 10.6 0M1.7 4.7a11.8 11.8 0 0 1 16.6 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        '<i class="ph3__bat"><b></b></i></span>' +
      '<div class="ph3__brand"><img src="assets/logo-mark.png?v=2" width="40" height="40" alt=""><span>CARD<em>CREST</em></span>' +
        '<span class="ph3__bell">' + icon('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0"' + stroke + '/>') + '<i></i></span></div>' +
      '<h3 class="ph3__hi">Hey, ' + UI.esc(name) + ' <span aria-hidden="true">👋</span></h3>' +
      '<p class="ph3__sub">Turn your card spending into rewards.</p>' +
      '<div class="ph3__search">' + icon('<circle cx="11" cy="11" r="6.5"' + stroke + '/><path d="m16 16 4 4"' + stroke + '/>') + '<span>Search lounges, offers, movies...</span></div>' +
      '<div class="ph3__q">' +
        '<span><i>' + icon('<g transform="rotate(45 12 12)">' + plane + '</g>', ' style="color:#fff"') + '</i>Lounge</span>' +
        '<span><i><svg viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="pk"><path d="M5.5 9.5h13L17 21H7z"/></clipPath></defs><circle cx="8" cy="7" r="2.6" fill="#fff3cf"/><circle cx="12" cy="5.6" r="2.9" fill="#ffe9a8"/><circle cx="16" cy="7" r="2.6" fill="#fff3cf"/><g clip-path="url(#pk)"><rect x="5" y="9" width="14" height="13" fill="#fff"/><rect x="5.3" y="9" width="2.6" height="13" fill="#e5384a"/><rect x="10.7" y="9" width="2.6" height="13" fill="#e5384a"/><rect x="16.1" y="9" width="2.6" height="13" fill="#e5384a"/></g></svg></i>Movies</span>' +
        '<span><i><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="#2fbf85"/><rect x="3.5" y="5" width="17" height="4.5" rx="2" fill="#17a06a"/><path d="M9.5 14.5l1.6 1.6 3.4-3.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></i>Pay &amp; Earn</span>' +
        '<span><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5" fill="none" stroke="#c98d1e" stroke-width="1.8" stroke-linecap="round"/><rect x="4.5" y="8" width="15" height="13" rx="3" fill="#f5b73c"/><path d="M12 12.5v5M9.6 12.5 12 15l2.4-2.5" fill="none" stroke="#7a4a00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></i>Order &amp; Earn</span>' +
      '</div>' +
      '<div class="ph3__offer"><small>Featured Offer</small>' +
        '<div class="ph3__row"><i>' + icon('<g transform="rotate(45 12 12)">' + plane + '</g>', ' style="color:#fff"') + '</i>' +
        '<span><b>Airport Lounge Access</b><strong>₹500 Off</strong></span>' +
        '<u>' + icon('<path d="m9 6 6 6-6 6"' + stroke + '/>') + '</u></div></div>' +
      '<div class="ph3__nav">' + nav.map(function (n) { return '<span' + (n[2] ? ' class="on"' : '') + '>' + icon(n[1]) + n[0] + '</span>'; }).join('') + '</div>' +
      '</div>';
  }
  /* maps the app screen's rectangle onto the four corners of the phone screen (a perspective transform) */
  function phoneFit(root) {
    var art = root.querySelector('.hx__art'), app = root.querySelector('.hx__app'), ovl = root.querySelector('.hx__ovl');
    if (!art || !app || !ovl) return;
    var s = [[0, 0], [PHONE.w, 0], [PHONE.w, PHONE.h], [0, PHONE.h]], t = PHONE.quad, A = [], B = [], i, j, k;
    for (i = 0; i < 4; i++) {
      A.push([s[i][0], s[i][1], 1, 0, 0, 0, -s[i][0] * t[i][0], -s[i][1] * t[i][0]]); B.push(t[i][0]);
      A.push([0, 0, 0, s[i][0], s[i][1], 1, -s[i][0] * t[i][1], -s[i][1] * t[i][1]]); B.push(t[i][1]);
    }
    for (i = 0; i < 8; i++) {                                    // Gaussian elimination
      var p = i; for (j = i + 1; j < 8; j++) if (Math.abs(A[j][i]) > Math.abs(A[p][i])) p = j;
      var tmp = A[i]; A[i] = A[p]; A[p] = tmp; var tb = B[i]; B[i] = B[p]; B[p] = tb;
      for (j = i + 1; j < 8; j++) { var f = A[j][i] / A[i][i]; for (k = i; k < 8; k++) A[j][k] -= f * A[i][k]; B[j] -= f * B[i]; }
    }
    var h = new Array(8);
    for (i = 7; i >= 0; i--) { var sum = B[i]; for (k = i + 1; k < 8; k++) sum -= A[i][k] * h[k]; h[i] = sum / A[i][i]; }
    app.style.transform = 'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].join(',') + ')';
    var size = function () { if (!art.isConnected) return; ovl.style.transform = 'scale(' + (art.clientWidth / PHONE.imgW) + ')'; };
    size();
    if (w.ResizeObserver) new w.ResizeObserver(size).observe(art); else w.addEventListener('resize', size);
  }

  /* Product tiles lean toward the pointer and the ticket stack drifts with it. Skipped for touch and reduced motion. */
  function tilt(root) {
    if (w.matchMedia('(prefers-reduced-motion: reduce)').matches || !w.matchMedia('(hover: hover)').matches) return;
    root.querySelectorAll('.bt').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = 'translateY(-10px) perspective(900px) rotateY(' + (x * 10).toFixed(2) + 'deg) rotateX(' + (-y * 10).toFixed(2) + 'deg)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
    var mh = root.querySelector('.mh'), deck = root.querySelector('.mh__deck');
    if (!mh || !deck) return;
    mh.addEventListener('pointermove', function (e) {
      var r = mh.getBoundingClientRect();
      deck.style.transform = 'rotateY(' + (((e.clientX - r.left) / r.width - .5) * -14).toFixed(2) + 'deg) rotateX(' + (((e.clientY - r.top) / r.height - .5) * 8).toFixed(2) + 'deg)';
    });
  }

  /* Hero: the scene image stays fixed, buttons pull toward it, and a bar at the top shows scroll progress. */
  function fx(root) {
    var reduced = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hx = root.querySelector('.hx'), prog = root.querySelector('#ccProg');
    if (hx && !reduced && w.matchMedia('(hover: hover)').matches) {
      hx.querySelectorAll('.hx__btn').forEach(function (b) {
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .2).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px)';
        });
        b.addEventListener('pointerleave', function () { b.style.transform = ''; });
      });
    }
    /* on desktop the hero is exactly as tall as the space left under the header, so it covers the whole screen */
    var hxEl = root.querySelector('.hx');
    if (hxEl) {
      var sizeHero = function () {
        if (!hxEl.isConnected) return w.removeEventListener('resize', sizeHero);
        if (w.innerWidth < 1025) { hxEl.style.removeProperty('--hx-h'); return; }
        var top = hxEl.getBoundingClientRect().top + (w.scrollY || 0);
        hxEl.style.setProperty('--hx-h', Math.max(520, w.innerHeight - top) + 'px');
      };
      sizeHero(); w.addEventListener('resize', sizeHero);
      var stripX = d.getElementById('demoStripX');
      if (stripX) stripX.addEventListener('click', function () { setTimeout(sizeHero, 50); });
      setTimeout(sizeHero, 300);
    }
    /* the green headline word changes every 2.4 seconds */
    var rot = root.querySelector('#hxRot b');
    if (rot && !reduced) {
      var words = ['Swipe', 'Spend', 'Lounge Visit', 'Movie Night', 'Online Order', 'Payment'], wi = 0;
      var timer = setInterval(function () {
        if (!rot.isConnected) return clearInterval(timer);
        wi = (wi + 1) % words.length;
        rot.className = 'out';
        setTimeout(function () { rot.textContent = words[wi]; rot.className = 'in'; }, 340);
      }, 2400);
    }
    if (prog) {
      var onScroll = function () {
        if (!prog.isConnected) return w.removeEventListener('scroll', onScroll);
        var h = d.documentElement.scrollHeight - w.innerHeight;
        prog.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, w.scrollY / h) : 0) + ')';
      };
      w.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }
  }

  w.CC.Pages.home = function () {
    /* Amex Platinum Travel is listed under See all cards, not on the home page */
    var top = C.topByScore(8).filter(function (c) { return c.id !== 'amex-plat-travel'; }).slice(0, 3);
    var popular = C.popular(3);
    var offers = O.query({ section: 'top' }).slice(0, 6);
    var bestCard = top[0];
    var bestScore = C.score(bestCard);
    var ringCards = C.topByScore(9);
    var cu = w.CC.Auth && w.CC.Auth.current && w.CC.Auth.current();
    var firstName = cu && cu.name ? String(cu.name).split(' ')[0] : 'Ayush';

    var html =
      /* ---- hero: the four products ---- */
      '<div class="scrollbar" id="ccProg" aria-hidden="true"></div>' +
      '<section class="hx">' +
      '<div class="hx__top">' +
        '<div class="hx__art" role="img" aria-label="The Card Crest app on a phone in an airport lounge, with floating Lounge, Movies, Offers and Pay &amp; Earn tiles">' +
          '<img class="hx__artimg" src="assets/hero/scene-clean.jpg" width="1307" height="805" alt="" fetchpriority="high">' +
'<div class="hx__ovl" aria-hidden="true"><div class="hx__app">' + phoneApp(firstName) + '</div></div>' +          [['Lounge', 216, 307, -4], ['Movies', 150, 542, 10], ['Offers', 1041, 297, -8], ['Pay &amp; Earn', 1132, 480, 8]].map(function (l) {            return '<b class="hx__lbl" aria-hidden="true" style="left:' + (l[1] / 13.07).toFixed(2) + '%; top:' + (l[2] / 8.05).toFixed(2) + '%; --r:' + l[3] + 'deg">' + l[0] + '</b>';          }).join('') +
        '</div>' +
        '<div class="wrap hx__in">' +
          '<div class="hx__copy">' +
            '<span class="hx__pill"><span class="dot"></span>Enjoy card perks, even without the card.</span>' +
            '<h1 class="hx__h">Get More Value From <br><em class="hx__rot" id="hxRot"><b>Swipe</b></em></h1>' +
            '<p class="hx__lede">Unlock airport lounges, movie tickets, cashback, exclusive offers and more — with the cards you already own.</p>' +
            '<div class="hx__cta">' +
              '<a class="hx__btn hx__btn--dark" href="#/market">Start Earning <span aria-hidden="true">↗</span></a>' +
              '<a class="hx__btn hx__btn--light" href="#/how-it-works"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 8l6 4-6 4z" fill="currentColor"/></svg>See How It Works</a>' +
            '</div>' +
            '<div class="hx__trust">' +
              '<div><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M17 14c2.8 0 4.5 1.8 4.5 4.6"/></svg><b>50K+</b><span>Users Earning</span></div>' +
              '<div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg><b>1,000+</b><span>Live Offers</span></div>' +
              '<div><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/></svg><b>25+</b><span>Trusted Partners</span></div>' +
              '<div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg><b>4.8/5</b><span>User Rating</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="wrap hx__feat">' + [
        ['lounge', 'Lounge Access', 'Relax before you fly.', 'Exclusive lounge offers.', 'card-lounge.jpg', '<path d="M21 15.5 13.5 11V5.5a1.5 1.5 0 0 0-3 0V11L3 15.5V17l7.5-2v3.5L9 20v1.2l3-.8 3 .8V20l-1.5-1.5V15L21 17z" fill="currentColor"/>'],
        ['movie', 'Movie Tickets', 'Book. Watch. Earn.', 'Best deals on movies.', 'card-movie.jpg', '<path d="M5 9h14l-1.6 11H6.6z" fill="currentColor"/><path d="M7 9c0-3 2-4 3.5-3.4C11.5 4 14 4 14.6 5.6 16.5 5 18 6.5 17 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'],
        ['pay', 'Pay & Earn', 'Shop with offers.', 'You save, they earn.', 'card-pay.jpg', '<path d="M5 8h14l-1 12H6z" fill="currentColor"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'],
        ['order', 'Order & Earn', 'Get it delivered.', 'Earn on every order.', 'card-order.jpg?v=2', '<path d="M4 8l8-4 8 4v8l-8 4-8-4z" fill="currentColor"/><path d="M4 8l8 4 8-4M12 12v8" fill="none" stroke="#fff" stroke-width="1.4"/>']
      ].map(function (f, i) {
        return '<a class="hx__f hx__f--' + f[0] + '" href="' + PRODUCTS[i].href + '" data-service="' + f[0] + '" style="--d:' + i + '" aria-label="' + f[1] + '">' +
          '<img class="hx__fart" src="assets/hero/' + f[4] + '" alt="" loading="lazy">' +
          '<span class="hx__fb"><svg viewBox="0 0 24 24" aria-hidden="true">' + f[5] + '</svg></span>' +
          '<span class="hx__ft"><b>' + f[1] + '</b><small>' + f[2] + '<br>' + f[3] + '</small></span>' +
          '<span class="hx__go" aria-hidden="true">→</span></a>';
      }).join('') + '</div>' +
      '</section>' +

      /* ---- product bento ---- */
      '<section class="section"><div class="wrap">' +
        '<div class="section__head"><div class="eyebrow">What you can do</div>' +
        '<h2 class="h1">Four ways to <em>pay less</em> with a card you don’t have</h2></div>' +
        '<div class="bento">' + PRODUCTS.map(function (p, i) {
          return '<a class="bt bt--' + p.key + ' reveal" href="' + p.href + '" data-service="' + p.key + '">' +
            '<span class="bt__n">0' + (i + 1) + '</span>' +
            '<span class="bt__ic">' + p.icon + '</span>' +
            '<h3 class="bt__t">' + p.name + '</h3>' +
            '<p class="bt__p">' + p.blurb + '</p>' +
            '<span class="bt__price">' + p.price + '</span>' +
            '<span class="bt__go">' + p.cta + ' <i>→</i></span>' +
          '</a>';
        }).join('') + '</div>' +
      '</div></section>' +

      /* ---- how it works for both sides ---- */
      '<section class="section section--mist"><div class="wrap">' +
        '<div class="section__head"><div class="eyebrow">Two sides, one safe deal</div>' +
        '<h2 class="h1">Need a perk? Hold a card? <em>Both win.</em></h2></div>' +
        '<div class="duo">' +
          '<div class="duo__c reveal"><span class="duo__k">I want a benefit</span><ol>' +
            '<li><b>Pick a product</b><span>Lounge, movie, Pay &amp; Earn or Order &amp; Earn.</span></li>' +
            '<li><b>Pay into escrow</b><span>Your money is held, not handed over.</span></li>' +
            '<li><b>Confirm and save</b><span>Released only after you confirm.</span></li></ol>' +
            '<a class="btn btn--primary" href="#/market">Get a benefit</a></div>' +
          '<div class="duo__c duo__c--dark reveal"><span class="duo__k">I have a card</span><ol>' +
            '<li><b>Add your card</b><span>Bank and variant only. Never the number.</span></li>' +
            '<li><b>Accept a request</b><span>See only what your card can fulfil.</span></li>' +
            '<li><b>Get paid</b><span>Reimbursement plus your earning, to your wallet.</span></li></ol>' +
            '<a class="btn btn--soft" href="#/market/cards">Add my card</a></div>' +
        '</div>' +
      '</div></section>' +

      /* ---- credit cards (the ring) ---- */
      '<section class="section"><div class="wrap">' +
        '<div class="spread section__head"><div><div class="eyebrow">Also on Card Crest</div>' +
        '<h2 class="h1">Find the card that <em>returns the most</em></h2>' +
        '<p class="lede">' + C.all().length + ' cards scored on what they give back against what they cost.</p></div>' +
        '<div class="row row--wrap"><a class="btn btn--primary" href="#/eligibility">Find my card</a><a class="btn btn--ghost" href="#/cards">Browse all cards</a></div></div>' +
        '<div class="stage" id="heroStage" style="--step:' + (360 / ringCards.length) + 'deg">' +
          '<div class="stage__floor" aria-hidden="true"><i></i><i></i><i></i></div>' +
          '<div class="ring">' + ringCards.map(function (c, i) {
            var b = C.bank(c.bank);
            return '<div class="rc" style="--i:' + i + '" data-id="' + c.id + '" data-name="' + UI.esc(c.name) + '" data-bank="' +
              UI.esc(b ? b.name : '') + '" data-score="' + Math.round(C.score(c).total) + '">' + UI.plastic(c) + '</div>';
          }).join('') + '</div>' +
          '<div class="stage__info" aria-live="polite">' +
            '<div class="stage__bank"></div><div class="stage__name"></div>' +
            '<div class="stage__meta"><span class="stage__score"><b></b>/100 value score</span>' +
            '<a class="stage__go" href="#/cards">View card →</a></div>' +
          '</div>' +
          '<div class="stage__hint" aria-hidden="true">Drag to spin</div>' +
        '</div>' +
        '<div class="hero__proof">' +
          '<div><strong data-count="' + C.all().length + '">' + C.all().length + '</strong><span>Cards scored</span></div>' +
          '<div><strong data-count="' + O.stores().length + '">' + O.stores().length + '</strong><span>Cashback stores</span></div>' +
          '<div><strong data-count="' + O.all().length + '">' + O.all().length + '</strong><span>Live offers</span></div>' +
          '<div><strong data-count="' + Math.round(bestScore.value.net) + '" data-money="1">' + UI.money(bestScore.value.net) + '</strong><span>Top card\'s net annual value</span></div>' +
        '</div>' +
      '</div></section>' +

      /* ---- highest value ---- */
      '<section class="section"><div class="wrap">' +
        '<div class="spread section__head"><div><div class="eyebrow">Card Value Score</div>' +
        '<h2 class="h1">The cards that <em>return the most</em></h2>' +
        '<p class="lede">Scored out of 100 on net return, fee efficiency, benefits, welcome value and how easily the points convert to rupees.</p></div>' +
        '<a class="btn btn--ghost" href="#/cards">See all cards</a></div>' +
        '<div class="mkt__grid" id="homeTop">' + top.map(function (c) { return w.CC.Render.cardTile(c); }).join('') + '</div>' +
      '</div></section>' +

      /* ---- popular ---- */
      '<section class="section section--mist"><div class="wrap">' +
        '<div class="spread section__head"><div><div class="eyebrow">Most looked at</div>' +
        '<h2 class="h1">Popular right now</h2></div>' +
        '<a class="btn btn--ghost" href="#/compare">Compare cards</a></div>' +
        '<div class="mkt__grid" id="homePop">' + popular.map(function (c) { return w.CC.Render.cardTile(c); }).join('') + '</div>' +
      '</div></section>' +

      /* ---- offers ---- */
      '<section class="section"><div class="wrap">' +
        '<div class="spread section__head"><div><div class="eyebrow">Cashback marketplace</div>' +
        '<h2 class="h1">Cashback <em>on top of</em> your card rewards</h2>' +
        '<p class="lede">Start your session from Card Crest and we track the purchase. What your card earns, you keep as well.</p></div>' +
        '<a class="btn btn--ghost" href="#/offers">All offers</a></div>' +
        '<div class="grid g-3" id="homeOffers">' + offers.map(w.CC.Render.offerTile).join('') + '</div>' +
        '<div class="grid g-4" style="margin-top:24px">' +
          O.stores().filter(function (s) { return s.popular; }).slice(0, 4).map(w.CC.Render.storeTile).join('') + '</div>' +
      '</div></section>' +

      /* ---- calculator teaser ---- */
      '<section class="section section--mist"><div class="wrap">' +
        '<div class="grid g-2" style="gap:44px; align-items:center">' +
          '<div><div class="eyebrow">Card value calculator</div>' +
          '<h2 class="h1">Is the annual fee <em>actually worth it</em>?</h2>' +
          '<p class="lede" style="margin:16px 0 24px">Put in what you really spend each month. We work out the rewards, discount the points you cannot easily spend, add the benefits, subtract the fee, and show you what is left over.</p>' +
          '<a class="btn btn--primary" href="#/calculator">Open the calculator</a></div>' +
          '<div class="panel">' +
            '<div class="spread" style="margin-bottom:18px"><div><div class="ctile__bank">' + UI.esc(C.bank(bestCard.bank).name) + '</div>' +
            '<h3 class="h3" style="font-size:1.15rem">' + UI.esc(bestCard.name) + '</h3></div>' +
            UI.gauge(bestScore.total, false) + '</div>' +
            '<div class="calc__line" style="border-color:var(--line-soft)"><span class="muted small">Rewards at ₹40,000 a month</span><strong>' + UI.money(bestScore.value.rewards) + '</strong></div>' +
            '<div class="calc__line" style="border-color:var(--line-soft)"><span class="muted small">Benefits and perks</span><strong>' + UI.money(bestScore.value.perks) + '</strong></div>' +
            '<div class="calc__line" style="border-color:var(--line-soft)"><span class="muted small">Annual fee</span><strong>' + (bestCard.annualFee ? '−' + UI.money(bestCard.annualFee) : 'None') + '</strong></div>' +
            '<div class="calc__line"><span class="muted small">Net annual value</span><strong style="color:var(--crest); font-size:1.15rem">' + UI.money(bestScore.value.net) + '</strong></div>' +
            '<p class="small muted" style="margin-top:14px">Estimated, not guaranteed. Caps and exclusions move real numbers around.</p>' +
          '</div>' +
        '</div>' +
      '</div></section>' +

      /* ---- how it works ---- */
      '<section class="section"><div class="wrap">' +
        '<div class="section__head"><div class="eyebrow">How Card Crest works</div>' +
        '<h2 class="h1">Find it, use it, <em>get paid back</em></h2></div>' +
        '<div class="flow">' +
          '<div class="flow__i reveal"><h3 class="h3">Tell us how you spend</h3><p>Six short questions. No credit enquiry, no impact on your score.</p></div>' +
          '<div class="flow__i reveal"><h3 class="h3">Compare on real value</h3><p>Every card scored on what it returns after the fee, not on marketing copy.</p></div>' +
          '<div class="flow__i reveal"><h3 class="h3">Shop through Card Crest</h3><p>Activate an offer, buy as usual, and we track the order back to you.</p></div>' +
          '<div class="flow__i reveal"><h3 class="h3">Take the money out</h3><p>Confirmed cashback goes to UPI, your bank or a gift card.</p></div>' +
        '</div>' +
      '</div></section>' +

      /* ---- refer ---- */
      '<section class="section section--tight"><div class="wrap">' +
        '<div class="panel" style="background:linear-gradient(135deg,var(--crest),var(--crest-d)); border:0; color:#fff; padding:44px">' +
        '<div class="spread row--wrap" style="gap:24px">' +
        '<div style="max-width:52ch"><h2 class="h1" style="color:#fff; margin-bottom:12px">Refer a friend, <em style="color:#8fd3b4">both earn ₹100</em></h2>' +
        '<p style="color:rgba(255,255,255,.78)">When a friend signs up with your code, the reward lands in your balance straight away.</p></div>' +
        '<a class="btn btn--soft btn--lg" href="#/refer">Get my referral code</a></div></div>' +
      '</div></section>' +

      /* ---- trust ---- */
      '<section class="section section--mist"><div class="wrap">' +
        '<div class="section__head"><div class="eyebrow">Where we stand</div>' +
        '<h2 class="h1">What Card Crest is, and <em>what it is not</em></h2></div>' +
        '<div class="grid g-3">' +
          '<div class="panel reveal"><h3 class="h3" style="margin-bottom:8px">We are not a bank</h3>' +
          '<p class="muted small">Every card is issued by the bank named on it. Approval, credit limit and pricing are entirely the bank\'s decision. We do not lend and we never see your money.</p></div>' +
          '<div class="panel reveal"><h3 class="h3" style="margin-bottom:8px">Nothing here is guaranteed</h3>' +
          '<p class="muted small">Card Value Scores, reward estimates and eligibility results are our own modelling. They are labelled as estimates because that is what they are.</p></div>' +
          '<div class="panel reveal"><h3 class="h3" style="margin-bottom:8px">How we get paid</h3>' +
          '<p class="muted small">Banks and merchants pay us a commission. We pass part of it back to you as cashback and rewards. It costs you nothing, and it does not change how we rank cards.</p></div>' +
        '</div>' +
      '</div></section>' +

      /* ---- FAQs ---- */
      '<section class="section"><div class="wrap" style="max-width:800px">' +
        '<div class="section__head"><div class="eyebrow">Questions</div>' +
        '<h2 class="h1">Before you start</h2></div>' +
        DATA.faqs.slice(0, 6).map(function (f) {
          return '<div class="accordion"><button class="accordion__q">' + f[0] + '</button>' +
            '<div class="accordion__a">' + UI.esc(f[1]) + '</div></div>';
        }).join('') +
        '<div style="text-align:center; margin-top:26px"><a class="btn btn--ghost" href="#/help">Visit the help centre</a></div>' +
      '</div></section>' +

      /* ---- final CTA ---- */
      '<section class="section section--tight"><div class="wrap" style="text-align:center; max-width:640px">' +
        '<h2 class="h1">Find out what your <em>next card</em> is worth</h2>' +
        '<p class="lede" style="margin:14px auto 26px">Six questions, an estimated eligibility for every card, and a ranked shortlist built around how you actually spend.</p>' +
        '<div class="row" style="justify-content:center; flex-wrap:wrap">' +
        '<a class="btn btn--primary btn--lg" href="#/eligibility">Check my eligibility</a>' +
        '<a class="btn btn--ghost btn--lg" href="#/calculator">Try the calculator</a></div>' +
      '</div></section>';

    return {
      title: 'Card Crest | Get more value from every card',
      desc: 'Discover, compare and maximise the value of your credit cards. Card Value Scores, cashback offers and a rewards wallet.',
      html: html,
      mount: function (root) {
        w.CC.Hero.mount(root);
        tilt(root);
        phoneFit(root);
        fx(root);
        w.CC.Render.bindCompare(root);
        w.CC.Render.bindOfferActions(root);
      }
    };
  };
})(window, document);
