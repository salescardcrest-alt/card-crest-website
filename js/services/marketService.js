/* ============================================================
   Card Crest — marketService.js
   The benefit-sharing marketplace: Lounge, Movie, Order & Earn, Pay & Earn.

   Two backends behind one API (CC.Market):
   - Supabase mode: every action is an RPC (mk_<action>) defined in
     supabase/05_marketplace.sql. The database is the source of truth
     for money, locking and the state machine.
   - Local mode (no Supabase, or localhost testing): the same rules run
     here against the browser Store, so the whole flow can be tried alone.

   The payment gateway is in TEST MODE: a simulated checkout sends a signed
   "payment.captured" event to the same webhook handler a real gateway would
   call. The platform never sees card numbers, CVV, OTPs or bank passwords.
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store, Core = w.CC.MarketCore;
  var sb = null;                       // Supabase client when configured
  var clock = function () { return Date.now(); };
  var DEMO_HOLDER = 'mk-demo-holder';
  var TEST_SECRET = 'cc_test_webhook_secret';

  var COLS = ['mkRequests', 'mkCards', 'mkFees', 'mkLedger', 'mkMessages', 'mkProofs', 'mkDisputes', 'mkRatings',
              'mkPayouts', 'mkKyc', 'mkQuota', 'mkWebhook', 'mkAudit', 'mkOutbox', 'mkTrust'];

  /* ---------- tiny SHA-256 + HMAC (signature check works on any origin) ---------- */
  function sha256(bytes) {
    var pow = Math.pow, W = pow(2, 32), i, j, k = [], h = [], primes = 0, cand = 2, comp = {};
    for (; primes < 64; cand++) {
      if (!comp[cand]) {
        for (i = 0; i < 313; i += cand) comp[i] = cand;
        h[primes] = (pow(cand, 0.5) * W) | 0;
        k[primes++] = (pow(cand, 1 / 3) * W) | 0;
      }
    }
    h = h.slice(0, 8);
    var len = bytes.length, words = [];
    for (i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((3 - i) % 4) * 8;
    words[len >> 2] |= 0x80 << ((3 - len) % 4) * 8;
    var total = ((len + 8 >> 6) + 1) * 16;
    for (i = 0; i < total; i++) if (words[i] === undefined) words[i] = 0;
    words[total - 1] = len * 8;
    words[total - 2] = Math.floor(len * 8 / W);
    for (j = 0; j < total; j += 16) {
      var wk = words.slice(j, j + 16), old = h.slice(0), a, e;
      for (i = 0; i < 64; i++) {
        var w15 = wk[i - 15], w2 = wk[i - 2];
        if (i >= 16) {
          wk[i] = (wk[i - 16] + (((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3)) +
                   wk[i - 7] + (((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10))) | 0;
        }
        a = h[0]; e = h[4];
        var t1 = h[7] + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) +
                 ((e & h[5]) ^ (~e & h[6])) + k[i] + wk[i];
        var t2 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) +
                 ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
        h = [(t1 + t2) | 0].concat(h);
        h[4] = (h[4] + t1) | 0;
        h.length = 8;
      }
      for (i = 0; i < 8; i++) h[i] = (h[i] + old[i]) | 0;
    }
    var out = [];
    for (i = 0; i < 8; i++) for (j = 3; j >= 0; j--) out.push((h[i] >> (j * 8)) & 255);
    return out;
  }
  function utf8(str) { return Array.prototype.slice.call(unescape(encodeURIComponent(str))).map(function (c) { return c.charCodeAt(0); }); }
  function hex(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
  function hmacHex(key, msg) {
    var kb = utf8(key), i;
    if (kb.length > 64) kb = sha256(kb);
    while (kb.length < 64) kb.push(0);
    var ipad = kb.map(function (b) { return b ^ 0x36; }), opad = kb.map(function (b) { return b ^ 0x5c; });
    return hex(sha256(opad.concat(sha256(ipad.concat(utf8(msg))))));
  }
  function safeEq(a, b) {
    if (a.length !== b.length) return false;
    var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  /* ---------- helpers ---------- */
  function Err(msg) { this.message = msg; }
  function fail(msg) { throw new Err(msg); }
  function col(name) { var a = S.get(name); if (!a) { a = []; S.set(name, a); } return a; }
  function rid(p) { return S.uid(p); }
  function nowIso() { return new Date(clock()).toISOString(); }
  function byId(name, id) { return col(name).filter(function (r) { return r.id === id; })[0] || null; }
  function me() { var u = w.CC.Auth.current(); return u ? u.id : null; }
  function nameOf(id) {
    if (id === DEMO_HOLDER) return 'Test cardholder';
    var u = S.get('users').filter(function (x) { return x.id === id; })[0];
    return u ? u.name : 'Member';
  }
  function firstName(id) { return String(nameOf(id)).split(' ')[0]; }
  function fmt(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

  var Market = { core: Core, DEMO_HOLDER: DEMO_HOLDER, TEST_SECRET: TEST_SECRET, sha256hex: function (s) { return hex(sha256(utf8(s))); }, hmac: hmacHex };

  /* ============================================================
     LOCAL ENGINE
     ============================================================ */
  var L = {};

  function audit(actor, action, entity, id, diff) {
    S.insert('mkAudit', { id: rid('aud'), actor: actor, action: action, entity: entity, entityId: id, diff: diff || {}, at: nowIso() });
  }

  /* in-app notification now; email + WhatsApp rows are queued for a sender (see README) */
  function notify(userId, title, body, requestId, type) {
    if (!userId || userId === DEMO_HOLDER) return;
    w.CC.Notifications.push(userId, type || 'market', title, body);
    ['email', 'whatsapp'].forEach(function (ch) {
      S.insert('mkOutbox', { id: rid('out'), userId: userId, channel: ch, title: title, body: body, requestId: requestId || null, status: 'QUEUED', createdAt: nowIso() });
    });
  }

  function describe(r) {
    var x = r.details || {};
    if (r.module === 'LOUNGE') return String(x.type || '').toLowerCase() + ' lounge at ' + x.airport;
    if (r.module === 'MOVIE') return x.movie + (x.offer === 'BOGO' ? ' (buy one get one)' : ' (₹500 off on 2 seats)');
    return (r.module === 'ORDER' ? 'an order' : 'a payment') + ' on ' + x.platform;
  }

  /* Tell every cardholder whose card fits this request, straight away. */
  function notifyEligible(req, skipUser) {
    var told = {};
    col('mkCards').forEach(function (card) {
      var u = card.ownerId;
      if (told[u] || u === req.buyerId || u === skipUser || u === DEMO_HOLDER) return;
      if (!Core.cardFits(card, req, quotaUsed).ok) return;
      told[u] = true;
      notify(u, 'New request you can fulfil', 'Someone needs ' + describe(req) + '. You would earn ' + fmt(req.feeSnapshot.holderFee) + (req.feeSnapshot.reimbursement ? ' plus ' + fmt(req.feeSnapshot.reimbursement) + ' reimbursed' : '') + '. First to accept gets it.', req.id, 'market:open:' + req.id);
    });
  }

  /* double-entry: every transaction must balance */
  function post(req, kind, lines, note) {
    var dr = 0, cr = 0;
    lines.forEach(function (l) { dr += l.debit || 0; cr += l.credit || 0; });
    if (Math.abs(dr - cr) > 0.005) fail('Ledger entry does not balance.');
    var txn = rid('txn');
    lines.forEach(function (l) {
      if (!(l.debit || l.credit)) return;
      S.insert('mkLedger', { id: rid('led'), txnId: txn, requestId: req ? req.id : null, kind: l.kind || kind, account: l.account,
        debit: Core.r2(l.debit || 0), credit: Core.r2(l.credit || 0), note: note || '', at: nowIso() });
    });
  }
  function balance(account) {
    return Core.r2(col('mkLedger').reduce(function (a, e) { return e.account === account ? a + e.credit - e.debit : a; }, 0));
  }
  function escrowHeld(req) {
    return Core.r2(col('mkLedger').reduce(function (a, e) {
      return e.requestId === req.id && e.account === 'escrow' ? a + e.credit - e.debit : a;
    }, 0));
  }

  function go(req, to, actor, note) {
    if (!Core.canTransition(req.status, to)) fail('This request cannot move from ' + req.status + ' to ' + to + '.');
    var from = req.status, patch = { status: to, version: (req.version || 0) + 1 };
    S.update('mkRequests', req.id, patch);
    audit(actor, 'status', 'request', req.id, { from: from, to: to, note: note || '' });
    return byId('mkRequests', req.id);
  }

  function trustEvent(userId, delta, reason, reqId) {
    if (!userId || userId === DEMO_HOLDER) return;
    S.insert('mkTrust', { id: rid('trs'), userId: userId, delta: delta, reason: reason, requestId: reqId || null, at: nowIso() });
  }

  function quotaUsed(cardId, kind, quarter) {
    return col('mkQuota').filter(function (q) { return q.cardId === cardId && q.kind === kind && q.quarter === quarter; }).length;
  }
  function releaseQuota(req) {
    col('mkQuota').filter(function (q) { return q.requestId === req.id; }).forEach(function (q) { S.remove('mkQuota', q.id); });
  }

  function mustBeBuyer(req, actor) { if (!req || req.buyerId !== actor) fail('Only the buyer can do that.'); }
  function mustBeHolder(req, actor) { if (!req || req.cardholderId !== actor) fail('Only the cardholder on this request can do that.'); }
  function activeUser(actor) {
    if (actor === DEMO_HOLDER) return;
    var u = S.get('users').filter(function (x) { return x.id === actor; })[0];
    if (!u) fail('Sign in to continue.');
    if (u.active === false) fail('This account is switched off. Contact support.');
  }
  function isAdmin(actor) {
    var u = S.get('users').filter(function (x) { return x.id === actor; })[0];
    return !!(u && u.role === 'admin');
  }
  function perm(actor, req) { return req.buyerId === actor || req.cardholderId === actor || isAdmin(actor); }

  L.ensure = function () {
    COLS.forEach(col);
    if (!col('mkFees').length) Core.DEFAULT_FEES.forEach(function (f) { S.get('mkFees').push(Object.assign({}, f)); });
    /* older saved pricing (before the 40/30/30 split) is moved to the new rules */
    Core.DEFAULT_FEES.forEach(function (f) {
      var cur = col('mkFees').filter(function (x) { return x.id === f.id; })[0];
      if (cur && (cur.mode !== f.mode && (f.mode === 'SPLIT' || f.module === 'LOUNGE') || (f.listValue && cur.listValue == null))) S.get('mkFees')[S.get('mkFees').indexOf(cur)] = Object.assign({}, f);
      if (!cur) S.get('mkFees').push(Object.assign({}, f));
    });
    S.commit();
    /* a built-in test cardholder so one person can walk the whole flow alone */
    if (!col('mkCards').filter(function (c) { return c.ownerId === DEMO_HOLDER; }).length) {
      S.get('mkCards').push({ id: 'mkc-demo', ownerId: DEMO_HOLDER, bank: 'hdfc', variant: 'Regalia (test)', network: 'Visa', active: true,
        benefits: [
          { kind: 'LOUNGE_DOM', program: 'Priority Pass', quota: 8, airports: ['ANY'] },
          { kind: 'LOUNGE_INTL', program: 'Priority Pass', quota: 6, airports: ['ANY'] },
          { kind: 'MOVIE_BOGO', program: 'Bank' }, { kind: 'MOVIE_FLAT500_2', program: 'Bank' },
          { kind: 'SHOPPING', program: 'Bank', note: 'Test card, any offer' }
        ] });
      S.get('mkKyc').push({ id: 'mkk-demo', userId: DEMO_HOLDER, status: 'APPROVED', legalName: 'Test Cardholder', pan: 'ABCDE1234F', upi: 'test@upi', createdAt: nowIso() });
      S.commit();
    }
  };

  /* ---------- requests ---------- */
  L.create = function (actor, p) {
    activeUser(actor);
    var recent = col('mkRequests').filter(function (r) { return r.buyerId === actor && clock() - new Date(r.createdAt).getTime() < 3600000; }).length;
    if (recent >= 10) fail('Too many requests in the last hour. Please wait a little.');
    var module = p.module;
    if (Core.MODULES.indexOf(module) < 0) fail('Unknown request type.');
    var clean = Core.cleanRequest(module, p.details || {}, clock());
    if (clean.error) fail(clean.error);
    var d = clean.details;
    var sub = module === 'LOUNGE' ? d.type : module === 'MOVIE' ? d.offer : 'DEFAULT';
    var cfg = Core.feeFor(col('mkFees'), module, sub);
    var qt = Core.quote(module, cfg, module === 'MOVIE' ? { seatCount: d.seatCount, ticketTotal: d.ticketTotal } : d);
    if (!qt.ok) fail(qt.error);
    var req = {
      id: rid('mkr'), module: module, subtype: sub, buyerId: actor, cardholderId: null, cardId: null, status: 'CREATED',
      details: d, feeSnapshot: Core.snapshot(cfg, qt.q), gatewayOrderId: null, topupOrderId: null, gatewayPaymentId: null,
      ref: null, actual: null, topupDue: 0, topupPaid: 0, createdAt: nowIso(), version: 0
    };
    S.insert('mkRequests', req);
    audit(actor, 'create', 'request', req.id, { module: module, total: req.feeSnapshot.total });
    return { request: req };
  };

  L.cancel = function (actor, p) {
    var req = byId('mkRequests', p.id); mustBeBuyer(req, actor);
    if (req.status === 'CREATED') { go(req, 'CANCELLED', actor, 'before payment'); return {}; }
    if (req.status !== 'PAID') fail('A request can only be cancelled before a cardholder accepts it.');
    go(req, 'CANCELLED', actor, 'buyer cancelled');
    refund(byId('mkRequests', req.id), 0, 'Buyer cancelled before acceptance');
    notify(actor, 'Request cancelled', 'Your payment of ' + fmt(req.feeSnapshot.total) + ' is being refunded in full.', req.id);
    return {};
  };

  /* money back to the buyer, with an optional penalty on the cardholder */
  function refund(req, penalty, reason) {
    var held = escrowHeld(req);
    if (held > 0) post(req, 'REFUND', [{ account: 'escrow', debit: held }, { account: 'external:buyer:' + req.buyerId, credit: held }], reason);
    if (penalty > 0 && req.cardholderId) {
      post(req, 'PENALTY', [{ account: 'holder:' + req.cardholderId, debit: penalty }, { account: 'platform', credit: penalty }], reason);
      notify(req.cardholderId, 'Penalty applied', fmt(penalty) + ' was deducted from your wallet: ' + reason, req.id);
    }
    var r = byId('mkRequests', req.id);
    var next = go(r, 'REFUNDED', 'system', reason);
    S.update('mkRequests', req.id, { refundedAt: nowIso(), penaltyApplied: penalty || 0, closedReason: reason });
    return next;
  }

  function settle(req, note) {
    var legs = Core.settleLegs(req.feeSnapshot, req.topupDue > 0 ? null : req.actual);
    var held = escrowHeld(req);
    if (Math.abs(held - legs.held) > 0.005) {
      // topup never paid: pay out on the estimate
      legs = Core.settleLegs(req.feeSnapshot, null);
    }
    var holder = 'holder:' + req.cardholderId, lines = [{ account: 'escrow', debit: held }];
    if (legs.reimbursement) lines.push({ account: holder, credit: legs.reimbursement, kind: 'REIMBURSEMENT' });
    if (legs.holderFee) lines.push({ account: holder, credit: legs.holderFee, kind: 'CARDHOLDER_EARNING' });
    if (legs.platform) lines.push({ account: 'platform', credit: legs.platform, kind: 'PLATFORM_FEE' });
    if (legs.refund) lines.push({ account: 'external:buyer:' + req.buyerId, credit: legs.refund, kind: 'REFUND' });
    post(req, 'SETTLEMENT', lines, note || 'Settled');
    var r = go(byId('mkRequests', req.id), 'SETTLED', 'system', note);
    S.update('mkRequests', req.id, { settledAt: nowIso() });
    trustEvent(req.cardholderId, 2, 'Completed request', req.id);
    trustEvent(req.buyerId, 1, 'Completed request', req.id);
    notify(req.cardholderId, 'You earned ' + fmt(legs.reimbursement + legs.holderFee), fmt(legs.reimbursement) + ' reimbursement plus ' + fmt(legs.holderFee) + ' earning is in your wallet.', req.id);
    notify(req.buyerId, 'Request completed', 'Your ' + Core.MODULE_LABEL[req.module].toLowerCase() + ' request is complete.' + (legs.refund ? ' ' + fmt(legs.refund) + ' was refunded to you.' : ''), req.id);
    return r;
  }

  /* ---------- payment (test mode) ---------- */
  L.startPayment = function (actor, p) {
    var req = byId('mkRequests', p.id); mustBeBuyer(req, actor);
    var purpose = p.purpose === 'TOPUP' ? 'TOPUP' : 'ORDER';
    if (purpose === 'ORDER' && req.status !== 'CREATED') fail('This request is already paid.');
    if (purpose === 'TOPUP' && !(req.topupDue > 0)) fail('There is nothing to top up.');
    var amount = purpose === 'ORDER' ? req.feeSnapshot.total : req.topupDue;
    var order = { orderId: 'order_test_' + rid('o').slice(2), amount: Core.r2(amount), currency: 'INR', purpose: purpose, requestId: req.id };
    S.update('mkRequests', req.id, purpose === 'ORDER' ? { gatewayOrderId: order.orderId } : { topupOrderId: order.orderId });
    return { order: order };
  };

  /* what the simulated checkout sends; a real gateway sends the same shape with its own secret */
  Market.buildTestEvent = function (order, outcome) {
    var body = JSON.stringify({
      id: 'evt_' + rid('e').slice(2), type: outcome === 'fail' ? 'payment.failed' : 'payment.captured',
      payload: { orderId: order.orderId, paymentId: 'pay_test_' + rid('p').slice(2), amount: order.amount }
    });
    return { body: body, signature: hmacHex(TEST_SECRET, body) };
  };

  /* Verified, idempotent. Used by the test checkout and by the Edge Function in production. */
  L.webhook = function (_actor, p) {
    if (!p.signature || !safeEq(hmacHex(TEST_SECRET, p.body), String(p.signature))) fail('Webhook signature is not valid.');
    var ev = JSON.parse(p.body);
    if (col('mkWebhook').filter(function (x) { return x.eventId === ev.id; }).length) return { duplicate: true };
    S.insert('mkWebhook', { id: rid('whk'), eventId: ev.id, type: ev.type, payload: ev.payload, processedAt: nowIso() });
    if (ev.type !== 'payment.captured') return { ignored: true };
    var pl = ev.payload;
    var req = col('mkRequests').filter(function (r) { return r.gatewayOrderId === pl.orderId || r.topupOrderId === pl.orderId; })[0];
    if (!req) fail('No request matches that payment.');
    var topup = req.topupOrderId === pl.orderId;
    if (!topup && req.status !== 'CREATED') fail('This request is already paid.');
    var due = topup ? req.topupDue : req.feeSnapshot.total;
    if (Math.abs(due - pl.amount) > 0.005) fail('Paid amount does not match the amount due.');
    post(req, 'ESCROW_IN', [{ account: 'external:buyer:' + req.buyerId, debit: pl.amount }, { account: 'escrow', credit: pl.amount }],
      topup ? 'Top-up' : 'Payment ' + pl.paymentId);
    if (topup) {
      S.update('mkRequests', req.id, { topupDue: 0, topupPaid: Core.r2((req.topupPaid || 0) + pl.amount) });
      notify(req.cardholderId, 'Buyer topped up', fmt(pl.amount) + ' was added to escrow for this request.', req.id);
    } else {
      var t = clock();
      var r = go(req, 'PAID', 'gateway', pl.paymentId);
      S.update('mkRequests', req.id, { gatewayPaymentId: pl.paymentId, paidAt: new Date(t).toISOString(), acceptBy: Core.acceptBy(r, t) });
      notify(req.buyerId, 'Payment held safely', fmt(pl.amount) + ' is in escrow. A cardholder can pick up your request now.', req.id);
      notifyEligible(byId('mkRequests', req.id));
    }
    return {};
  };

  /* ---------- cardholder side ---------- */
  L.openFor = function (actor) {
    var mine = col('mkCards').filter(function (c) { return c.ownerId === actor; });
    return col('mkRequests').filter(function (r) {
      return r.status === 'PAID' && r.buyerId !== actor && new Date(r.acceptBy).getTime() > clock();
    }).map(function (r) {
      var fits = mine.map(function (c) { return { card: c, fit: Core.cardFits(c, r, quotaUsed) }; });
      var ok = fits.filter(function (f) { return f.fit.ok; });
      return { request: Object.assign({}, r, { details: Core.publicDetails(r.details) }), cards: ok.map(function (f) { return f.card; }),
               eligible: ok.length > 0, why: ok.length ? '' : (fits[0] ? fits[0].fit.why : 'Add a card with this benefit') };
    });
  };

  L.accept = function (actor, p) {
    activeUser(actor);
    var req = byId('mkRequests', p.id);
    if (!req) fail('Request not found.');
    if (req.buyerId === actor) fail('You cannot accept your own request.');
    if (req.status !== 'PAID') fail('Someone else already picked this up, or it is no longer open.');
    if (new Date(req.acceptBy).getTime() <= clock()) fail('This request has expired.');
    var live = col('mkRequests').filter(function (r) { return r.cardholderId === actor && ['ACCEPTED', 'FULFILLED', 'DISPUTED'].indexOf(r.status) > -1; }).length;
    if (live >= 5) fail('Finish a few of your open jobs before taking more.');
    var card = byId('mkCards', p.cardId);
    if (!card || card.ownerId !== actor) fail('Choose one of your own cards.');
    var fit = Core.cardFits(card, req, quotaUsed);
    if (!fit.ok) fail(fit.why + '.');
    var t = clock();
    var r = go(req, 'ACCEPTED', actor, card.bank);       // status check above plus this is the lock in local mode
    S.update('mkRequests', req.id, { cardholderId: actor, cardId: card.id, acceptedAt: new Date(t).toISOString(), fulfilBy: Core.fulfilBy(r, t) });
    if (req.module === 'LOUNGE') {
      S.insert('mkQuota', { id: rid('q'), cardId: card.id, kind: fit.benefit.kind, quarter: Core.quarterOf(req.details.dateTime), requestId: req.id });
    }
    notify(req.buyerId, 'A cardholder accepted', firstName(actor) + ' will take care of your request. You can chat with them on the request page.', req.id);
    return {};
  };

  L.release = function (actor, p) {
    var req = byId('mkRequests', p.id); mustBeHolder(req, actor);
    if (req.status !== 'ACCEPTED') fail('You can only step back before you upload proof.');
    releaseQuota(req);
    go(req, 'PAID', actor, 'cardholder stepped back');
    S.update('mkRequests', req.id, { cardholderId: null, cardId: null, acceptedAt: null, fulfilBy: null });
    trustEvent(actor, -2, 'Stepped back from a request', req.id);
    notify(req.buyerId, 'Cardholder stepped back', 'Your request is open again for another cardholder.', req.id);
    notifyEligible(byId('mkRequests', req.id), actor);
    return {};
  };

  L.fulfil = function (actor, p) {
    var req = byId('mkRequests', p.id); mustBeHolder(req, actor);
    if (req.status !== 'ACCEPTED') fail('This request is not waiting for proof.');
    var bad = Core.cleanProof(req.module, p);
    if (bad) fail(bad);
    var actual = null, topup = 0;
    if (req.module !== 'LOUNGE') {
      actual = Core.r2(p.actual);
      if (actual > req.feeSnapshot.reimbursement * 2) fail('That amount is far above the estimate. Message the buyer or contact support first.');
      topup = Core.adjust(req.feeSnapshot, actual).topup;
    }
    p.proofs.forEach(function (f) {
      S.insert('mkProofs', { id: rid('prf'), requestId: req.id, uploaderId: actor, kind: 'PROOF', name: f.name, path: f.path || null, dataUrl: f.dataUrl || null, createdAt: nowIso() });
    });
    var t = clock();
    var r = go(req, 'FULFILLED', actor, p.ref);
    S.update('mkRequests', req.id, { ref: String(p.ref || '').trim(), actual: actual, topupDue: topup, fulfilledAt: new Date(t).toISOString(),
      autoConfirmAt: Core.autoConfirmAt(r, t) });
    var bn = actual !== null ? Core.adjust(req.feeSnapshot, actual) : null;
    notify(req.buyerId, 'Proof uploaded',
      topup > 0 ? 'The final price is ' + fmt(topup) + ' higher than estimated. Top up to release funds, or raise a dispute.'
        : bn && bn.refund > 0 ? 'The final price was ' + fmt(bn.refund) + ' lower, you will get that back when this completes.'
        : 'Check the proof and confirm to release payment.', req.id);
    return {};
  };

  /* ---------- buyer side after fulfilment ---------- */
  L.confirm = function (actor, p) {
    var req = byId('mkRequests', p.id); mustBeBuyer(req, actor);
    return confirmNow(req, actor);
  };
  function confirmNow(req, actor) {
    if (req.status !== 'FULFILLED') fail('There is nothing to confirm yet.');
    if (req.topupDue > 0) fail('Pay the top-up first. The cardholder paid more than the estimate.');
    var t = clock();
    var r = go(req, 'CONFIRMED', actor);
    S.update('mkRequests', req.id, { confirmedAt: new Date(t).toISOString(), settleAt: Core.settleAt(r, t) });
    return settleIfDue(byId('mkRequests', req.id));
  }
  function settleIfDue(req) {
    if (req.status === 'CONFIRMED' && new Date(req.settleAt).getTime() <= clock()) { settle(req, 'Confirmed'); return { settled: true }; }
    return { settled: false, settleAt: req.settleAt };
  }

  L.topup = function (actor, p) { return L.startPayment(actor, { id: p.id, purpose: 'TOPUP' }); };

  L.denied = function (actor, p) {
    var req = byId('mkRequests', p.id); mustBeBuyer(req, actor);
    if (req.module !== 'LOUNGE') fail('Entry reports are for lounge access.');
    if (req.status !== 'FULFILLED') fail('You can report a denial once the cardholder has uploaded the pass.');
    var pen = req.feeSnapshot.penalty;
    S.insert('mkDisputes', { id: rid('dsp'), requestId: req.id, raisedBy: actor, reason: 'ENTRY_DENIED', note: String(p.note || ''), status: 'RESOLVED', resolution: 'REFUND', createdAt: nowIso(), resolvedAt: nowIso() });
    trustEvent(req.cardholderId, -15, 'Lounge entry denied', req.id);
    refund(req, pen, 'Lounge entry denied');
    notify(req.buyerId, 'Refunded in full', 'We are sorry the entry was denied. ' + fmt(req.feeSnapshot.total) + ' is going back to you.', req.id);
    return {};
  };

  L.dispute = function (actor, p) {
    var req = byId('mkRequests', p.id); mustBeBuyer(req, actor);
    if (['ACCEPTED', 'FULFILLED'].indexOf(req.status) < 0) fail('A dispute can be raised while the request is with the cardholder.');
    var reason = String(p.reason || '').trim(), note = String(p.note || '').trim();
    if (!reason) fail('Choose a reason.');
    if (note.length < 10) fail('Tell us what happened in a few words.');
    var d = { id: rid('dsp'), requestId: req.id, raisedBy: actor, reason: reason, note: note, status: 'OPEN', createdAt: nowIso(), prevStatus: req.status };
    S.insert('mkDisputes', d);
    (p.evidence || []).forEach(function (f) {
      S.insert('mkProofs', { id: rid('prf'), requestId: req.id, uploaderId: actor, kind: 'EVIDENCE', name: f.name, path: f.path || null, dataUrl: f.dataUrl || null, createdAt: nowIso() });
    });
    go(req, 'DISPUTED', actor, reason);
    notify(req.cardholderId, 'The buyer raised a dispute', 'Support will review the proofs and decide. Reply in the request chat if you can help.', req.id);
    return { dispute: d };
  };

  /* ---------- admin ---------- */
  L.resolveDispute = function (actor, p) {
    if (!isAdmin(actor)) fail('Only staff can resolve disputes.');
    var d = byId('mkDisputes', p.id);
    if (!d || d.status !== 'OPEN') fail('This dispute is already closed.');
    var req = byId('mkRequests', d.requestId);
    var outcome = p.outcome, pen = p.penalise ? req.feeSnapshot.penalty : 0;
    if (outcome === 'REFUND') {
      if (pen) trustEvent(req.cardholderId, -25, 'Dispute lost', req.id);
      refund(req, pen, 'Dispute resolved: refund');
    } else if (outcome === 'RELEASE') {
      settle(req, 'Dispute resolved: released to cardholder');
    } else if (outcome === 'PARTIAL') {
      var held = escrowHeld(req), x = Core.r2(p.buyerAmount);
      if (!(x > 0 && x < held)) fail('Enter an amount between 0 and ' + held + '.');
      var plat = Math.min(req.feeSnapshot.platform, Core.r2(held - x)), rest = Core.r2(held - x - plat);
      var lines = [{ account: 'escrow', debit: held }, { account: 'external:buyer:' + req.buyerId, credit: x, kind: 'REFUND' }];
      if (plat) lines.push({ account: 'platform', credit: plat, kind: 'PLATFORM_FEE' });
      if (rest) lines.push({ account: 'holder:' + req.cardholderId, credit: rest, kind: 'CARDHOLDER_EARNING' });
      post(req, 'SETTLEMENT', lines, 'Dispute resolved: partial refund');
      go(byId('mkRequests', req.id), 'SETTLED', actor, 'partial');
      S.update('mkRequests', req.id, { settledAt: nowIso(), closedReason: 'Partial refund of ' + fmt(x) });
      notify(req.buyerId, 'Dispute decided', fmt(x) + ' is going back to you.', req.id);
      notify(req.cardholderId, 'Dispute decided', fmt(rest) + ' was released to your wallet.', req.id);
    } else fail('Choose an outcome.');
    S.update('mkDisputes', d.id, { status: 'RESOLVED', resolution: outcome, resolvedBy: actor, resolvedAt: nowIso(), adminNote: String(p.note || '') });
    audit(actor, 'resolve-dispute', 'dispute', d.id, { outcome: outcome });
    return {};
  };

  /* timers: expiry, no-shows, auto-confirm, delayed release */
  L.sweep = function () {
    var t = clock(), n = 0;
    col('mkRequests').slice().forEach(function (r0) {
      var r = byId('mkRequests', r0.id);
      try {
        if (r.status === 'PAID' && r.acceptBy && new Date(r.acceptBy).getTime() <= t) {
          go(r, 'EXPIRED', 'system', 'No cardholder accepted in time');
          refund(byId('mkRequests', r.id), 0, 'Nobody accepted in time');
          notify(r.buyerId, 'Request expired', 'No cardholder picked it up in time. ' + fmt(r.feeSnapshot.total) + ' has been refunded in full.', r.id);
          n++;
        } else if (r.status === 'ACCEPTED' && r.fulfilBy && new Date(r.fulfilBy).getTime() <= t) {
          releaseQuota(r);
          trustEvent(r.cardholderId, -10, 'No-show', r.id);
          refund(r, r.feeSnapshot.penalty, 'Cardholder did not deliver in time');
          notify(r.buyerId, 'Refunded in full', 'The cardholder did not deliver in time, so you were refunded.', r.id);
          n++;
        } else if (r.status === 'FULFILLED' && r.autoConfirmAt && new Date(r.autoConfirmAt).getTime() <= t && !(r.topupDue > 0)) {
          confirmNow(r, 'system'); n++;
        } else if (r.status === 'CONFIRMED') {
          if (settleIfDue(r).settled) n++;
        }
      } catch (e) { if (!(e instanceof Err)) throw e; }
    });
    return { changed: n };
  };

  /* ---------- cards, KYC, payouts, fees ---------- */
  L.saveCard = function (actor, p) {
    activeUser(actor);
    var bank = String(p.bank || '').trim(), variant = String(p.variant || '').trim();
    if (!bank) fail('Choose the bank.');
    if (variant.length < 2) fail('Enter the card variant, for example Regalia or Millennia.');
    var bens = (p.benefits || []).filter(function (b) { return Core.BENEFITS[b.kind]; }).map(function (b) {
      var o = { kind: b.kind, program: b.program || 'Bank' };
      if (Core.BENEFITS[b.kind].quota) {
        o.quota = Number(b.quota);
        if (!(o.quota >= 1 && o.quota <= 99)) fail('Enter how many lounge visits you get per quarter (1 to 99).');
        o.airports = (b.airports && b.airports.length) ? b.airports : ['ANY'];
      }
      if (b.note) o.note = String(b.note).slice(0, 120);
      return o;
    });
    if (!bens.length) fail('Add at least one benefit this card offers.');
    var row = { bank: bank, variant: variant, network: p.network || '', benefits: bens, active: true };
    if (p.id) {
      var ex = byId('mkCards', p.id);
      if (!ex || ex.ownerId !== actor) fail('Card not found.');
      S.update('mkCards', p.id, row);
      return { id: p.id };
    }
    row.id = rid('mkc'); row.ownerId = actor; row.createdAt = nowIso();
    S.insert('mkCards', row);
    return { id: row.id };
  };
  L.removeCard = function (actor, p) {
    var c = byId('mkCards', p.id);
    if (!c || c.ownerId !== actor) fail('Card not found.');
    if (col('mkRequests').some(function (r) { return r.cardId === c.id && ['ACCEPTED', 'FULFILLED', 'DISPUTED'].indexOf(r.status) > -1; })) fail('This card is being used on an open request.');
    S.remove('mkCards', c.id);
    return {};
  };

  L.submitKyc = function (actor, p) {
    activeUser(actor);
    var pan = String(p.pan || '').toUpperCase().trim();
    if (String(p.legalName || '').trim().length < 3) fail('Enter your name as on your PAN card.');
    if (!Core.valid.pan(pan)) fail('Enter a valid PAN, like ABCDE1234F.');
    var upi = String(p.upi || '').trim(), acct = String(p.account || '').trim(), ifsc = String(p.ifsc || '').toUpperCase().trim();
    if (upi) { if (!Core.valid.upi(upi)) fail('That UPI ID does not look right.'); }
    else if (!(Core.valid.account(acct) && Core.valid.ifsc(ifsc))) fail('Give a UPI ID, or a bank account number with its IFSC.');
    var row = { userId: actor, status: 'PENDING', legalName: String(p.legalName).trim(), pan: pan, upi: upi, account: acct, ifsc: ifsc, createdAt: nowIso(), reviewNote: '' };
    var ex = col('mkKyc').filter(function (k) { return k.userId === actor; })[0];
    if (ex) S.update('mkKyc', ex.id, row); else { row.id = rid('kyc'); S.insert('mkKyc', row); }
    return {};
  };
  L.reviewKyc = function (actor, p) {
    if (!isAdmin(actor)) fail('Only staff can review KYC.');
    var k = byId('mkKyc', p.id);
    if (!k) fail('KYC record not found.');
    if (['APPROVED', 'REJECTED'].indexOf(p.status) < 0) fail('Choose approve or reject.');
    S.update('mkKyc', k.id, { status: p.status, reviewNote: String(p.note || ''), reviewedAt: nowIso() });
    notify(k.userId, p.status === 'APPROVED' ? 'KYC approved' : 'KYC needs changes', p.status === 'APPROVED' ? 'You can now request payouts.' : (p.note || 'Please re-submit your details.'));
    audit(actor, 'kyc-' + p.status.toLowerCase(), 'kyc', k.id);
    return {};
  };

  L.requestPayout = function (actor, p) {
    activeUser(actor);
    var k = col('mkKyc').filter(function (x) { return x.userId === actor; })[0];
    if (!k || k.status !== 'APPROVED') fail('Complete KYC and wait for approval before your first payout.');
    var amt = Core.r2(p.amount);
    if (!(amt >= 100)) fail('The minimum payout is ₹100.');
    if (amt > L.available(actor)) fail('That is more than your available balance.');
    var row = { id: rid('pay'), userId: actor, amount: amt, method: k.upi ? 'UPI' : 'BANK', destination: k.upi || ('A/c ending ' + k.account.slice(-4)), status: 'REQUESTED', createdAt: nowIso() };
    S.insert('mkPayouts', row);
    return { payout: row };
  };
  L.available = function (userId) {
    var held = col('mkPayouts').filter(function (x) { return x.userId === userId && x.status === 'REQUESTED'; }).reduce(function (a, x) { return a + x.amount; }, 0);
    return Core.r2(balance('holder:' + userId) - held);
  };
  L.processPayout = function (actor, p) {
    if (!isAdmin(actor)) fail('Only staff can process payouts.');
    var x = byId('mkPayouts', p.id);
    if (!x || x.status !== 'REQUESTED') fail('This payout is already handled.');
    if (p.reject) {
      S.update('mkPayouts', x.id, { status: 'REJECTED', note: String(p.note || ''), processedAt: nowIso() });
      notify(x.userId, 'Payout not processed', String(p.note || 'Please contact support.'));
      return {};
    }
    if (x.amount > balance('holder:' + x.userId)) fail('The wallet no longer covers this payout.');
    post(null, 'PAYOUT', [{ account: 'holder:' + x.userId, debit: x.amount }, { account: 'external:payout:' + x.userId, credit: x.amount }], 'Payout ' + x.id);
    S.update('mkPayouts', x.id, { status: 'PAID', ref: 'TESTPAY-' + rid('r').slice(2).toUpperCase(), processedAt: nowIso() });
    notify(x.userId, 'Payout sent', fmt(x.amount) + ' was sent to ' + x.destination + ' (test mode, no real money moves).');
    audit(actor, 'payout', 'payout', x.id, { amount: x.amount });
    return {};
  };

  L.saveFee = function (actor, p) {
    if (!isAdmin(actor)) fail('Only staff can change fees.');
    var f = byId('mkFees', p.id);
    if (!f) fail('Fee not found.');
    var patch = {};
    Object.keys(p.patch || {}).forEach(function (k) {
      var v = p.patch[k];
      patch[k] = (['fee', 'feePct', 'minFee', 'platformAmt', 'platformPct', 'discount', 'cap', 'listValue', 'buyerPct', 'holderPct', 'acceptHours', 'confirmHours', 'penalty'].indexOf(k) > -1 && v !== '' && v !== null) ? Number(v) : v;
    });
    var bad = Core.validateFee(Object.assign({}, f, patch));
    if (bad) fail(bad);
    S.update('mkFees', f.id, patch);
    audit(actor, 'fee', 'fee', f.id, patch);
    return {};
  };

  /* ---------- chat and ratings ---------- */
  L.sendMessage = function (actor, p) {
    var req = byId('mkRequests', p.id);
    if (!req || !perm(actor, req)) fail('You are not part of this request.');
    if (!req.cardholderId) fail('Chat opens once a cardholder accepts.');
    if (['REFUNDED', 'CANCELLED', 'EXPIRED'].indexOf(req.status) > -1) fail('This request is closed.');
    var body = String(p.body || '').trim();
    if (!body) fail('Type a message first.');
    if (body.length > 500) fail('Keep messages under 500 characters.');
    var recent = col('mkMessages').filter(function (m) { return m.senderId === actor && clock() - new Date(m.createdAt).getTime() < 60000; }).length;
    if (recent >= 20) fail('You are sending messages too quickly.');
    S.insert('mkMessages', { id: rid('msg'), requestId: req.id, senderId: actor, body: Core.maskContact(body), createdAt: nowIso() });
    var other = actor === req.buyerId ? req.cardholderId : req.buyerId;
    if (other !== DEMO_HOLDER && !isAdmin(actor)) notify(other, 'New message', firstName(actor) + ': ' + Core.maskContact(body).slice(0, 80), req.id);
    return {};
  };

  L.rate = function (actor, p) {
    var req = byId('mkRequests', p.id);
    if (!req || !(req.buyerId === actor || req.cardholderId === actor)) fail('You are not part of this request.');
    if (req.status !== 'SETTLED') fail('You can rate once the request is complete.');
    var stars = Number(p.stars);
    if (!(stars >= 1 && stars <= 5)) fail('Choose 1 to 5 stars.');
    if (col('mkRatings').some(function (r) { return r.requestId === req.id && r.raterId === actor; })) fail('You already rated this one.');
    var ratee = actor === req.buyerId ? req.cardholderId : req.buyerId;
    S.insert('mkRatings', { id: rid('rat'), requestId: req.id, raterId: actor, rateeId: ratee, stars: stars, note: String(p.note || '').slice(0, 300), createdAt: nowIso() });
    return {};
  };

  L.banUser = function (actor, p) {
    if (!isAdmin(actor)) fail('Only staff can do that.');
    S.update('users', p.userId, { active: !p.ban });
    audit(actor, p.ban ? 'ban' : 'unban', 'user', p.userId);
    return {};
  };

  /* ============================================================
     PUBLIC API
     ============================================================ */
  function wrap(fn) {
    return new Promise(function (resolve) {
      try { resolve(Object.assign({ ok: true }, fn() || {})); }
      catch (e) { if (e instanceof Err) resolve({ ok: false, error: e.message }); else { console.error(e); resolve({ ok: false, error: 'Something went wrong. Please try again.' }); } }
    });
  }

  /* Supabase column names <-> the camelCase objects the pages use */
  function camel(row) {
    var o = {};
    Object.keys(row).forEach(function (k) { o[k.replace(/_([a-z])/g, function (m, c) { return c.toUpperCase(); })] = row[k]; });
    return o;
  }
  var TABLES = { mkRequests: 'mk_requests', mkCards: 'mk_cards', mkFees: 'mk_fee_config', mkLedger: 'mk_ledger', mkMessages: 'mk_messages',
    mkProofs: 'mk_proofs', mkDisputes: 'mk_disputes', mkRatings: 'mk_ratings', mkPayouts: 'mk_payouts', mkKyc: 'mk_kyc', mkTrust: 'mk_trust_events',
    mkQuota: 'mk_quota_use', mkAudit: 'mk_audit_log', mkOutbox: 'mk_outbox' };
  var remoteOpen = [];
  var remoteMember = {};

  Market.mode = function () { return sb ? 'supabase' : 'local'; };

  Market.init = function (client) {
    sb = client || null;
    COLS.forEach(col);
    if (!sb) L.ensure();
    else if (!col('mkFees').length) S.set('mkFees', Core.DEFAULT_FEES.map(function (f) { return Object.assign({}, f); }));
  };

  /* Pull the signed-in user's marketplace rows (everything, for staff). */
  Market.load = function (user) {
    if (!sb) { L.sweep(); return Promise.resolve(); }
    var u = user || w.CC.Auth.current();
    if (!u) return Promise.resolve();
    startLive(u);
    var jobs = Object.keys(TABLES).map(function (name) {
      return sb.from(TABLES[name]).select('*').then(function (r) {
        if (r.error) { return; }
        S.set(name, r.data.map(camel));
      });
    });
    jobs.push(sb.rpc('mk_sweep').then(function () {}, function () {}));
    jobs.push(sb.rpc('mk_open_requests').then(function (r) { remoteOpen = (r.data || []); }, function () {}));
    jobs.push(sb.from('mk_member').select('*').then(function (r) {

      (r.data || []).forEach(function (m) { remoteMember[m.user_id] = { name: m.display_name, trust: Number(m.trust), done: m.jobs_done }; });
    }, function () {}));
    return Promise.all(jobs).then(function () {});
  };

  var ACTIONS = ['create', 'cancel', 'accept', 'release', 'fulfil', 'confirm', 'denied', 'dispute', 'resolveDispute', 'saveCard', 'removeCard',
    'submitKyc', 'reviewKyc', 'requestPayout', 'processPayout', 'saveFee', 'sendMessage', 'rate', 'banUser', 'startPayment', 'topup'];

  /* One entry point for every write. */
  Market.do = function (action, params, asUser) {
    if (ACTIONS.indexOf(action) < 0) return Promise.resolve({ ok: false, error: 'Unknown action.' });
    if (!sb) {
      var actor = asUser || me();
      return wrap(function () { if (!actor) fail('Sign in to continue.'); return L[action](actor, params || {}); }).then(function (r) {
        w.dispatchEvent(new CustomEvent('cc:market'));
        return r;
      });
    }
    var rpc = 'mk_' + action.replace(/[A-Z]/g, function (m) { return '_' + m.toLowerCase(); });
    return sb.rpc(rpc, { p: params || {} }).then(function (r) {
      if (r.error) return { ok: false, error: friendly(r.error.message) };
      var out = r.data || { ok: true };
      if (out.ok === undefined) out.ok = true;
      return Market.load().then(function () { w.dispatchEvent(new CustomEvent('cc:market')); return out; });
    });
  };
  function friendly(msg) {
    if (/Could not find the function|schema cache/i.test(msg)) return 'The marketplace database is not set up yet. Run supabase/05_marketplace.sql in the Supabase SQL editor.';
    return msg;
  }

  /* Test checkout: create the order, then deliver the signed gateway event. */
  Market.pay = function (id, outcome, purpose) {
    return Market.do('startPayment', { id: id, purpose: purpose || 'ORDER' }).then(function (r) {
      if (!r.ok) return r;
      var ev = Market.buildTestEvent(r.order, outcome);
      if (!sb) return wrap(function () {
        var res = L.webhook(null, { body: ev.body, signature: ev.signature });
        w.dispatchEvent(new CustomEvent('cc:market'));
        return res;
      });
      return sb.rpc('mk_test_payment', { p: { order_id: r.order.orderId, outcome: outcome === 'fail' ? 'fail' : 'success' } }).then(function (x) {
        if (x.error) return { ok: false, error: friendly(x.error.message) };
        return Market.load().then(function () { w.dispatchEvent(new CustomEvent('cc:market')); return Object.assign({ ok: true }, x.data || {}); });
      });
    });
  };
  /* replays a payload to the webhook (used by tests and the local helper) */
  Market.webhook = function (body, signature) { return wrap(function () { return L.webhook(null, { body: body, signature: signature }); }); };

  /* ---------- reads ---------- */
  Market.fees = function () { return col('mkFees'); };
  Market.fee = function (module, subtype) { return Core.feeFor(col('mkFees'), module, subtype); };
  Market.request = function (id) { return byId('mkRequests', id); };
  Market.asBuyer = function (uid) {
    return col('mkRequests').filter(function (r) { return r.buyerId === uid; }).sort(byNewest);
  };
  Market.asHolder = function (uid) {
    return col('mkRequests').filter(function (r) { return r.cardholderId === uid; }).sort(byNewest);
  };
  Market.all = function () { return col('mkRequests').slice().sort(byNewest); };
  function byNewest(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }
  Market.cards = function (uid) { return col('mkCards').filter(function (c) { return c.ownerId === uid; }); };
  Market.card = function (id) { return byId('mkCards', id); };
  Market.openFor = function (uid) {
    if (!sb) return L.openFor(uid);
    var mine = Market.cards(uid);
    return remoteOpen.map(function (row) {
      var r = camel(row);
      var fits = mine.map(function (c) { return { card: c, fit: Core.cardFits(c, r, quotaUsed) }; });
      var ok = fits.filter(function (f) { return f.fit.ok; });
      return { request: r, cards: ok.map(function (f) { return f.card; }), eligible: ok.length > 0, why: ok.length ? '' : (fits[0] ? fits[0].fit.why : 'Add a card with this benefit') };
    });
  };
  Market.quotaLeft = function (card, ben, quarter) { return Core.quotaLeft(card, ben, quarter, quotaUsed); };
  Market.quotaUsed = quotaUsed;
  Market.ledgerFor = function (reqId) { return col('mkLedger').filter(function (e) { return e.requestId === reqId; }); };
  Market.messages = function (reqId) {
    return col('mkMessages').filter(function (m) { return m.requestId === reqId; }).sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  };
  Market.proofs = function (reqId) { return col('mkProofs').filter(function (p) { return p.requestId === reqId; }); };
  Market.dispute = function (reqId) { return col('mkDisputes').filter(function (d) { return d.requestId === reqId; })[0] || null; };
  Market.disputes = function () { return col('mkDisputes').slice().sort(byNewest); };
  Market.ratings = function (reqId) { return col('mkRatings').filter(function (r) { return r.requestId === reqId; }); };
  Market.kyc = function (uid) { return col('mkKyc').filter(function (k) { return k.userId === uid; })[0] || null; };
  Market.kycAll = function () { return col('mkKyc').slice(); };
  Market.payouts = function (uid) { return col('mkPayouts').filter(function (p) { return !uid || p.userId === uid; }).sort(byNewest); };
  Market.outbox = function () { return col('mkOutbox'); };
  Market.nameOf = function (id) { return remoteMember[id] ? remoteMember[id].name : nameOf(id); };
  Market.trust = function (uid) {
    if (sb && remoteMember[uid]) return remoteMember[uid].trust;
    var score = 50;
    col('mkRatings').forEach(function (r) { if (r.rateeId === uid) score += (r.stars - 3) * 5; });
    col('mkTrust').forEach(function (t) { if (t.userId === uid) score += t.delta; });
    return Math.max(0, Math.min(100, score));
  };
  Market.rating = function (uid) {
    var rs = col('mkRatings').filter(function (r) { return r.rateeId === uid; });
    return { count: rs.length, avg: rs.length ? rs.reduce(function (a, r) { return a + r.stars; }, 0) / rs.length : 0 };
  };
  Market.wallet = function (uid) {
    var rows = col('mkLedger').filter(function (e) { return e.account === 'holder:' + uid; });
    var bal = rows.reduce(function (a, e) { return a + e.credit - e.debit; }, 0);
    var earned = rows.filter(function (e) { return e.kind === 'REIMBURSEMENT' || e.kind === 'CARDHOLDER_EARNING'; }).reduce(function (a, e) { return a + e.credit; }, 0);
    var asked = col('mkPayouts').filter(function (x) { return x.userId === uid && x.status === 'REQUESTED'; }).reduce(function (a, x) { return a + x.amount; }, 0);
    var pending = col('mkRequests').filter(function (r) { return r.cardholderId === uid && ['ACCEPTED', 'FULFILLED', 'CONFIRMED', 'DISPUTED'].indexOf(r.status) > -1; })
      .reduce(function (a, r) { return a + r.feeSnapshot.reimbursement + r.feeSnapshot.holderFee; }, 0);
    return { balance: Core.r2(bal), available: Core.r2(bal - asked), earned: Core.r2(earned), pending: Core.r2(pending), asked: asked };
  };
  Market.balance = balance;
  Market.ledgerAll = function () { return col('mkLedger').slice(); };

  /* Revenue and volume by module and sub-type, from the ledger. */
  Market.report = function () {
    var out = {};
    var led = col('mkLedger');
    col('mkRequests').forEach(function (r) {
      var key = r.module + (r.subtype && r.subtype !== 'DEFAULT' ? ' / ' + r.subtype : '');
      var o = out[key] = out[key] || { key: key, requests: 0, settled: 0, refunded: 0, gmv: 0, platform: 0, penalties: 0, holders: 0 };
      o.requests++;
      if (r.status === 'SETTLED') { o.settled++; o.gmv += r.feeSnapshot.total; }
      if (r.status === 'REFUNDED') o.refunded++;
    });
    led.forEach(function (e) {
      var r = byId('mkRequests', e.requestId);
      if (!r) return;
      var key = r.module + (r.subtype && r.subtype !== 'DEFAULT' ? ' / ' + r.subtype : '');
      var o = out[key];
      if (e.kind === 'PLATFORM_FEE') o.platform += e.credit;
      if (e.kind === 'PENALTY') o.penalties += e.credit;
      if (e.kind === 'CARDHOLDER_EARNING') o.holders += e.credit;
    });
    return Object.keys(out).map(function (k) { return out[k]; });
  };
  Market.setClock = function (fn) { clock = fn || function () { return Date.now(); }; };
  Market.now = function () { return clock(); };

  /* Test tool (local mode): jump the clock forward so expiry and auto-confirm can be seen without waiting. */
  var OFFSET_KEY = 'cc.mk.offset';
  Market.advance = function (ms) {
    var off = (Number(localStorage.getItem(OFFSET_KEY)) || 0) + ms;
    try { localStorage.setItem(OFFSET_KEY, String(off)); } catch (e) {}
    clock = function () { return Date.now() + off; };
    return Market.sweep();
  };
  Market.resetClock = function () { try { localStorage.removeItem(OFFSET_KEY); } catch (e) {} clock = function () { return Date.now(); }; };
  (function () {
    var off = 0;
    try { off = Number(localStorage.getItem(OFFSET_KEY)) || 0; } catch (e) {}
    if (off) clock = function () { return Date.now() + off; };
  })();

  /* Drop the signed-in user's marketplace rows from this browser (Supabase mode only). */
  Market.clear = function () { stopLive(); if (sb) COLS.forEach(function (c) { S.set(c, []); }); remoteOpen = []; };

  /* ---------- live alerts for cardholders ---------- */
  var MUTE_KEY = 'cc.mk.mute', live = null, liveUser = null;
  Market.soundOn = function () { try { return localStorage.getItem(MUTE_KEY) !== '1'; } catch (e) { return true; } };
  Market.setSound = function (on) { try { localStorage.setItem(MUTE_KEY, on ? '0' : '1'); } catch (e) {} };
  Market.alertsState = function () { return w.Notification ? Notification.permission : 'unsupported'; };
  Market.askAlerts = function () {
    if (!w.Notification) return Promise.resolve('unsupported');
    return Promise.resolve(Notification.requestPermission());
  };
  function beep() {
    if (!Market.soundOn()) return;
    try {
      var Ctx = w.AudioContext || w.webkitAudioContext; if (!Ctx) return;
      var c = new Ctx(), o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.05; o.connect(g); g.connect(c.destination); o.start();
      setTimeout(function () { o.frequency.value = 1175; }, 120);
      setTimeout(function () { o.stop(); c.close(); }, 260);
    } catch (e) {}
  }
  /* toast + sound + desktop alert for a new "request you can fulfil" */
  function announce(n) {
    if (!n || String(n.type).indexOf('market:open:') !== 0) return;
    w.CC.UI.toast(n.title + ': ' + String(n.body).split('.')[0]);
    beep();
    try { if (w.Notification && Notification.permission === 'granted') new Notification(n.title, { body: n.body, tag: n.type }); } catch (e) {}
  }

  /* Supabase: a Realtime subscription on this user's notification rows. */
  function startLive(u) {
    if (!sb || !sb.channel || (live && liveUser === u.id)) return;
    stopLive(); liveUser = u.id;
    live = sb.channel('cc-notify-' + u.id).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + u.id }, function (p) {
        var n = camel(p.new || {});
        if (!n.id || col('notifications').some(function (x) { return x.id === n.id; })) return;
        S.get('notifications').unshift(n); S.commit();            // direct push: S.insert would write it back to Supabase
        w.dispatchEvent(new CustomEvent('cc:notify'));
        if (String(n.type).indexOf('market') === 0) Market.load().then(function () { w.dispatchEvent(new CustomEvent('cc:market')); });
        announce(n);
      }).subscribe();
  }
  function stopLive() { if (live && sb) { try { sb.removeChannel(live); } catch (e) {} } live = null; liveUser = null; }

  /* Local demo: another browser tab changed the saved data, so pick it up and announce anything new. */
  w.addEventListener('storage', function (e) {
    if (sb || e.key !== 'cardcrest.v1') return;
    var u = w.CC.Auth && w.CC.Auth.current(), seen = {};
    if (u) col('notifications').forEach(function (n) { if (n.userId === u.id) seen[n.id] = true; });
    S.reload();
    var now = w.CC.Auth && w.CC.Auth.current();
    if (now) col('notifications').filter(function (n) { return n.userId === now.id && !seen[n.id]; }).forEach(announce);
    w.dispatchEvent(new CustomEvent('cc:notify'));
    w.dispatchEvent(new CustomEvent('cc:market'));
  });
  Market.sweep = function () { return sb ? Market.load().then(function () { return { ok: true }; }) : wrap(function () { return L.sweep(); }); };

  /* ---------- proof files ---------- */
  /* Supabase: private bucket, signed links. Local: a small compressed copy kept in the browser. */
  Market.prepFile = function (file, requestId) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('Choose a file.'));
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return reject(new Error('Use a PNG, JPG or WebP image.'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('Images must be under 8 MB.'));
      shrink(file).then(function (blob) {
        if (sb) {
          var u = w.CC.Auth.current();
          var path = u.id + '/' + requestId + '/' + Date.now() + '-' + file.name.replace(/[^\w.-]/g, '_');
          return sb.storage.from('mk-proofs').upload(path, blob, { contentType: blob.type, upsert: false }).then(function (r) {
            if (r.error) return reject(new Error(r.error.message));
            resolve({ name: file.name, path: path });
          });
        }
        var fr = new FileReader();
        fr.onload = function () { resolve({ name: file.name, dataUrl: fr.result }); };
        fr.onerror = function () { reject(new Error('Could not read that file.')); };
        fr.readAsDataURL(blob);
      });
    });
  };
  function shrink(file) {
    return new Promise(function (resolve) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1400, s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b || file); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  Market.proofUrl = function (p) {
    if (p.dataUrl) return Promise.resolve(p.dataUrl);
    if (!sb || !p.path) return Promise.resolve('');
    return sb.storage.from('mk-proofs').createSignedUrl(p.path, 3600).then(function (r) { return r.data ? r.data.signedUrl : ''; });
  };

  Market._L = L;                       // exposed for the test page only
  w.CC.Market = Market;
})(window);
