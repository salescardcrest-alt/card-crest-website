/* ============================================================
   Card Crest — searchService.js
   One query across cards, banks, stores, offers and benefits.
   ============================================================ */
(function (w) {
  'use strict';

  var BENEFITS = [
    { label: 'Airport lounge access', href: '#/cards?benefit=lounge' },
    { label: 'Travel benefits',       href: '#/cards?benefit=travel' },
    { label: 'Fuel savings',          href: '#/cards?benefit=fuel' },
    { label: 'Dining offers',         href: '#/cards?benefit=dining' },
    { label: 'Milestone rewards',     href: '#/cards?benefit=milestone' },
    { label: 'Insurance cover',       href: '#/cards?benefit=insurance' }
  ];

  var Search = {
    run: function (q) {
      q = (q || '').trim().toLowerCase();
      if (q.length < 2) return null;
      var out = { cards: [], banks: [], stores: [], offers: [], benefits: [] };

      out.cards = w.CC.Cards.all().filter(function (c) {
        var b = w.CC.Cards.bank(c.bank);
        return (c.name + ' ' + (b ? b.name : '') + ' ' + c.type.join(' ')).toLowerCase().indexOf(q) > -1;
      }).slice(0, 4);

      out.banks = w.CC.Cards.banks().filter(function (b) {
        return b.name.toLowerCase().indexOf(q) > -1;
      }).slice(0, 3);

      out.stores = w.CC.Offers.stores().filter(function (s) {
        return (s.name + ' ' + s.category).toLowerCase().indexOf(q) > -1;
      }).slice(0, 4);

      out.offers = w.CC.Offers.all().filter(function (o) {
        return o.title.toLowerCase().indexOf(q) > -1;
      }).slice(0, 3);

      out.benefits = BENEFITS.filter(function (b) {
        return b.label.toLowerCase().indexOf(q) > -1;
      }).slice(0, 3);

      var n = out.cards.length + out.banks.length + out.stores.length + out.offers.length + out.benefits.length;
      return n ? out : { empty: true };
    }
  };

  w.CC.Search = Search;
})(window);
