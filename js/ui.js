/* ============================================================
   Card Crest — ui.js
   Formatting helpers, toasts, modals and shared markup.
   ============================================================ */
(function (w, d) {
  'use strict';

  var UI = {};

  /* ---------- formatting ---------- */
  UI.money = function (n, opts) {
    n = Number(n) || 0;
    var s = Math.round(Math.abs(n)).toLocaleString('en-IN');
    return (n < 0 ? '−₹' : '₹') + s + (opts && opts.suffix ? opts.suffix : '');
  };
  UI.pct = function (n) { return (Math.round(n * 10) / 10) + '%'; };
  UI.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  UI.date = function (iso) {
    var dt = new Date(iso);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  UI.ago = function (iso) {
    var ms = Date.now() - new Date(iso).getTime();
    var m = Math.floor(ms / 60000), h = Math.floor(m / 60), dd = Math.floor(h / 24);
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    if (h < 24) return h + 'h ago';
    if (dd < 30) return dd + 'd ago';
    return UI.date(iso);
  };
  UI.slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  UI.initials = function (name) {
    return String(name || '?').split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase();
  };
  UI.debounce = function (fn, ms) {
    var t; return function () {
      var a = arguments, c = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 220);
    };
  };

  /* ---------- toasts ---------- */
  UI.toast = function (msg, kind) {
    var host = d.getElementById('toasts');
    var el = d.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' toast--err' : '');
    el.innerHTML = '<span class="toast__i">' + (kind === 'error' ? '!' : '&check;') + '</span><span>' + UI.esc(msg) + '</span>';
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 260);
    }, 3200);
  };

  /* ---------- modal ---------- */
  var openModal = null;
  UI.modal = function (opts) {
    UI.closeModal();
    var root = d.getElementById('modalRoot');
    var wrap = d.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML =
      '<div class="modal__box' + (opts.wide ? ' modal__box--wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + UI.esc(opts.title || 'Dialog') + '">' +
        '<div class="modal__head"><h2 class="h2">' + UI.esc(opts.title || '') + '</h2>' +
        '<button class="icon-btn" data-x aria-label="Close">&times;</button></div>' +
        '<div class="modal__body">' + (opts.body || '') + '</div>' +
        (opts.foot ? '<div class="modal__foot">' + opts.foot + '</div>' : '') +
      '</div>';
    root.appendChild(wrap);
    d.body.classList.add('no-scroll');
    openModal = wrap;

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('[data-x]')) UI.closeModal();
    });
    var focusable = wrap.querySelector('input,select,textarea,button:not([data-x])');
    if (focusable) setTimeout(function () { focusable.focus(); }, 60);
    if (opts.onMount) opts.onMount(wrap);
    return wrap;
  };
  UI.closeModal = function () {
    if (!openModal) return;
    openModal.remove(); openModal = null;
    d.body.classList.remove('no-scroll');
  };
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      UI.closeModal();
      var sheet = d.getElementById('sheet');
      if (sheet && !sheet.hidden) { sheet.hidden = true; d.body.classList.remove('no-scroll'); }
    }
  });

  UI.confirm = function (title, body, confirmLabel, onYes, danger) {
    UI.modal({
      title: title,
      body: '<p class="muted">' + body + '</p>',
      foot: '<button class="btn btn--ghost" data-x>Cancel</button>' +
            '<button class="btn ' + (danger ? 'btn--danger' : 'btn--primary') + '" data-yes>' + UI.esc(confirmLabel) + '</button>',
      onMount: function (m) {
        m.querySelector('[data-yes]').addEventListener('click', function () { UI.closeModal(); onYes(); });
      }
    });
  };

  /* ---------- shared markup ---------- */
  UI.gauge = function (score, label, big) {
    var r = big ? 40 : 22, circ = 2 * Math.PI * r;
    var off = circ - (Math.max(0, Math.min(100, score)) / 100) * circ;
    var size = big ? 92 : 52;
    return '<div class="cvs' + (big ? ' cvs--lg' : '') + '">' +
      '<div class="cvs__ring"><svg viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle class="cvs__track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '"></circle>' +
      '<circle class="cvs__fill" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" ' +
      'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle>' +
      '</svg><span class="cvs__val">' + Math.round(score) + '</span></div>' +
      (label === false ? '' : '<span class="cvs__lbl">Card value<b>score out of 100</b></span>') +
      '</div>';
  };

  /* Brand logo from the company's own site icon. */
  UI.logoUrl = function (domain) {
    return 'https://www.google.com/s2/favicons?sz=128&domain=' + encodeURIComponent(domain);
  };
  var FALLBACK = 'this.parentNode.classList.add(\'is-fallback\');this.remove()';

  UI.bankLogo = function (bank, cls) {
    var domain = bank && (bank.domain || w.CC.DATA.bankDomains[bank.id]);
    if (!domain) return '';
    return '<span class="bank-logo ' + (cls || '') + '"><img src="' + UI.logoUrl(domain) + '" alt="' +
      UI.esc(bank.name) + ' logo" loading="lazy" onerror="' + FALLBACK + '"></span>';
  };

  /* A card photo is looked up at assets/cards/<card-id>.png (then .jpg, .webp), or card.image if set.
     If no photo exists, the drawn card below stays as the fallback. */
  var PHOTO_EXT = ['png', 'jpg', 'webp'];
  UI.photoErr = function (img) {
    var n = (+img.getAttribute('data-n') || 0) + 1;
    var base = img.getAttribute('data-base');
    if (!base || n >= PHOTO_EXT.length) { img.remove(); return; }
    img.setAttribute('data-n', n);
    img.src = base + '.' + PHOTO_EXT[n];
  };
  UI.plastic = function (card, small) {
    var bank = w.CC.Cards.bank(card.bank);
    var base = 'assets/cards/' + card.id;
    var photo = card.image
      ? '<img class="plastic__photo" src="' + UI.esc(card.image) + '" alt="' + UI.esc(card.name) + ' card" loading="lazy" onerror="this.remove()">'
      : '<img class="plastic__photo" src="' + base + '.' + PHOTO_EXT[0] + '" data-base="' + base + '" alt="' + UI.esc(card.name) + ' card" loading="lazy" onerror="CC.UI.photoErr(this)">';
    return '<div class="plastic plastic--' + card.art + (small ? ' plastic--sm' : '') + '">' +
      '<div class="plastic__bank">' + UI.bankLogo(bank, 'bank-logo--card') + '<span>' + UI.esc(bank ? bank.short : '') + '</span></div>' +
      '<div class="plastic__chip"></div>' +
      '<div><div class="plastic__name">' + UI.esc(card.name) + '</div>' +
      '<div class="plastic__no">•••• •••• •••• ' + (card.id.length * 7 % 90 + 10) + '</div></div>' + photo + '</div>';
  };

  UI.logo = function (store, cls) {
    var domain = store.domain || w.CC.DATA.storeDomains[store.id];
    var letter = UI.esc(store.name[0]);
    if (!domain) {
      return '<div class="logo-badge ' + (cls || '') + '" style="background:' + store.color + '">' + letter + '</div>';
    }
    return '<div class="logo-badge logo-badge--img ' + (cls || '') + '" style="--brand:' + store.color + '" data-letter="' + letter + '">' +
      '<img src="' + UI.logoUrl(domain) + '" alt="' + UI.esc(store.name) + ' logo" loading="lazy" onerror="' + FALLBACK + '"></div>';
  };

  UI.stars = function (r) {
    return '<span class="rating"><svg viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.3 4.6L18.2 21 12 17.3 5.8 21l1.5-6.8L2 9.6 9 9z"/></svg>' + r.toFixed(1) + '</span>';
  };

  UI.statusBadge = function (status) {
    var map = {
      clicked: ['grey', 'Clicked'], tracked: ['info', 'Tracked'], pending: ['warn', 'Pending'],
      confirmed: ['ok', 'Confirmed'], cancelled: ['grey', 'Cancelled'], rejected: ['danger', 'Rejected'],
      applied: ['info', 'Applied'], 'under-review': ['warn', 'Under review'], documents: ['warn', 'Documents needed'],
      approved: ['ok', 'Approved'], completed: ['ok', 'Completed'],
      requested: ['warn', 'Requested'], processing: ['info', 'Processing'],
      open: ['warn', 'Open'], resolved: ['ok', 'Resolved'],
      successful: ['ok', 'Successful'], active: ['ok', 'Active'], disabled: ['danger', 'Disabled']
    };
    var m = map[status] || ['grey', status];
    return '<span class="badge badge--' + m[0] + '">' + m[1] + '</span>';
  };

  UI.empty = function (title, desc, ctaLabel, ctaHref) {
    return '<div class="empty"><div class="empty__t">' + UI.esc(title) + '</div>' +
      '<p class="empty__d">' + UI.esc(desc) + '</p>' +
      (ctaLabel ? '<a class="btn btn--primary" href="' + ctaHref + '">' + UI.esc(ctaLabel) + '</a>' : '') + '</div>';
  };

  UI.skeletonGrid = function (n, cls) {
    var out = '';
    for (var i = 0; i < n; i++) out += '<div class="sk ' + (cls || 'sk-card') + '"></div>';
    return out;
  };

  /* ---------- scroll reveal ---------- */
  UI.reveal = function (scope) {
    var els = (scope || d).querySelectorAll('.reveal:not(.is-in)');
    if (!('IntersectionObserver' in w)) {
      els.forEach(function (el) { el.classList.add('is-in'); }); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, i) {
        if (e.isIntersecting) {
          setTimeout(function () { e.target.classList.add('is-in'); }, i * 55);
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -60px 0px' });
    els.forEach(function (el) { io.observe(el); });
  };

  /* ---------- count up ---------- */
  UI.countUp = function (el, to, fmt) {
    if (w.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
    var start = performance.now(), dur = 900;
    function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };

  /* ---------- accordion + tabs delegation ---------- */
  d.addEventListener('click', function (e) {
    var q = e.target.closest('.accordion__q');
    if (q) q.parentElement.classList.toggle('is-open');
  });

  UI.setMeta = function (title, desc) {
    d.title = title;
    var m = d.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', desc);
  };

  w.CC.UI = UI;
})(window, document);
