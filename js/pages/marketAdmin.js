/* ============================================================
   Card Crest — pages/marketAdmin.js
   Admin sections for the marketplace: requests, disputes, KYC,
   fee config, payouts, revenue reports. Plugged into /admin by admin.js.
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, M = w.CC.Market, Core = w.CC.MarketCore;
  var money = UI.money, esc = UI.esc;

  var MA = { sections: [
    ['market', 'Marketplace'], ['mk-disputes', 'Disputes'], ['mk-kyc', 'KYC'],
    ['mk-fees', 'Fees'], ['mk-payouts', 'Payouts'], ['mk-reports', 'Revenue']
  ], views: {} };

  var STATUS_TONE = { SETTLED: 'ok', CONFIRMED: 'ok', PAID: 'info', ACCEPTED: 'warn', FULFILLED: 'warn', DISPUTED: 'danger', CREATED: 'grey', EXPIRED: 'grey', CANCELLED: 'grey', REFUNDED: 'grey' };
  function badge(s) { return '<span class="badge badge--' + (STATUS_TONE[s] || 'grey') + '">' + s.charAt(0) + s.slice(1).toLowerCase() + '</span>'; }
  function dt(iso) { return iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; }
  function table(head, rows, empty) {
    return '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl"><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.join('') : '<tr><td colspan="' + head.length + '" style="padding:40px; text-align:center" class="muted">' + empty + '</td></tr>') + '</tbody></table></div></div>';
  }
  function title(r) {
    var x = r.details || {};
    return r.module === 'LOUNGE' ? x.airport + ' ' + x.terminal + ' ' + String(x.type || '').toLowerCase() + ' lounge'
      : r.module === 'MOVIE' ? x.movie + ' (' + (x.offer === 'BOGO' ? 'BOGO' : '₹500 off') + ')' : r.module.charAt(0) + r.module.slice(1).toLowerCase() + ' on ' + x.platform;
  }
  var KEY_LABEL = { 'LOUNGE / DOMESTIC': 'Lounge · Domestic', 'LOUNGE / INTERNATIONAL': 'Lounge · International', 'MOVIE / BOGO': 'Movie · Buy one get one',
    'MOVIE / FLAT_500_OFF_2_SEATS': 'Movie · ₹500 off on 2 seats', ORDER: 'Order & Earn (old)', PAY: 'Order & Earn' };
  function keyLabel(k) { return KEY_LABEL[k] || k; }
  function stat(k, v, sub) { return '<div class="stat"><span class="stat__k">' + k + '</span><span class="stat__v">' + v + '</span><span class="stat__sub">' + sub + '</span></div>'; }

  /* ---------------- requests ---------------- */
  MA.views.market = function () {
    var all = M.all(), by = {};
    all.forEach(function (r) { by[r.status] = (by[r.status] || 0) + 1; });
    var open = all.filter(function (r) { return ['PAID', 'ACCEPTED', 'FULFILLED', 'CONFIRMED', 'DISPUTED'].indexOf(r.status) > -1; });
    var escrow = M.balance('escrow');
    return '<div class="grid g-4" style="margin-bottom:22px">' +
      stat('Requests', all.length, (by.SETTLED || 0) + ' completed') +
      stat('In progress', open.length, (by.PAID || 0) + ' waiting for a cardholder') +
      stat('Held in escrow', money(escrow), 'Buyers’ money not yet released') +
      stat('Disputes open', M.disputes().filter(function (x) { return x.status === 'OPEN'; }).length, '<a href="#/admin/mk-disputes">Review</a>') + '</div>' +
      '<input data-filter placeholder="Search requests, people or status" style="margin-bottom:14px; max-width:360px">' +
      table(['Request', 'Buyer', 'Cardholder', 'Status', 'Total', 'Created', ''], all.map(function (r) {
        return '<tr><td><strong>' + esc(title(r)) + '</strong><div class="small muted">' + r.module + ' · ' + esc(String(r.id).slice(-8)) + '</div></td><td>' + esc(M.nameOf(r.buyerId)) + '</td><td>' +
          (r.cardholderId ? esc(M.nameOf(r.cardholderId)) : '—') + '</td><td>' + badge(r.status) + '</td><td class="num">' + money(r.feeSnapshot.total) + '</td><td>' + dt(r.createdAt) +
          '</td><td style="text-align:right"><a class="btn btn--ghost btn--xs" href="#/market/r/' + r.id + '">Open</a></td></tr>';
      }), 'No marketplace requests yet.');
  };

  /* ---------------- disputes ---------------- */
  MA.views['mk-disputes'] = function () {
    var list = M.disputes();
    return '<p class="muted" style="margin-bottom:14px">Each decision moves money through the ledger. A refund returns the full escrow to the buyer, a release pays the cardholder, a split lets you choose what the buyer gets back.</p>' +
      table(['Request', 'Raised by', 'Reason', 'What they said', 'Status', ''], list.map(function (x) {
        var r = M.request(x.requestId);
        return '<tr><td>' + (r ? '<a href="#/market/r/' + r.id + '"><strong>' + esc(title(r)) + '</strong></a><div class="small muted">' + money(r.feeSnapshot.total) + '</div>' : '—') + '</td><td>' + esc(M.nameOf(x.raisedBy)) + '</td><td>' + esc(String(x.reason).replace(/_/g, ' ').toLowerCase()) +
          '</td><td style="max-width:280px">' + esc(x.note) + '</td><td>' + (x.status === 'OPEN' ? '<span class="badge badge--danger">Open</span>' : '<span class="badge badge--ok">' + esc(String(x.resolution || 'resolved').toLowerCase()) + '</span>') +
          '</td><td style="text-align:right">' + (x.status === 'OPEN' ? '<button class="btn btn--primary btn--xs" data-dsp="' + x.id + '">Decide</button>' : '') + '</td></tr>';
      }), 'No disputes.');
  };

  function decide(id) {
    var dsp = M.disputes().filter(function (x) { return x.id === id; })[0], r = M.request(dsp.requestId), held = M.balance('escrow');
    var reqHeld = M.ledgerFor(r.id).reduce(function (a, e) { return e.account === 'escrow' ? a + e.credit - e.debit : a; }, 0);
    UI.modal({
      title: 'Decide this dispute',
      body: '<p class="muted">' + esc(title(r)) + ' · ' + money(reqHeld) + ' in escrow</p><div class="note" style="margin:10px 0">' + esc(dsp.note) + '</div>' +
        '<div class="stack"><label class="check"><input type="radio" name="o" value="REFUND" checked> Refund the buyer in full</label>' +
        '<label class="check"><input type="radio" name="o" value="RELEASE"> Release to the cardholder</label>' +
        '<label class="check"><input type="radio" name="o" value="PARTIAL"> Split: refund part to the buyer</label></div>' +
        '<div class="field" id="amtBox" hidden style="margin-top:12px"><label for="amt">Amount back to the buyer (₹)</label><input id="amt" type="number" min="1" max="' + reqHeld + '"></div>' +
        '<label class="check" style="margin-top:12px"><input type="checkbox" id="pen"> Penalise the cardholder (' + money(r.feeSnapshot.penalty) + ' and a trust drop), for refunds</label>' +
        '<div class="field" style="margin-top:12px"><label for="an">Note to both sides</label><textarea id="an" rows="2" maxlength="300"></textarea></div><p class="err" id="de" style="color:var(--danger); font-size:.86rem; display:none"></p>',
      foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-go>Confirm decision</button>',
      onMount: function (m) {
        m.querySelectorAll('[name=o]').forEach(function (el) { el.onchange = function () { m.querySelector('#amtBox').hidden = m.querySelector('[name=o]:checked').value !== 'PARTIAL'; }; });
        m.querySelector('[data-go]').onclick = function () {
          var out = m.querySelector('[name=o]:checked').value, b = this; b.disabled = true;
          M.do('resolveDispute', { id: id, outcome: out, buyerAmount: m.querySelector('#amt').value, penalise: m.querySelector('#pen').checked, note: m.querySelector('#an').value }).then(function (res) {
            b.disabled = false;
            if (!res.ok) { var e = m.querySelector('#de'); e.textContent = res.error; e.style.display = 'block'; return; }
            UI.closeModal(); UI.toast('Dispute decided'); w.CC.Router.refresh();
          });
        };
      }
    });
  }

  /* ---------------- KYC ---------------- */
  MA.views['mk-kyc'] = function () {
    return table(['Member', 'Name on PAN', 'PAN', 'Payout to', 'Status', ''], M.kycAll().filter(function (k) { return k.userId !== M.DEMO_HOLDER; }).map(function (k) {
      return '<tr><td>' + esc(M.nameOf(k.userId)) + '</td><td>' + esc(k.legalName) + '</td><td class="mono">' + esc(k.pan) + '</td><td>' + (k.upi ? esc(k.upi) : 'A/c ' + esc(k.account) + ' · ' + esc(k.ifsc)) + '</td>' +
        '<td><span class="badge badge--' + (k.status === 'APPROVED' ? 'ok' : k.status === 'REJECTED' ? 'danger' : 'warn') + '">' + k.status.charAt(0) + k.status.slice(1).toLowerCase() + '</span></td>' +
        '<td style="text-align:right; white-space:nowrap">' + (k.status !== 'APPROVED' ? '<button class="btn btn--primary btn--xs" data-kyc="' + k.id + '" data-s="APPROVED">Approve</button> ' : '') +
        (k.status !== 'REJECTED' ? '<button class="btn btn--danger btn--xs" data-kyc="' + k.id + '" data-s="REJECTED">Reject</button>' : '') + '</td></tr>';
    }), 'No KYC submissions yet.');
  };

  /* ---------------- fees ---------------- */
  MA.views['mk-fees'] = function () {
    return '<div class="note" style="margin-bottom:16px">Changes apply to <strong>new</strong> requests only. Every request keeps the price and split it was booked at.</div>' +
      table(['Option', 'Price', 'Platform share', 'Cardholder share', 'Windows', ''], M.fees().map(function (f) {
        var pr, pl, ch;
        if (f.mode === 'SPLIT') { pr = (f.module === 'LOUNGE' ? 'Usual price ' + money(f.listValue) + '<br>' : '') + 'Buyer keeps ' + f.buyerPct + '%'; pl = f.platformPct + '% of the discount'; ch = f.holderPct + '% of the discount'; }
        else if (f.mode === 'FIXED') { pr = (f.module === 'LOUNGE' && f.listValue ? 'Usual price ' + money(f.listValue) + '<br>Buyer pays ' : '') + money(f.fee) + (f.module === 'LOUNGE' ? '' : ' fee'); pl = money(f.platformAmt); ch = money(f.fee - f.platformAmt); }
        else { pr = f.feePct + '% (min ' + money(f.minFee) + ')'; pl = f.platformPct + '% of fee'; ch = (100 - f.platformPct) + '% of fee'; }
        return '<tr><td><strong>' + esc(f.label) + '</strong><div class="small muted">' + f.module + ' · ' + esc(f.subtype) + (f.active === false ? ' · off' : '') + '</div></td><td>' + pr + (f.discount ? '<div class="small muted">Discount ' + money(f.discount) + '</div>' : '') + '</td><td>' + pl + '</td><td>' + ch +
          '</td><td class="small">Accept ' + f.acceptHours + ' h<br>Confirm ' + f.confirmHours + ' h<br>Penalty ' + money(f.penalty) + '</td><td style="text-align:right"><button class="btn btn--ghost btn--xs" data-fee="' + f.id + '">Edit</button></td></tr>';
      }), 'No fee configuration.');
  };

  function feeEditor(id) {
    var f = M.fees().filter(function (x) { return x.id === id; })[0];
    function num(k, label, hint) { return '<div class="field"><label for="f-' + k + '">' + label + '</label><input id="f-' + k + '" type="number" step="any" value="' + (f[k] == null ? '' : f[k]) + '">' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'; }
    UI.modal({
      title: f.label, wide: true,
      body: '<div class="form-grid">' + (f.mode === 'SPLIT'
        ? (f.module === 'LOUNGE' ? num('listValue', 'Usual lounge entry price (₹)', 'The value the card benefit waives. The buyer pays this minus their share.') : '') + num('buyerPct', 'Buyer keeps (% of the discount)') + num('holderPct', 'Cardholder gets (%)') + num('platformPct', 'Platform gets (%)')
        : f.mode === 'FIXED'
        ? (f.module === 'LOUNGE' ? num('listValue', 'Usual lounge entry price (₹)', 'Shown to the buyer as their saving.') : '') + num('fee', 'Price to the buyer for the service (₹)', f.module === 'LOUNGE' ? 'The whole lounge price.' : 'Service fee added on top of the ticket amount.') + num('platformAmt', 'Platform share (₹)', 'The rest goes to the cardholder.')
        : num('feePct', 'Fee (% of the price after the offer)') + num('minFee', 'Minimum fee (₹)') + num('platformPct', 'Platform share (% of the fee)')) +
        (f.module === 'MOVIE' && f.subtype === 'FLAT_500_OFF_2_SEATS' ? num('discount', 'Flat discount (₹)') : '') +
        (f.module === 'MOVIE' && f.subtype === 'BOGO' ? num('cap', 'Discount cap (₹, 0 = none)') : '') +
        num('acceptHours', 'Hours for a cardholder to accept') + num('confirmHours', 'Hours before auto-confirm') + num('penalty', 'No-show or denial penalty (₹)') + '</div>' +
        '<label class="check" style="margin-top:8px"><input type="checkbox" id="f-active"' + (f.active === false ? '' : ' checked') + '> Available to buyers</label><p class="err" id="f-err" style="color:var(--danger); font-size:.86rem; display:none"></p>',
      foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-go>Save</button>',
      onMount: function (m) {
        m.querySelector('[data-go]').onclick = function () {
          var patch = { active: m.querySelector('#f-active').checked }, b = this;
          ['fee', 'platformAmt', 'feePct', 'minFee', 'platformPct', 'listValue', 'buyerPct', 'holderPct', 'discount', 'cap', 'acceptHours', 'confirmHours', 'penalty'].forEach(function (k) { var el = m.querySelector('#f-' + k); if (el) patch[k] = el.value; });
          b.disabled = true;
          M.do('saveFee', { id: id, patch: patch }).then(function (res) {
            b.disabled = false;
            if (!res.ok) { var e = m.querySelector('#f-err'); e.textContent = res.error; e.style.display = 'block'; return; }
            UI.closeModal(); UI.toast('Fee saved. New requests use it from now.'); w.CC.Router.refresh();
          });
        };
      }
    });
  }

  /* ---------------- payouts ---------------- */
  MA.views['mk-payouts'] = function () {
    return '<div class="note" style="margin-bottom:16px">Test mode: marking a payout as paid writes the ledger entry but sends no real money. Live payouts go through the gateway’s payout API.</div>' +
      table(['Member', 'To', 'Requested', 'Status', 'Amount', ''], M.payouts().map(function (p) {
        return '<tr><td>' + esc(M.nameOf(p.userId)) + '</td><td>' + esc(p.destination) + '</td><td>' + dt(p.createdAt) + '</td><td><span class="badge badge--' + (p.status === 'PAID' ? 'ok' : p.status === 'REJECTED' ? 'danger' : 'warn') + '">' + p.status.charAt(0) + p.status.slice(1).toLowerCase() + '</span>' + (p.ref ? '<div class="small muted">' + esc(p.ref) + '</div>' : '') + '</td><td class="num"><strong>' + money(p.amount) + '</strong></td>' +
          '<td style="text-align:right; white-space:nowrap">' + (p.status === 'REQUESTED' ? '<button class="btn btn--primary btn--xs" data-pay="' + p.id + '">Mark paid</button> <button class="btn btn--danger btn--xs" data-pay-no="' + p.id + '">Reject</button>' : '') + '</td></tr>';
      }), 'No payouts requested.');
  };

  /* ---------------- revenue ---------------- */
  MA.views['mk-reports'] = function () {
    var rep = M.report(), led = M.ledgerAll();
    var tot = rep.reduce(function (a, r) { a.gmv += r.gmv; a.platform += r.platform; a.pen += r.penalties; a.holders += r.holders; return a; }, { gmv: 0, platform: 0, pen: 0, holders: 0 });
    var dr = led.reduce(function (a, e) { return a + e.debit; }, 0), cr = led.reduce(function (a, e) { return a + e.credit; }, 0);
    var live = M.all().filter(function (r) { return ['PAID', 'ACCEPTED', 'FULFILLED', 'CONFIRMED', 'DISPUTED'].indexOf(r.status) > -1; })
      .reduce(function (a, r) { return a + r.feeSnapshot.total + (r.topupPaid || 0); }, 0);
    var escrow = M.balance('escrow'), okEsc = Math.abs(escrow - live) < 0.01, okBal = Math.abs(dr - cr) < 0.01;
    var head = '<div class="grid g-4" style="margin-bottom:22px">' + stat('Platform revenue', money(tot.platform + tot.pen), money(tot.platform) + ' fees + ' + money(tot.pen) + ' penalties') +
      stat('Completed volume', money(tot.gmv), 'Total paid by buyers') + stat('Paid to cardholders', money(tot.holders), 'Earnings, excluding reimbursements') + stat('Outbox queue', M.outbox().filter(function (o) { return o.status === 'QUEUED'; }).length, 'Emails and WhatsApp waiting for a sender') + '</div>' +
      table(['Module / type', 'Requests', 'Completed', 'Refunded', 'Volume', 'Platform fees', 'Penalties', 'Cardholder earnings'], rep.map(function (r) {
        return '<tr><td style="white-space:nowrap"><strong>' + esc(keyLabel(r.key)) + '</strong></td><td>' + r.requests + '</td><td>' + r.settled + '</td><td>' + r.refunded + '</td><td class="num">' + money(r.gmv) + '</td><td class="num">' + money(r.platform) + '</td><td class="num">' + money(r.penalties) + '</td><td class="num">' + money(r.holders) + '</td></tr>';
      }), 'No activity yet.') +
      '<h3 class="h3" style="margin:22px 0 10px">Ledger health</h3><div class="grid g-2">' +
      '<div class="note' + (okBal ? '' : ' note--warn') + '"><strong>' + (okBal ? 'Balanced' : 'Out of balance') + '.</strong> Debits ' + money(dr) + ' and credits ' + money(cr) + ' across ' + led.length + ' entries.</div>' +
      '<div class="note' + (okEsc ? '' : ' note--warn') + '"><strong>' + (okEsc ? 'Escrow matches' : 'Escrow mismatch') + '.</strong> Escrow holds ' + money(escrow) + ', open requests account for ' + money(live) + '.</div></div>';
    /* ---- more to look at: where requests stand, where the money comes from, who is doing the work ---- */
    var all = M.all(), byStatus = {};
    all.forEach(function (r) { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    var TONE = { SETTLED: 'var(--leaf)', CONFIRMED: 'var(--leaf)', PAID: 'var(--info)', ACCEPTED: 'var(--warn)', FULFILLED: 'var(--warn)', DISPUTED: 'var(--danger)', CREATED: 'var(--line)', EXPIRED: 'var(--line)', CANCELLED: 'var(--line)', REFUNDED: 'var(--muted)' };
    function bars(rows, fmt) {
      var peak = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
      return rows.length ? rows.map(function (r) {
        return '<div style="margin-bottom:14px"><div class="spread small" style="margin-bottom:6px"><span>' + esc(r[0]) + '</span><strong style="white-space:nowrap">' + fmt(r[1]) + '</strong></div>' +
          '<div class="progress"><div class="progress__b" style="width:' + Math.max(2, (r[1] / peak) * 100).toFixed(0) + '%; background:' + (r[2] || 'var(--leaf)') + '"></div></div></div>';
      }).join('') : '<p class="muted small">Nothing yet.</p>';
    }
    var statusRows = Object.keys(byStatus).sort(function (a, b) { return byStatus[b] - byStatus[a]; }).map(function (k) { return [k.charAt(0) + k.slice(1).toLowerCase(), byStatus[k], TONE[k]]; });
    var revRows = rep.map(function (r) { return [keyLabel(r.key), r.platform + r.penalties]; }).filter(function (r) { return r[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });

    var holders = {}, buyers = {};
    led.forEach(function (e) {
      if (e.kind === 'CARDHOLDER_EARNING' && /^holder:/.test(e.account)) { var h = e.account.slice(7); holders[h] = (holders[h] || 0) + e.credit; }
    });
    all.forEach(function (r) {
      if (r.status !== 'SETTLED') return;
      var b = buyers[r.buyerId] = buyers[r.buyerId] || { spend: 0, n: 0 }; b.spend += r.feeSnapshot.total; b.n++;
    });
    function top(map, valueOf) { return Object.keys(map).map(function (k) { return [k, valueOf(map[k])]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5); }
    var holderRows = top(holders, function (v) { return v; }).map(function (r) {
      var jobs = M.asHolder(r[0]).filter(function (x) { return x.status === 'SETTLED'; }).length;
      return '<tr><td>' + esc(M.nameOf(r[0])) + '</td><td>' + jobs + '</td><td>' + M.trust(r[0]) + '</td><td class="num"><strong>' + money(r[1]) + '</strong></td></tr>';
    });
    var buyerRows = top(buyers, function (v) { return v.spend; }).map(function (r) {
      return '<tr><td>' + esc(M.nameOf(r[0])) + '</td><td>' + buyers[r[0]].n + '</td><td class="num"><strong>' + money(r[1]) + '</strong></td></tr>';
    });
    function who(acct) {
      if (/^holder:/.test(acct)) return 'Cardholder ' + M.nameOf(acct.slice(7));
      if (/^external:buyer:/.test(acct)) return 'Buyer ' + M.nameOf(acct.slice(15));
      if (/^external:payout:/.test(acct)) return 'Payout to ' + M.nameOf(acct.slice(16));
      return acct === 'escrow' ? 'Escrow' : acct === 'platform' ? 'Card Crest' : acct;
    }
    var recent = led.slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); }).slice(0, 10).map(function (e) {
      return '<tr><td class="muted" style="white-space:nowrap">' + dt(e.at) + '</td><td><span class="badge badge--grey">' + esc(String(e.kind).replace(/_/g, ' ').toLowerCase()) + '</span></td>' +
        '<td>' + esc(who(e.account)) + '</td><td class="num">' + (e.debit ? '<span style="color:var(--danger)">\u2212' + money(e.debit) + '</span>' : '') + '</td><td class="num">' + (e.credit ? '<span style="color:var(--leaf)">+' + money(e.credit) + '</span>' : '') + '</td></tr>';
    });
    var more = '<div class="grid g-2" style="margin-top:26px">' +
      '<div class="panel"><h3 class="h3" style="margin-bottom:16px">Requests by status</h3>' + bars(statusRows, function (v) { return v; }) + '</div>' +
      '<div class="panel"><h3 class="h3" style="margin-bottom:16px">Card Crest revenue by service</h3>' + bars(revRows, money) + '<p class="small muted">Fees kept on completed requests, plus penalties.</p></div></div>' +
      '<div class="grid g-2" style="margin-top:22px"><div><h3 class="h3" style="margin-bottom:10px">Top cardholders</h3>' + table(['Cardholder', 'Tasks done', 'Trust', 'Earned'], holderRows, 'No earnings yet.') + '</div>' +
      '<div><h3 class="h3" style="margin-bottom:10px">Top buyers</h3>' + table(['Buyer', 'Completed', 'Spent'], buyerRows, 'No completed requests yet.') + '</div></div>' +
      '<h3 class="h3" style="margin:26px 0 10px">Latest ledger entries</h3>' + table(['When', 'Type', 'Account', 'Out', 'In'], recent, 'No money has moved yet.');
    return head + more;
  };

  /* ---------------- events ---------------- */
  MA.bind = function (root) {
    root.querySelectorAll('[data-dsp]').forEach(function (b) { b.onclick = function () { decide(b.dataset.dsp); }; });
    root.querySelectorAll('[data-fee]').forEach(function (b) { b.onclick = function () { feeEditor(b.dataset.fee); }; });
    root.querySelectorAll('[data-kyc]').forEach(function (b) {
      b.onclick = function () {
        var status = b.dataset.s;
        UI.modal({ title: status === 'APPROVED' ? 'Approve KYC' : 'Reject KYC', body: '<div class="field"><label for="kn">Note to the member' + (status === 'REJECTED' ? ' (what to fix)' : ' (optional)') + '</label><input id="kn" maxlength="200"></div>',
          foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn ' + (status === 'APPROVED' ? 'btn--primary' : 'btn--danger') + '" data-go>' + (status === 'APPROVED' ? 'Approve' : 'Reject') + '</button>',
          onMount: function (m) { m.querySelector('[data-go]').onclick = function () {
            M.do('reviewKyc', { id: b.dataset.kyc, status: status, note: m.querySelector('#kn').value }).then(function (r) { if (!r.ok) UI.toast(r.error, 'error'); else { UI.closeModal(); UI.toast('KYC ' + status.toLowerCase()); w.CC.Router.refresh(); } }); }; } });
      };
    });
    root.querySelectorAll('[data-pay]').forEach(function (b) {
      b.onclick = function () { M.do('processPayout', { id: b.dataset.pay }).then(function (r) { if (!r.ok) UI.toast(r.error, 'error'); else { UI.toast('Payout marked as paid (test mode)'); w.CC.Router.refresh(); } }); };
    });
    root.querySelectorAll('[data-pay-no]').forEach(function (b) {
      b.onclick = function () { M.do('processPayout', { id: b.dataset.payNo, reject: true, note: 'Please check your payout details and request again.' }).then(function (r) { if (!r.ok) UI.toast(r.error, 'error'); else { UI.toast('Payout rejected'); w.CC.Router.refresh(); } }); };
    });
  };

  w.CC.MarketAdmin = MA;
})(window, document);
