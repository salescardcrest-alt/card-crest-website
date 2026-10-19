/* ============================================================
   Card Crest — rewardService.js
   The rewards wallet and the demo redemption service.
   The payout call is deliberately isolated: replace payout()
   with a real UPI or bank transfer API and nothing else changes.
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store;
  var MIN = 250;

  var Rewards = {
    MIN: MIN,
    methods: ['UPI', 'Bank transfer', 'Gift card'],

    redemptions: function (userId) {
      return S.where('redemptions', function (r) { return r.userId === userId; })
        .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    },
    all: function () {
      return S.get('redemptions').slice().sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    },

    balance: function (userId) { return w.CC.Cashback.totals(userId); },

    /* DEMO PAYMENT SERVICE.
       This does not contact a bank, a UPI handle or a card network.
       It records the request and marks it processed locally. */
    payout: function (userId, amount, method, destination) {
      var bal = Rewards.balance(userId);
      if (amount < MIN) {
        return { ok: false, error: 'The minimum redemption is ' + w.CC.UI.money(MIN) + '.' };
      }
      if (amount > bal.available) {
        return { ok: false, error: 'You have ' + w.CC.UI.money(bal.available) + ' available to redeem.' };
      }
      if (!destination) {
        return { ok: false, error: 'Enter where the reward should go.' };
      }
      var row = {
        id: S.uid('rdm'), userId: userId, amount: amount, method: method,
        destination: destination, status: 'processing',
        createdAt: new Date().toISOString(),
        ref: 'CCR' + Math.random().toString(36).slice(2, 10).toUpperCase()
      };
      S.insert('redemptions', row);
      w.CC.Notifications.push(userId, 'reward', 'Redemption requested',
        w.CC.UI.money(amount) + ' to ' + method + '. Demo mode — no real transfer is made.');

      if (!w.CC.Auth.remote) setTimeout(function () {
        if (S.find('redemptions', row.id)) {
          S.update('redemptions', row.id, { status: 'completed' });
          w.CC.Notifications.push(userId, 'reward', 'Redemption processed',
            w.CC.UI.money(amount) + ' marked as sent in demo mode.');
        }
      }, 9000);

      return { ok: true, redemption: row };
    },

    setStatus: function (id, status) {
      var r = S.find('redemptions', id);
      if (!r) return null;
      S.update('redemptions', id, { status: status });
      w.CC.Notifications.push(r.userId, 'reward', 'Redemption ' + status,
        w.CC.UI.money(r.amount) + ' is now marked ' + status + '.');
      return S.find('redemptions', id);
    }
  };

  w.CC.Rewards = Rewards;
})(window);
