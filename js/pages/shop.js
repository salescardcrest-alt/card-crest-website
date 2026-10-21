/* ============================================================
   Card Crest — pages/shop.js
   The shopping session: where the shopper stays while the store
   is open in its own tab. Follows the tracked order live.
   Route: #/shop/:txnId
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, Auth = w.CC.Auth, CB = w.CC.Cashback, O = w.CC.Offers;
  w.CC.Pages = w.CC.Pages || {};

  var STEPS = [
    ['clicked', 'Session started', 'The store was opened from Card Crest with your tracking reference.'],
    ['tracked', 'Order seen', 'The store reported your order to the affiliate network.'],
    ['pending', 'Awaiting confirmation', 'The store confirms the order after the return window, usually 30 to 90 days.'],
    ['confirmed', 'Cashback confirmed', 'The cashback moves to your rewards wallet.']
  ];
  /* Open the store in a Card Crest shopping window (a sized window beside this page), straight from a click so the
     browser does not block it. Returns true if the window opened. */
  function openWindow(url) {
    var width = Math.min(1180, Math.max(720, Math.round((w.screen.availWidth || 1280) * 0.62))), height = Math.min(900, Math.max(560, (w.screen.availHeight || 800) - 90));
    var left = Math.max(0, (w.screen.availWidth || 1280) - width - 10), top = 20;
    var win = w.open(url, 'cardcrest-store', 'popup=yes,width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes');
    if (!win) return false;
    try { win.opener = null; } catch (e) {}      // the other site gets no handle back to Card Crest
    try { win.focus(); } catch (e) {}
    return true;
  }
  function openStore(txn) {
    var url = CB.trackedUrl(txn);
    if (!url) { UI.toast('This store has no link yet', 'error'); return false; }
    return openWindow(url);
  }
  w.CC.Render = w.CC.Render || {};
  w.CC.Render.openStore = openStore;
  w.CC.Render.openWindow = openWindow;

  /* "Apply for this card": send the applicant to the bank with Card Crest's partner code, and keep Card Crest open on the application page. */
  w.CC.Render.applyForCard = function (card) {
    if (!Auth.require()) return;
    var AP = w.CC.Applications, bank = w.CC.Cards.bank(card.bank), bankName = bank ? bank.name : 'the bank';
    var rw = w.CC.Cards.rewardFor(card), earn = rw ? ' When the bank approves it, you earn ' + UI.money(rw) + ' in your Card Crest rewards.' : '';
    UI.confirm('Apply for ' + card.name + '?',
      'You will be taken to ' + bankName + '\u2019s own website to complete the application. Card Crest\u2019s partner code is attached to it automatically, so the bank credits the application to Card Crest. Approval, limit and pricing are decided by the bank.' + earn,
      'Continue to ' + bankName, function () {
        var u = Auth.current(), app, res = AP.create(u.id, card.id);
        if (res.ok) app = res.application;
        else app = AP.forUser(u.id).filter(function (a) { return a.cardId === card.id && ['applied', 'under-review', 'documents'].indexOf(a.status) > -1; })[0];   // already started: pick it up again
        if (!app) return UI.toast(res.error, 'error');
        var opened = openWindow(AP.trackedUrl(app));      // the bank opens in a Card Crest window, straight from this click
        w.CC.Router.go('#/apply/' + app.id + (opened ? '' : '?go=1'));
      });
  };

  w.CC.Pages.shop = function (params, query) {
    if (!Auth.require()) return false;
    var u = Auth.current(), txn = CB.find(params.id);
    if (!txn || txn.userId !== u.id) {
      return { title: 'Shopping session | Card Crest', html: '<div class="wrap section">' + UI.empty('Session not found', 'It may belong to another account.', 'Back to offers', '#/offers') + '</div>' };
    }
    var store = O.store(txn.storeId) || { name: 'the store', id: txn.storeId, color: '#0e5c3c' };
    var url = CB.trackedUrl(txn);
    /* CashKaro-style hand-over: a "taking you to the store" screen, then the store opens through the tracked link */
    var FLAG = 'cc.shop.' + txn.id, seenGo = false;
    try { seenGo = !!sessionStorage.getItem(FLAG); } catch (e) {}
    var auto = !!(query && query.go === '1') && !seenGo && !!url;
    var goHtml = auto
      ? '<div class="shop-go" id="shopGo"><div class="shop-go__logos"><span class="shop-go__cc"><img src="assets/logo-mark.png?v=2" alt="Card Crest" width="46" height="46"></span>' +
        '<span class="shop-go__arrow" aria-hidden="true"><i></i><i></i><i></i></span><span class="shop-go__store">' + UI.logo(store, 'logo-badge--lg') + '</span></div>' +
        '<h1 class="h2" style="text-align:center">Taking you to ' + UI.esc(store.name) + '\u2026</h1>' +
        '<p class="muted" style="text-align:center; max-width:52ch; margin:8px auto 0">Your cashback tracking starts now. Shop as usual and do not use another coupon or cashback site in the same session.</p>' +
        '<div class="shop-go__bar"><b id="goBar"></b></div><p class="small muted" style="text-align:center; margin-top:10px">Opening in <strong id="goSecs">4</strong> seconds</p>' +
        '<div class="row row--wrap" style="justify-content:center; gap:10px; margin-top:14px"><button class="btn btn--primary" id="goNow">Go to ' + UI.esc(store.name) + ' now</button>' +
        '<button class="btn btn--ghost" id="goTab">Open in a new tab instead</button><button class="btn btn--link" id="goStay">Stay on Card Crest</button></div></div>'
      : '';

    function body(t) {
      var at = Math.max(0, CB.FLOW.indexOf(t.status));
      var rejected = t.status === 'rejected' || t.status === 'cancelled';
      return '<ul class="tl">' + STEPS.map(function (s, i) {
        var cls = rejected ? '' : (i < at ? 'is-done' : i === at ? 'is-now' : '');
        if (!rejected && t.status === 'confirmed' && i === at) cls = 'is-done';
        return '<li class="tl__i ' + cls + '"><div class="tl__t">' + s[1] + '</div><div class="tl__d">' + s[2] + '</div></li>';
      }).join('') + '</ul>' + (rejected ? '<div class="note note--warn" style="margin-top:14px">This session ended as <strong>' + UI.esc(t.status) + '</strong>, so no cashback is earned.</div>' : '');
    }

    var html = '<div class="wrap section--tight">' + goHtml +
      '<div class="shop-bar"><span class="shop-bar__dot" aria-hidden="true"></span>' +
      '<div class="shop-bar__t"><strong>Cashback tracking is on</strong><span>You are shopping at <b>' + UI.esc(store.name) + '</b> through Card Crest</span></div>' +
      '<code class="mono" title="Your tracking reference">' + UI.esc(txn.id) + '</code></div>' +

      '<div class="detail" style="margin-top:22px"><div class="stack">' +
      '<div class="panel"><div class="spread" style="gap:14px; flex-wrap:wrap; margin-bottom:6px"><h1 class="h2">Shop at ' + UI.esc(store.name) + '</h1>' +
      '<span id="shopStatus">' + UI.statusBadge(txn.status) + '</span></div>' +
      '<p class="muted">Your store is open in its own Card Crest shopping window beside this page. Finish shopping there, then come back here to follow your cashback.</p>' +
      '<div class="row row--wrap" style="gap:10px; margin:16px 0 4px"><button class="btn btn--primary" id="reopen">Open ' + UI.esc(store.name) + ' again</button>' +
      '<a class="btn btn--ghost" href="#/dashboard/transactions">I am done, see my transactions</a></div></div>' +

      '<div class="panel"><h2 class="h3" style="margin-bottom:14px">Where your cashback is</h2><div id="shopSteps">' + body(txn) + '</div></div>' +
      '<div class="panel"><h2 class="h3" style="margin-bottom:8px">Why the store opens on its own site</h2><p class="muted small">Shops such as Flipkart, Amazon, Myntra and PolicyBazaar do not allow themselves to be shown inside other websites, for the safety of your login and payment. So Card Crest hands you over to the store through your tracked link, and the tracking follows you there.</p></div>' +
      '</div>' +

      '<aside class="detail__side"><div class="stack">' +
      '<div class="panel"><h2 class="h3" style="margin-bottom:10px">This session</h2>' +
      '<div class="spread" style="padding:9px 0; border-bottom:1px solid var(--line-soft)"><span class="muted">Cashback rate</span><strong>' + (txn.offerId && O.byId(txn.offerId) ? UI.pct(O.byId(txn.offerId).cashback) : '-') + '</strong></div>' +
      '<div class="spread" style="padding:9px 0; border-bottom:1px solid var(--line-soft)"><span class="muted">Estimated order</span><strong style="white-space:nowrap">' + UI.money(txn.amount) + '</strong></div>' +
      '<div class="spread" style="padding:9px 0"><span class="muted">Estimated cashback</span><strong style="white-space:nowrap; color:var(--crest)">' + UI.money(txn.cashback) + '</strong></div></div>' +
      '<div class="note"><strong>Keep tracking working</strong><br>Stay in this browser, turn off coupon extensions and ad-blockers for the store, and do not switch to the store’s own app mid-way.</div>' +
      '</div></aside></div></div>';

    return {
      title: 'Shopping at ' + store.name + ' | Card Crest', html: html,
      mount: function (root) {
        var g = w.CC.Router.gen, last = txn.status;
        /* the hand-over: count down, then send this tab to the store through the tracked link */
        var goBox = root.querySelector('#shopGo');
        if (goBox) {
          var secs = 4, bar = root.querySelector('#goBar'), left = root.querySelector('#goSecs'), stopped = false;
          function mark() { try { sessionStorage.setItem(FLAG, '1'); } catch (e) {} }
          function done() { stopped = true; mark(); goBox.remove(); }
          function leave() { if (stopped) return; stopped = true; mark(); w.location.href = url; }
          requestAnimationFrame(function () { bar.style.width = '100%'; });   // CSS transition fills the bar over 4s
          var cd = setInterval(function () {
            if (w.CC.Router.gen !== g || stopped) return clearInterval(cd);
            secs--; left.textContent = Math.max(secs, 0);
            if (secs <= 0) { clearInterval(cd); leave(); }
          }, 1000);
          root.querySelector('#goNow').onclick = function () { clearInterval(cd); leave(); };
          root.querySelector('#goTab').onclick = function () { clearInterval(cd); openStore(txn); done(); };
          root.querySelector('#goStay').onclick = function () { clearInterval(cd); done(); };
        }
        root.querySelector('#reopen').onclick = function () { openStore(txn); };
        /* follow the order live, redrawing only the parts that change */
        var tick = setInterval(function () {
          if (w.CC.Router.gen !== g) return clearInterval(tick);
          var t = CB.find(txn.id);
          if (!t || t.status === last) return;
          last = t.status;
          root.querySelector('#shopStatus').innerHTML = UI.statusBadge(t.status);
          root.querySelector('#shopSteps').innerHTML = body(t);
          UI.toast('Your ' + store.name + ' order is now ' + t.status);
        }, 2000);
      }
    };
  };

  /* ---------------- applying for a card: hand-over to the bank ---------------- */
  w.CC.Pages.applyGo = function (params, query) {
    if (!Auth.require()) return false;
    var AP = w.CC.Applications, u = Auth.current(), app = AP.byId(params.id);
    if (!app || app.userId !== u.id) {
      return { title: 'Application | Card Crest', html: '<div class="wrap section">' + UI.empty('Application not found', 'It may belong to another account.', 'Back to cards', '#/cards') + '</div>' };
    }
    var card = w.CC.Cards.byId(app.cardId), bank = card && w.CC.Cards.bank(card.bank), bankName = bank ? bank.name : 'the bank';
    var url = AP.trackedUrl(app), ref = AP.partnerRef(card ? card.bank : '');
    var FLAG = 'cc.apply.' + app.id, seen = false;
    try { seen = !!sessionStorage.getItem(FLAG); } catch (e) {}
    var auto = !!(query && query.go === '1') && !seen && !!url;

    var goHtml = auto
      ? '<div class="shop-go" id="shopGo"><div class="shop-go__logos"><span class="shop-go__cc"><img src="assets/logo-mark.png?v=2" alt="Card Crest" width="46" height="46"></span>' +
        '<span class="shop-go__arrow" aria-hidden="true"><i></i><i></i><i></i></span><span class="shop-go__store">' + UI.bankLogo(bank) + '</span></div>' +
        '<h1 class="h2" style="text-align:center">Taking you to ' + UI.esc(bankName) + '\u2026</h1>' +
        '<p class="muted" style="text-align:center; max-width:56ch; margin:8px auto 0">Complete your ' + UI.esc(card ? card.name : 'card') + ' application on the bank\u2019s own site. Card Crest\u2019s partner code is attached to your application automatically.</p>' +
        '<div class="shop-go__bar"><b id="goBar"></b></div><p class="small muted" style="text-align:center; margin-top:10px">Opening in <strong id="goSecs">4</strong> seconds</p>' +
        '<div class="row row--wrap" style="justify-content:center; gap:10px; margin-top:14px"><button class="btn btn--primary" id="goNow">Go to ' + UI.esc(bankName) + ' now</button>' +
        '<button class="btn btn--ghost" id="goTab">Open in a new window instead</button><button class="btn btn--link" id="goStay">Stay on Card Crest</button></div></div>'
      : '';

    var at = AP.stageIndex(app.status);
    var steps = '<ul class="tl">' + AP.FLOW.map(function (s, i) {
      return '<li class="tl__i ' + (i < at ? 'is-done' : i === at ? 'is-now' : '') + '"><div class="tl__t">' + s.label + '</div><div class="tl__d">' + s.desc + '</div></li>';
    }).join('') + '</ul>';

    var html = '<div class="wrap section--tight">' + goHtml +
      '<div class="shop-bar"><span class="shop-bar__dot" aria-hidden="true"></span><div class="shop-bar__t"><strong>Your application is linked to Card Crest</strong>' +
      '<span>' + UI.esc(card ? card.name : 'Card') + ' with ' + UI.esc(bankName) + (ref ? ' &middot; partner code <b>' + UI.esc(ref) + '</b>' : '') + (w.CC.Cards.rewardFor(card) ? ' &middot; you earn <b>' + UI.money(w.CC.Cards.rewardFor(card)) + '</b> when it is approved' : '') + '</span></div>' +
      '<code class="mono" title="Your application reference">' + UI.esc(app.id) + '</code></div>' +
      '<div class="detail" style="margin-top:22px"><div class="stack">' +
      '<div class="panel"><div class="spread" style="gap:14px; flex-wrap:wrap; margin-bottom:6px"><h1 class="h2">Apply for ' + UI.esc(card ? card.name : 'this card') + '</h1><span>' + UI.statusBadge(app.status) + '</span></div>' +
      '<p class="muted">Finish the application on ' + UI.esc(bankName) + '\u2019s site. The bank sees the Card Crest partner code on your application and credits it to us, which is what keeps Card Crest free for you.</p>' +
      '<div class="row row--wrap" style="gap:10px; margin:16px 0 4px"><button class="btn btn--primary" id="reopen">Open ' + UI.esc(bankName) + ' again</button>' +
      '<a class="btn btn--ghost" href="#/dashboard/applications">See my applications</a></div></div>' +
      '<div class="panel"><h2 class="h3" style="margin-bottom:14px">Where your application is</h2>' + steps + '</div></div>' +
      '<aside class="detail__side"><div class="stack"><div class="note"><strong>Before you apply</strong><br>Have your PAN, Aadhaar and income proof ready. Approval, limit and pricing are decided by the bank. Card Crest never sees your documents.</div>' +
      (ref ? '' : '<div class="note note--warn"><strong>Partner code not set yet.</strong><br>Add Card Crest\u2019s code for this bank in <code>js/config.js</code> (PARTNER_REF) so the bank can credit it.</div>') +
      '</div></aside></div></div>';

    return {
      title: 'Apply for ' + (card ? card.name : 'a card') + ' | Card Crest', html: html,
      mount: function (root) {
        var g = w.CC.Router.gen;
        var goBox = root.querySelector('#shopGo');
        if (goBox) {
          var secs = 4, bar = root.querySelector('#goBar'), left = root.querySelector('#goSecs'), stopped = false;
          function mark() { try { sessionStorage.setItem(FLAG, '1'); } catch (e) {} }
          function done() { stopped = true; mark(); goBox.remove(); }
          function leave() { if (stopped) return; stopped = true; mark(); w.location.href = url; }
          requestAnimationFrame(function () { bar.style.width = '100%'; });
          var cd = setInterval(function () {
            if (w.CC.Router.gen !== g || stopped) return clearInterval(cd);
            secs--; left.textContent = Math.max(secs, 0);
            if (secs <= 0) { clearInterval(cd); leave(); }
          }, 1000);
          root.querySelector('#goNow').onclick = function () { clearInterval(cd); leave(); };
          root.querySelector('#goTab').onclick = function () { clearInterval(cd); openWindow(url); done(); };
          root.querySelector('#goStay').onclick = function () { clearInterval(cd); done(); };
        }
        root.querySelector('#reopen').onclick = function () { if (!url || !openWindow(url)) UI.toast('Allow pop-ups for Card Crest, or use "Go to the bank" on the hand-over screen.', 'error'); };
      }
    };
  };
})(window, document);
