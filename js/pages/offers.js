/* ============================================================
   Card Crest — pages/offers.js
   Cashback marketplace: offers, stores and activation.
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, O = w.CC.Offers, Auth = w.CC.Auth, CB = w.CC.Cashback;
  w.CC.Pages = w.CC.Pages || {};

  /* ---------------- shared ---------------- */
  function offerTile(offer) {
    var store = O.store(offer.storeId);
    if (!store) return '';
    var user = Auth.current();
    var fav = user ? O.isFavourite(user.id, offer.id) : false;
    return '<article class="otile reveal">' +
      '<div class="otile__head">' + UI.logo(store) +
        '<div style="flex:1"><div class="otile__brand">' + UI.esc(store.name) + '</div>' +
        '<div class="otile__cb">Up to ' + UI.pct(offer.cashback) + ' cashback</div></div>' +
        '<button class="icon-btn' + (fav ? ' is-on' : '') + '" data-fav="' + offer.id + '" aria-label="Save this offer" title="Save this offer">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.8-7.5-10A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7.5 3c0 5.2-7.5 10-7.5 10z"/></svg></button>' +
      '</div>' +
      '<p class="otile__title">' + UI.esc(offer.title) + '</p>' +
      '<div class="otile__meta">' +
        (offer.kind === 'coupon'
          ? '<button class="coupon" data-code="' + UI.esc(offer.code) + '">' + UI.esc(offer.code) + '</button>'
          : '<span class="badge badge--grey">Cashback deal</span>') +
        '<span style="margin-left:auto">Ends in ' + offer.expiresInDays + ' days</span>' +
      '</div>' +
      '<div class="row" style="gap:8px">' +
        '<a class="btn btn--ghost btn--sm" href="#/offers/' + offer.id + '" style="flex:1">Details</a>' +
        '<button class="btn btn--primary btn--sm" data-activate="' + offer.id + '" style="flex:1">Activate</button>' +
      '</div></article>';
  }
  w.CC.Render = w.CC.Render || {};
  w.CC.Render.offerTile = offerTile;

  function storeTile(store) {
    return '<a class="stile reveal" href="#/stores/' + store.id + '">' +
      UI.logo(store) +
      '<div class="stile__name">' + UI.esc(store.name) + '</div>' +
      '<div class="stile__cb">Up to ' + UI.pct(store.cashback) + '</div>' +
      '<div class="small muted">' + O.forStore(store.id).length + ' live offers</div></a>';
  }
  w.CC.Render.storeTile = storeTile;

  /* ---------------- activation ---------------- */
  function activate(offerId) {
    if (!Auth.require()) return;
    var offer = O.byId(offerId);
    if (!offer) return UI.toast('That offer is no longer available', 'error');
    var store = O.store(offer.storeId);

    UI.modal({
      title: 'Activate cashback at ' + store.name,
      body: '<p>Card Crest takes you to ' + UI.esc(store.name) + ' through your tracked link. Finish your shopping there, in this same browser, and we match the order back to your account.</p>' +
        '<div class="note" style="margin:16px 0"><strong>Three things that break tracking:</strong> ad-blockers, coupon browser extensions, and opening the retailer in a different browser or app after activating.</div>' +
        '<div class="spread" style="padding:14px 0; border-top:1px solid var(--line-soft)">' +
        '<span class="muted small">Cashback rate</span><strong>' + UI.pct(offer.cashback) + '</strong></div>' +
        '<div class="spread" style="padding:14px 0; border-top:1px solid var(--line-soft)">' +
        '<span class="muted small">Confirms in</span><strong>30 to 90 days</strong></div>' +
        '<p class="small muted" style="margin-top:16px">Cashback is confirmed by the store after the return window. In this demo the status moves through the lifecycle on a timer so you can see how it works.</p>',
      foot: '<button class="btn btn--ghost" data-x>Cancel</button>' +
            '<button class="btn btn--primary" data-go>Continue to ' + UI.esc(store.name) + '</button>',
      onMount: function (m) {
        m.querySelector('[data-go]').onclick = function () {
          var txn = CB.activate(Auth.current().id, offer);
          UI.closeModal();
          // open the store in a Card Crest shopping window; if the browser blocks it, the hand-over screen takes this tab to the store
          var opened = w.CC.Render.openStore(txn);
          w.CC.Router.go('#/shop/' + txn.id + (opened ? '' : '?go=1'));
        };
      }
    });
  }
  w.CC.Render.activate = activate;

  function bindOfferActions(root) {
    root.querySelectorAll('[data-activate]').forEach(function (b) {
      b.onclick = function () { activate(b.dataset.activate); };
    });
    root.querySelectorAll('[data-code]').forEach(function (b) {
      b.onclick = function () {
        navigator.clipboard && navigator.clipboard.writeText(b.dataset.code);
        UI.toast('Coupon code copied');
      };
    });
    root.querySelectorAll('[data-fav]').forEach(function (b) {
      b.onclick = function () {
        if (!Auth.require()) return;
        var on = O.toggleFavourite(Auth.current().id, b.dataset.fav);
        b.classList.toggle('is-on', on);
        UI.toast(on ? 'Offer saved' : 'Offer removed from saved');
      };
    });
  }
  w.CC.Render.bindOfferActions = bindOfferActions;

  /* ---------------- /offers ---------------- */
  var oState = { q: '', categories: [], kind: 'all', section: 'all', sort: 'cashback' };

  w.CC.Pages.offers = function (params, query) {
    if (query.category) oState.categories = [query.category];
    if (query.section) oState.section = query.section;

    var sections = [
      ['all', 'All offers'], ['top', 'Top offers'], ['trending', 'Trending'],
      ['flash', 'Flash deals'], ['new', 'Newest']
    ];

    return {
      title: 'Cashback offers | Card Crest',
      desc: 'Live cashback offers and coupon codes across shopping, travel, food and finance.',
      html: '<div class="wrap section--tight">' +
        '<div class="section__head"><h1 class="h1">Cashback on top of <em>whatever your card already gives you</em></h1>' +
        '<p class="lede">Start your shopping session here and we track the purchase. The cashback stacks on the rewards your card earns anyway.</p></div>' +

        '<div class="chip-row chip-row--scroll" style="margin-bottom:14px">' + sections.map(function (s) {
          return '<button class="chip' + (oState.section === s[0] ? ' is-on' : '') + '" data-section="' + s[0] + '">' + s[1] + '</button>';
        }).join('') + '</div>' +

        '<div class="chip-row chip-row--scroll" style="margin-bottom:22px">' +
          '<button class="chip' + (!oState.categories.length ? ' is-on' : '') + '" data-cat="">All categories</button>' +
          O.categories().map(function (c) {
            return '<button class="chip' + (oState.categories.indexOf(c.name) > -1 ? ' is-on' : '') + '" data-cat="' + c.name + '">' + c.name + '</button>';
          }).join('') + '</div>' +

        '<div class="mkt__bar">' +
          '<input type="search" id="offerSearch" placeholder="Search stores, offers or codes" value="' + UI.esc(oState.q) + '" aria-label="Search offers" style="flex:1; min-width:220px">' +
          '<div class="row">' +
            '<select id="offerKind" aria-label="Offer type" style="width:auto; height:38px">' +
              '<option value="all">Deals and coupons</option><option value="deal">Cashback deals only</option><option value="coupon">Coupon codes only</option>' +
            '</select>' +
            '<select id="offerSort" aria-label="Sort offers" style="width:auto; height:38px">' +
              '<option value="cashback">Highest cashback</option><option value="expiry">Ending soonest</option><option value="store">Store A–Z</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<p class="mkt__count" id="offerCount"></p>' +
        '<div class="grid g-3" id="offerGrid" style="margin-top:14px"></div>' +

        '<div class="section--tight"><div class="spread" style="margin-bottom:18px"><h2 class="h2">Popular stores</h2>' +
        '<a class="btn btn--ghost btn--sm" href="#/stores">All stores</a></div>' +
        '<div class="grid g-4">' + O.stores().filter(function (s) { return s.popular; }).slice(0, 8).map(storeTile).join('') + '</div></div>' +
        '</div>',
      mount: function (root) {
        var grid = root.querySelector('#offerGrid');
        var count = root.querySelector('#offerCount');

        function draw() {
          var list = O.query(oState);
          count.textContent = list.length + (list.length === 1 ? ' offer' : ' offers') + ' live right now';
          if (!list.length) {
            grid.style.gridTemplateColumns = '1fr';
            grid.innerHTML = UI.empty('No offers match that',
              'Try a broader category, or clear the search. New offers go live every week.',
              'Show all offers', '#/offers');
            return;
          }
          grid.style.gridTemplateColumns = '';
          grid.innerHTML = list.map(offerTile).join('');
          bindOfferActions(grid);
          UI.reveal(grid);
        }

        root.querySelectorAll('[data-section]').forEach(function (b) {
          b.onclick = function () {
            oState.section = b.dataset.section;
            root.querySelectorAll('[data-section]').forEach(function (x) { x.classList.remove('is-on'); });
            b.classList.add('is-on'); draw();
          };
        });
        root.querySelectorAll('[data-cat]').forEach(function (b) {
          b.onclick = function () {
            var v = b.dataset.cat;
            oState.categories = v ? [v] : [];
            root.querySelectorAll('[data-cat]').forEach(function (x) { x.classList.remove('is-on'); });
            b.classList.add('is-on'); draw();
          };
        });
        root.querySelector('#offerSearch').addEventListener('input', UI.debounce(function (e) {
          oState.q = e.target.value; draw();
        }, 240));
        root.querySelector('#offerKind').addEventListener('change', function (e) { oState.kind = e.target.value; draw(); });
        root.querySelector('#offerSort').addEventListener('change', function (e) { oState.sort = e.target.value; draw(); });
        draw();
      }
    };
  };

  /* ---------------- /offers/:id ---------------- */
  w.CC.Pages.offerDetail = function (params) {
    var offer = O.byId(params.id);
    if (!offer) return w.CC.Pages.notFound();
    var store = O.store(offer.storeId);
    var related = O.forStore(store.id).filter(function (o) { return o.id !== offer.id; }).slice(0, 3);

    return {
      title: offer.title + ' | Card Crest',
      desc: offer.title + ' at ' + store.name + ' with up to ' + offer.cashback + '% cashback through Card Crest.',
      html: '<div class="wrap section--tight" style="max-width:820px">' +
        '<nav class="small muted" style="margin-bottom:18px"><a href="#/offers">Offers</a> / <a href="#/stores/' + store.id + '">' + UI.esc(store.name) + '</a></nav>' +
        '<div class="panel">' +
          '<div class="row" style="gap:16px; margin-bottom:20px">' + UI.logo(store) +
          '<div><div class="otile__brand" style="font-size:1.1rem">' + UI.esc(store.name) + '</div>' +
          '<div class="otile__cb">Up to ' + UI.pct(offer.cashback) + ' cashback</div></div></div>' +
          '<h1 class="h1" style="font-size:1.6rem; margin-bottom:16px">' + UI.esc(offer.title) + '</h1>' +
          (offer.kind === 'coupon' ? '<div class="copy-box" style="margin-bottom:20px"><code>' + UI.esc(offer.code) + '</code>' +
            '<button class="btn btn--sm btn--soft" data-code="' + UI.esc(offer.code) + '">Copy code</button></div>' : '') +
          '<div class="grid g-3" style="margin-bottom:22px">' +
            '<div class="stat"><span class="stat__k">Cashback</span><span class="stat__v">' + UI.pct(offer.cashback) + '</span></div>' +
            '<div class="stat"><span class="stat__k">Type</span><span class="stat__v" style="font-size:1.1rem">' + (offer.kind === 'coupon' ? 'Coupon code' : 'Cashback deal') + '</span></div>' +
            '<div class="stat"><span class="stat__k">Ends in</span><span class="stat__v">' + offer.expiresInDays + 'd</span></div>' +
          '</div>' +
          '<button class="btn btn--primary btn--lg btn--block" data-activate="' + offer.id + '">Activate cashback</button>' +
          '<div class="divider"></div>' +
          '<h2 class="h2" style="font-size:1.15rem; margin-bottom:10px">Terms for this offer</h2>' +
          '<p class="muted small">' + UI.esc(offer.terms) + '</p>' +
          '<h2 class="h2" style="font-size:1.15rem; margin:22px 0 10px">Store cashback rules</h2>' +
          '<ul class="benefit-list">' + store.terms.map(function (t) {
            return '<li><span class="tick">&check;</span>' + UI.esc(t) + '</li>';
          }).join('') + '</ul>' +
        '</div>' +
        (related.length ? '<div class="section--tight"><h2 class="h2" style="margin-bottom:16px">More from ' + UI.esc(store.name) + '</h2>' +
          '<div class="grid g-3">' + related.map(offerTile).join('') + '</div></div>' : '') +
        '</div>',
      mount: function (root) { bindOfferActions(root); }
    };
  };

  /* ---------------- /stores ---------------- */
  var sState = { q: '', categories: [], sort: 'cashback' };

  w.CC.Pages.stores = function () {
    return {
      title: 'Stores | Card Crest',
      desc: 'Browse every store on Card Crest and the cashback rate you earn there.',
      html: '<div class="wrap section--tight">' +
        '<div class="section__head"><h1 class="h1">Every store, and <em>what it pays back</em></h1>' +
        '<p class="lede">Start a session from a store page and your purchase is tracked automatically.</p></div>' +
        '<div class="chip-row chip-row--scroll" style="margin-bottom:22px">' +
          '<button class="chip is-on" data-cat="">All categories</button>' +
          O.categories().map(function (c) {
            return '<button class="chip" data-cat="' + c.name + '">' + c.name + ' (' + c.count + ')</button>';
          }).join('') + '</div>' +
        '<div class="mkt__bar">' +
          '<input type="search" id="storeSearch" placeholder="Search stores" aria-label="Search stores" style="flex:1; min-width:220px">' +
          '<select id="storeSort" aria-label="Sort stores" style="width:auto; height:38px">' +
            '<option value="cashback">Highest cashback</option><option value="popular">Most popular</option>' +
            '<option value="offers">Most offers</option><option value="name">Name A–Z</option>' +
          '</select>' +
        '</div>' +
        '<p class="mkt__count" id="storeCount"></p>' +
        '<div class="grid g-4" id="storeGrid" style="margin-top:14px"></div></div>',
      mount: function (root) {
        var grid = root.querySelector('#storeGrid');
        var count = root.querySelector('#storeCount');
        function draw() {
          var list = O.queryStores(sState);
          count.textContent = list.length + (list.length === 1 ? ' store' : ' stores');
          if (!list.length) {
            grid.style.gridTemplateColumns = '1fr';
            grid.innerHTML = UI.empty('No stores found', 'Try a different search term or category.', 'Show all stores', '#/stores');
            return;
          }
          grid.style.gridTemplateColumns = '';
          grid.innerHTML = list.map(storeTile).join('');
          UI.reveal(grid);
        }
        root.querySelectorAll('[data-cat]').forEach(function (b) {
          b.onclick = function () {
            sState.categories = b.dataset.cat ? [b.dataset.cat] : [];
            root.querySelectorAll('[data-cat]').forEach(function (x) { x.classList.remove('is-on'); });
            b.classList.add('is-on'); draw();
          };
        });
        root.querySelector('#storeSearch').addEventListener('input', UI.debounce(function (e) {
          sState.q = e.target.value; draw();
        }, 240));
        root.querySelector('#storeSort').addEventListener('change', function (e) { sState.sort = e.target.value; draw(); });
        draw();
      }
    };
  };

  /* ---------------- /stores/:id ---------------- */
  w.CC.Pages.storeDetail = function (params) {
    var store = O.store(params.id);
    if (!store) return w.CC.Pages.notFound();
    var offers = O.forStore(store.id);
    var coupons = offers.filter(function (o) { return o.kind === 'coupon'; });
    var deals = offers.filter(function (o) { return o.kind === 'deal'; });
    var related = O.stores().filter(function (s) {
      return s.category === store.category && s.id !== store.id;
    }).slice(0, 4);

    return {
      title: store.name + ' cashback and coupons | Card Crest',
      desc: 'Earn up to ' + store.cashback + '% cashback at ' + store.name + ' plus live coupon codes.',
      html: '<div class="wrap section--tight">' +
        '<nav class="small muted" style="margin-bottom:18px"><a href="#/stores">Stores</a> / ' + UI.esc(store.name) + '</nav>' +
        '<div class="store-hero" style="margin-bottom:28px">' + UI.logo(store) +
          '<div style="flex:1; min-width:220px"><h1 class="h1" style="font-size:1.9rem">' + UI.esc(store.name) + '</h1>' +
          '<p class="muted small" style="margin-top:4px">' + UI.esc(store.category) + ' &middot; ' + offers.length + ' live offers</p></div>' +
          '<div style="text-align:right"><div class="stat__k">Cashback up to</div>' +
          '<div class="stat__v" style="color:var(--crest)">' + UI.pct(store.cashback) + '</div></div>' +
          '<button class="btn btn--primary" data-activate-store>Activate cashback</button>' +
        '</div>' +

        (deals.length ? '<h2 class="h2" style="margin-bottom:16px">Cashback deals</h2>' +
          '<div class="grid g-3" style="margin-bottom:34px">' + deals.map(offerTile).join('') + '</div>' : '') +
        (coupons.length ? '<h2 class="h2" style="margin-bottom:16px">Coupon codes</h2>' +
          '<div class="grid g-3" style="margin-bottom:34px">' + coupons.map(offerTile).join('') + '</div>' : '') +

        '<div class="grid g-2" style="margin-bottom:34px">' +
          '<div class="panel"><h2 class="h2" style="font-size:1.2rem; margin-bottom:14px">How cashback works here</h2>' +
          '<ol class="tl" style="padding-left:30px">' +
          ['Start from this page so we can open a tracked session.',
           'Shop as usual and pay in that same session.',
           'The order appears in your transactions within 48 hours as tracked.',
           'Once ' + store.name + '\'s return window closes, it moves to confirmed and lands in your rewards.'
          ].map(function (t, i) {
            return '<li class="tl__i' + (i === 0 ? ' is-now' : '') + '"><div class="tl__t">Step ' + (i + 1) + '</div><div class="tl__d">' + UI.esc(t) + '</div></li>';
          }).join('') + '</ol></div>' +
          '<div class="panel"><h2 class="h2" style="font-size:1.2rem; margin-bottom:14px">Cashback rules</h2>' +
          '<ul class="benefit-list">' + store.terms.map(function (t) {
            return '<li><span class="tick">&check;</span>' + UI.esc(t) + '</li>';
          }).join('') + '</ul></div>' +
        '</div>' +

        (related.length ? '<h2 class="h2" style="margin-bottom:16px">Similar stores</h2>' +
          '<div class="grid g-4">' + related.map(storeTile).join('') + '</div>' : '') +
        '</div>',
      mount: function (root) {
        bindOfferActions(root);
        root.querySelector('[data-activate-store]').onclick = function () {
          var best = offers.slice().sort(function (a, b) { return b.cashback - a.cashback; })[0];
          if (!best) return UI.toast('No live offers at this store right now', 'error');
          activate(best.id);
        };
      }
    };
  };
})(window, document);
