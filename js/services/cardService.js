/* ============================================================
   Card Crest — cardService.js
   Card catalogue, the Card Value Score, the value calculator
   and the eligibility estimate.
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store, D = w.CC.DATA;

  /* Reference spending profile used when the user has not given
     us their own. ₹40,000 a month across five categories. */
  var REF = { online: 15000, offline: 12000, dining: 5000, fuel: 4000, travel: 4000 };

  function totalOf(p) { return (p.online + p.offline + p.dining + p.fuel + p.travel) * 12; }

  /* Redemption quality, read out of the card's own redemption text.
     A point worth ₹1 as statement credit is worth far more than a
     point worth ₹0.25 locked into a voucher catalogue. */
  function redemptionQuality(card) {
    var t = (card.redemption || '').toLowerCase();
    if (/statement|auto-credit|auto credit|amazon pay|swiggy money/.test(t)) return 1;
    if (/=\s*₹1\b/.test(t)) return 0.9;
    if (/₹0\.5/.test(t)) return 0.6;
    if (/₹0\.45/.test(t)) return 0.55;
    if (/₹0\.25|4 points/.test(t)) return 0.35;
    return 0.5;
  }

  var BENEFIT_KEYS = ['lounge', 'fuel', 'travel', 'dining', 'shopping', 'insurance', 'milestone'];
  function benefitCount(card) {
    return BENEFIT_KEYS.filter(function (k) {
      var v = (card[k] || '').toLowerCase();
      return v && !/^not included|^no specific|^no milestone|^no benefit|not offered|do not earn/.test(v);
    }).length;
  }

  /* ----- annual value of a card for a given spending profile ----- */
  function value(card, profile) {
    var p = profile || REF;
    var a = card.accel || {};
    function rate(k) {
      var r = a[k] != null ? a[k] : card.rewardRate;
      return r / 100;
    }
    var rewards =
      p.online  * 12 * rate('online') +
      p.offline * 12 * rate('offline') +
      p.dining  * 12 * rate('dining') +
      p.fuel    * 12 * rate('fuel') +
      p.travel  * 12 * rate('travel');

    var rq = redemptionQuality(card);
    var realisedRewards = rewards * (0.55 + 0.45 * rq); // points you cannot spend well are worth less
    var perks = card.valuePerks || 0;
    var welcome = card.welcomeValue || 0;
    var fee = card.annualFee || 0;
    var net = realisedRewards + perks - fee;

    return {
      rewards: Math.round(realisedRewards),
      grossRewards: Math.round(rewards),
      perks: perks, welcome: welcome, fee: fee,
      net: Math.round(net),
      spend: totalOf(p)
    };
  }

  /* ----- Card Value Score: 0–100, six weighted components -----
     Returned with its breakdown so the UI can show its working. */
  function score(card, profile) {
    var v = value(card, profile);
    var spend = v.spend || 1;

    // 1. Net return on spend, 0–6% mapped to 0–40
    var retPct = (v.net / spend) * 100;
    var sReturn = Math.max(0, Math.min(40, (retPct / 6) * 40));

    // 2. Fee efficiency, 0–15
    var sFee = card.annualFee === 0 ? 15
      : Math.max(0, Math.min(15, ((v.rewards + v.perks) / Math.max(card.annualFee, 1)) * 3.2));

    // 3. Breadth of benefits, 0–20
    var sBenefits = (benefitCount(card) / BENEFIT_KEYS.length) * 20;

    // 4. Welcome value against joining fee, 0–10
    var sWelcome = card.joiningFee === 0
      ? (card.welcomeValue > 0 ? 10 : 6)
      : Math.max(0, Math.min(10, (card.welcomeValue / Math.max(card.joiningFee, 1)) * 10));

    // 5. Redemption quality, 0–10
    var sRedeem = redemptionQuality(card) * 10;

    // 6. How reachable the card is, 0–5
    var sAccess = Math.max(0, Math.min(5, 5 - (card.minIncome / 3600000) * 5));

    var total = sReturn + sFee + sBenefits + sWelcome + sRedeem + sAccess;
    return {
      total: Math.max(1, Math.min(100, Math.round(total))),
      value: v,
      parts: [
        { k: 'Net return on spend', v: sReturn,   max: 40 },
        { k: 'Fee efficiency',      v: sFee,      max: 15 },
        { k: 'Breadth of benefits', v: sBenefits, max: 20 },
        { k: 'Welcome value',       v: sWelcome,  max: 10 },
        { k: 'Redemption quality',  v: sRedeem,   max: 10 },
        { k: 'How reachable it is', v: sAccess,   max: 5 }
      ]
    };
  }

  /* ----- eligibility estimate ----- */
  function eligibility(card, p) {
    // p: { income, credit, employment, age }
    if (!p || !p.income) return { level: 'unknown', pct: 0, label: 'Add your details' };
    var pts = 0;
    var incRatio = p.income / card.minIncome;
    pts += Math.min(50, incRatio * 42);
    var credit = p.credit || 0;
    if (credit >= card.minCibil + 40) pts += 32;
    else if (credit >= card.minCibil) pts += 26;
    else if (credit >= card.minCibil - 30) pts += 14;
    else if (credit > 0) pts += 5;
    else pts += 12; // no score on file — neutral
    if (p.employment === 'Salaried') pts += 12;
    else if (p.employment === 'Self-employed') pts += 9;
    else pts += 3;
    var age = p.age || 30;
    pts += (age >= card.minAge && age <= card.maxAge) ? 6 : 0;

    var pct = Math.max(4, Math.min(96, Math.round(pts)));
    var level = pct >= 70 ? 'strong' : pct >= 45 ? 'fair' : 'weak';
    return {
      level: level, pct: pct,
      label: level === 'strong' ? 'Strong match'
        : level === 'fair' ? 'Possible match' : 'Unlikely right now'
    };
  }

  var Cards = {
    REF: REF,
    all: function () { return S.where('cards', function (c) { return c.active !== false; }); },
    allIncludingInactive: function () { return S.get('cards'); },
    byId: function (id) { return S.find('cards', id) || Cards.partner(id); },
    /* partner cards: applied for through Card Crest, with a rupee reward on approval (see data.js) */
    partners: function () { return w.CC.DATA.partnerCards.slice(); },
    /* The rupee reward for applying through Card Crest and being approved. A partner card has its own; any other card
       of a partner bank shows the lowest reward that bank pays, so we never promise more than we pay. 0 = none. */
    rewardFor: function (card) {
      if (!card) return 0;
      if (card.partner) return card.reward || 0;
      var same = w.CC.DATA.partnerCards.filter(function (p) { return p.bank === card.bank; }).map(function (p) { return p.reward; });
      return same.length ? Math.min.apply(null, same) : 0;
    },
    partner: function (id) { return w.CC.DATA.partnerCards.filter(function (p) { return p.id === id; })[0] || null; },
    banks: function () { return D.banks; },
    bank: function (id) { return D.banks.filter(function (b) { return b.id === id; })[0]; },
    value: value,
    score: score,
    eligibility: eligibility,
    benefitCount: benefitCount,

    scoreOf: function (id, profile) { return score(Cards.byId(id), profile).total; },

    profileFor: function (user) {
      if (!user) return null;
      return { income: user.income, credit: user.credit, employment: user.employment, age: user.age || 30 };
    },

    /* filters: { q, banks[], types[], fee[], benefits[], sort } */
    query: function (f) {
      f = f || {};
      var list = Cards.all().slice();
      var q = (f.q || '').trim().toLowerCase();

      if (q) {
        list = list.filter(function (c) {
          var bank = Cards.bank(c.bank);
          return (c.name + ' ' + (bank ? bank.name : '') + ' ' + c.type.join(' ') + ' ' +
            c.perks.join(' ') + ' ' + c.lounge + ' ' + c.travel + ' ' + c.shopping)
            .toLowerCase().indexOf(q) > -1;
        });
      }
      if (f.banks && f.banks.length) {
        list = list.filter(function (c) { return f.banks.indexOf(c.bank) > -1; });
      }
      if (f.types && f.types.length) {
        list = list.filter(function (c) {
          return f.types.some(function (t) { return c.type.indexOf(t) > -1; });
        });
      }
      if (f.fee && f.fee.length) {
        list = list.filter(function (c) {
          return f.fee.some(function (band) {
            var a = c.annualFee;
            if (band === 'free') return a === 0;
            if (band === 'u500') return a > 0 && a < 500;
            if (band === '500-2000') return a >= 500 && a <= 2000;
            if (band === '2000+') return a > 2000;
            return true;
          });
        });
      }
      if (f.benefits && f.benefits.length) {
        list = list.filter(function (c) {
          return f.benefits.every(function (b) {
            var v = (c[b] || '').toLowerCase();
            return v && !/^not included|^no specific|^no milestone|not offered/.test(v);
          });
        });
      }

      var sort = f.sort || 'score';
      list.sort(function (a, b) {
        if (sort === 'fee-low') return a.annualFee - b.annualFee;
        if (sort === 'fee-high') return b.annualFee - a.annualFee;
        if (sort === 'rating') return b.rating - a.rating;
        if (sort === 'reward') return b.rewardRate - a.rewardRate;
        return score(b).total - score(a).total;
      });
      return list;
    },

    topByScore: function (n) {
      return Cards.all().slice().sort(function (a, b) {
        return score(b).total - score(a).total;
      }).slice(0, n || 4);
    },
    popular: function (n) {
      return Cards.all().filter(function (c) { return c.popular; }).slice(0, n || 4);
    },

    /* Recommendation used by the eligibility flow. */
    recommend: function (p, prefs) {
      var profile = prefs && prefs.spend ? prefs.spend : REF;
      return Cards.all().map(function (c) {
        var e = eligibility(c, p);
        var sc = score(c, profile);
        var fit = sc.total * 0.6 + e.pct * 0.4;
        if (prefs && prefs.priorities && prefs.priorities.length) {
          var match = prefs.priorities.filter(function (t) { return c.type.indexOf(t) > -1; }).length;
          fit += match * 9;
        }
        return { card: c, eligibility: e, score: sc, fit: fit };
      }).filter(function (r) { return r.eligibility.pct >= 30; })
        .sort(function (a, b) { return b.fit - a.fit; })
        .slice(0, 4);
    },

    /* saved cards */
    saved: function (userId) {
      return S.where('savedCards', function (s) { return s.userId === userId; });
    },
    isSaved: function (userId, cardId) {
      return Cards.saved(userId).some(function (s) { return s.cardId === cardId; });
    },
    MAX_SAVED: 30,
    save: function (userId, cardId) {
      if (Cards.isSaved(userId, cardId)) return false;
      if (Cards.saved(userId).length >= Cards.MAX_SAVED) return false;
      S.insert('savedCards', {
        id: S.uid('sv'), userId: userId, cardId: cardId,
        primary: Cards.saved(userId).length === 0, savedAt: new Date().toISOString()
      });
      return true;
    },
    unsave: function (userId, cardId) {
      var row = Cards.saved(userId).filter(function (s) { return s.cardId === cardId; })[0];
      if (row) S.remove('savedCards', row.id);
    },
    setPrimary: function (userId, savedId) {
      Cards.saved(userId).forEach(function (s) {
        S.update('savedCards', s.id, { primary: s.id === savedId });
      });
    },

    /* comparison tray */
    compare: function () { return S.get('compare') || []; },
    toggleCompare: function (cardId) {
      var list = Cards.compare().slice();
      var i = list.indexOf(cardId);
      if (i > -1) { list.splice(i, 1); S.set('compare', list); return { added: false, list: list }; }
      if (list.length >= 4) return { added: false, full: true, list: list };
      list.push(cardId);
      S.set('compare', list);
      return { added: true, list: list };
    },
    clearCompare: function () { S.set('compare', []); },

    /* admin CRUD */
    create: function (data) {
      var c = Object.assign({
        id: w.CC.UI.slug(data.name), art: 'cashback', type: ['rewards'], rating: 4,
        accel: {}, valuePerks: 0, perks: [], pros: [], cons: [], active: true,
        minAge: 21, maxAge: 60, minCibil: 720,
        documents: ['PAN card', 'Aadhaar or address proof', 'Income proof'],
        welcome: 'No welcome bonus', welcomeValue: 0, lounge: 'Not included',
        fuel: 'Not included', travel: 'Not included', dining: 'Not included',
        shopping: 'Not included', insurance: 'Not included', milestone: 'No milestone benefit',
        redemption: '1 point = ₹0.25', feeWaiver: 'No fee waiver offered'
      }, data);
      return S.insert('cards', c);
    },
    update: function (id, patch) { return S.update('cards', id, patch); },
    remove: function (id) { S.remove('cards', id); }
  };

  w.CC.Cards = Cards;
})(window);
