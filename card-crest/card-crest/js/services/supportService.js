/* ============================================================
   Card Crest — supportService.js
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store;

  var Support = {
    categories: ['Cashback', 'Credit cards', 'Rewards and redemption', 'Applications', 'Account and login', 'Something else'],
    all: function () {
      return S.get('tickets').slice().sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    },
    forUser: function (userId) {
      return S.where('tickets', function (t) { return t.userId === userId; });
    },
    create: function (data) {
      var row = Object.assign({
        id: S.uid('tkt'), status: 'open', createdAt: new Date().toISOString()
      }, data);
      S.insert('tickets', row);
      return row;
    },
    setStatus: function (id, status) { return S.update('tickets', id, { status: status }); }
  };

  w.CC.Support = Support;
})(window);
