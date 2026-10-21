/* ============================================================
   Card Crest — pages/adminPlus.js
   Staff tools on top of the base admin panel:
   - an attention queue and live numbers on the overview
   - Reward approvals: confirm or reject cashback, pay or reject redemptions, approve referral rewards
   - transaction summary, status filters and CSV export
   - announcements to users
   - an activity log of what staff changed
   Plugged into /admin by admin.js. Staff sign in on the normal login page and land here.
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, S = w.CC.Store, Auth = w.CC.Auth, CB = w.CC.Cashback, RW = w.CC.Rewards, RF = w.CC.Referrals,
      O = w.CC.Offers, AP = w.CC.Applications, SP = w.CC.Support, N = w.CC.Notifications;
  var money = UI.money, esc = UI.esc;

  var AX = { first: true, sections: [['approvals', 'Reward approvals'], ['announce', 'Announcements'], ['activity', 'Activity log']], views: {} };

  /* ---------------- helpers ---------------- */
  var OPEN_TXN = ['clicked', 'tracked', 'pending'];
  function users() { return S.get('users').filter(function (u) { return u.role !== 'admin'; }); }
  function userName(id) { var u = S.find('users', id); return u ? u.name : 'Member'; }
  function storeName(id) { var s = O.store(id); return s ? s.name : '-'; }
  function ago(iso) { return UI.ago(iso); }
  function table(head, rows, empty) {
    return '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl"><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.join('') : '<tr><td colspan="' + head.length + '" style="padding:34px; text-align:center" class="muted">' + empty + '</td></tr>') + '</tbody></table></div></div>';
  }
  function stat(k, v, sub, accent) {
    return '<div class="stat' + (accent ? ' stat--accent' : '') + '"><span class="stat__k">' + k + '</span><span class="stat__v" style="white-space:nowrap">' + v + '</span><span class="stat__sub">' + sub + '</span></div>';
  }
  function csv(name, head, rows) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var text = [head].concat(rows).map(function (r) { return r.map(q).join(','); }).join('\r\n');
    var a = d.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    d.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------------- activity log (kept in this browser) ---------------- */
  function col(n) { var a = S.get(n); if (!a) { a = []; S.set(n, a); } return a; }
  function log(action, text) {
    var me = Auth.current();
    col('adminLog').unshift({ id: S.uid('log'), at: new Date().toISOString(), by: me ? me.name : 'Staff', action: action, text: text });
    if (S.get('adminLog').length > 400) S.get('adminLog').length = 400;
    S.commit();
  }
  AX.log = log;
  AX.counts = function () { return counts(); };
  /* every change staff make while in the admin area is written to the log */
  (function watch() {
    var WATCH = { transactions: 'Transaction', redemptions: 'Redemption', applications: 'Application', referrals: 'Referral', tickets: 'Ticket', users: 'User',
                  cards: 'Card', stores: 'Store', offers: 'Offer' };
    var update = S.update;
    S.update = function (colName, id, patch) {
      var row = update.apply(S, arguments);
      try {
        if (WATCH[colName] && location.hash.indexOf('#/admin') === 0 && Auth.isAdmin()) {
          var keys = Object.keys(patch || {}).filter(function (k) { return k !== 'updatedAt'; });
          var what = patch && patch.status ? 'set to ' + patch.status : patch && 'active' in patch ? (patch.active ? 'enabled' : 'disabled') : 'edited (' + keys.join(', ') + ')';
          log(WATCH[colName], WATCH[colName] + ' ' + String(id).slice(-8) + ' ' + what);
        }
      } catch (e) {}
      return row;
    };
  })();

  /* ---------------- overview: attention queue + live numbers ---------------- */
  function counts() {
    var M = w.CC.Market;
    return {
      cashback: S.get('transactions').filter(function (t) { return OPEN_TXN.indexOf(t.status) > -1; }),
      redemptions: S.get('redemptions').filter(function (r) { return r.status === 'requested' || r.status === 'processing'; }),
      referrals: S.get('referrals').filter(function (r) { return r.status === 'pending'; }),
      apps: S.get('applications').filter(function (a) { return ['applied', 'under-review', 'documents'].indexOf(a.status) > -1; }),
      tickets: S.get('tickets').filter(function (t) { return t.status !== 'resolved'; }),
      disputes: M ? M.disputes().filter(function (x) { return x.status === 'OPEN'; }) : [],
      kyc: M ? M.kycAll().filter(function (k) { return k.status === 'PENDING' && k.userId !== M.DEMO_HOLDER; }) : [],
      payouts: M ? M.payouts().filter(function (p) { return p.status === 'REQUESTED'; }) : []
    };
  }

  AX.views.overview = function (prev) {
    var c = counts(), M = w.CC.Market, me = Auth.current();
    var sum = function (a, f) { return a.reduce(function (x, r) { return x + f(r); }, 0); };
    var cbAmt = sum(c.cashback, function (t) { return t.cashback; }), rdAmt = sum(c.redemptions, function (r) { return r.amount; });
    var queue = [
      ['Cashback to confirm', c.cashback.length, money(cbAmt) + ' waiting', '#/admin/approvals'],
      ['Redemption requests', c.redemptions.length, money(rdAmt) + ' to pay out', '#/admin/approvals'],
      ['Referral rewards', c.referrals.length, 'waiting for approval', '#/admin/approvals'],
      ['Card applications', c.apps.length, 'to review', '#/admin/applications'],
      ['Support tickets', c.tickets.length, 'not resolved', '#/admin/support'],
      ['Marketplace disputes', c.disputes.length, 'to decide', '#/admin/mk-disputes'],
      ['Cardholder KYC', c.kyc.length, 'to verify', '#/admin/mk-kyc'],
      ['Payout requests', c.payouts.length, money(sum(c.payouts, function (p) { return p.amount; })) + ' to send', '#/admin/mk-payouts']
    ];
    var todo = queue.reduce(function (a, r) { return a + r[1]; }, 0);

    var mk = M ? M.all() : [], rep = M ? M.report() : [];
    var mkRev = rep.reduce(function (a, r) { return a + r.platform + r.penalties; }, 0);
    var live = mk.filter(function (r) { return ['PAID', 'ACCEPTED', 'FULFILLED', 'CONFIRMED', 'DISPUTED'].indexOf(r.status) > -1; });
    var week = Date.now() - 7 * 86400000;
    var newUsers = users().filter(function (u) { return new Date(u.joined || 0).getTime() > week; }).length;
    var tx = S.get('transactions'), todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    var txToday = tx.filter(function (t) { return new Date(t.createdAt) >= todayStart; });

    var events = []
      .concat(tx.map(function (t) { return { at: t.createdAt, what: userName(t.userId) + ' started a ' + storeName(t.storeId) + ' order (' + money(t.amount) + ')', tag: t.status }; }))
      .concat(S.get('redemptions').map(function (r) { return { at: r.createdAt, what: userName(r.userId) + ' asked to redeem ' + money(r.amount) + ' by ' + r.method, tag: r.status }; }))
      .concat(S.get('applications').map(function (a) { return { at: a.createdAt, what: userName(a.userId) + ' applied for a card', tag: a.status }; }))
      .concat(mk.map(function (r) { return { at: r.createdAt, what: userName(r.buyerId) + ' made a ' + String(r.module).toLowerCase() + ' request (' + money(r.feeSnapshot.total) + ')', tag: r.status.toLowerCase() }; }))
      .sort(function (a, b) { return new Date(b.at) - new Date(a.at); }).slice(0, 8);

    return '<div class="panel" style="margin-bottom:20px; background:linear-gradient(135deg,var(--crest),var(--leaf)); color:#fff; border:0">' +
        '<div class="spread" style="gap:14px; flex-wrap:wrap"><div><div style="opacity:.8; font-size:.8rem">Welcome back, ' + esc(me ? me.name.split(' ')[0] : 'team') + '</div>' +
        '<h3 class="h2" style="color:#fff; margin-top:2px">' + (todo ? todo + ' things need your attention' : 'You are all caught up') + '</h3></div>' +
        '<a class="btn btn--sm" style="background:#fff; color:var(--crest)" href="#/admin/approvals">Open reward approvals</a></div></div>' +

      '<div class="adm-queue">' + queue.map(function (q) {
        return '<a class="adm-q' + (q[1] ? ' has' : '') + '" href="' + q[3] + '"><span class="adm-q__n">' + q[1] + '</span><span class="adm-q__t"><strong>' + q[0] + '</strong><small>' + q[2] + '</small></span></a>';
      }).join('') + '</div>' +

      '<div class="grid g-4" style="margin:22px 0">' +
        stat('Transactions', tx.length, txToday.length + ' today') +
        stat('New users', newUsers, 'Joined in the last 7 days') +
        stat('Share & Earn requests', mk.length, live.length + ' in progress') +
        stat('Share & Earn revenue', money(mkRev), 'Fees and penalties kept', true) +
      '</div>' +

      '<div class="panel" style="margin-bottom:22px"><h3 class="h3" style="margin-bottom:12px">Latest activity</h3>' +
      (events.length ? events.map(function (e) {
        return '<div class="spread" style="padding:9px 0; border-bottom:1px solid var(--line-soft); gap:12px"><span>' + esc(e.what) + '</span>' +
          '<span class="small muted" style="white-space:nowrap">' + UI.ago(e.at) + ' &middot; ' + esc(e.tag) + '</span></div>';
      }).join('') : '<p class="muted small">Nothing yet.</p>') + '</div>' +
      (prev ? prev() : '');
  };

  /* ---------------- reward approvals ---------------- */
  AX.views.approvals = function () {
    var c = counts();
    var cbRows = c.cashback.slice().sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); }).map(function (t) {
      return '<tr><td><input type="checkbox" data-pick="' + t.id + '" aria-label="Select"></td><td class="mono small" style="white-space:nowrap">' + esc(String(t.id).slice(-10)) + '</td>' +
        '<td style="white-space:nowrap">' + esc(userName(t.userId)) + '<div class="small muted">' + ago(t.createdAt) + '</div></td><td style="white-space:nowrap">' + esc(storeName(t.storeId)) + '</td>' +
        '<td class="num">' + money(t.amount) + '</td><td class="num"><strong>' + money(t.cashback) + '</strong></td><td>' + UI.statusBadge(t.status) + '</td>' +
        '<td style="white-space:nowrap; text-align:right"><button class="btn btn--primary btn--xs" data-cb="confirmed" data-id="' + t.id + '">Confirm</button> ' +
        '<button class="btn btn--danger btn--xs" data-cb="rejected" data-id="' + t.id + '">Reject</button></td></tr>';
    });
    var rdRows = c.redemptions.map(function (r) {
      return '<tr><td class="mono small">' + esc(r.ref) + '</td><td>' + esc(userName(r.userId)) + '</td><td class="muted">' + ago(r.createdAt) + '</td>' +
        '<td>' + esc(r.method) + '<div class="small muted">' + esc(r.destination || '') + '</div></td><td class="num"><strong>' + money(r.amount) + '</strong></td><td>' + UI.statusBadge(r.status) + '</td>' +
        '<td style="white-space:nowrap; text-align:right"><button class="btn btn--primary btn--xs" data-rd="completed" data-id="' + r.id + '">Mark paid</button> ' +
        '<button class="btn btn--danger btn--xs" data-rd="rejected" data-id="' + r.id + '">Reject</button></td></tr>';
    });
    var rfRows = c.referrals.map(function (r) {
      return '<tr><td>' + esc(userName(r.userId)) + '</td><td>' + esc(r.name) + '</td><td class="muted">' + ago(r.createdAt) + '</td><td class="num">' + (r.reward ? money(r.reward) : '-') + '</td>' +
        '<td style="white-space:nowrap; text-align:right"><button class="btn btn--primary btn--xs" data-rf="successful" data-id="' + r.id + '">Approve reward</button> ' +
        '<button class="btn btn--danger btn--xs" data-rf="rejected" data-id="' + r.id + '">Reject</button></td></tr>';
    });
    var done = S.get('transactions').filter(function (t) { return t.status === 'confirmed'; });
    return '<div class="grid g-4" style="margin-bottom:22px">' +
        stat('Cashback to confirm', c.cashback.length, money(c.cashback.reduce(function (a, t) { return a + t.cashback; }, 0)) + ' in total', true) +
        stat('Redemptions waiting', c.redemptions.length, money(c.redemptions.reduce(function (a, r) { return a + r.amount; }, 0)) + ' to pay') +
        stat('Referral rewards', c.referrals.length, 'waiting for approval') +
        stat('Confirmed so far', done.length, money(done.reduce(function (a, t) { return a + t.cashback; }, 0)) + ' paid into wallets') + '</div>' +

      '<div class="spread" style="margin-bottom:10px; gap:12px; flex-wrap:wrap"><h3 class="h3">Cashback awaiting confirmation</h3>' +
      '<div class="row row--wrap" style="gap:8px"><button class="btn btn--ghost btn--xs" id="pickAll">Select all</button>' +
      '<button class="btn btn--primary btn--xs" id="confirmPicked">Confirm selected</button></div></div>' +
      '<div class="note" style="margin-bottom:12px">Confirm once the store or affiliate network has confirmed the order. The user is told right away and the cashback joins their available balance.</div>' +
      table(['', 'Reference', 'User', 'Store', 'Order value', 'Cashback', 'Status', ''], cbRows, 'Nothing is waiting. Every tracked order has been handled.') +

      '<h3 class="h3" style="margin:28px 0 10px">Redemption requests</h3>' +
      table(['Reference', 'User', 'Requested', 'Pay to', 'Amount', 'Status', ''], rdRows, 'No redemption requests waiting.') +

      '<h3 class="h3" style="margin:28px 0 10px">Referral rewards</h3>' +
      table(['Referrer', 'Friend', 'Joined', 'Reward', ''], rfRows, 'No referral rewards waiting.');
  };

  /* ---------------- transactions: summary, filters, export ---------------- */
  AX.views.transactions = function (prev) {
    var list = S.get('transactions'), by = {};
    list.forEach(function (t) { by[t.status] = (by[t.status] || 0) + 1; });
    var gross = list.reduce(function (a, t) { return a + t.amount; }, 0), cb = list.reduce(function (a, t) { return a + t.cashback; }, 0);
    var chips = [['all', 'All', list.length]].concat(['clicked', 'tracked', 'pending', 'confirmed', 'cancelled', 'rejected'].map(function (s) { return [s, s.charAt(0).toUpperCase() + s.slice(1), by[s] || 0]; }));
    return '<div class="grid g-4" style="margin-bottom:18px">' +
        stat('Total transactions', list.length, 'Every tracked order') + stat('Order value', money(gross), 'Gross tracked through Card Crest') +
        stat('Cashback promised', money(cb), 'Across all statuses') + stat('Confirmed', money(list.filter(function (t) { return t.status === 'confirmed'; }).reduce(function (a, t) { return a + t.cashback; }, 0)), (by.confirmed || 0) + ' orders', true) + '</div>' +
      '<div class="spread" style="margin-bottom:14px; gap:12px; flex-wrap:wrap"><div class="chip-row">' + chips.map(function (c, i) {
        return '<button class="chip' + (i === 0 ? ' is-on' : '') + '" data-chip="' + c[0] + '">' + c[1] + ' (' + c[2] + ')</button>';
      }).join('') + '</div><button class="btn btn--ghost btn--xs" data-export="transactions">Export CSV</button></div>' + (prev ? prev() : '');
  };

  AX.views.users = function (prev) {
    var list = users();
    return '<div class="spread" style="margin-bottom:14px; gap:12px; flex-wrap:wrap"><p class="muted small">' + list.length + ' members, ' + list.filter(function (u) { return u.active !== false; }).length + ' active</p>' +
      '<button class="btn btn--ghost btn--xs" data-export="users">Export CSV</button></div>' + (prev ? prev() : '');
  };

  AX.views.rewards = function (prev) {
    return '<div class="spread" style="margin-bottom:14px"><p class="muted small">Redemptions waiting also appear under Reward approvals.</p>' +
      '<button class="btn btn--ghost btn--xs" data-export="redemptions">Export CSV</button></div>' + (prev ? prev() : '');
  };

  /* ---------------- announcements ---------------- */
  AX.views.announce = function () {
    var past = col('adminLog').filter(function (l) { return l.action === 'Announcement'; }).slice(0, 8);
    return '<div class="grid g-2"><div class="panel"><h3 class="h3" style="margin-bottom:12px">Send a message to members</h3>' +
      '<div class="field"><label for="an-to">Who gets it</label><select id="an-to"><option value="active">All active members</option><option value="cashback">Members who have used cashback</option><option value="holders">Members with benefit cards (cardholders)</option></select></div>' +
      '<div class="field"><label for="an-title">Title</label><input id="an-title" maxlength="80" placeholder="e.g. New: Share & Earn is live"></div>' +
      '<div class="field"><label for="an-body">Message</label><textarea id="an-body" rows="4" maxlength="400" placeholder="Keep it short and useful."></textarea></div>' +
      '<p class="err" id="an-err" style="color:var(--danger); font-size:.86rem; display:none"></p>' +
      '<button class="btn btn--primary" id="an-send">Send message</button><p class="small muted" style="margin-top:10px">It shows in each member’s notification bell straight away.</p></div>' +
      '<div class="panel"><h3 class="h3" style="margin-bottom:12px">Recently sent</h3>' +
      (past.length ? past.map(function (l) { return '<div style="padding:9px 0; border-bottom:1px solid var(--line-soft)"><strong>' + esc(l.text.split(' | ')[0]) + '</strong><div class="small muted">' + esc(l.text.split(' | ')[1] || '') + ' &middot; ' + ago(l.at) + '</div></div>'; }).join('') : '<p class="muted small">Nothing sent yet.</p>') + '</div></div>';
  };

  /* ---------------- activity log ---------------- */
  AX.views.activity = function () {
    var rows = col('adminLog').slice(0, 150).map(function (l) {
      return '<tr><td class="muted" style="white-space:nowrap">' + new Date(l.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</td>' +
        '<td>' + esc(l.by) + '</td><td><span class="badge badge--grey">' + esc(l.action) + '</span></td><td>' + esc(l.text) + '</td></tr>';
    });
    return '<div class="note" style="margin-bottom:14px">What staff changed from this browser: approvals, status changes and messages. The Share & Earn actions are also kept on the server in the marketplace audit log.</div>' +
      table(['When', 'Who', 'Type', 'What'], rows, 'No staff activity recorded yet.');
  };

  /* ---------------- events ---------------- */
  AX.bind = function (root) {
    function again() { w.CC.Router.refresh(); }

    root.querySelectorAll('[data-cb]').forEach(function (b) {
      b.onclick = function () {
        CB.setStatus(b.dataset.id, b.dataset.cb, true);
        log('Cashback', 'Cashback ' + String(b.dataset.id).slice(-8) + ' ' + b.dataset.cb);
        UI.toast('Cashback ' + b.dataset.cb + '. The member has been told.'); again();
      };
    });
    var all = root.querySelector('#pickAll');
    if (all) all.onclick = function () {
      var boxes = root.querySelectorAll('[data-pick]'), on = [].some.call(boxes, function (x) { return !x.checked; });
      boxes.forEach(function (x) { x.checked = on; }); all.textContent = on ? 'Clear selection' : 'Select all';
    };
    var cp = root.querySelector('#confirmPicked');
    if (cp) cp.onclick = function () {
      var ids = [].slice.call(root.querySelectorAll('[data-pick]:checked')).map(function (x) { return x.dataset.pick; });
      if (!ids.length) return UI.toast('Tick the orders to confirm first', 'error');
      UI.confirm('Confirm ' + ids.length + ' cashback' + (ids.length > 1 ? 's' : '') + '?', 'Each member is told, and the cashback joins their available balance.', 'Confirm all', function () {
        ids.forEach(function (id) { CB.setStatus(id, 'confirmed', true); });
        log('Cashback', 'Confirmed ' + ids.length + ' cashback orders in one go'); UI.toast(ids.length + ' confirmed'); again();
      });
    };
    root.querySelectorAll('[data-rd]').forEach(function (b) {
      b.onclick = function () {
        RW.setStatus(b.dataset.id, b.dataset.rd);
        log('Redemption', 'Redemption ' + String(b.dataset.id).slice(-8) + ' ' + b.dataset.rd);
        UI.toast(b.dataset.rd === 'completed' ? 'Marked as paid. Demo mode: no money moves.' : 'Redemption rejected'); again();
      };
    });
    root.querySelectorAll('[data-rf]').forEach(function (b) {
      b.onclick = function () {
        RF.setStatus(b.dataset.id, b.dataset.rf);
        log('Referral', 'Referral ' + String(b.dataset.id).slice(-8) + ' ' + b.dataset.rf); UI.toast('Referral ' + b.dataset.rf); again();
      };
    });

    /* transaction status chips */
    root.querySelectorAll('[data-chip]').forEach(function (chip) {
      chip.onclick = function () {
        root.querySelectorAll('[data-chip]').forEach(function (c) { c.classList.toggle('is-on', c === chip); });
        root.querySelectorAll('tbody tr').forEach(function (tr) {
          var sel = tr.querySelector('select[data-txn]');
          tr.style.display = (chip.dataset.chip === 'all' || !sel || sel.value === chip.dataset.chip) ? '' : 'none';
        });
      };
    });

    /* CSV exports */
    root.querySelectorAll('[data-export]').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.export;
        if (k === 'transactions') csv('card-crest-transactions', ['Reference', 'User', 'Email', 'Store', 'Date', 'Order value', 'Cashback', 'Status'],
          S.get('transactions').map(function (t) { var u = S.find('users', t.userId) || {}; return [t.id, u.name, u.email, storeName(t.storeId), t.createdAt, t.amount, t.cashback, t.status]; }));
        if (k === 'users') csv('card-crest-users', ['Name', 'Email', 'Mobile', 'City', 'Status', 'Joined', 'Lifetime rewards', 'Transactions'],
          users().map(function (u) { var t = CB.totals(u.id); return [u.name, u.email, u.mobile, u.city, u.active === false ? 'disabled' : 'active', u.joined, t.lifetime, t.count]; }));
        if (k === 'redemptions') csv('card-crest-redemptions', ['Reference', 'User', 'Method', 'Pay to', 'Amount', 'Status', 'Requested'],
          S.get('redemptions').map(function (r) { return [r.ref, userName(r.userId), r.method, r.destination, r.amount, r.status, r.createdAt]; }));
        log('Export', 'Exported ' + k + ' to CSV');
      };
    });

    /* announcements */
    var send = root.querySelector('#an-send');
    if (send) send.onclick = function () {
      var err = root.querySelector('#an-err'), title = root.querySelector('#an-title').value.trim(), body = root.querySelector('#an-body').value.trim(), who = root.querySelector('#an-to').value;
      err.style.display = 'none';
      if (title.length < 3 || body.length < 5) { err.textContent = 'Add a title and a short message.'; err.style.display = 'block'; return; }
      var M = w.CC.Market, list = users().filter(function (u) { return u.active !== false; });
      if (who === 'cashback') list = list.filter(function (u) { return CB.forUser(u.id).length > 0; });
      if (who === 'holders' && M) list = list.filter(function (u) { return M.cards(u.id).length > 0; });
      if (!list.length) { err.textContent = 'No members match that group.'; err.style.display = 'block'; return; }
      UI.confirm('Send to ' + list.length + ' member' + (list.length > 1 ? 's' : '') + '?', 'This cannot be taken back.', 'Send', function () {
        list.forEach(function (u) { N.push(u.id, 'announcement', title, body); });
        log('Announcement', title + ' | sent to ' + list.length + ' members'); UI.toast('Sent to ' + list.length + ' members'); again();
      });
    };
  };

  w.CC.AdminPlus = AX;
})(window, document);
