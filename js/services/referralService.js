/* ============================================================
   Card Crest — referralService.js
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store;
  var REWARD = 1000;

  var Referrals = {
    REWARD: REWARD,
    forUser: function (userId) {
      return S.where('referrals', function (r) { return r.userId === userId; })
        .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    },
    all: function () { return S.get('referrals'); },
    earned: function (userId) {
      return Referrals.forUser(userId)
        .filter(function (r) { return r.status === 'successful'; })
        .reduce(function (a, r) { return a + r.reward; }, 0);
    },
    stats: function (userId) {
      var list = Referrals.forUser(userId);
      return {
        total: list.length,
        successful: list.filter(function (r) { return r.status === 'successful'; }).length,
        pending: list.filter(function (r) { return r.status === 'pending'; }).length,
        earned: Referrals.earned(userId)
      };
    },
    link: function (user) {
      return 'https://cardcrest.in/join?ref=' + w.CC.Auth.referralCode(user);
    },
    setStatus: function (id, status) {
      var r = S.find('referrals', id);
      if (!r) return null;
      S.update('referrals', id, { status: status, reward: status === 'successful' ? REWARD : 0 });
      if (status === 'successful') {
        w.CC.Notifications.push(r.userId, 'referral', 'Referral reward credited',
          r.name + ' completed their first card. ' + w.CC.UI.money(REWARD) + ' added to your balance.');
      }
      return S.find('referrals', id);
    }
  };

  w.CC.Referrals = Referrals;
})(window);
