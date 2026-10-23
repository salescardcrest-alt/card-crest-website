/* ============================================================
   Card Crest — pages/market.js
   Benefit-sharing marketplace pages (buyer + cardholder):
   /market, /market/new/:module, /market/requests, /market/earn,
   /market/cards, /market/wallet, /market/r/:id
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, Auth = w.CC.Auth, M = w.CC.Market, Core = w.CC.MarketCore, C = w.CC.Cards;
  w.CC.Pages = w.CC.Pages || {};
  var money = UI.money, esc = UI.esc;

  /* ---------------- shared bits ---------------- */
  var MODS = {
    LOUNGE: { slug: 'lounge', title: 'Lounge access', short: 'Airport lounge', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15.5 13.5 11V5.5a1.5 1.5 0 0 0-3 0V11L3 15.5V17l7.5-2v3.5L9 20v1.2l3-.8 3 .8V20l-1.5-1.5V15L21 17z"/></svg>', blurb: 'Enter an airport lounge for ₹500 domestic or ₹1,000 international.' },
    MOVIE:  { slug: 'movie', title: 'Movie offers', short: 'Movie offer', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="6.5" r="4"/><circle cx="7.5" cy="6.5" r="1"/><circle cx="16" cy="6.5" r="4"/><circle cx="16" cy="6.5" r="1"/><rect x="2.5" y="11.5" width="14" height="9" rx="1.8"/><path d="M16.5 14.5 21.5 12v8l-5-2.5"/></svg>', blurb: 'Get buy-one-get-one or ₹500 off on 2 seats using a card that carries the offer.' },
    ORDER:  { slug: 'order', title: 'Order & Earn', short: 'Order & Earn', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6.4"/><path d="M9.6 9.2h4.8M9.6 11.4h4.8M10 9.2c3.2 0 3.2 4.4 0 4.4h-.4l3.4 2.2"/></svg>', blurb: 'A cardholder orders for you with their card offer. You get a discount.' },
    PAY:    { slug: 'pay', title: 'Order & Earn', short: 'Order & Earn', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></svg>', blurb: 'Share the shopping site, your payment link and delivery address. A cardholder pays with their card. You get a discount.' }
  };
  var SLUG = { lounge: 'LOUNGE', movie: 'MOVIE', order: 'ORDER', pay: 'PAY' };

  var STATUS = {
    CREATED: ['grey', 'Awaiting payment'], PAID: ['info', 'Open for cardholders'], ACCEPTED: ['warn', 'Accepted'],
    FULFILLED: ['warn', 'Proof uploaded'], CONFIRMED: ['ok', 'Confirmed'], SETTLED: ['ok', 'Completed'],
    EXPIRED: ['grey', 'Expired'], CANCELLED: ['grey', 'Cancelled'], DISPUTED: ['danger', 'In dispute'], REFUNDED: ['grey', 'Refunded']
  };
  function badge(status) { var s = STATUS[status] || ['grey', status]; return '<span class="badge badge--' + s[0] + '">' + s[1] + '</span>'; }

  function dt(iso) {
    if (!iso) return '—';
    var x = new Date(iso);
    return isNaN(x) ? '—' : x.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function left(iso) {
    var ms = new Date(iso).getTime() - M.now();
    if (ms <= 0) return 'now';
    var m = Math.round(ms / 60000), h = Math.floor(m / 60);
    if (m < 60) return m + ' min';
    if (h < 48) return h + ' h ' + (m % 60) + ' min';
    return Math.round(h / 24) + ' days';
  }
  function bankName(id) { if (!id || id === 'any') return 'Any eligible card'; var b = C.bank(id); return b ? b.name : id; }

  function titleOf(r) {
    var x = r.details || {};
    if (r.module === 'LOUNGE') return x.airport + ' ' + x.terminal + ' · ' + String(x.type || '').toLowerCase() + ' lounge';
    if (r.module === 'MOVIE') return x.movie + ' · ' + (x.offer === 'BOGO' ? 'Buy one get one' : '₹500 off on 2 seats');
    return (r.module === 'ORDER' ? 'Order' : 'Pay') + ' on ' + x.platform + ' · ' + UI.sentence(x.offerWanted);
  }
  function subOf(r) {
    var x = r.details || {};
    if (r.module === 'LOUNGE') return 'Flight ' + x.flight + ' · ' + dt(x.dateTime);
    if (r.module === 'MOVIE') return x.theatre + ' · ' + dt(x.showTime) + ' · ' + x.seatCount + ' seats';
    return 'Price after offer ' + money(x.expectedPrice) + ' (listed ' + money(x.listPrice) + ')';
  }

  function shell(active, inner) {
    var items = [
      ['/market', 'Overview'], ['/market/requests', 'My requests'], ['/market/pay-earn', 'Pay & Earn'], ['/market/earn', 'Earn with my card'],
      ['/market/cards', 'My benefit cards'], ['/market/wallet', 'Wallet and payouts']
    ];
    return '<div class="wrap section--tight"><div class="dash">' +
      '<nav class="side-nav" aria-label="Marketplace">' +
      items.map(function (i) { return '<a href="#' + i[0] + '" class="' + (i[0] === active ? 'is-active' : '') + '">' + i[1] + '</a>'; }).join('') +
      '</nav><div>' + inner + '</div></div></div>';
  }

  var lastLoad = 0;
  /* A page stays "current" until the router draws another one. Timers and listeners check this, so a page that
     has been replaced never keeps polling or redrawing (the view element itself is reused, so isConnected can't tell). */
  function stamp() { var g = w.CC.Router.gen; return function () { return w.CC.Router.gen === g; }; }
  /* A fingerprint of everything these pages show. Pages redraw only when it really changes. */
  function dataSig() {
    var u = Auth.current(), uid = u ? u.id : '', S = w.CC.Store;
    return [
      M.all().map(function (r) { return [r.id, r.status, r.version, r.topupDue, r.cardholderId].join(':'); }).join(','),
      M.cards(uid).map(function (c) { return c.id + ':' + c.bank + c.variant + ':' + JSON.stringify(c.benefits || []); }).join(','),
      M.openFor(uid).map(function (o) { return o.request.id + (o.eligible ? 1 : 0); }).join(','),
      M.payouts().map(function (p) { return p.id + p.status; }).join(','),
      M.kycAll().map(function (k) { return k.id + k.status; }).join(','),
      M.wallet(uid).balance, M.fees().map(function (f) { return f.id + JSON.stringify(f); }).join(''),
      (S.get('mkProofs') || []).length, (S.get('mkRatings') || []).length, (S.get('mkDisputes') || []).map(function (d) { return d.id + d.status; }).join(',')
    ].join('|');
  }
  /* Supabase: pull fresh rows when a page opens, and redraw only if something changed. */
  function fresh(root) {
    var alive = stamp();
    if (M.mode() !== 'supabase' || !Auth.current()) return;
    if (Date.now() - lastLoad < 5000) return;
    lastLoad = Date.now();
    var before = dataSig();
    M.load().then(function () { if (alive() && dataSig() !== before) w.CC.Router.refresh(); });
  }
  function onChange(root, fn) {
    var alive = stamp(), last = dataSig();
    function h() {
      if (!alive()) { w.removeEventListener('cc:market', h); return; }
      var now = dataSig(); if (now === last) return;
      last = now; fn();
    }
    w.addEventListener('cc:market', h);
  }
  function busy(btn, on, label) {
    if (!btn) return;
    btn.disabled = !!on;
    if (label) { if (on) { btn.dataset.l = btn.textContent; btn.textContent = label; } else if (btn.dataset.l) btn.textContent = btn.dataset.l; }
  }
  function field(id, label, input, hint) {
    return '<div class="field"><label for="' + id + '">' + label + '</label>' + input + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  }
  function row(k, v, strong) {
    var amount = /^[−+-]?₹[\d,.]+$/.test(String(v)); // keep money on one line, let long text wrap
    return '<div class="spread" style="padding:9px 0; border-bottom:1px solid var(--line-soft)"><span class="muted">' + k + '</span><span style="font-weight:' + (strong ? 800 : 600) + (amount ? '; white-space:nowrap; flex-shrink:0' : '; text-align:right') + '">' + v + '</span></div>';
  }

  /* price breakdown, role aware */
  function breakdown(module, q, who) {
    var out = '', sp = q.split;
    if (sp && who === 'holder') {
      if (q.reimbursement) out += row('Ticket amount you pay and get back in full', money(q.reimbursement));
      out += row('Your earning', '+' + money(q.holderFee));
    } else if (sp && module === 'LOUNGE') {
      out += row('Usual lounge entry price', money(q.original));
      out += row('Your discount', '−' + money(sp.buyerShare));
    } else if (sp) {
      out += row('Listed price', money(q.original));
      out += row('Card offer discount', '−' + money(q.discount));
      out += row('Price after the offer (paid by the cardholder)', money(q.reimbursement));
      out += row('Service fee', '+' + money(q.fee));
    } else if (module === 'LOUNGE' && who === 'holder') {
      out += row('Your share of the lounge fee', '+' + money(q.holderFee));
    } else if (module === 'LOUNGE') {
      if (q.discount > 0) {
        out += row('Usual lounge entry price', money(q.original));
        out += row('Your saving with a cardholder', '−' + money(q.discount));
      } else out += row('Lounge access fee', money(q.total));
    } else {
      out += row(module === 'MOVIE' ? 'Ticket price (all seats)' : 'Listed price', money(q.original));
      out += row('Card offer discount', '−' + money(q.discount));
      out += row('Ticket amount (reimbursed to the cardholder)', money(q.reimbursement));
      out += row('Service fee', money(q.fee));
    }
    var recv = q.holderReceives != null ? q.holderReceives : (Number(q.reimbursement) || 0) + (Number(q.holderFee) || 0);   // old requests do not store the total
    out += '<div class="spread" style="padding:13px 0 4px"><strong>' + (who === 'holder' ? 'You receive in total' : 'You pay') + '</strong><strong style="font-size:1.35rem; white-space:nowrap">' + money(who === 'holder' ? recv : q.total) + '</strong></div>';
    if (who !== 'holder' && q.saved !== null && q.saved !== undefined) {
      out += '<div class="mk-save">You save ' + money(q.saved) + ' compared with paying full price</div>';
    }
    return out;
  }

  /* ---------------- hub ---------------- */
  w.CC.Pages.market = function () {
    var u = Auth.current();
    var mine = u ? M.asBuyer(u.id) : [];
    var active = mine.filter(function (r) { return ['SETTLED', 'REFUNDED', 'CANCELLED', 'EXPIRED'].indexOf(r.status) < 0; }).length;
    var jobs = u ? M.asHolder(u.id).filter(function (r) { return ['ACCEPTED', 'FULFILLED', 'DISPUTED'].indexOf(r.status) > -1; }).length : 0;

    var html = '<div class="wrap section--tight">' +
      '<div class="section__head"><span class="eyebrow">Share &amp; Earn</span>' +
      '<h1 class="h1">Get the card offer you don’t have. <em>Or earn from the one you do.</em></h1>' +
      '<p class="lede">Buyers pay into escrow. Cardholders fulfil the request with their own card. Money is released only after the buyer confirms, and Card Crest never sees card numbers, CVVs or OTPs.</p></div>' +
      '<div class="note note--warn" style="margin-bottom:26px"><strong>Test mode.</strong> Payments and payouts are simulated, no real money moves. Real gateway checkout is switched on later.</div>' +

      (u ? '<div class="grid g-3" style="margin-bottom:28px">' +
        '<div class="stat"><span class="stat__k">Your active requests</span><span class="stat__v">' + active + '</span><span class="stat__sub"><a href="#/market/requests">View all</a></span></div>' +
        '<div class="stat"><span class="stat__k">Tasks you are doing</span><span class="stat__v">' + jobs + '</span><span class="stat__sub"><a href="#/market/earn">Open requests</a></span></div>' +
        '<div class="stat stat--accent"><span class="stat__k">Wallet available</span><span class="stat__v">' + money(M.wallet(u.id).available) + '</span><span class="stat__sub">Trust score ' + M.trust(u.id) + ' / 100</span></div>' +
        '</div>' : '') +

      '<h2 class="h2" style="margin-bottom:14px">I want a benefit</h2>' +
      '<div class="grid g-4" style="margin-bottom:34px">' +
      Object.keys(MODS).filter(function (k) { return k !== 'ORDER'; }).map(function (k) { /* Order & Earn is now part of Pay & Earn */
        var m = MODS[k];
        return '<a class="panel mk-tile" href="#/market/new/' + m.slug + '"><span class="mk-tile__i mk-tile__i--' + m.slug + '">' + m.icon + '</span>' +
          '<strong>' + m.title + '</strong><span class="muted small">' + m.blurb + '</span><span class="mk-tile__go">Start a request →</span></a>';
      }).join('') +
      '<a class="panel mk-tile" href="#/market/pay-earn"><span class="mk-tile__i mk-tile__i--order">' + MODS.ORDER.icon + '</span><strong>Pay & Earn</strong><span class="muted small">See your Order & Earn requests with the payment link, shopping site and delivery address.</span><span class="mk-tile__go">Open →</span></a></div>' +

      '<h2 class="h2" style="margin-bottom:14px">I have a card</h2>' +
      '<div class="grid g-3" style="margin-bottom:34px">' +
      '<a class="panel mk-tile" href="#/market/cards"><span class="mk-tile__i">1</span><strong>Add your benefit cards</strong><span class="muted small">Bank and variant only, plus lounge quotas and offers. Never the card number.</span></a>' +
      '<a class="panel mk-tile" href="#/market/earn"><span class="mk-tile__i">2</span><strong>Pick up open requests</strong><span class="muted small">You see only requests your cards can fulfil. First to accept gets it.</span></a>' +
      '<a class="panel mk-tile" href="#/market/wallet"><span class="mk-tile__i">3</span><strong>Get paid</strong><span class="muted small">Reimbursement plus your earning lands in your wallet. Withdraw after KYC.</span></a>' +
      '</div>' +

      '<h2 class="h2" style="margin-bottom:18px">How the money stays safe</h2>' +
      '<div class="flow" style="margin-bottom:30px">' +
      [['Pay into escrow', 'The buyer pays the full amount to Card Crest. It is held, not handed over.'],
       ['A cardholder accepts', 'Only cardholders whose card truly fits can accept, and the first one locks it.'],
       ['Proof is uploaded', 'Order IDs, passes and invoices are attached. Phone numbers stay hidden in chat.'],
       ['Confirm, then release', 'The buyer confirms (or time passes with no dispute) and the split is paid out. Problems mean a refund.']
      ].map(function (s) { return '<div class="flow__i"><h3 class="h3">' + s[0] + '</h3><p>' + s[1] + '</p></div>'; }).join('') + '</div>' +
      '<p class="muted small">Card benefits are set by each bank and can change. Sharing a benefit may be restricted by your bank’s terms, so check them before you list a card.</p>' +
      '</div>';
    return { title: 'Share & Earn | Card Crest', desc: 'Get lounge access, movie offers and card-offer prices, or earn by sharing your card benefits, with escrow-protected payments.', html: html,
      mount: function (root) { fresh(root); } };
  };

  /* ---------------- new request ---------------- */
  function payModal(req, opts) {
    opts = opts || {};
    var amount = opts.amount !== undefined ? opts.amount : req.feeSnapshot.total;
    UI.modal({
      title: opts.topup ? 'Top up escrow' : 'Pay into escrow',
      body: '<div class="note note--warn" style="margin-bottom:14px"><strong>Test checkout.</strong> No card details are asked for and no money moves.</div>' +
        '<div class="spread" style="margin-bottom:6px"><span class="muted">' + esc(titleOf(req)) + '</span><strong style="font-size:1.4rem">' + money(amount) + '</strong></div>' +
        '<p class="muted small">Your payment is held in escrow. The cardholder is paid only after you confirm, and you are refunded in full if nobody picks it up or the request fails.</p>' +
        '<p class="err" id="payErr" style="color:var(--danger); font-size:.85rem; display:none"></p>',
      foot: '<button class="btn btn--ghost" data-x>' + (opts.topup ? 'Not now' : 'Pay later') + '</button>' +
        '<button class="btn btn--danger" data-fail>Simulate failed payment</button>' +
        '<button class="btn btn--primary" data-ok>Pay ' + money(amount) + ' (test)</button>',
      onMount: function (m) {
        function go(outcome, btn) {
          busy(btn, true);
          M.pay(req.id, outcome, opts.topup ? 'TOPUP' : 'ORDER').then(function (r) {
            if (!r.ok) { var e = m.querySelector('#payErr'); e.textContent = r.error; e.style.display = 'block'; busy(btn, false); return; }
            if (outcome === 'fail') {
              var e2 = m.querySelector('#payErr'); e2.textContent = 'The test payment failed. Nothing was charged. You can try again.'; e2.style.display = 'block'; busy(btn, false); return;
            }
            UI.closeModal(); UI.toast(opts.topup ? 'Top-up received' : 'Payment received and held in escrow');
            if (opts.done) opts.done(); else w.CC.Router.go('#/market/r/' + req.id);
          });
        }
        m.querySelector('[data-ok]').onclick = function () { go('success', this); };
        m.querySelector('[data-fail]').onclick = function () { go('fail', this); };
        m.addEventListener('click', function (e) { if (e.target.closest('[data-x]') && !opts.topup && !opts.done) w.CC.Router.go('#/market/r/' + req.id); });
      }
    });
  }

  function bankOptions() {
    return '<option value="any">Any eligible card</option>' + C.banks().map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('');
  }
  function nowLocalMin(hours) {
    var t = new Date(M.now() + hours * 3600000);
    t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
    return t.toISOString().slice(0, 16);
  }

  var STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
  var FORMS = {
    LOUNGE: function () {
      return '<div class="field"><label>Lounge type</label><div class="chip-row" id="f-type"></div><span class="hint">Pick this first. The airport list changes to match.</span></div>' +
        field('f-airport', 'Airport', '<select id="f-airport"></select>', '<span id="f-airportHint"></span>') +
        '<div class="form-grid">' + field('f-terminal', 'Terminal', '<select id="f-terminal"></select><input id="f-terminalx" placeholder="e.g. T3 or Terminal 1" maxlength="20" autocomplete="off" hidden>') +
        field('f-date', 'Flight date and time', '<input id="f-date" type="datetime-local" min="' + nowLocalMin(2) + '">', 'At least 2 hours from now.') + '</div>' +
        '<div class="form-grid">' + field('f-flight', 'Flight number', '<input id="f-flight" placeholder="AI 101" maxlength="8" autocomplete="off">') +
        field('f-guest', 'Name as per ID', '<input id="f-guest" data-name placeholder="As on your boarding pass" autocomplete="name">') + '</div>';
    },
    MOVIE: function () {
      return field('f-offer', 'Offer', '<select id="f-offer"><option value="FLAT_500_OFF_2_SEATS">₹500 off on 2 seats</option><option value="BOGO">Buy one get one</option></select>') +
        '<div class="form-grid">' + field('f-movie', 'Movie', '<input id="f-movie" placeholder="Movie name">') + field('f-theatre', 'Theatre', '<input id="f-theatre" placeholder="PVR Orion, Bengaluru">') + '</div>' +
        '<div class="form-grid">' + field('f-city', 'City', '<input id="f-city" placeholder="Bengaluru">') +
        field('f-show', 'Showtime', '<input id="f-show" type="datetime-local" min="' + nowLocalMin(3) + '">', 'At least 3 hours from now.') + '</div>' +
        '<div class="form-grid">' + field('f-seats', 'Seats', '<input id="f-seats" placeholder="G7, G8">') +
        field('f-count', 'Number of seats', '<input id="f-count" type="number" min="2" max="2" value="2">', 'Both offers need exactly 2 seats.') + '</div>' +
        '<div class="form-grid">' + field('f-total', 'Ticket total for all seats (₹)', '<input id="f-total" type="number" min="1" inputmode="decimal" placeholder="1200">', 'What the booking shows before any offer.') +
        field('f-plat', 'Booking site', '<select id="f-plat"><option>BookMyShow</option><option>District</option><option>PVR INOX</option><option>Paytm Movies</option><option>Other</option></select>') + '</div>' +
        field('f-bank', 'Card the offer runs on', '<select id="f-bank">' + bankOptions() + '</select>', 'Pick a bank if the offer is tied to one.');
    },
    ORDER: function (pay) {
      return '<div class="form-grid">' + (pay ? '' : field('f-url', 'Product link', '<input id="f-url" type="url" placeholder="https://www.amazon.in/…">')) +
        field('f-plat', pay ? 'Shopping site or merchant' : 'Shopping site', '<select id="f-plat"><option>Amazon</option><option>Flipkart</option><option>Myntra</option><option>Ajio</option><option>Croma</option><option>Other</option></select>') + '</div>' +
        (pay ? field('f-pay', 'Final payment link', '<input id="f-pay" placeholder="Paste the payment link" autocomplete="off">',
          'The page where the payment is made, after the offer is applied. The cardholder opens it and pays with their own card. Only they see this link, after accepting. It needs to open for someone who is not signed in as you, like a pay-by-link or invoice link.') : '') +
        '<div class="form-grid">' + field('f-list', 'Listed price (₹)', '<input id="f-list" type="number" min="1" max="200000" inputmode="decimal">', 'Up to ₹2,00,000.') +
        field('f-exp', pay ? 'Amount to pay on that page (₹)' : 'Price after the card offer (₹)', '<input id="f-exp" type="number" min="1" max="200000" inputmode="decimal">', 'Must be less than the listed price.') + '</div>' +
        field('f-offer', 'Card offer you want', '<input id="f-offer" placeholder="10% instant discount on HDFC credit cards">') +
        field('f-bank', 'Card', '<select id="f-bank">' + bankOptions() + '<option value="other">Other card (type which one)</option></select><input id="f-cardname" placeholder="Which card? e.g. SBI Cashback" maxlength="60" autocomplete="off" style="margin-top:8px" hidden>') +
        '<h3 class="h3" style="margin:6px 0 10px">Delivery address</h3><div class="form-grid">' + field('f-an', 'Full name', '<input id="f-an" data-name autocomplete="name">') + field('f-apin', 'PIN code', '<input id="f-apin" maxlength="6" inputmode="numeric" autocomplete="postal-code">', '<span id="f-apinHint">Enter the PIN code and the city, state and area fill in by themselves.</span>') + '</div>' +
          field('f-aarea', 'Area', '<select id="f-aarea"><option value="">Enter the PIN code first</option></select>') + field('f-aline', 'Address', '<input id="f-aline" autocomplete="street-address" placeholder="House, street, area">') + '<div class="form-grid">' + field('f-acity', 'City', '<input id="f-acity" autocomplete="address-level2">') + field('f-astate', 'State', '<select id="f-astate" autocomplete="address-level1"><option value="">Choose state</option>' + STATES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>') + '</div>' +
          '<p class="muted small">Only the cardholder who accepts your request sees the payment link and address.</p>';
    }
  };

  w.CC.Pages.marketNew = function (params) {
    if (!Auth.require()) return false;
    var module = SLUG[params.module];
    if (!module) return w.CC.Pages.notFound();
    var m = MODS[module];

    var html = '<div class="wrap section--tight"><a class="btn btn--link small" href="#/market">← Share &amp; Earn</a>' +
      '<div class="section__head" style="margin-top:12px"><h1 class="h1">' + m.title + '</h1><p class="lede">' + m.blurb + '</p></div>' +
      '<div class="detail"><div class="panel" id="mkForm">' + (module === 'ORDER' ? FORMS.ORDER(false) : module === 'PAY' ? FORMS.ORDER(true) : FORMS[module]()) +
      '<p class="err" id="mkErr" style="color:var(--danger); font-size:.88rem; display:none; margin-top:8px"></p>' +
      '<button class="btn btn--primary btn--lg btn--block" id="mkGo" style="margin-top:14px">Review and pay</button>' +
      '<p class="muted small" style="margin-top:12px; text-align:center">You pay into escrow. Nothing is released until you confirm.</p></div>' +
      '<aside class="detail__side"><div class="panel" id="mkQuote"></div></aside></div></div>';

    return {
      title: m.title + ' | Share & Earn | Card Crest', html: html,
      mount: function (root) {
        function $(id) { return root.querySelector('#' + id); }
        var type = 'DOMESTIC';

        function collect() {
          if (module === 'LOUNGE') {
            return { type: type, airport: $('f-airport').value, terminal: type === 'INTERNATIONAL' ? $('f-terminalx').value : $('f-terminal').value, dateTime: $('f-date').value, flight: $('f-flight').value, guestName: UI.titleCase($('f-guest').value).trim() };
          }
          if (module === 'MOVIE') {
            return { offer: $('f-offer').value, movie: $('f-movie').value, theatre: $('f-theatre').value, city: $('f-city').value, showTime: $('f-show').value,
              seats: $('f-seats').value, seatCount: Number($('f-count').value), ticketTotal: Number($('f-total').value), platform: $('f-plat').value, bank: $('f-bank').value };
          }
          var o = { url: module === 'ORDER' ? $('f-url').value : '', platform: $('f-plat').value, listPrice: Number($('f-list').value), expectedPrice: Number($('f-exp').value), offerWanted: UI.sentence($('f-offer').value), bank: $('f-bank').value === 'other' ? 'any' : $('f-bank').value, cardOther: $('f-bank').value === 'other', cardName: $('f-bank').value === 'other' ? UI.sentence($('f-cardname').value) : '' };
          o.address = { name: UI.titleCase($('f-an').value).trim(), line: $('f-aline').value, area: $('f-aarea').value, city: $('f-acity').value, state: $('f-astate').value, pin: $('f-apin').value };
          if (module === 'PAY') o.payUrl = $('f-pay').value;
          return o;
        }

        function quoteNow() {
          var box = $('mkQuote'), v = collect(), sub, input;
          if (module === 'LOUNGE') { sub = v.type; input = {}; }
          else if (module === 'MOVIE') { sub = v.offer; input = { seatCount: v.seatCount, ticketTotal: v.ticketTotal }; }
          else { sub = 'DEFAULT'; input = { listPrice: v.listPrice, expectedPrice: v.expectedPrice }; }
          var cfg = M.fee(module, sub), res = Core.quote(module, cfg, input);
          var head = '<h2 class="h3" style="margin-bottom:10px">Price breakdown</h2>';
          if (res.ok) { box.innerHTML = head + breakdown(module, res.q, 'buyer') + (module !== 'LOUNGE' ? '<p class="muted small" style="margin-top:12px">If the cardholder’s final price differs, the difference is refunded to you or you are asked to top up before payment is released.</p>' : ''); return res; }
          var hint = module === 'LOUNGE' ? '' : 'Fill in the prices to see your breakdown.';
          box.innerHTML = head + (res.error && (module === 'LOUNGE' || (input.listPrice || input.ticketTotal)) ? '<div class="note note--warn">' + esc(res.error) + '</div>' : '<p class="muted small">' + hint + '</p>');
          return res;
        }

        if (module === 'LOUNGE') {
          /* Lounge type first: it decides which airports and terminals are listed. */
          var kindLabel = function (t) { return t === 'DOMESTIC' ? 'Domestic' : 'International'; };
          var drawTerm = function () {
            var abroad = type === 'INTERNATIONAL';
            $('f-terminal').hidden = abroad; $('f-terminalx').hidden = !abroad;
            if (!abroad) $('f-terminal').innerHTML = Core.terminalsFor($('f-airport').value, type).map(function (t) { return '<option>' + t + '</option>'; }).join('');
          };
          var airportOpt = function (a) { return '<option value="' + a.code + '">' + a.code + ' \u00B7 ' + esc(a.name) + '</option>'; };
          var drawAirports = function (keep) {
            var list = Core.airportsFor(type), html = '';
            if (type === 'INTERNATIONAL') { // grouped by country
              var seen = {};
              list.forEach(function (a) { (seen[a.country] = seen[a.country] || []).push(a); });
              html = Object.keys(seen).sort().map(function (c) { return '<optgroup label="' + esc(c) + '">' + seen[c].map(airportOpt).join('') + '</optgroup>'; }).join('');
            } else html = list.map(airportOpt).join('');
            $('f-airport').innerHTML = html;
            if (keep && list.some(function (a) { return a.code === keep; })) $('f-airport').value = keep;
            $('f-airportHint').textContent = type === 'INTERNATIONAL' ? list.length + ' airports outside India, grouped by country.' : list.length + ' airports in India.';
            drawTerm();
          };
          var drawType = function () {
            $('f-type').innerHTML = ['DOMESTIC', 'INTERNATIONAL'].map(function (t) {
              var c = M.fee('LOUNGE', t);
              return '<button type="button" class="chip' + (t === type ? ' is-on' : '') + '" data-t="' + t + '">' + kindLabel(t) + ' \u00B7 ' + money(c ? (Core.quote('LOUNGE', c, {}).q || {}).total : 0) + '</button>';
            }).join('');
            $('f-type').querySelectorAll('[data-t]').forEach(function (b) {
              b.onclick = function () { var keep = $('f-airport').value; type = b.dataset.t; drawType(); drawAirports(keep); quoteNow(); };
            });
          };
          $('f-airport').onchange = function () { drawTerm(); quoteNow(); };
          $('f-terminal').onchange = quoteNow;
          drawType(); drawAirports();
        }
        root.querySelectorAll('#mkForm input, #mkForm select').forEach(function (el) { el.addEventListener('input', quoteNow); el.addEventListener('change', quoteNow); });
        var bsel = $('f-bank'), bnm = $('f-cardname'); if (bsel && bnm) bsel.addEventListener('change', function () { bnm.hidden = bsel.value !== 'other'; });
        var pin = $('f-apin');
        if (pin) pin.addEventListener('input', function () {
          this.value = this.value.replace(/\D/g, '').slice(0, 6);
          var hint = $('f-apinHint'), area = $('f-aarea');
          if (this.value.length < 6) { if (hint) hint.textContent = ''; return; }
          var want = this.value;
          if (hint) hint.textContent = 'Looking up the PIN code…';
          fetch('https://api.postalpincode.in/pincode/' + want).then(function (r) { return r.json(); }).then(function (j) {
            if (pin.value !== want) return;
            var list = j && j[0] && j[0].Status === 'Success' ? j[0].PostOffice || [] : [];
            if (!list.length) { hint.textContent = 'PIN code not found. Enter the city and state yourself.'; return; }
            $('f-acity').value = list[0].District || list[0].Block || '';
            var st = Array.prototype.find.call($('f-astate').options, function (o) { return o.value.toLowerCase() === String(list[0].State || '').toLowerCase(); });
            if (st) $('f-astate').value = st.value;
            area.innerHTML = '<option value="">Choose area</option>' + list.map(function (p) { return '<option>' + esc(p.Name) + '</option>'; }).join('');
            if (list.length === 1) area.value = list[0].Name;
            hint.textContent = 'Found: ' + list[0].District + ', ' + list[0].State + '. Pick your area below.';
            quoteNow();
          }).catch(function () { if (hint) hint.textContent = 'Could not look up the PIN code. Enter the city and state yourself.'; });
        });

        /* money boxes: only digits (and up to 2 decimals), and nothing above the limit can be typed */
        function limitMoney(id, max) {
          var el = $(id); if (!el) return;
          el.addEventListener('keydown', function (e) { if (/^[eE+\-]$/.test(e.key)) e.preventDefault(); });
          el.addEventListener('input', function () {
            var v = this.value.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1');
            if (Number(v) > max) v = String(max);
            if (v !== this.value) this.value = v;
            quoteNow();
          });
        }
        var cap = (module === 'ORDER' || module === 'PAY') ? 200000 : 1000000;
        limitMoney('f-list', cap); limitMoney('f-exp', cap); limitMoney('f-total', cap);
        quoteNow();

        $('mkGo').onclick = function () {
          var err = $('mkErr'); err.style.display = 'none';
          var res = quoteNow();
          function bad(msg) { err.textContent = msg; err.style.display = 'block'; }
          if (!res.ok) return bad(res.error);
          var btn = this; busy(btn, true, 'Checking…');
          M.do('create', { module: module, details: collect() }).then(function (r) {
            busy(btn, false, true);
            if (!r.ok) return bad(r.error);
            var req = M.request(r.request.id) || { id: r.request.id, details: collect(), feeSnapshot: { total: res.q.total } };
            payModal(req);
          });
        };
      }
    };
  };

  /* ---------------- my requests ---------------- */
  function requestList(list, empty, mine) {
    if (!list.length) return empty;
    return '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Request</th><th>Type</th><th>Status</th><th class="num">' + (mine ? 'You pay' : 'You earn') + '</th><th></th></tr></thead><tbody>' +
      list.map(function (r) {
        var amt = mine ? r.feeSnapshot.total : r.feeSnapshot.holderReceives;
        return '<tr><td><strong>' + esc(titleOf(r)) + '</strong><div class="small muted">' + esc(subOf(r)) + '</div></td>' +
          '<td>' + MODS[r.module].short + '</td><td>' + badge(r.status) + '</td><td class="num"><strong>' + money(amt) + '</strong></td>' +
          '<td style="text-align:right"><a class="btn btn--ghost btn--xs" href="#/market/r/' + r.id + '">Open</a></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  w.CC.Pages.marketRequests = function (params, q) {
    if (!Auth.require()) return false;
    var u = Auth.current(), all = M.asBuyer(u.id), f = (q && q.f) || 'all';
    var done = ['SETTLED', 'REFUNDED', 'CANCELLED', 'EXPIRED'];
    var list = all.filter(function (r) { return f === 'all' || (f === 'active' ? done.indexOf(r.status) < 0 : done.indexOf(r.status) > -1); });
    var inner = '<div class="spread section__head"><div><h1 class="h1">My requests</h1><p class="lede">Everything you asked for, with where each one stands.</p></div>' +
      '<a class="btn btn--primary btn--sm" href="#/market">New request</a></div>' +
      '<div class="chip-row" style="margin-bottom:18px">' + [['all', 'All'], ['active', 'In progress'], ['done', 'Finished']].map(function (c) {
        return '<a class="chip' + (f === c[0] ? ' is-on' : '') + '" href="#/market/requests?f=' + c[0] + '">' + c[1] + '</a>'; }).join('') + '</div>' +
      requestList(list, UI.empty('Nothing here yet', 'Start a request and it shows up here.', 'Browse what you can get', '#/market'), true);
    return { title: 'My requests | Share & Earn | Card Crest', html: shell('/market/requests', inner), mount: function (root) { fresh(root); onChange(root, w.CC.Router.refresh); } };
  };

  /* ---------------- Pay & Earn: every Order & Earn request you made, with all its details ---------------- */
  w.CC.Pages.marketPayEarn = function () {
    if (!Auth.require()) return false;
    var u = Auth.current();
    var list = M.asBuyer(u.id).filter(function (r) { return r.module === 'PAY' || r.module === 'ORDER'; });
    function kv(k, v) { return v ? '<div class="deal-line"><span>' + k + '</span><strong>' + v + '</strong></div>' : ''; }
    function openLink(u2) { return '<a href="' + esc(openable(u2)) + '" target="_blank" rel="noopener noreferrer">Open</a> · <a href="#" data-copy-link="' + esc(u2) + '">Copy</a>'; }
    var cards = list.map(function (r) {
      var x = r.details || {}, a = x.address, s = r.feeSnapshot || {};
      return '<div class="panel" style="margin-bottom:16px"><div class="spread" style="gap:12px; flex-wrap:wrap; margin-bottom:10px"><div><span class="badge badge--info">Order &amp; Earn</span> ' + badge(r.status) +
        '<h2 class="h3" style="margin-top:8px">' + esc(titleOf(r)) + '</h2></div><a class="btn btn--ghost btn--sm" href="#/market/r/' + r.id + '">Open request</a></div>' +
        kv('Shopping site', esc(x.platform)) + (x.url ? kv('Product link', openLink(x.url)) : '') + (x.payUrl ? kv('Payment link', openLink(x.payUrl)) : '') +
        kv('Card', esc(UI.sentence(x.cardName) || bankName(x.bank))) + kv('Offer wanted', esc(UI.sentence(x.offerWanted))) +
        kv('Listed price', money(x.listPrice)) + kv('Amount to pay', money(x.expectedPrice)) + kv('You pay Card Crest', '<strong>' + money(s.total) + '</strong>') +
        (a ? kv('Deliver to', esc(UI.titleCase(a.name) + ', ' + (a.state || a.city))) : '') +
        kv('Requested', dt(r.createdAt)) +
        (Number(s.saved) > 0 ? '<div class="deal-get mk-earn"><span>You earn<small>Your discount on this request</small></span><strong>' + money(s.saved) + '</strong></div>' : '') + '</div>';
    }).join('');
    var inner = '<div class="spread section__head"><div><h1 class="h1">Pay &amp; Earn</h1><p class="lede">Your Order &amp; Earn requests with every detail: payment link, shopping site and delivery address.</p></div></div>' +
      (cards || UI.empty('No requests yet', 'Create an Order & Earn request and it shows up here with all its details.', 'Start a request', '#/market/new/pay'));
    return { title: 'Pay & Earn | Share & Earn | Card Crest', html: shell('/market/pay-earn', inner), mount: function (root) {
      fresh(root); onChange(root, w.CC.Router.refresh);
      root.querySelectorAll('[data-copy-link]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.preventDefault(); var t = b.getAttribute('data-copy-link'); try { navigator.clipboard.writeText(t); UI.toast('Link copied'); } catch (err) { UI.toast('Could not copy', 'error'); } });
      });
    } };
  };

  /* ---------------- earn ---------------- */
  w.CC.Pages.marketEarn = function (params, q) {
    if (!Auth.require()) return false;
    var u = Auth.current(), tab = (q && q.t) || 'open';
    var cards = M.cards(u.id), wal = M.wallet(u.id), kyc = M.kyc(u.id);
    var open = M.openFor(u.id).sort(function (a, b) { return (b.eligible ? 1 : 0) - (a.eligible ? 1 : 0); });
    var mine = M.asHolder(u.id);

    var openHtml = !cards.length
      ? UI.empty('Add a card to start earning', 'Tell us which benefits your cards carry (bank and variant only). We then show requests they can fulfil.', 'Add a card', '#/market/cards')
      : open.length ? '<div class="stack">' + open.map(function (o) {
        var r = o.request, s = r.feeSnapshot;
        return '<div class="panel mk-job' + (o.eligible ? '' : ' is-off') + '" data-id="' + r.id + '">' +
          '<div class="spread" style="align-items:flex-start; gap:18px; flex-wrap:wrap"><div style="flex:1; min-width:240px"><span class="badge badge--info">' + MODS[r.module].short + '</span>' +
          '<h3 class="h3" style="margin:8px 0 4px">' + esc(titleOf(r)) + '</h3><div class="small muted">' + esc(subOf(r)) + '</div>' +
          (r.module !== 'LOUNGE' ? '<div class="small muted" style="margin-top:4px">Card: ' + esc(UI.sentence(r.details.cardName) || bankName(r.details.bank)) + '</div>' : '') +
          '<div class="small muted" style="margin-top:4px">Open for ' + left(r.acceptBy) + '</div></div>' +
          '<div style="text-align:right"><div class="muted small">You earn</div><div style="font-size:1.5rem; font-weight:800">' + money(s.holderFee) + '</div>' +
          (s.reimbursement ? '<div class="small muted">plus ' + money(s.reimbursement) + ' reimbursed</div>' : '') + '</div></div>' +
          (o.eligible
            ? '<div class="row row--wrap" style="margin-top:14px; gap:10px"><select data-card style="max-width:280px">' + o.cards.map(function (c) { return '<option value="' + c.id + '">' + esc(bankName(c.bank)) + ' ' + esc(c.variant) + '</option>'; }).join('') + '</select>' +
              '<button class="btn btn--primary btn--sm" data-accept>Accept request</button></div>'
            : '<p class="small muted" style="margin-top:12px">Not for your cards: ' + esc(o.why) + '</p>') + '</div>';
      }).join('') + '</div>' : UI.empty('No open requests right now', 'New ones appear here as buyers pay. Check back soon.');

    var inner = '<div class="section__head"><h1 class="h1">Earn with my card</h1><p class="lede">Pick up requests your cards can fulfil. You pay with your own card, get reimbursed, and earn the service fee.</p></div>' +
      '<div class="mk-live"><span class="mk-live__dot" aria-hidden="true"></span><div class="mk-live__t"><strong>Live alerts are on.</strong> You are told the moment someone needs a service one of your cards can do, with no refresh needed.</div><div class="row row--wrap" style="gap:8px"><button class="btn btn--ghost btn--xs" id="soundBtn"></button><button class="btn btn--soft btn--xs" id="alertBtn" hidden>Get desktop alerts</button><button class="btn btn--soft btn--xs" id="emailBtn" type="button"></button></div></div>' +
      '<div class="grid g-3" style="margin-bottom:24px">' +
      '<div class="stat stat--accent"><span class="stat__k">Wallet available</span><span class="stat__v">' + money(wal.available) + '</span><span class="stat__sub">' + money(wal.pending) + ' on the way</span></div>' +
      '<div class="stat"><span class="stat__k">Trust score</span><span class="stat__v">' + M.trust(u.id) + '</span><span class="stat__sub">Rating ' + (M.rating(u.id).count ? M.rating(u.id).avg.toFixed(1) + ' (' + M.rating(u.id).count + ')' : 'none yet') + '</span></div>' +
      '<div class="stat"><span class="stat__k">KYC</span><span class="stat__v" style="font-size:1.2rem">' + (kyc ? kyc.status.charAt(0) + kyc.status.slice(1).toLowerCase() : 'Not started') + '</span><span class="stat__sub"><a href="#/market/wallet">Needed before your first payout</a></span></div></div>' +
      '<div class="tabs"><button class="' + (tab === 'open' ? 'is-on' : '') + '" data-tab="open">Open requests (' + open.filter(function (o) { return o.eligible; }).length + ')</button>' +
      '<button class="' + (tab === 'jobs' ? 'is-on' : '') + '" data-tab="jobs">My tasks (' + mine.length + ')</button></div>' +
      (tab === 'open' ? openHtml : requestList(mine, UI.empty('No tasks yet', 'Accepted requests show up here.'), false));

    return {
      title: 'Earn with my card | Share & Earn | Card Crest', html: shell('/market/earn', inner),
      mount: function (root) {
        fresh(root); onChange(root, w.CC.Router.refresh);
        /* live alerts: sound switch, desktop alert permission, and a gentle refresh as a safety net */
        var sb = root.querySelector('#soundBtn'), ab = root.querySelector('#alertBtn');
        function drawSound() { sb.textContent = 'Sound: ' + (M.soundOn() ? 'on' : 'off'); }
        function drawAlert() {
          var st = M.alertsState();
          ab.hidden = st === 'granted' || st === 'unsupported';
          ab.textContent = st === 'denied' ? 'Desktop alerts are blocked in this browser' : 'Get desktop alerts';
          ab.disabled = st === 'denied';
        }
        drawSound(); drawAlert();
        sb.onclick = function () { M.setSound(!M.soundOn()); drawSound(); };
        /* email alerts: one switch, sent to the address on the account (for example your Gmail) */
        var eb = root.querySelector('#emailBtn');
        function drawEmail() {
          var on = M.emailAlerts(u.id);
          eb.textContent = on ? 'Email alerts: on' : 'Email me alerts';
          eb.className = 'btn btn--xs ' + (on ? 'btn--primary' : 'btn--soft');
          eb.title = 'New requests you can fulfil, and your payment confirmations, are sent to ' + u.email;
        }
        if (eb) {
          drawEmail();
          eb.onclick = function () {
            var on = !M.emailAlerts(u.id); eb.disabled = true;
            M.do('setEmailAlerts', { on: on }).then(function (r) {
              eb.disabled = false;
              if (!r.ok) return UI.toast(r.error, 'error');
              UI.toast(on ? 'We will email ' + u.email + ' about new requests and your payments' : 'Email alerts are off');
              drawEmail();
            });
          };
        }
        ab.onclick = function () { M.askAlerts().then(drawAlert); };
        if (M.mode() === 'supabase') {
          var alive = stamp(), tick = setInterval(function () {
            if (!alive()) return clearInterval(tick);
            var before = dataSig();
            M.load().then(function () { if (alive() && dataSig() !== before) w.CC.Router.refresh(); });
          }, 20000);
        }
        root.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { w.CC.Router.go('#/market/earn?t=' + b.dataset.tab); }; });
        root.querySelectorAll('.mk-job [data-accept]').forEach(function (b) {
          b.onclick = function () {
            var card = b.closest('.mk-job'), id = card.dataset.id; busy(b, true, 'Accepting…');
            M.do('accept', { id: id, cardId: card.querySelector('[data-card]').value }).then(function (r) {
              if (!r.ok) { busy(b, false, true); UI.toast(r.error, 'error'); w.CC.Router.refresh(); return; }
              UI.toast('It’s yours. Upload proof once you have done it.'); w.CC.Router.go('#/market/r/' + id);
            });
          };
        });
      }
    };
  };

  /* ---------------- my benefit cards ---------------- */
  function benefitSummary(c) {
    var u = Auth.current(), qtr = Core.quarterOf(new Date(M.now()).toISOString());
    return (c.benefits || []).map(function (b) {
      var label = Core.BENEFITS[b.kind].label, extra = '';
      if (Core.BENEFITS[b.kind].quota) {
        var used = M.quotaUsed(c.id, b.kind, qtr);
        extra = ' · ' + used + ' of ' + b.quota + ' used this quarter (' + esc(b.program) + ')';
      } else if (b.note) extra = ' · ' + esc(b.note);
      return '<li>' + label + '<span class="muted small">' + extra + '</span></li>';
    }).join('');
  }

  function cardEditor(card) {
    var has = {}; (card && card.benefits || []).forEach(function (b) { has[b.kind] = b; });
    function ben(kind) {
      var b = has[kind], meta = Core.BENEFITS[kind];
      return '<div class="mk-ben" data-kind="' + kind + '"><label class="check"><input type="checkbox" data-on' + (b ? ' checked' : '') + '> <strong>' + meta.label + '</strong></label>' +
        '<div class="mk-ben__more"' + (b ? '' : ' hidden') + '>' +
        (meta.quota
          ? '<div class="form-grid">' + field('q-' + kind, 'Visits per quarter', '<input data-quota type="number" min="1" max="99" value="' + (b && b.quota || 4) + '">') +
            field('p-' + kind, 'Access program', '<select data-program>' + Core.PROGRAMS.map(function (p) { return '<option' + (b && b.program === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select>') + '</div>' +
            field('a-' + kind, (kind === 'LOUNGE_INTL' ? 'Valid airports (outside India)' : 'Valid airports (India)'), '<select data-airports multiple size="6">' + '<option value="ANY"' + (!b || !b.airports || b.airports.indexOf('ANY') > -1 ? ' selected' : '') + '>Any airport</option>' +
              (kind === 'LOUNGE_INTL' ? Core.INTL_AIRPORTS : Core.AIRPORTS).map(function (a) { return '<option value="' + a.code + '"' + (b && b.airports && b.airports.indexOf(a.code) > -1 ? ' selected' : '') + '>' + a.code + ' · ' + esc(a.name) + '</option>'; }).join('') + '</select>', 'Hold Ctrl or Cmd to pick several.')
          : field('n-' + kind, 'Note (optional)', '<input data-note maxlength="120" value="' + esc(b && b.note || '') + '" placeholder="' + (kind === 'SHOPPING' ? 'e.g. 10% off on Amazon, max ₹1,500' : 'e.g. Tuesdays only') + '">')) +
        '</div></div>';
    }
    UI.modal({
      title: card ? 'Edit card' : 'Add a card', wide: true,
      body: '<div class="note" style="margin-bottom:14px">Enter the bank and variant only. Never share your card number, CVV, PIN or OTP with anyone, including us.</div>' +
        '<div class="form-grid">' + field('c-bank', 'Bank', '<select id="c-bank">' + C.banks().map(function (b) { return '<option value="' + b.id + '"' + (card && card.bank === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select>') +
        field('c-var', 'Card variant', '<input id="c-var" list="c-vars" value="' + esc(card ? card.variant : '') + '" placeholder="Regalia, Millennia…"><datalist id="c-vars"></datalist>') + '</div>' +
        field('c-net', 'Network', '<select id="c-net">' + ['', 'Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners'].map(function (n) { return '<option' + (card && card.network === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>') +
        '<h3 class="h3" style="margin:8px 0 10px">Benefits this card offers</h3>' + Object.keys(Core.BENEFITS).map(ben).join('') +
        '<p class="err" id="c-err" style="color:var(--danger); font-size:.86rem; display:none"></p>',
      foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-save>' + (card ? 'Save changes' : 'Add card') + '</button>',
      onMount: function (m) {
        function vars() {
          var b = m.querySelector('#c-bank').value;
          var list = (w.CC.Store.get('cards') || []).filter(function (c) { return c.bank === b; });
          m.querySelector('#c-vars').innerHTML = list.map(function (c) { return '<option value="' + esc(c.name) + '">'; }).join('');
        }
        m.querySelector('#c-bank').onchange = vars; vars();
        m.querySelectorAll('[data-on]').forEach(function (cb) {
          cb.onchange = function () { cb.closest('.mk-ben').querySelector('.mk-ben__more').hidden = !cb.checked; };
        });
        m.querySelector('[data-save]').onclick = function () {
          var benefits = [];
          m.querySelectorAll('.mk-ben').forEach(function (el) {
            if (!el.querySelector('[data-on]').checked) return;
            var b = { kind: el.dataset.kind };
            var q = el.querySelector('[data-quota]'); if (q) { b.quota = Number(q.value); b.program = el.querySelector('[data-program]').value;
              b.airports = [].slice.call(el.querySelector('[data-airports]').selectedOptions).map(function (o) { return o.value; }); }
            var n = el.querySelector('[data-note]'); if (n) b.note = n.value;
            benefits.push(b);
          });
          var btn = this; busy(btn, true);
          M.do('saveCard', { id: card && card.id, bank: m.querySelector('#c-bank').value, variant: m.querySelector('#c-var').value, network: m.querySelector('#c-net').value, benefits: benefits }).then(function (r) {
            busy(btn, false);
            if (!r.ok) { var e = m.querySelector('#c-err'); e.textContent = r.error; e.style.display = 'block'; return; }
            UI.closeModal();
            var waiting = card ? 0 : M.openFor(Auth.current().id).filter(function (o) { return o.eligible; }).length;
            UI.toast(card ? 'Card updated' : waiting ? 'Card added. ' + waiting + (waiting === 1 ? ' request is' : ' requests are') + ' waiting for it' : 'Card added');
            if (waiting) w.CC.Router.go('#/market/earn'); else w.CC.Router.refresh();
          });
        };
      }
    });
  }

  w.CC.Pages.marketCards = function () {
    if (!Auth.require()) return false;
    var u = Auth.current(), cards = M.cards(u.id);
    var inner = '<div class="spread section__head"><div><h1 class="h1">My benefit cards</h1><p class="lede">The cards you can fulfil requests with. Bank and variant only, never the number.</p></div>' +
      '<button class="btn btn--primary btn--sm" id="addCard">Add a card</button></div>' +
      (cards.length ? '<div class="stack">' + cards.map(function (c) {
        return '<div class="panel" data-id="' + c.id + '"><div class="spread" style="gap:14px; flex-wrap:wrap"><div><h3 class="h3">' + esc(bankName(c.bank)) + ' ' + esc(c.variant) + '</h3>' +
          '<div class="small muted">' + esc(c.network || 'Network not set') + '</div></div><div class="row"><button class="btn btn--ghost btn--xs" data-edit>Edit</button><button class="btn btn--danger btn--xs" data-del>Remove</button></div></div>' +
          '<ul class="mk-ben-list">' + benefitSummary(c) + '</ul></div>';
      }).join('') + '</div>' : UI.empty('No cards added', 'Add a card and the benefits it carries. Lounge visits are tracked per quarter, domestic and international separately.'));
    /* cards saved from the catalog (Credit cards > Save card) live here too, so there is one place for your cards */
    var savedList = C.saved(u.id).map(function (sv) { return { sv: sv, card: C.byId(sv.cardId) }; }).filter(function (x) { return x.card; });
    var savedHtml = '<div class="section__head" style="margin-top:34px"><div><h2 class="h2">Saved from the catalog</h2>' +
      '<p class="lede">Cards you saved while browsing, up to ' + C.MAX_SAVED + '. <a href="#/cards">Browse credit cards</a></p></div></div>' +
      (savedList.length ? '<div class="stack">' + savedList.map(function (x) {
        var b = C.bank(x.card.bank);
        return '<div class="panel" data-saved="' + x.card.id + '"><div class="spread" style="gap:14px; flex-wrap:wrap"><div><h3 class="h3"><a href="#/cards/' + x.card.id + '">' + esc(x.card.name) + '</a></h3>' +
          '<div class="small muted">' + esc(b ? b.name : '') + (x.sv.primary ? ' &middot; primary' : '') + '</div></div>' +
          '<div class="row"><a class="btn btn--ghost btn--xs" href="#/cards/' + x.card.id + '">Benefits</a><button class="btn btn--danger btn--xs" data-unsave>Remove</button></div></div></div>';
      }).join('') + '</div>' : '<p class="muted">Nothing saved yet. Use "Save card" on any card page.</p>');
    inner += savedHtml;
    return { title: 'My benefit cards | Share & Earn | Card Crest', html: shell('/market/cards', inner),
      mount: function (root) {
        fresh(root);
        root.querySelector('#addCard').onclick = function () { cardEditor(null); };
        root.querySelectorAll('[data-saved]').forEach(function (el) {
          el.querySelector('[data-unsave]').onclick = function () {
            C.unsave(u.id, el.dataset.saved); UI.toast('Removed from your saved cards'); w.CC.Router.refresh();
          };
        });
        root.querySelectorAll('[data-id]').forEach(function (el) {
          el.querySelector('[data-edit]').onclick = function () { cardEditor(M.card(el.dataset.id)); };
          el.querySelector('[data-del]').onclick = function () {
            UI.confirm('Remove this card?', 'Open requests using it must be finished first.', 'Remove', function () {
              M.do('removeCard', { id: el.dataset.id }).then(function (r) { if (!r.ok) UI.toast(r.error, 'error'); else { UI.toast('Card removed'); w.CC.Router.refresh(); } });
            }, true);
          };
        });
      } };
  };

  /* ---------------- wallet and payouts ---------------- */
  w.CC.Pages.marketWallet = function () {
    if (!Auth.require()) return false;
    var u = Auth.current(), wal = M.wallet(u.id), kyc = M.kyc(u.id), pays = M.payouts(u.id);
    var lines = M.ledgerAll().filter(function (e) { return e.account === 'holder:' + u.id; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); }).slice(0, 15);
    var kycHtml = !kyc || kyc.status === 'REJECTED'
      ? (kyc ? '<div class="note note--warn" style="margin-bottom:12px">Needs changes: ' + esc(kyc.reviewNote || 'please re-submit') + '</div>' : '') +
        '<div class="form-grid">' + field('k-name', 'Name as on PAN', '<input id="k-name" data-name autocomplete="name" value="' + esc(kyc ? kyc.legalName : u.name) + '">') +
        field('k-pan', 'PAN', '<input id="k-pan" maxlength="10" style="text-transform:uppercase" placeholder="ABCDE1234F">') + '</div>' +
        '<div class="form-grid">' + field('k-upi', 'UPI ID for payouts', '<input id="k-upi" placeholder="name@bank">', 'Or fill the bank details below.') + '<div></div></div>' +
        '<div class="form-grid">' + field('k-acct', 'Bank account number', '<input id="k-acct" inputmode="numeric">') + field('k-ifsc', 'IFSC', '<input id="k-ifsc" maxlength="11" style="text-transform:uppercase">') + '</div>' +
        '<p class="err" id="k-err" style="color:var(--danger); font-size:.86rem; display:none"></p><button class="btn btn--primary" id="k-go">Submit for review</button>'
      : '<div class="spread"><div><strong>' + esc(kyc.legalName) + '</strong><div class="small muted">PAN ••••••' + esc(kyc.pan.slice(-4)) + ' · ' + (kyc.upi ? esc(kyc.upi) : 'Bank a/c ••••' + esc((kyc.account || '').slice(-4))) + '</div></div>' +
        '<span class="badge badge--' + (kyc.status === 'APPROVED' ? 'ok' : 'warn') + '">' + (kyc.status === 'APPROVED' ? 'Approved' : 'In review') + '</span></div>';

    var inner = '<div class="section__head"><h1 class="h1">Wallet and payouts</h1><p class="lede">Your earnings from completed requests. Payouts need approved KYC.</p></div>' +
      '<div class="grid g-3" style="margin-bottom:24px">' +
      '<div class="stat stat--accent"><span class="stat__k">Available</span><span class="stat__v">' + money(wal.available) + '</span><span class="stat__sub">' + (wal.asked ? money(wal.asked) + ' payout in process' : 'Minimum payout ₹100') + '</span></div>' +
      '<div class="stat"><span class="stat__k">On the way</span><span class="stat__v">' + money(wal.pending) + '</span><span class="stat__sub">From requests in progress</span></div>' +
      '<div class="stat"><span class="stat__k">Earned to date</span><span class="stat__v">' + money(wal.earned) + '</span><span class="stat__sub">Reimbursements and fees</span></div></div>' +
      '<div class="grid g-2" style="margin-bottom:24px">' +
      '<div class="panel"><h2 class="h3" style="margin-bottom:12px">KYC</h2>' + kycHtml + '</div>' +
      '<div class="panel"><h2 class="h3" style="margin-bottom:12px">Request a payout</h2>' +
      (kyc && kyc.status === 'APPROVED'
        ? field('p-amt', 'Amount (₹)', '<input id="p-amt" type="number" min="100" inputmode="decimal" value="' + Math.floor(Math.max(0, wal.available)) + '">', 'Sent to ' + esc(kyc.upi || 'your bank account') + '. Test mode, no real money moves.') +
          '<p class="err" id="p-err" style="color:var(--danger); font-size:.86rem; display:none"></p><button class="btn btn--primary" id="p-go"' + (wal.available < 100 ? ' disabled' : '') + '>Request payout</button>'
        : '<p class="muted">Complete KYC and wait for approval before your first payout.</p>') + '</div></div>' +
      '<h2 class="h3" style="margin-bottom:10px">Payouts</h2>' +
      (pays.length ? '<div class="panel panel--flush" style="margin-bottom:24px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>To</th><th>Status</th><th class="num">Amount</th></tr></thead><tbody>' +
        pays.map(function (p) { return '<tr><td>' + dt(p.createdAt) + '</td><td>' + esc(p.destination) + '</td><td><span class="badge badge--' + (p.status === 'PAID' ? 'ok' : p.status === 'REJECTED' ? 'danger' : 'warn') + '">' + p.status.charAt(0) + p.status.slice(1).toLowerCase() + '</span></td><td class="num">' + money(p.amount) + '</td></tr>'; }).join('') + '</tbody></table></div></div>'
        : '<p class="muted" style="margin-bottom:24px">No payouts yet.</p>') +
      '<h2 class="h3" style="margin-bottom:10px">Wallet activity</h2>' +
      (lines.length ? '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>What</th><th class="num">Amount</th></tr></thead><tbody>' +
        lines.map(function (e) {
          var kind = { REIMBURSEMENT: 'Reimbursement', CARDHOLDER_EARNING: 'Earning', PENALTY: 'Penalty', PAYOUT: 'Payout' }[e.kind] || e.kind;
          var amt = e.credit - e.debit;
          return '<tr><td>' + dt(e.at) + '</td><td>' + kind + (e.note ? '<div class="small muted">' + esc(e.note) + '</div>' : '') + '</td><td class="num" style="color:' + (amt < 0 ? 'var(--danger)' : 'inherit') + '"><strong>' + (amt < 0 ? '−' : '+') + money(Math.abs(amt)) + '</strong></td></tr>';
        }).join('') + '</tbody></table></div></div>' : '<p class="muted">Earnings appear here when your requests complete.</p>');

    return { title: 'Wallet and payouts | Share & Earn | Card Crest', html: shell('/market/wallet', inner),
      mount: function (root) {
        fresh(root); onChange(root, w.CC.Router.refresh);
        var kg = root.querySelector('#k-go');
        if (kg) kg.onclick = function () {
          var err = root.querySelector('#k-err'); err.style.display = 'none'; busy(kg, true);
          M.do('submitKyc', { legalName: UI.titleCase(root.querySelector('#k-name').value).trim(), pan: root.querySelector('#k-pan').value, upi: root.querySelector('#k-upi').value,
            account: root.querySelector('#k-acct').value, ifsc: root.querySelector('#k-ifsc').value }).then(function (r) {
            busy(kg, false);
            if (!r.ok) { err.textContent = r.error; err.style.display = 'block'; return; }
            UI.toast('KYC submitted. We will review it shortly.'); w.CC.Router.refresh();
          });
        };
        var pg = root.querySelector('#p-go');
        if (pg) pg.onclick = function () {
          var err = root.querySelector('#p-err'); err.style.display = 'none'; busy(pg, true);
          M.do('requestPayout', { amount: root.querySelector('#p-amt').value }).then(function (r) {
            busy(pg, false);
            if (!r.ok) { err.textContent = r.error; err.style.display = 'block'; return; }
            UI.toast('Payout requested'); w.CC.Router.refresh();
          });
        };
      } };
  };

  /* ---------------- request detail ---------------- */
  var DISPUTE_REASONS = [['WRONG_PROOF', 'The proof does not match my request'], ['FAKE_PROOF', 'The proof looks fake'], ['NOT_DELIVERED', 'Not delivered'],
    ['WRONG_AMOUNT', 'Wrong amount charged'], ['OTHER', 'Something else']];

  function testProofImage() {
    var c = d.createElement('canvas'); c.width = 600; c.height = 380;
    var g = c.getContext('2d'); g.fillStyle = '#e4f0e9'; g.fillRect(0, 0, 600, 380);
    g.fillStyle = '#0e5c3c'; g.font = 'bold 34px sans-serif'; g.fillText('TEST PROOF', 40, 120);
    g.font = '20px sans-serif'; g.fillText('Generated by the test helper', 40, 170); g.fillText(new Date().toLocaleString('en-IN'), 40, 205);
    return c.toDataURL('image/jpeg', 0.8);
  }

  function actionBox(r, u, root) {
    var isBuyer = r.buyerId === u.id, isHolder = r.cardholderId === u.id, s = r.feeSnapshot, h = '', xd = r.details || {};
    if (isBuyer) {
      if (r.status === 'CREATED') h = '<p class="muted">Pay into escrow so cardholders can see your request.</p><button class="btn btn--primary btn--block" data-act="pay">Pay ' + money(s.total) + ' (test)</button><button class="btn btn--ghost btn--block" style="margin-top:8px" data-act="cancel">Cancel request</button>';
      else if (r.status === 'PAID') h = '<p class="muted">Waiting for a cardholder. Open for <strong>' + left(r.acceptBy) + '</strong>. If nobody accepts, you are refunded automatically.</p><button class="btn btn--ghost btn--block" data-act="cancel">Cancel and refund</button>';
      else if (r.status === 'ACCEPTED') h = '<p class="muted">The cardholder is on it and has until <strong>' + dt(r.fulfilBy) + '</strong> to upload proof. If they miss it you are refunded.</p><button class="btn btn--ghost btn--block" data-act="dispute">Raise a dispute</button>';
      else if (r.status === 'FULFILLED') {
        if (r.topupDue > 0) h += '<div class="note note--warn" style="margin-bottom:12px">The cardholder paid <strong>' + money(r.topupDue) + '</strong> more than estimated. Top up to release funds, or raise a dispute.</div><button class="btn btn--primary btn--block" data-act="topup">Top up ' + money(r.topupDue) + '</button>';
        else h += '<p class="muted">Check the proof. Confirm to release payment' + (r.module === 'MOVIE' ? ' (money is released after the show)' : '') + '. If you do nothing, it confirms automatically at <strong>' + dt(r.autoConfirmAt) + '</strong>.</p><button class="btn btn--primary btn--block" data-act="confirm">' + (r.module === 'LOUNGE' ? 'I got in. Confirm' : 'Everything is fine. Confirm') + '</button>';
        if (r.module === 'LOUNGE') h += '<button class="btn btn--danger btn--block" style="margin-top:8px" data-act="denied">Entry was denied</button>';
        h += '<button class="btn btn--ghost btn--block" style="margin-top:8px" data-act="dispute">Raise a dispute</button>';
      }
      else if (r.status === 'CONFIRMED') h = '<p class="muted">Confirmed. Payment is released to the cardholder at <strong>' + dt(r.settleAt) + '</strong>, after the show.</p>';
      else if (r.status === 'DISPUTED') h = '<p class="muted">Support is reviewing this. We will decide a refund, a release or a split once the proofs are checked.</p>';
    }
    if (isHolder) {
      if (r.status === 'ACCEPTED') {
        h = '<p class="muted" style="margin-bottom:12px">' + (r.module === 'ORDER' ? 'Place the whole order on the site with your own card offer and have it delivered to the buyer&rsquo;s address, then upload proof by ' : r.module === 'PAY' ? 'Open the payment page the buyer shared, check the amount matches the offer price, and pay it with your own card. Do not pay if the amount is different. Upload the payment confirmation by ' : 'Do it with your own card, then upload proof by ') + '<strong>' + dt(r.fulfilBy) + '</strong>.</p>' +
          field('u-files', 'Proof images', '<input id="u-files" type="file" accept="image/png,image/jpeg,image/webp" multiple>', r.module === 'LOUNGE' ? 'Pass or booking screenshot.' : r.module === 'MOVIE' ? 'Tickets and booking confirmation.' : r.module === 'ORDER' ? 'Order confirmation and invoice.' : 'Payment confirmation.') +
          field('u-ref', r.module === 'LOUNGE' ? 'Pass or booking reference' : r.module === 'MOVIE' ? 'Booking ID' : 'Order or payment ID', '<input id="u-ref" autocomplete="off">') +
          (r.module !== 'LOUNGE' ? field('u-act', 'Amount you actually paid (₹)', '<input id="u-act" type="number" min="1" inputmode="decimal" value="' + s.reimbursement + '">', 'Estimated ' + money(s.reimbursement) + '. A lower price is refunded to the buyer, a higher one needs their top-up.') : '') +
          '<p class="err" id="u-err" style="color:var(--danger); font-size:.86rem; display:none"></p>' +
          '<button class="btn btn--primary btn--block" data-act="fulfil">Upload proof</button><button class="btn btn--ghost btn--block" style="margin-top:8px" data-act="release">Step back from this request</button>';
        if (r.module === 'PAY' && xd.payUrl) h = '<div class="note" style="margin-bottom:14px"><strong>Final payment page</strong><div class="small" style="margin:6px 0 10px">Pay exactly <strong>' + money(s.reimbursement) + '</strong> here with your own card. The link was added automatically when you accepted.</div>' +
          '<a class="btn btn--primary btn--block" href="' + esc(openable(xd.payUrl)) + '" target="_blank" rel="noopener noreferrer">Open the final payment page</a>' +
          '<button type="button" class="btn btn--ghost btn--block" style="margin-top:8px" data-copy-pay="' + esc(xd.payUrl) + '">Copy link</button></div>' + h;
      } else if (r.status === 'FULFILLED') h = '<p class="muted">Proof sent. Waiting for the buyer to confirm' + (r.topupDue > 0 ? ' (they need to top up ' + money(r.topupDue) + ' first)' : '') + '. It confirms by itself at <strong>' + dt(r.autoConfirmAt) + '</strong>.</p>';
      else if (r.status === 'CONFIRMED') h = '<p class="muted">Confirmed. Your payment is released at <strong>' + dt(r.settleAt) + '</strong>.</p>';
      else if (r.status === 'DISPUTED') h = '<p class="muted">The buyer raised a dispute. Reply in the chat and support will decide.</p>';
    }
    if (r.status === 'SETTLED' && (isBuyer || isHolder)) {
      var mineR = M.ratings(r.id).filter(function (x) { return x.raterId === u.id; })[0];
      h = (isHolder ? '<p><strong>You earned ' + money(Core.settleLegs(s, r.actual).reimbursement + s.holderFee) + '</strong> (' + money(Core.settleLegs(s, r.actual).reimbursement) + ' reimbursement + ' + money(s.holderFee) + ' earning).</p>' : '<p><strong>All done.</strong></p>') +
        (mineR ? '<p class="muted">You rated this ' + mineR.stars + ' of 5. Thank you.</p>' :
          '<p class="muted" style="margin:10px 0 6px">How did it go with ' + esc(M.nameOf(isBuyer ? r.cardholderId : r.buyerId)) + '?</p><div class="row" id="stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button class="btn btn--ghost btn--xs" data-star="' + n + '">' + n + ' ★</button>'; }).join('') + '</div>');
    }
    if (r.status === 'REFUNDED' || r.status === 'EXPIRED' || r.status === 'CANCELLED') h = '<p><strong>' + (r.status === 'EXPIRED' ? 'Expired. ' : '') + 'Refunded in full.</strong></p><p class="muted">' + esc(r.closedReason || '') + '</p>';
    return h || '<p class="muted">Nothing for you to do right now.</p>';
  }

  function localHelper(r) {
    if (M.mode() !== 'local') return '';
    var btns = '';
    if (r.status === 'PAID') btns += '<button class="btn btn--soft btn--xs" data-help="accept">Test cardholder accepts</button>';
    if (r.status === 'ACCEPTED' && r.cardholderId === M.DEMO_HOLDER) btns += '<button class="btn btn--soft btn--xs" data-help="proof">Test cardholder uploads proof</button><button class="btn btn--soft btn--xs" data-help="proof-low">… and paid ₹50 less</button><button class="btn btn--soft btn--xs" data-help="proof-high">… and paid ₹60 more</button>';
    btns += '<button class="btn btn--ghost btn--xs" data-help="t1">+1 hour</button><button class="btn btn--ghost btn--xs" data-help="t24">+1 day</button><button class="btn btn--ghost btn--xs" data-help="t72">+3 days</button><button class="btn btn--ghost btn--xs" data-help="t0">Reset clock</button>';
    return '<div class="panel mk-helper"><strong>Test helper</strong><p class="muted small" style="margin:4px 0 10px">Runs only on your own browser. It plays the other side so you can try every step alone.</p><div class="row row--wrap" style="gap:8px">' + btns + '</div></div>';
  }

  /* ---------------- Deal Timeline (cardholder, Order & Earn / Pay & Earn) ---------------- */
  var DEAL_FAQ = [
    ['What is Order & Earn? How is it different from Pay & Earn?', 'In Order & Earn you place the whole order on the shopping site with your card offer and it is delivered to the buyer. In Pay & Earn you only complete a payment on a page the buyer shares.'],
    ['Do I pay from my own money?', 'Yes, you pay on the shop with your own card. The buyer’s payment to Card Crest covers it: you get the amount back plus your earning when the deal completes.'],
    ['When exactly do I get my money back?', 'After you send proof and the buyer confirms (or it confirms by itself), your reimbursement and earning are released to your wallet.'],
    ['What if I accept a deal and change my mind?', 'Use Exit deal before you place the order. The request goes back to other cardholders. Stepping back can lower your trust score a little.'],
    ['How long do I have?', 'The countdown at the top shows the time left to place the order and send proof.']
  ];
  /* payment links can be pasted in any form: add https:// when no scheme was typed, never open other schemes */
  function openable(u) {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    return /^[a-z][a-z0-9+.-]*:/i.test(u) ? '#' : 'https://' + u;
  }
  function copyRow(label, value) {
    if (value === undefined || value === null || value === '') return '';
    return '<div class="deal-copy"><div><span class="deal-copy__k">' + esc(label) + '</span><span class="deal-copy__v">' + esc(value) + '</span></div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-copy="' + esc(value) + '" data-label="' + esc(label) + '">Copy</button></div>';
  }
  function dealPanel(r, x, s) {
    var pay = r.module === 'PAY', site = x.platform || 'the shop', st = r.status;
    var order = ['ACCEPTED', 'FULFILLED', 'CONFIRMED', 'SETTLED'].indexOf(st);
    var card = r.cardId ? M.card(r.cardId) : null;
    var confirmH = Number(s.confirmHours || 24);
    var steps = [
      ['Deal accepted', 'You took this request. The buyer’s money is held safely.', order >= 0],
      ['Card selected', card ? bankName(card.bank) + ' ' + (card.variant || '') : 'Your card', order >= 0],
      [pay ? 'Pay on the payment page' : 'Place the order on ' + site, '', order >= 1],
      [pay ? 'Enter payment details' : 'Enter order details', '', order >= 1],
      ['Buyer confirms', st === 'FULFILLED' ? 'Proof sent. The buyer is checking it. It confirms by itself if they do not respond.' : '', order >= 2],
      ['Payment unlocked', 'About ' + (confirmH >= 48 ? Math.round(confirmH / 24) + ' days' : confirmH + ' hours') + ' after confirmation', st === 'SETTLED']
    ];
    var cur = -1; steps.forEach(function (p, i) { if (!p[2] && cur < 0) cur = i; });
    var tl = '<ul class="deal-tl">' + steps.map(function (p, i) {
      var body = '';
      if (i === 2 && st === 'ACCEPTED') {
        var link = pay ? x.payUrl : x.url;
        body = '<p class="muted small">' + (pay ? 'Open the payment page and pay exactly ' + money(s.reimbursement) + ' with your own card.' : 'Open ' + esc(site) + ' in a window next to this page. Use your card offer and the address below.') + '</p>' +
          (link ? '<button type="button" class="btn btn--primary btn--sm" data-open-store="' + esc(pay ? openable(link) : link) + '">' + (pay ? 'Open payment page' : 'Open ' + esc(site)) + ' in a window</button>' : '');
      } else if (i === 3 && st === 'ACCEPTED') {
        body = '<p class="muted small">When you have ' + (pay ? 'paid' : 'placed the order') + ', add the ' + (pay ? 'payment' : 'order') + ' ID, the amount and a screenshot in <a href="#actions" data-jump>What next</a>.</p>';
      }
      var state = p[2] ? 'is-done' : (i === cur ? 'is-now' : '');
      return '<li class="deal-tl__i ' + state + '"><div class="deal-tl__t">' + esc(p[0]) + '</div>' + (p[1] ? '<div class="deal-tl__d">' + esc(p[1]) + '</div>' : '') + body + '</li>';
    }).join('') + '</ul>';

    var a = x.address;
    var addr = a ? '<div class="panel"><h2 class="h3" style="margin-bottom:10px">Delivery address</h2>' +
      copyRow('Name', a.name) + copyRow('Address', a.line) + copyRow('Area', a.area) + copyRow('City', a.city) + copyRow('State', a.state) + copyRow('Pincode', a.pin) +
      copyRow('Full address', a.name + ', ' + a.line + (a.area ? ', ' + a.area : '') + ', ' + a.city + (a.state ? ', ' + a.state : '') + ' ' + a.pin) + '</div>' : '';
    var instr = ['Accept only if you can finish within the time shown above.',
      pay ? 'Pay only on the payment page the buyer shared, and only the amount shown below. The delivery address is below, with Copy buttons.' : 'You will place the order on ' + esc(site) + '. The delivery address is below, with Copy buttons.',
      'Pay with your own card only. Never share your card number, CVV or OTP with anyone, including the buyer.',
      'Pay the full amount due on your card as usual, so the offer is not reversed.',
      'The ' + (pay ? 'payment' : 'order') + ' ID you enter must match what you actually placed. A mismatch can lead to cancellation' + (s.penalty ? ' and a penalty of ' + money(s.penalty) : '') + '.',
      'If something looks wrong, message the buyer in the chat on this page, or contact support.'];
    return '<div class="deal">' +
      '<div class="panel"><div class="spread" style="gap:12px; flex-wrap:wrap; margin-bottom:14px"><h2 class="h3">Deal Timeline</h2>' +
      (st === 'ACCEPTED' && r.fulfilBy ? '<div class="deal-timer"><span class="deal-timer__t" data-deadline="' + esc(r.fulfilBy) + '">--:--</span><span class="deal-timer__l">' + (pay ? 'To pay' : 'To enter order details') + '</span></div>' : '') + '</div>' + tl + '</div>' +
      addr +
      '<div class="panel"><h2 class="h3" style="margin-bottom:10px">Instructions</h2><ul class="deal-bullets">' + instr.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>' +
      '<div class="panel"><h2 class="h3" style="margin-bottom:10px">Payment details</h2>' +
        '<div class="deal-line"><span>' + (pay ? 'Amount to pay' : 'Price to pay') + '</span><strong class="deal-big">' + money(s.reimbursement) + '</strong></div>' +
        '<div class="deal-get"><span>Amount you get</span><strong>' + money(Number(s.reimbursement) + Number(s.holderFee)) + '</strong></div>' +
        row('Reimbursement', money(s.reimbursement)) + row('Your earning', money(s.holderFee), true) + '</div>' +
      '<div class="panel"><div class="spread" style="margin-bottom:10px"><h2 class="h3">Offer details</h2><span class="deal-tag">Apply before paying</span></div>' +
        '<div class="deal-line"><span>' + esc(UI.sentence(x.offerWanted) || '') + '</span><strong class="deal-off">' + money(s.discount) + ' off</strong></div>' +
        '<div class="deal-chip">' + esc(UI.sentence(x.cardName) || bankName(x.bank)) + '</div></div>' +
      '<div class="panel"><h2 class="h3" style="margin-bottom:6px">Help &amp; FAQs</h2>' + DEAL_FAQ.map(function (f) {
        return '<details class="deal-faq"><summary>' + esc(f[0]) + '</summary><p class="muted">' + esc(f[1]) + '</p></details>'; }).join('') + '</div>' +
      (st === 'ACCEPTED' ? '<button type="button" class="deal-exit" data-exit-deal>Exit deal</button>' : '') + '</div>';
  }

  w.CC.Pages.marketRequest = function (params) {
    if (!Auth.require()) return false;
    var u = Auth.current(), r = M.request(params.id);
    var admin = u.role === 'admin';
    if (!r || !(r.buyerId === u.id || r.cardholderId === u.id || admin)) {
      return { title: 'Request | Card Crest', html: '<div class="wrap section">' + UI.empty('Request not found', 'It may belong to another account, or it was removed.', 'Back to Share & Earn', '#/market') + '</div>',
        mount: function (root) { fresh(root); } };
    }
    var isBuyer = r.buyerId === u.id, isHolder = r.cardholderId === u.id, x = r.details || {}, s = r.feeSnapshot;

    var detailRows = '';
    if (r.module === 'LOUNGE') detailRows = row('Airport', esc(x.airport + ' ' + x.terminal)) + row('Lounge', esc(x.type === 'INTERNATIONAL' ? 'International' : 'Domestic')) + row('Flight', esc(x.flight)) + row('When', dt(x.dateTime)) + (x.guestName ? row('Guest name', esc(UI.titleCase(x.guestName))) : '');
    else if (r.module === 'MOVIE') detailRows = row('Movie', esc(x.movie)) + row('Theatre', esc(x.theatre + (x.city ? ', ' + x.city : ''))) + row('Showtime', dt(x.showTime)) + row('Seats', esc(x.seats + ' (' + x.seatCount + ')')) + row('Offer', x.offer === 'BOGO' ? 'Buy one get one' : '₹500 off on 2 seats') + row('Card', esc(bankName(x.bank))) + row('Booking site', esc(x.platform));
    else detailRows = row('Site', esc(x.platform)) + (x.url ? row('Product', '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">Open link</a>') : '') + row('Offer wanted', esc(UI.sentence(x.offerWanted))) + row('Card', esc(bankName(x.bank))) +
      (x.address && (isBuyer || isHolder || admin) ? row('Deliver to', esc(UI.titleCase(x.address.name) + ', ' + x.address.line + (x.address.area ? ', ' + x.address.area : '') + ', ' + x.address.city + (x.address.state ? ', ' + x.address.state : '') + ' ' + x.address.pin)) : '') +
      (x.payUrl && (isHolder || isBuyer || admin) ? row('Payment page', '<a href="' + esc(openable(x.payUrl)) + '" target="_blank" rel="noopener noreferrer">Open payment page</a>') : '');
    if (r.cardholderId) detailRows += row('Cardholder', esc(M.nameOf(r.cardholderId)) + ' · trust ' + M.trust(r.cardholderId)) + (r.cardId && M.card(r.cardId) ? row('Using', esc(bankName(M.card(r.cardId).bank) + ' ' + M.card(r.cardId).variant)) : '');
    if (!isBuyer) detailRows += row('Buyer', esc(M.nameOf(r.buyerId)) + ' · trust ' + M.trust(r.buyerId));
    if (r.ref) detailRows += row('Reference', esc(r.ref));

    var steps = [['Request created', r.createdAt], ['Paid into escrow', r.paidAt], ['Accepted by a cardholder', r.acceptedAt], ['Proof uploaded', r.fulfilledAt], ['Confirmed', r.confirmedAt], ['Completed and paid out', r.settledAt]];
    var nowIdx = -1; steps.forEach(function (st, i) { if (!st[1] && nowIdx < 0) nowIdx = i; });
    var closed = ['REFUNDED', 'EXPIRED', 'CANCELLED', 'SETTLED'].indexOf(r.status) > -1;
    var tl = '<ul class="tl">' + steps.map(function (st, i) {
      return '<li class="tl__i ' + (st[1] ? 'is-done' : (!closed && i === nowIdx ? 'is-now' : '')) + '"><div class="tl__t">' + st[0] + '</div><div class="tl__d">' + (st[1] ? dt(st[1]) : (!closed && i === nowIdx ? 'Next' : '—')) + '</div></li>';
    }).join('') + '</ul>';

    var who = isHolder ? 'holder' : 'buyer';
    var dealOn = isHolder && (r.module === 'ORDER' || r.module === 'PAY') && ['ACCEPTED', 'FULFILLED', 'CONFIRMED', 'SETTLED'].indexOf(r.status) > -1;
    var proofs = M.proofs(r.id);
    var dispute = M.dispute(r.id);
    var adj = r.actual != null && r.module !== 'LOUNGE' ? Core.adjust(s, r.actual) : null;

    var html = '<div class="wrap section--tight"><a class="btn btn--link small" href="' + (isHolder && !isBuyer ? '#/market/earn?t=jobs' : '#/market/requests') + '">← Back</a>' +
      '<div class="spread" style="margin:12px 0 22px; gap:14px; flex-wrap:wrap"><div><span class="badge badge--info">' + MODS[r.module].short + '</span> ' + badge(r.status) +
      '<h1 class="h1" style="margin-top:10px">' + esc(titleOf(r)) + '</h1><p class="lede">' + esc(subOf(r)) + '</p></div></div>' +
      (r.status === 'DISPUTED' && dispute ? '<div class="note note--warn" style="margin-bottom:18px"><strong>Dispute open.</strong> ' + esc(dispute.note) + '</div>' : '') +
      (dispute && dispute.status === 'RESOLVED' && dispute.reason !== 'ENTRY_DENIED' ? '<div class="note" style="margin-bottom:18px"><strong>Dispute resolved: ' + esc(String(dispute.resolution).toLowerCase()) + '.</strong> ' + esc(dispute.adminNote || '') + '</div>' : '') +
      '<div class="detail market-detail"><div class="stack">' +
      (dealOn ? dealPanel(r, x, s) : '') +
      '<div class="panel"><h2 class="h3" style="margin-bottom:8px">Details</h2>' + detailRows + '</div>' +
      '<div class="panel"><h2 class="h3" style="margin-bottom:8px">' + (isHolder ? 'What you get' : 'Price breakdown') + '</h2>' + breakdown(r.module, s, who) +
      (adj && (adj.refund || adj.topup) ? '<div class="note note--warn" style="margin-top:12px">Final price ' + money(r.actual) + ' vs estimate ' + money(s.reimbursement) + ': ' + (adj.refund ? money(adj.refund) + ' goes back to the buyer.' : money(adj.topup) + ' ' + (r.topupDue > 0 ? 'top-up is due from the buyer.' : 'top-up was paid.')) + '</div>' : '') + '</div>' +
      (dealOn ? '' : '<div class="panel"><h2 class="h3" style="margin-bottom:14px">Progress</h2>' + tl + '</div>') +
      (proofs.length ? '<div class="panel"><h2 class="h3" style="margin-bottom:12px">Proofs</h2><div class="mk-proofs" id="proofs">' + proofs.map(function (p) {
        return '<figure data-p="' + p.id + '"><a target="_blank" rel="noopener noreferrer"><img alt="' + esc(p.name) + '"></a><figcaption class="small muted">' + (p.kind === 'EVIDENCE' ? 'Buyer evidence' : 'Cardholder proof') + '</figcaption></figure>'; }).join('') + '</div></div>' : '') +
      '</div><aside class="detail__side"><div class="stack">' +
      '<div class="panel" id="actions"><h2 class="h3" style="margin-bottom:12px">What next</h2>' + (admin && !isBuyer && !isHolder ? '<p class="muted">You are viewing as staff. Manage this from the admin panel.</p><a class="btn btn--soft btn--sm" href="#/admin/market">Open admin</a>' : actionBox(r, u)) + '</div>' +
      (r.cardholderId && (isBuyer || isHolder || admin) ? '<div class="panel" id="chat"><h2 class="h3" style="margin-bottom:10px">Chat</h2><div class="mk-chat" id="chatLog"></div>' +
        (['REFUNDED', 'CANCELLED', 'EXPIRED'].indexOf(r.status) < 0 ? '<form class="row" id="chatForm" style="margin-top:10px; gap:8px"><input id="chatIn" maxlength="500" placeholder="Write a message" autocomplete="off" style="flex:1"><button class="btn btn--primary btn--sm">Send</button></form><p class="small" id="chatLeft" style="margin-top:8px; font-weight:600"></p><div class="note note--warn" style="margin-top:8px; padding:8px 11px; font-size:.74rem; line-height:1.4"><strong>Never share personal or contact details.</strong> No phone, email, address, CVV, OTP or bank details. Only the last 4 digits of your card.</div>' : '') + '</div>' : '') +
      localHelper(r) + '</div></aside></div></div>';

    return {
      title: titleOf(r) + ' | Share & Earn | Card Crest', html: html,
      mount: function (root) {
        fresh(root);
        function redo() { w.CC.Router.refresh(); }
        var alive = stamp();
        onChange(root, w.CC.Router.refresh);                       // the request itself changed: redraw the page
        w.addEventListener('cc:market', function h() { if (!alive()) return w.removeEventListener('cc:market', h); drawChat(); });   // new chat messages only

        /* deal timeline: copy buttons, the shop in a window beside this page, the countdown, exit */
        root.querySelectorAll('[data-copy]').forEach(function (b) {
          b.onclick = function () {
            var t = b.getAttribute('data-copy');
            function ok() { UI.toast(b.getAttribute('data-label') + ' copied'); }
            if (w.navigator.clipboard && w.navigator.clipboard.writeText) w.navigator.clipboard.writeText(t).then(ok, function () { w.prompt('Copy this', t); });
            else w.prompt('Copy this', t);
          };
        });
        root.querySelectorAll('[data-open-store]').forEach(function (b) {
          b.onclick = function () {
            var url = b.getAttribute('data-open-store'), W = Math.min(1100, Math.round(w.screen.availWidth * 0.62)), H = w.screen.availHeight - 80;
            var win = w.open(url, 'ccstore', 'popup=yes,width=' + W + ',height=' + H + ',left=' + Math.max(0, w.screen.availWidth - W) + ',top=40');
            if (!win) w.open(url, '_blank', 'noopener');
            else UI.toast('The shop opened in a window. Keep this page open beside it.');
          };
        });
        var jump = root.querySelector('[data-jump]');
        if (jump) jump.onclick = function (e) { e.preventDefault(); var a = root.querySelector('#actions'); if (a) a.scrollIntoView({ behavior: 'smooth' }); };
        var ex = root.querySelector('[data-exit-deal]');
        if (ex) ex.onclick = function () { var rel = root.querySelector('[data-act="release"]'); if (rel) rel.click(); else UI.toast('You can step back from What next.'); };
        var tmr = root.querySelector('.deal-timer__t');
        if (tmr) {
          var dl = new Date(tmr.getAttribute('data-deadline')).getTime();
          (function tick() {
            if (!alive() || !tmr.isConnected) return;
            var ms = dl - Date.now();
            if (ms <= 0) { tmr.textContent = 'Time is up'; return; }
            var sec = Math.floor(ms / 1000), h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s2 = sec % 60;
            function p2(n) { return (n < 10 ? '0' : '') + n; }
            tmr.textContent = (h ? h + ':' + p2(m) : p2(m)) + ':' + p2(s2);
            tmr.classList.toggle('is-low', ms < 300000);
            setTimeout(tick, 1000);
          })();
        }

        /* proofs */
        root.querySelectorAll('#proofs figure').forEach(function (fig) {
          var p = M.proofs(r.id).filter(function (x) { return x.id === fig.dataset.p; })[0];
          M.proofUrl(p).then(function (url) { var img = fig.querySelector('img'); img.src = url; fig.querySelector('a').href = url; });
        });

        /* chat limits: 2 messages each, at most 4 digits in a message */
        var CH = Core.CHAT, staff = u.role === 'admin' && !isBuyer && !isHolder;
        function chatLeft() {
          var used = M.messages(r.id).filter(function (m) { return m.senderId === u.id; }).length, left = Math.max(0, CH.MAX_MESSAGES - used);
          var cl = root.querySelector('#chatLeft'), ci = root.querySelector('#chatIn'), cb = root.querySelector('#chatForm button');
          if (cl && !staff) cl.textContent = left ? 'You can send ' + left + ' more message' + (left === 1 ? '' : 's') + ' (of ' + CH.MAX_MESSAGES + '). Share only the last ' + CH.MAX_DIGITS + ' digits of your card.' : 'You have used your ' + CH.MAX_MESSAGES + ' messages on this request.';
          if (ci && !staff) { ci.disabled = !left; ci.placeholder = left ? 'Write a message (no numbers or contact details)' : 'You have used your messages'; if (cb) cb.disabled = !left; }
        }
        var chatIn0 = root.querySelector('#chatIn');
        if (chatIn0 && !staff) chatIn0.addEventListener('input', function () {
          var n = 0, out = '';
          for (var i = 0; i < chatIn0.value.length; i++) { var ch = chatIn0.value.charAt(i); if (/\d/.test(ch)) { n++; if (n > CH.MAX_DIGITS) continue; } out += ch; }
          if (out !== chatIn0.value) { chatIn0.value = out; UI.toast('Share only the last ' + CH.MAX_DIGITS + ' digits of your card.', 'error'); }
        });
        /* chat */
        var chatKey = '';
        function drawChat() {
          var log = root.querySelector('#chatLog'); if (!log) return;
          var msgs = M.messages(r.id), key = msgs.map(function (m) { return m.id; }).join(',');

          chatLeft();
          if (key === chatKey) return;                       // nothing new, leave the box alone
          chatKey = key;
          var atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
          log.innerHTML = msgs.length ? msgs.map(function (m) {
            return '<div class="mk-msg' + (m.senderId === u.id ? ' is-me' : '') + '"><div class="mk-msg__b">' + esc(m.body) + '</div><div class="mk-msg__m">' + (m.senderId === u.id ? 'You' : esc(M.nameOf(m.senderId))) + ' · ' + dt(m.createdAt) + '</div></div>';
          }).join('') : '<p class="muted small">No messages yet.</p>';
          if (atBottom || msgs.length === 1) log.scrollTop = log.scrollHeight;

        }
        drawChat();
        var cf = root.querySelector('#chatForm');
        if (cf) cf.onsubmit = function (e) {
          e.preventDefault();
          var inp = root.querySelector('#chatIn'), body = inp.value.trim(); if (!body) return;
          if (!staff && Core.chatCheck(body)) return UI.toast(Core.chatCheck(body), 'error');
          M.do('sendMessage', { id: r.id, body: body }).then(function (res) { if (!res.ok) UI.toast(res.error, 'error'); else { inp.value = ''; drawChat(); chatLeft(); } });
        };
        if (M.mode() === 'supabase' && r.cardholderId) {
          var poll = setInterval(function () {
            if (!alive()) return clearInterval(poll);
            var before = dataSig();
            M.load().then(function () { if (!alive()) return; if (dataSig() !== before) w.CC.Router.refresh(); else drawChat(); });
          }, 8000);
        }

        /* actions */
        function act(name, fn) { var b = root.querySelector('[data-act="' + name + '"]'); if (b) b.onclick = function () { fn(b); }; }
        var cp = root.querySelector('[data-copy-pay]');
        if (cp) cp.onclick = function () {
          var link = cp.getAttribute('data-copy-pay');
          function done() { UI.toast('Payment page link copied'); }
          if (w.navigator.clipboard && w.navigator.clipboard.writeText) w.navigator.clipboard.writeText(link).then(done, function () { w.prompt('Copy this link', link); });
          else w.prompt('Copy this link', link);
        };
        function run(btn, action, params, okMsg, label) {
          busy(btn, true, label || 'Working…');
          M.do(action, params).then(function (res) {
            if (!res.ok) { busy(btn, false, true); UI.toast(res.error, 'error'); return; }
            if (okMsg) UI.toast(okMsg); redo();
          });
        }
        act('pay', function () { payModal(r, { done: redo }); });
        act('topup', function () { payModal(r, { topup: true, amount: r.topupDue, done: redo }); });
        act('cancel', function (b) { UI.confirm('Cancel this request?', r.status === 'PAID' ? 'Your payment is refunded in full.' : 'It has not been paid, so nothing is charged.', 'Cancel request', function () { run(b, 'cancel', { id: r.id }, 'Request cancelled'); }, true); });
        act('confirm', function (b) { run(b, 'confirm', { id: r.id }, r.module === 'MOVIE' ? 'Confirmed. Payment is released after the show.' : 'Confirmed. Payment released.'); });
        act('release', function (b) { UI.confirm('Step back?', 'The request goes back to other cardholders. This lowers your trust score a little.', 'Step back', function () { run(b, 'release', { id: r.id }, 'You stepped back'); }, true); });
        act('denied', function (b) {
          UI.modal({ title: 'Entry was denied', body: '<p class="muted">You will be refunded in full and the cardholder is penalised. Tell us what happened.</p><div class="field"><label for="dn">What did the lounge say?</label><textarea id="dn" rows="3" maxlength="300"></textarea></div>',
            foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--danger" data-go>Refund me</button>',
            onMount: function (m) { m.querySelector('[data-go]').onclick = function () { var n = m.querySelector('#dn').value; UI.closeModal(); run(b, 'denied', { id: r.id, note: n }, 'Refunded in full'); }; } });
        });
        act('dispute', function (b) {
          UI.modal({ title: 'Raise a dispute', body: '<div class="field"><label for="dr">Reason</label><select id="dr">' + DISPUTE_REASONS.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select></div>' +
            '<div class="field"><label for="dn">What happened?</label><textarea id="dn" rows="4" maxlength="500"></textarea></div><div class="field"><label for="de">Evidence (optional)</label><input id="de" type="file" accept="image/png,image/jpeg,image/webp" multiple></div><p class="err" id="de-err" style="color:var(--danger); font-size:.86rem; display:none"></p>',
            foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-go>Send to support</button>',
            onMount: function (m) {
              m.querySelector('[data-go]').onclick = function () {
                var go = this, files = [].slice.call(m.querySelector('#de').files); busy(go, true);
                Promise.all(files.map(function (f) { return M.prepFile(f, r.id); })).then(function (ev) {
                  return M.do('dispute', { id: r.id, reason: m.querySelector('#dr').value, note: m.querySelector('#dn').value, evidence: ev });
                }).then(function (res) {
                  busy(go, false);
                  if (!res.ok) { var e = m.querySelector('#de-err'); e.textContent = res.error; e.style.display = 'block'; return; }
                  UI.closeModal(); UI.toast('Dispute sent. Support will review it.'); redo();
                }).catch(function (err) { busy(go, false); var e = m.querySelector('#de-err'); e.textContent = err.message; e.style.display = 'block'; });
              };
            } });
        });
        act('fulfil', function (b) {
          var err = root.querySelector('#u-err'); err.style.display = 'none';
          var files = [].slice.call(root.querySelector('#u-files').files);
          if (!files.length) { err.textContent = 'Upload at least one proof image.'; err.style.display = 'block'; return; }
          busy(b, true, 'Uploading…');
          Promise.all(files.map(function (f) { return M.prepFile(f, r.id); })).then(function (proofs) {
            var act = root.querySelector('#u-act');
            return M.do('fulfil', { id: r.id, ref: root.querySelector('#u-ref').value, actual: act ? act.value : undefined, proofs: proofs });
          }).then(function (res) {
            if (!res.ok) { busy(b, false, true); err.textContent = res.error; err.style.display = 'block'; return; }
            UI.toast('Proof uploaded. The buyer can confirm now.'); redo();
          }).catch(function (e) { busy(b, false, true); err.textContent = e.message; err.style.display = 'block'; });
        });
        root.querySelectorAll('[data-star]').forEach(function (b) {
          b.onclick = function () { M.do('rate', { id: r.id, stars: Number(b.dataset.star) }).then(function (res) { if (!res.ok) UI.toast(res.error, 'error'); else { UI.toast('Thanks for rating'); redo(); } }); };
        });

        /* local test helper */
        root.querySelectorAll('[data-help]').forEach(function (b) {
          b.onclick = function () {
            var k = b.dataset.help, D = M.DEMO_HOLDER, est = s.reimbursement;
            if (k === 'accept') return M.do('accept', { id: r.id, cardId: 'mkc-demo' }, D).then(function (res) { if (!res.ok) UI.toast(res.error, 'error'); redo(); });
            if (k.indexOf('proof') === 0) {
              var actual = r.module === 'LOUNGE' ? undefined : (k === 'proof-low' ? est - 50 : k === 'proof-high' ? est + 60 : est);
              return M.do('fulfil', { id: r.id, ref: 'TEST-REF-1234', actual: actual, proofs: [{ name: 'test-proof.jpg', dataUrl: testProofImage() }] }, D).then(function (res) { if (!res.ok) UI.toast(res.error, 'error'); redo(); });
            }
            if (k === 't0') { M.resetClock(); return M.sweep().then(redo); }
            var h = { t1: 1, t24: 24, t72: 72 }[k];
            M.advance(h * 3600000).then(function () { UI.toast('Moved the clock forward ' + h + ' h'); redo(); });
          };
        });
      }
    };
  };

  w.CC.Pages.notFoundMarket = function () { return w.CC.Pages.notFound(); };
})(window, document);
