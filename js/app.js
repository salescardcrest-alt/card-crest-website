/* ============================================================
   Card Crest — app.js
   Boots the shell: header auth state, global search, mobile
   menu, notification bell, then starts the router.
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, Auth = w.CC.Auth, NT = w.CC.Notifications, SR = w.CC.Search;

  var App = {};

  /* ---------------- header auth area ---------------- */
  App.paintAuth = function () {
    var slot = d.getElementById('authSlot');
    var u = Auth.current();

    if (!u) {
      slot.innerHTML =
        '<a class="btn btn--ghost btn--sm" href="#/login">Sign in</a>' +
        '<a class="btn btn--primary btn--sm" href="#/signup">Sign up</a>';
      return;
    }

    var unread = NT.unread(u.id);
    slot.innerHTML =
      '<div class="dropdown" id="bellDrop">' +
        '<button class="bell" id="bellBtn" aria-label="Notifications" aria-expanded="false">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">' +
          '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' +
          (unread ? '<span class="bell__count">' + (unread > 9 ? '9+' : unread) + '</span>' : '') +
        '</button>' +
        '<div class="dropdown__menu" id="bellMenu" hidden style="min-width:320px">' +
          '<div class="dropdown__head"><strong>Notifications</strong>' +
          '<span>' + (unread ? unread + ' unread' : 'All caught up') + '</span></div>' +
          notifList(u) +
          '<div class="dropdown__sep"></div>' +
          '<a href="#/dashboard/notifications">See all notifications</a>' +
        '</div>' +
      '</div>' +
      '<div class="dropdown" id="userDrop">' +
        '<button class="avatar" id="avatarBtn" aria-label="Account menu" aria-expanded="false">' + UI.avatarHtml(u) + '</button>' +
        '<div class="dropdown__menu" id="userMenu" hidden>' +
          '<div class="dropdown__head"><strong>' + UI.esc(u.name) + '</strong><span>' + UI.esc(u.email) + '</span></div>' +
          '<a href="#/dashboard">Dashboard</a>' +
          '<a href="#/market/cards">My benefit cards</a>' +
          '<a href="#/rewards">My rewards</a>' +
          '<a href="#/dashboard/transactions">Transactions</a>' +
          '<a href="#/dashboard/applications">Applications</a>' +
          '<a href="#/refer">Referrals</a>' +
          '<a href="#/market">Share &amp; Earn</a>' +
          '<a href="#/profile">Profile and settings</a>' +
          (u.role === 'admin' ? '<div class="dropdown__sep"></div><a href="#/admin">Admin panel</a>' : '') +
          '<div class="dropdown__sep"></div>' +
          '<button id="logoutBtn">Sign out</button>' +
        '</div>' +
      '</div>';

    wireDropdown('bellBtn', 'bellMenu');
    wireDropdown('avatarBtn', 'userMenu');

    d.getElementById('logoutBtn').onclick = function () {
      Auth.logout();
      App.paintAuth();
      UI.toast('Signed out');
      w.CC.Router.go('#/');
    };
    d.querySelectorAll('#bellMenu [data-n]').forEach(function (el) {
      el.onclick = function () {
        NT.markRead(el.dataset.n);
        var n = w.CC.Store.find('notifications', el.dataset.n);
        w.CC.Router.go(n && String(n.type).indexOf('market:open:') === 0 ? '#/market/earn' : '#/dashboard/notifications');
        closeAll();
        App.paintAuth();
      };
    });
  };

  function notifList(u) {
    var list = NT.forUser(u.id).slice(0, 4);
    if (!list.length) return '<p class="muted small" style="padding:14px 12px">Nothing yet.</p>';
    return list.map(function (n) {
      return '<button class="sr-item" data-n="' + n.id + '" style="align-items:flex-start">' +
        '<span class="notif__dot" style="margin-top:6px' + (n.read ? '; background:var(--line)' : '') + '"></span>' +
        '<span style="flex:1; text-align:left"><strong style="display:block">' + UI.esc(n.title) + '</strong>' +
        '<span style="font-size:.78rem; color:var(--muted); margin:0; display:block; white-space:normal">' + UI.esc(n.body) + '</span></span>' +
        '</button>';
    }).join('');
  }

  function wireDropdown(btnId, menuId) {
    var btn = d.getElementById(btnId), menu = d.getElementById(menuId);
    if (!btn || !menu) return;
    btn.onclick = function (e) {
      e.stopPropagation();
      var open = !menu.hidden;
      closeAll();
      menu.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
    };
  }

  function closeAll() {
    d.querySelectorAll('.dropdown__menu').forEach(function (m) { m.hidden = true; });
    d.querySelectorAll('[aria-expanded="true"]').forEach(function (b) {
      if (b.classList.contains('bell') || b.classList.contains('avatar')) b.setAttribute('aria-expanded', 'false');
    });
    var sp = d.getElementById('searchPanel');
    if (sp) sp.hidden = true;
  }
  d.addEventListener('click', closeAll);

  /* ---------------- global search ---------------- */
  function initSearch() {
    var input = d.getElementById('globalSearch');
    var panel = d.getElementById('searchPanel');
    if (!input) return;

    function draw() {
      var res = SR.run(input.value);
      if (!res) { panel.hidden = true; return; }
      if (res.empty) {
        panel.hidden = false;
        panel.innerHTML = '<p class="muted small" style="padding:16px">No matches. Try a bank, a store or a benefit like "lounge".</p>';
        return;
      }
      var out = '';
      function group(title, items) {
        if (!items.length) return '';
        return '<div class="sr-group">' + title + '</div>' + items.join('');
      }
      out += group('Cards', res.cards.map(function (c) {
        return '<a class="sr-item" href="#/cards/' + c.id + '"><strong>' + UI.esc(c.name) + '</strong>' +
          '<span>' + UI.esc(w.CC.Cards.bank(c.bank).short) + '</span></a>';
      }));
      out += group('Banks', res.banks.map(function (b) {
        return '<a class="sr-item" href="#/cards?q=' + encodeURIComponent(b.name) + '"><strong>' + UI.esc(b.name) + '</strong>' +
          '<span>All cards</span></a>';
      }));
      out += group('Stores', res.stores.map(function (s) {
        return '<a class="sr-item" href="#/stores/' + s.id + '"><strong>' + UI.esc(s.name) + '</strong>' +
          '<span>Up to ' + s.cashback + '%</span></a>';
      }));
      out += group('Offers', res.offers.map(function (o) {
        return '<a class="sr-item" href="#/offers/' + o.id + '"><strong>' + UI.esc(o.title) + '</strong>' +
          '<span>' + o.cashback + '%</span></a>';
      }));
      out += group('Benefits', res.benefits.map(function (b) {
        return '<a class="sr-item" href="' + b.href + '"><strong>' + UI.esc(b.label) + '</strong><span>Cards</span></a>';
      }));
      panel.hidden = false;
      panel.innerHTML = out;
      panel.querySelectorAll('a').forEach(function (a) {
        a.onclick = function () { panel.hidden = true; input.value = ''; };
      });
    }

    input.addEventListener('input', UI.debounce(draw, 200));
    input.addEventListener('focus', draw);
    input.addEventListener('click', function (e) { e.stopPropagation(); });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && input.value.trim()) {
        panel.hidden = true;
        w.CC.Router.go('#/cards?q=' + encodeURIComponent(input.value.trim()));
        input.value = '';
        input.blur();
      }
      if (e.key === 'Escape') { panel.hidden = true; input.blur(); }
    });
  }

  /* ---------------- mobile sheet ---------------- */
  function initSheet() {
    var sheet = d.getElementById('sheet');
    var burger = d.getElementById('burger');
    function open() { sheet.hidden = false; d.body.classList.add('no-scroll'); burger.setAttribute('aria-expanded', 'true'); }
    function close() { sheet.hidden = true; d.body.classList.remove('no-scroll'); burger.setAttribute('aria-expanded', 'false'); }
    burger.onclick = function (e) { e.stopPropagation(); open(); };
    d.getElementById('sheetClose').onclick = close;
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
    sheet.querySelectorAll('a').forEach(function (a) { a.onclick = close; });
    w.addEventListener('hashchange', close);
  }

  /* ---------------- sticky header ---------------- */
  function initSticky() {
    var hdr = d.getElementById('hdr');
    var tick = false;
    w.addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        hdr.classList.toggle('is-stuck', w.scrollY > 8);
        tick = false;
      });
    }, { passive: true });
  }

  /* ---------------- demo strip ---------------- */
  function initStrip() {
    var strip = d.getElementById('demoStrip');
    if (sessionStorage.getItem('cc.strip') === 'off') strip.hidden = true;
    d.getElementById('demoStripX').onclick = function () {
      strip.hidden = true;
      try { sessionStorage.setItem('cc.strip', 'off'); } catch (e) {}
    };
  }


  /* Password-reset link: ask for the new password straight away. */
  App.askNewPassword = function () {
    if (w.CC.Auth.recoveryError) { w.CC.UI.toast(w.CC.Auth.recoveryError, "error"); w.CC.Auth.recoveryError = ""; return; }
    if (!w.CC.Auth.isRecovering()) return;
    var UI = w.CC.UI;
    UI.modal({
      title: 'Set a new password',
      body: '<p class="muted" style="margin-bottom:14px">Choose a new password for your Card Crest account. Use a mix of upper and lower case letters, numbers and symbols, like a Google password.</p>' +
        '<div class="field"><label for="np1">New password</label><input id="np1" type="password" autocomplete="new-password">' + UI.pwMeterHtml() + '</div>' +
        '<div class="field" style="margin-top:10px"><label for="np2">Confirm new password</label><input id="np2" type="password" autocomplete="new-password"></div>' +
        '<div class="small" id="npErr" style="color:var(--danger,#b42318); margin-top:8px" hidden></div>',
      foot: '<button class="btn btn--primary" data-save-np>Save new password</button>',
      onMount: function (m) {
        var err = m.querySelector('#npErr'); UI.pwBind(m.querySelector('#np1'), m);
        function show(t) { err.textContent = t; err.hidden = !t; }
        m.querySelector('[data-save-np]').onclick = function () {
          var a = m.querySelector('#np1').value, b = m.querySelector('#np2').value;
          if (!UI.pwOk(a)) return show('Password needs: ' + UI.pwIssues(a).join(', ').toLowerCase() + '.');
          if (a !== b) return show('The two passwords do not match.');
          show('');
          w.CC.Auth.setNewPassword(a).then(function (res) {
            if (!res.ok) return show(res.error);
            UI.closeModal(); UI.toast('Password updated. You are signed in.'); App.paintAuth();
            w.location.hash = '#/dashboard';
          });
        };
      }
    });
  };
  w.addEventListener('cc:recovery', function () { setTimeout(App.askNewPassword, 400); });

  /* Name fields (data-name): a capital letter at the start of every word as you type, and the whole name tidied when you leave the box. */
  d.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches('input[data-name]') || e.isComposing) return;
    var v = t.value, nv = w.CC.UI.liftFirstLetters(v);
    if (nv !== v) { var p = t.selectionStart; t.value = nv; try { t.setSelectionRange(p, p); } catch (x) {} }
  });
  d.addEventListener('focusout', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches('input[data-name]')) return;
    var nv = w.CC.UI.titleCase(t.value).trim();
    if (nv !== t.value) { t.value = nv; t.dispatchEvent(new Event('input', { bubbles: true })); }
  });

  /* ---------------- ask to allow notifications ----------------
     A small card asks once a person is signed in: Allow or Not now. The browser's own permission box only opens from
     a click on Allow (browsers refuse to open it any other way). "Not now" asks again after 7 days; a block in the
     browser is respected and never asked again. */
  var SNOOZE_KEY = 'cc.notifAskUntil';
  function notifSupported() { return !!(w.Notification && 'requestPermission' in w.Notification); }
  function snoozed() { try { return Number(w.localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch (e) { return false; } }
  function snooze(days) { try { w.localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86400000)); } catch (e) {} }
  App.askNotifications = function (force) {
    if (!notifSupported() || !w.CC.Auth.current()) return;
    if (w.Notification.permission !== 'default') return;          // already allowed or blocked
    if (!force && snoozed()) return;
    if (d.getElementById('notifAsk')) return;
    var el = d.createElement('div');
    el.id = 'notifAsk'; el.className = 'notif-ask'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Allow notifications');
    el.innerHTML = '<div class="notif-ask__ico" aria-hidden="true">&#128276;</div>' +
      '<div class="notif-ask__t"><strong>Turn on notifications?</strong>' +
      '<span>Get an alert the moment a request you can fulfil is posted, or your application or reward changes. You can change this any time in your browser settings.</span></div>' +
      '<div class="notif-ask__b"><button type="button" class="btn btn--primary btn--sm" data-allow>Allow</button>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-later>Not now</button></div>';
    d.body.appendChild(el);
    el.querySelector('[data-later]').onclick = function () { snooze(7); el.remove(); };
    el.querySelector('[data-allow]').onclick = function () {
      var done = function (p) {
        el.remove();
        if (p === 'granted') {
          w.CC.UI.toast('Notifications are on');
          try { new w.Notification('Card Crest', { body: 'Notifications are on. We will alert you here.', icon: 'assets/logo-mark-64.png' }); } catch (e) {}
        } else if (p === 'denied') { w.CC.UI.toast('Notifications are blocked. You can allow them in your browser settings.'); snooze(30); }
        else snooze(7);
      };
      try {
        var r = w.Notification.requestPermission(done);       // old browsers take a callback, new ones return a promise
        if (r && r.then) r.then(done);
      } catch (e) { done('default'); }
    };
  };
  /* ask a few seconds after sign-in and after each sign-in from now on, not on every page */
  w.addEventListener('cc:routed', function () {
    if (App._asked || !w.CC.Auth.current()) return;
    App._asked = true;
    setTimeout(function () { App.askNotifications(false); }, 4000);
  });
  /* ---------------- boot ---------------- */
  App.start = function () {
    d.getElementById('yr').textContent = new Date().getFullYear();
    initStrip();
    initSticky();
    initSheet();
    initSearch();
    w.addEventListener('cc:notify', App.paintAuth);
    // Restore any saved Supabase session before the first route renders. Never wait on the network for long:
    // if it is slow or blocked, show the page after 2.5s and repaint the account bits when the session arrives.
    var started = false;
    function go() { if (started) return; started = true; App.paintAuth(); w.CC.Router.start(); setTimeout(App.askNewPassword, 400); }
    var timer = setTimeout(go, 2500);
    Auth.init().then(function () { clearTimeout(timer); if (started) App.paintAuth(); go(); },
                     function () { clearTimeout(timer); go(); });
    console.log('%cCard Crest', 'color:#0e5c3c;font-weight:700',
      '— demo mode. Sign in with demo@cardcrest.in / demo1234, or admin@cardcrest.in / admin1234.');
  };

  w.CC.App = App;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', App.start);
  else App.start();
})(window, document);
