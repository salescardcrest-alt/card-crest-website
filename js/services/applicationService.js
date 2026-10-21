/* ============================================================
   Card Crest — applicationService.js
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store;

  var FLOW = [
    { id: 'applied',      label: 'Application submitted', desc: 'We have sent your details to the bank.' },
    { id: 'under-review', label: 'Verification',          desc: 'The bank is checking your documents and bureau record.' },
    { id: 'documents',    label: 'Documents requested',   desc: 'The bank has asked for something extra.' },
    { id: 'approved',     label: 'Decision',              desc: 'The bank has made a decision on your application.' },
    { id: 'completed',    label: 'Card delivered',        desc: 'Your card has been dispatched and activated.' }
  ];

  var Applications = {
    FLOW: FLOW,
    forUser: function (userId) {
      return S.where('applications', function (a) { return a.userId === userId; })
        .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    },
    all: function () {
      return S.get('applications').slice().sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    },
    byId: function (id) { return S.find('applications', id); },

    /* Card Crest's partner / employee / referral code for a bank, set in js/config.js (PARTNER_REF). */
    partnerRef: function (bankId) {
      var c = (w.CC_CONFIG && w.CC_CONFIG.PARTNER_REF) || {};
      return c[bankId] || c.default || '';
    },

    /* Where "Apply for this card" sends the applicant: the bank's own site, with Card Crest's code attached.
       js/config.js APPLY_LINKS can hold the bank's exact partner link per card or per bank; {ref} becomes the
       partner code and {click} the application reference. Without one, the bank's site opens with both attached
       as ordinary parameters (the bank must be told to credit them; see the note in config.js). */
    trackedUrl: function (app) {
      var card = w.CC.Cards.byId(app.cardId), bank = card && w.CC.Cards.bank(card.bank);
      var ref = Applications.partnerRef(card ? card.bank : ''), cfg = (w.CC_CONFIG && w.CC_CONFIG.APPLY_LINKS) || {};
      var tpl = cfg[app.cardId] || (card && cfg[card.bank]);
      if (tpl) return String(tpl).replace(/\{ref\}/g, encodeURIComponent(ref)).replace(/\{click\}/g, encodeURIComponent(app.id));
      /* straight to the bank's credit card application pages (a card can set its own applyUrl), not the homepage */
      var base = (card && card.applyUrl) || (bank && (bank.applyUrl || w.CC.DATA.bankApply[bank.id]));
      if (!base) {
        var domain = bank && (bank.domain || w.CC.DATA.bankDomains[bank.id]);
        if (!domain) return '';
        base = 'https://www.' + String(domain).replace(/^www\./, '') + '/';
      }
      var q = ['utm_source=cardcrest', 'utm_medium=partner'];
      if (ref) q.push('ref=' + encodeURIComponent(ref));
      q.push('cc_click=' + encodeURIComponent(app.id));
      return base + (base.indexOf('?') > -1 ? '&' : '?') + q.join('&');
    },

    create: function (userId, cardId) {
      var already = Applications.forUser(userId).filter(function (a) {
        return a.cardId === cardId && ['applied', 'under-review', 'documents'].indexOf(a.status) > -1;
      })[0];
      if (already) return { ok: false, error: 'You already have an open application for this card.' };

      var row = {
        id: S.uid('app'), userId: userId, cardId: cardId, status: 'applied', partnerRef: Applications.partnerRef((w.CC.Cards.byId(cardId) || {}).bank),
        createdAt: new Date().toISOString(), notes: []
      };
      S.insert('applications', row);
      var card = w.CC.Cards.byId(cardId);
      w.CC.Notifications.push(userId, 'application', 'Application submitted',
        'Your ' + (card ? card.name : 'card') + ' application was started on the bank’s site with Card Crest’s partner code attached. Finish it there; we follow its status here.');
      if (!w.CC.Auth.remote) setTimeout(function () {
        if (S.find('applications', row.id)) Applications.setStatus(row.id, 'under-review');
      }, 14000);
      return { ok: true, application: row };
    },

    setStatus: function (id, status, note) {
      var a = S.find('applications', id);
      if (!a) return null;
      var notes = a.notes || [];
      if (note) notes.push({ at: new Date().toISOString(), text: note });
      S.update('applications', id, { status: status, notes: notes, updatedAt: new Date().toISOString() });
      var card = w.CC.Cards.byId(a.cardId);
      w.CC.Notifications.push(a.userId, 'application', 'Application updated',
        (card ? card.name : 'Your card') + ' is now marked ' + status.replace('-', ' ') + '.');
      if ((status === 'approved' || status === 'completed') && card && w.CC.Cards.rewardFor(card) > 0) Applications.creditReward(a, card);
      return S.find('applications', id);
    },


    /* A successful (approved) application on a partner card pays the applicant its reward, once.
       It lands in their rewards wallet as a confirmed entry, so it counts toward what they can redeem. */
    creditReward: function (app, card) {
      var done = S.where('transactions', function (t) { return t.storeId === 'cardreward' && t.offerId === app.id; })[0];
      var reward = w.CC.Cards.rewardFor(card);
      if (done || !(reward > 0)) return null;
      var now = new Date().toISOString();
      var row = { id: S.uid('txn'), userId: app.userId, storeId: 'cardreward', offerId: app.id, amount: 0, cashback: reward,
        status: 'confirmed', createdAt: now, updatedAt: now, retailerUrl: '' };
      S.insert('transactions', row);
      w.CC.Notifications.push(app.userId, 'reward', 'Card reward added',
        w.CC.UI.money(reward) + ' for your approved ' + card.name + ' is now in your rewards wallet.');
      return row;
    },
    stageIndex: function (status) {
      if (status === 'rejected') return 3;
      var i = FLOW.map(function (f) { return f.id; }).indexOf(status);
      return i < 0 ? 0 : i;
    }
  };

  w.CC.Applications = Applications;
})(window);
