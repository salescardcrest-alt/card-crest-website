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

  /* ---------- names: first letter of every word capital ----------
     "ayush kumar" and "AYUSH KUMAR" become "Ayush Kumar". A word that already mixes cases ("McDonald", "DeSouza")
     keeps its capitals and only gets a capital first letter. Words are split at spaces, hyphens and apostrophes. */
  UI.titleCase = function (s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/[^\s\-'’.]+/g, function (w) {
      var letters = w.replace(/[^A-Za-z\u00C0-\u024F]/g, '');
      var plain = letters && (letters === letters.toLowerCase() || letters === letters.toUpperCase());
      var rest = plain ? w.slice(1).toLowerCase() : w.slice(1);
      return w.charAt(0).toUpperCase() + rest;
    });
  };
  /* while typing, only lift the first letter of each word, so nothing the person types is rewritten under their fingers */
  UI.liftFirstLetters = function (s) {
    return String(s).replace(/(^|[\s\-'’.])([a-z\u00E0-\u00FF])/g, function (m, a, b) { return a + b.toUpperCase(); });
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
  /* Profile photo if the user has one, otherwise their initials. */
  UI.avatarHtml = function (user) {
    if (user && user.avatar) {
      return '<img src="' + UI.esc(user.avatar) + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' +
        UI.esc(UI.initials(user.name)).replace(/'/g, '') + '\'))">';
    }
    return UI.esc(UI.initials(user && user.name));
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
      '<svg class="plastic__nfc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M8 7a7 7 0 0 1 0 10"/><path d="M12 4a11 11 0 0 1 0 16"/><path d="M16 1.5a15 15 0 0 1 0 21"/></svg>' +
      '<div class="plastic__name">' + UI.esc(card.name) + '</div>' + photo + '</div>';
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

  /* ---------- pager: long tables show a page at a time ---------- */
  /* Works on every table.tbl inside `root`. Rows hidden by a search or filter (style.display = none) are skipped,
     so the pages always count only what is currently listed. */
  var pageMemo = {};
  UI.paginate = function (root, opts) {
    opts = opts || {};
    var sizes = [10, 25, 50, 100], size = 10;
    try { size = Number(localStorage.getItem('cc.pagesize')) || 10; } catch (e) {}
    if (sizes.indexOf(size) < 0) size = 10;

    [].slice.call(root.querySelectorAll('table.tbl')).forEach(function (tbl, idx) {
      var body = tbl.tBodies[0];
      if (!body) return;
      var rows = [].slice.call(body.rows);
      if (rows.length < 2 && rows[0] && rows[0].cells.length === 1) return;     // an empty-state row
      if (rows.length <= 10) return;                                            // nothing to page
      var wrap = tbl.closest('.panel') || tbl.parentNode, key = location.hash.split('?')[0] + '#' + idx;
      var bar = wrap.querySelector(':scope > .pager');
      if (!bar) { bar = d.createElement('div'); bar.className = 'pager'; wrap.appendChild(bar); }
      var page = pageMemo[key] || 1;

      function shown() { return rows.filter(function (r) { return r.style.display !== 'none'; }); }
      function nums(pages) {
        var out = [], add = function (n) { if (out.indexOf(n) < 0) out.push(n); };
        add(1); add(pages); for (var i = page - 1; i <= page + 1; i++) if (i > 1 && i < pages) add(i);
        out.sort(function (a, b) { return a - b; });
        var res = []; out.forEach(function (n, i) { if (i && n - out[i - 1] > 1) res.push('\u2026'); res.push(n); });
        return res;
      }
      function draw() {
        var list = shown(), pages = Math.max(1, Math.ceil(list.length / size));
        if (page > pages) page = pages;
        pageMemo[key] = page;
        rows.forEach(function (r) { r.classList.add('pg-hide'); });
        list.slice((page - 1) * size, page * size).forEach(function (r) { r.classList.remove('pg-hide'); });
        var from = list.length ? (page - 1) * size + 1 : 0, to = Math.min(page * size, list.length);
        bar.hidden = list.length <= 10 && !opts.always;
        bar.innerHTML =
          '<div class="pager__info"><span>Showing <strong>' + from + '\u2013' + to + '</strong> of <strong>' + list.length + '</strong></span>' +
          '<label class="pager__size">Rows <select aria-label="Rows per page">' + sizes.map(function (s) { return '<option' + (s === size ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label></div>' +
          (pages > 1 ? '<div class="pager__nav"><button type="button" data-pg="prev"' + (page === 1 ? ' disabled' : '') + '>Previous</button>' +
            nums(pages).map(function (n) { return n === '\u2026' ? '<span class="pager__gap">\u2026</span>' : '<button type="button" data-pg="' + n + '" class="' + (n === page ? 'is-on' : '') + '"' + (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>'; }).join('') +
            '<button type="button" data-pg="next"' + (page === pages ? ' disabled' : '') + '>Next</button></div>' : '');
      }
      bar.onclick = function (e) {
        var b = e.target.closest('[data-pg]'); if (!b || b.disabled) return;
        var pages = Math.max(1, Math.ceil(shown().length / size));
        page = b.dataset.pg === 'prev' ? Math.max(1, page - 1) : b.dataset.pg === 'next' ? Math.min(pages, page + 1) : Number(b.dataset.pg);
        draw();
        var top = wrap.getBoundingClientRect().top;
        if (top < 70) w.scrollTo({ top: w.scrollY + top - 90, behavior: 'smooth' });   // back to the top of the table
      };
      bar.onchange = function (e) {
        if (e.target.tagName !== 'SELECT') return;
        size = Number(e.target.value); page = 1;
        try { localStorage.setItem('cc.pagesize', String(size)); } catch (x) {}
        root.querySelectorAll('.pager').forEach(function (b) { if (b !== bar && b._redraw) { b._redraw(); } });
        draw();
      };
      bar._redraw = function () { size = Number((function () { try { return localStorage.getItem('cc.pagesize'); } catch (e) { return 10; } })()) || 10; draw(); };
      tbl._repage = function () { page = 1; draw(); };
      draw();
    });

    /* a search box or filter changed what is listed: go back to page 1 of each table */
    if (!root._pgBound) {
      root._pgBound = true;
      var again = UI.debounce(function () { root.querySelectorAll('table.tbl').forEach(function (t) { if (t._repage) t._repage(); }); }, 260);
      root.addEventListener('input', function (e) { if (e.target.matches('[data-filter], #admSearch, input[type=search]')) again(); });
      root.addEventListener('click', function (e) { if (e.target.closest('[data-chip]')) setTimeout(again, 30); });
    }
  };


  /* ---------- password strength (Google-style: length + upper + lower + number + symbol) ---------- */
  var PW_RULES = [
    ['len', '8 or more characters', function (p) { return p.length >= 8; }],
    ['low', 'A lowercase letter', function (p) { return /[a-z]/.test(p); }],
    ['up', 'An uppercase letter', function (p) { return /[A-Z]/.test(p); }],
    ['num', 'A number', function (p) { return /\d/.test(p); }],
    ['sym', 'A symbol, such as @ # $ !', function (p) { return /[^A-Za-z0-9]/.test(p); }]
  ];
  UI.pwIssues = function (p) {
    p = String(p || '');
    return PW_RULES.filter(function (r) { return !r[2](p); }).map(function (r) { return r[1]; });
  };
  UI.pwOk = function (p) { return UI.pwIssues(p).length === 0; };
  UI.pwMeterHtml = function () {
    return '<div class="pwm" data-pwm><div class="pwm__top"><div class="pwm__bar"><i></i></div><b class="pwm__lbl">Too weak</b></div><div class="pwm__ttl">Your password must have:</div><ul class="pwm__list">' +
      PW_RULES.map(function (r) { return '<li data-r="' + r[0] + '">' + r[1] + '</li>'; }).join('') + '</ul></div>';
  };
  UI.pwBind = function (input, scope) {
    var m = (scope || d).querySelector('[data-pwm]'); if (!input || !m) return;
    function paint() {
      var p = input.value, n = 0;
      PW_RULES.forEach(function (r) { var ok = r[2](p); if (ok) n++; m.querySelector('[data-r="' + r[0] + '"]').classList.toggle('is-ok', ok); });
      var lvl = !p ? 0 : n <= 2 ? 1 : n < 5 ? 2 : 3;
      m.dataset.lvl = lvl;
      m.querySelector('.pwm__lbl').textContent = ['Enter a password', 'Too weak', 'Almost there', 'Strong'][lvl];
    }
    input.addEventListener('input', paint); paint();
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


  /* Show/hide eye on every password box (sign in, sign up, reset, change password), including ones added later. */
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5.6 19 2 12 2 12a18.4 18.4 0 0 1 5.1-5.9M9.9 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function addPwEyes(scope) {
    [].forEach.call((scope || d).querySelectorAll('input[type="password"]:not([data-eye])'), function (input) {
      input.setAttribute('data-eye', '1');
      var wrap = input.parentNode;
      if (!wrap.classList || !wrap.classList.contains('pw-wrap')) {
        wrap = d.createElement('div'); wrap.className = 'pw-wrap';
        input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
      }
      var b = d.createElement('button');
      b.type = 'button'; b.className = 'pw-eye'; b.setAttribute('aria-label', 'Show password'); b.innerHTML = EYE;
      b.onclick = function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.innerHTML = show ? EYE_OFF : EYE;
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      };
      wrap.appendChild(b);
    });
  }
  UI.addPwEyes = addPwEyes;
  function watchPwEyes() {
    addPwEyes(d);
    if (w.MutationObserver) new w.MutationObserver(function () { addPwEyes(d); }).observe(d.body, { childList: true, subtree: true });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', watchPwEyes); else watchPwEyes();
  w.CC.UI = UI;
})(window, document);
