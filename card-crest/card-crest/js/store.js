/* ============================================================
   Card Crest — store.js
   The single data source behind every service. Today it reads
   and writes localStorage. Replace the read/write pair with
   fetch() calls and the services above it keep working.
   ============================================================ */
(function (w) {
  'use strict';
  var D = w.CC.DATA;
  var KEY = 'cardcrest.v1';
  var state = null;

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function seed() {
    var s = {
      users: D.users.map(function (u) { return Object.assign({}, u); }),
      cards: D.cards.map(function (c) { return Object.assign({ active: true }, c); }),
      stores: D.stores.map(function (x) { return Object.assign({ active: true }, x); }),
      offers: D.offers.map(function (o) { return Object.assign({ active: true }, o); }),
      transactions: [], applications: [], referrals: [], notifications: [],
      redemptions: [], tickets: [], savedCards: [], compare: [], favourites: [],
      session: null, profileExtras: {}
    };

    D.txnSeed.forEach(function (t) {
      s.transactions.push({
        id: uid('txn'), userId: t[0], storeId: t[1], offerId: t[2],
        amount: t[3], cashback: t[4], status: t[5], createdAt: D.daysAgo(t[6]),
        updatedAt: D.daysAgo(Math.max(0, t[6] - 4))
      });
    });

    D.appSeed.forEach(function (a) {
      s.applications.push({
        id: uid('app'), userId: a[0], cardId: a[1], status: a[2],
        createdAt: D.daysAgo(a[3]), notes: []
      });
    });

    D.refSeed.forEach(function (r) {
      s.referrals.push({
        id: uid('ref'), userId: r[0], name: r[1], status: r[2],
        reward: r[3], createdAt: D.daysAgo(r[4])
      });
    });

    D.notifSeed.forEach(function (n, i) {
      s.notifications.push({
        id: uid('ntf'), userId: n[0], type: n[1], title: n[2], body: n[3],
        createdAt: D.daysAgo(n[4]), read: i > 5
      });
    });

    // a couple of saved cards and one demo redemption so the account looks lived-in
    s.savedCards = [
      { id: uid('sv'), userId: 'u-001', cardId: 'hdfc-millennia', primary: true,  savedAt: D.daysAgo(60) },
      { id: uid('sv'), userId: 'u-001', cardId: 'icici-amazon',   primary: false, savedAt: D.daysAgo(41) },
      { id: uid('sv'), userId: 'u-001', cardId: 'axis-ace',       primary: false, savedAt: D.daysAgo(12) }
    ];
    s.redemptions = [
      { id: uid('rdm'), userId: 'u-001', amount: 1500, method: 'UPI', status: 'completed', createdAt: D.daysAgo(9), ref: 'CCR' + Date.now().toString(36).toUpperCase().slice(-8) }
    ];
    s.tickets = [
      { id: uid('tkt'), userId: 'u-002', name: 'Neha Kumari', email: 'neha@example.com', category: 'Cashback', message: 'My Ajio order from three weeks ago still shows as tracked.', status: 'open', createdAt: D.daysAgo(3) }
    ];
    return s;
  }

  function load() {
    if (state) return state;
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : seed();
    } catch (e) {
      state = seed();
    }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { /* private mode or quota — the app still works for this session */ }
  }

  var hook = null; // sync.js registers here to mirror writes to Supabase

  var Store = {
    hook: function (fn) { hook = fn; },
    get: function (key) { return load()[key]; },
    set: function (key, val) { load()[key] = val; save(); return val; },
    all: function () { return load(); },
    commit: save,
    uid: uid,
    reset: function () { localStorage.removeItem(KEY); state = null; load(); },

    insert: function (col, row) {
      var s = load();
      if (!row.id) row.id = uid(col.slice(0, 3));
      s[col].unshift(row);
      save();
      if (hook) hook('insert', col, row);
      return row;
    },
    update: function (col, id, patch) {
      var s = load(), row = s[col].filter(function (r) { return r.id === id; })[0];
      if (!row) return null;
      Object.assign(row, patch);
      save();
      if (hook) hook('update', col, row, patch);
      return row;
    },
    remove: function (col, id) {
      var s = load();
      var gone = s[col].filter(function (r) { return r.id === id; })[0];
      s[col] = s[col].filter(function (r) { return r.id !== id; });
      save();
      if (hook && gone) hook('remove', col, gone);
    },
    find: function (col, id) {
      return load()[col].filter(function (r) { return r.id === id; })[0] || null;
    },
    where: function (col, fn) { return load()[col].filter(fn); }
  };

  w.CC.Store = Store;
})(window);
