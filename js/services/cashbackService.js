/* ============================================================
   Card Crest — cashbackService.js
   Activation and the tracked → pending → confirmed lifecycle.
   Everything here is simulated. No real merchant network is
   involved and no money moves.
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store;

  var FLOW = ['clicked', 'tracked', 'pending', 'confirmed'];

  var Cashback = {
    FLOW: FLOW,

    forUser: function (userId, filter) {
      var list = S.where('transactions', function (t) { return t.userId === userId; });
      if (filter && filter.status && filter.status !== 'all') {
        list = list.filter(function (t) { return t.status === filter.status; });
      }
      if (filter && filter.q) {
        var q = filter.q.toLowerCase();
        list = list.filter(function (t) {
          var st = w.CC.Offers.store(t.storeId);
          return ((st ? st.name : '') + ' ' + t.id).toLowerCase().indexOf(q) > -1;
        });
      }
      return list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    },

    all: function () {
      return S.get('transactions').slice().sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    },

    /* Activation creates the click record the whole lifecycle hangs off. */
    activate: function (userId, offer, estimatedAmount) {
      var store = w.CC.Offers.store(offer.storeId);
      var amount = estimatedAmount || [1299, 2499, 3499, 4999, 7999][Math.floor(Math.random() * 5)];
      var txn = {
        id: S.uid('txn'), userId: userId, storeId: offer.storeId, offerId: offer.id,
        amount: amount, cashback: Math.round(amount * offer.cashback / 100),
        status: 'clicked', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        retailerUrl: offer.url || (store && store.url) || ''
      };
      S.insert('transactions', txn);
      w.CC.Notifications.push(userId, 'cashback', 'Cashback activated',
        'Your ' + (store ? store.name : 'store') + ' session is being tracked. Complete the purchase in the same session.');

      /* In demo mode we move the record along on a timer so the
         lifecycle is visible without waiting 90 days. */
      if (!w.CC.Auth.remote) setTimeout(function () {
        if (S.find('transactions', txn.id)) {
          Cashback.setStatus(txn.id, 'tracked', true);
        }
      }, 12000);

      return txn;
    },

    setStatus: function (txnId, status, silent) {
      var t = S.find('transactions', txnId);
      if (!t) return null;
      S.update('transactions', txnId, { status: status, updatedAt: new Date().toISOString() });
      var store = w.CC.Offers.store(t.storeId);
      var name = store ? store.name : 'your order';
      if (!silent) return S.find('transactions', txnId);

      var copy = {
        tracked: ['Cashback tracked', 'We have matched your ' + name + ' order. It moves to pending once the merchant confirms.'],
        pending: ['Cashback pending', w.CC.UI.money(t.cashback) + ' from ' + name + ' is waiting on the merchant\'s return window.'],
        confirmed: ['Cashback confirmed', w.CC.UI.money(t.cashback) + ' from ' + name + ' has been added to your rewards balance.'],
        cancelled: ['Cashback cancelled', 'Your ' + name + ' order was cancelled, so the cashback was reversed.'],
        rejected: ['Cashback rejected', 'The merchant did not accept the ' + name + ' claim. Raise a ticket if you think this is wrong.']
      }[status];
      if (copy) w.CC.Notifications.push(t.userId, 'cashback', copy[0], copy[1]);
      return S.find('transactions', txnId);
    },

    totals: function (userId) {
      var list = S.where('transactions', function (t) { return t.userId === userId; });
      var sum = function (f) {
        return list.filter(f).reduce(function (a, t) { return a + t.cashback; }, 0);
      };
      var confirmed = sum(function (t) { return t.status === 'confirmed'; });
      var pending = sum(function (t) { return t.status === 'pending' || t.status === 'tracked' || t.status === 'clicked'; });
      var redeemed = w.CC.Rewards.redemptions(userId)
        .filter(function (r) { return r.status !== 'rejected'; })
        .reduce(function (a, r) { return a + r.amount; }, 0);
      var referral = w.CC.Referrals.earned(userId);
      return {
        confirmed: confirmed, pending: pending, referral: referral,
        lifetime: confirmed + referral,
        available: Math.max(0, confirmed + referral - redeemed),
        redeemed: redeemed,
        count: list.length
      };
    },

    platformTotals: function () {
      var list = S.get('transactions');
      var sum = function (f) { return list.filter(f).reduce(function (a, t) { return a + t.cashback; }, 0); };
      return {
        gross: list.reduce(function (a, t) { return a + t.amount; }, 0),
        confirmed: sum(function (t) { return t.status === 'confirmed'; }),
        pending: sum(function (t) { return t.status === 'pending' || t.status === 'tracked'; }),
        rejected: sum(function (t) { return t.status === 'rejected' || t.status === 'cancelled'; }),
        count: list.length
      };
    }
  };

  w.CC.Cashback = Cashback;
})(window);
