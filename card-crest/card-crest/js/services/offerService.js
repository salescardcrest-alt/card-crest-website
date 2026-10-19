/* ============================================================
   Card Crest — offerService.js
   Stores, offers and coupons.
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store;

  var Offers = {
    stores: function () { return S.where('stores', function (s) { return s.active !== false; }); },
    allStores: function () { return S.get('stores'); },
    store: function (id) { return S.find('stores', id); },

    all: function () {
      return S.where('offers', function (o) { return o.active !== false; });
    },
    allIncludingInactive: function () { return S.get('offers'); },
    byId: function (id) { return S.find('offers', id); },
    forStore: function (storeId) {
      return Offers.all().filter(function (o) { return o.storeId === storeId; });
    },

    /* filters: { q, categories[], kind, sort, section } */
    query: function (f) {
      f = f || {};
      var list = Offers.all().slice();
      var q = (f.q || '').trim().toLowerCase();

      if (q) {
        list = list.filter(function (o) {
          var st = Offers.store(o.storeId) || { name: '', category: '' };
          return (o.title + ' ' + st.name + ' ' + st.category + ' ' + (o.code || ''))
            .toLowerCase().indexOf(q) > -1;
        });
      }
      if (f.categories && f.categories.length) {
        list = list.filter(function (o) {
          var st = Offers.store(o.storeId);
          return st && f.categories.indexOf(st.category) > -1;
        });
      }
      if (f.kind === 'coupon') list = list.filter(function (o) { return o.kind === 'coupon'; });
      if (f.kind === 'deal') list = list.filter(function (o) { return o.kind === 'deal'; });

      if (f.section === 'trending') list = list.filter(function (o) { return o.trending; });
      if (f.section === 'flash') list = list.filter(function (o) { return o.flash; });
      if (f.section === 'new') list = list.filter(function (o) { return o.expiresInDays >= 21; });
      if (f.section === 'top') list = list.filter(function (o) { return o.featured; });

      var sort = f.sort || 'cashback';
      list.sort(function (a, b) {
        if (sort === 'expiry') return a.expiresInDays - b.expiresInDays;
        if (sort === 'store') {
          var sa = Offers.store(a.storeId), sb = Offers.store(b.storeId);
          return (sa ? sa.name : '').localeCompare(sb ? sb.name : '');
        }
        return b.cashback - a.cashback;
      });
      return list;
    },

    /* store directory filters: { q, categories[], sort } */
    queryStores: function (f) {
      f = f || {};
      var list = Offers.stores().slice();
      var q = (f.q || '').trim().toLowerCase();
      if (q) list = list.filter(function (s) {
        return (s.name + ' ' + s.category).toLowerCase().indexOf(q) > -1;
      });
      if (f.categories && f.categories.length) {
        list = list.filter(function (s) { return f.categories.indexOf(s.category) > -1; });
      }
      var sort = f.sort || 'cashback';
      list.sort(function (a, b) {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'popular') return (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || b.cashback - a.cashback;
        if (sort === 'offers') return Offers.forStore(b.id).length - Offers.forStore(a.id).length;
        return b.cashback - a.cashback;
      });
      return list;
    },

    categories: function () {
      var seen = {};
      Offers.stores().forEach(function (s) { seen[s.category] = (seen[s.category] || 0) + 1; });
      return Object.keys(seen).sort().map(function (k) { return { name: k, count: seen[k] }; });
    },

    /* favourites */
    favourites: function (userId) {
      return S.where('favourites', function (f) { return f.userId === userId; });
    },
    isFavourite: function (userId, offerId) {
      return Offers.favourites(userId).some(function (f) { return f.offerId === offerId; });
    },
    toggleFavourite: function (userId, offerId) {
      var row = Offers.favourites(userId).filter(function (f) { return f.offerId === offerId; })[0];
      if (row) { S.remove('favourites', row.id); return false; }
      S.insert('favourites', { id: S.uid('fav'), userId: userId, offerId: offerId, at: new Date().toISOString() });
      return true;
    },

    /* admin CRUD */
    createStore: function (data) {
      return S.insert('stores', Object.assign({
        id: w.CC.UI.slug(data.name), category: 'Shopping', cashback: 3,
        color: '#0e5c3c', popular: false, active: true, url: '',
        terms: ['Cashback is tracked only when you start your session from Card Crest.']
      }, data));
    },
    updateStore: function (id, patch) { return S.update('stores', id, patch); },
    removeStore: function (id) { S.remove('stores', id); },

    create: function (data) {
      return S.insert('offers', Object.assign({
        id: S.uid('off'), kind: 'deal', code: '', cashback: 3,
        expiresInDays: 30, trending: false, featured: false, flash: false,
        active: true, url: '', terms: 'Standard cashback terms apply.'
      }, data));
    },
    update: function (id, patch) { return S.update('offers', id, patch); },
    remove: function (id) { S.remove('offers', id); }
  };

  w.CC.Offers = Offers;
})(window);
