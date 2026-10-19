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

    create: function (userId, cardId) {
      var already = Applications.forUser(userId).filter(function (a) {
        return a.cardId === cardId && ['applied', 'under-review', 'documents'].indexOf(a.status) > -1;
      })[0];
      if (already) return { ok: false, error: 'You already have an open application for this card.' };

      var row = {
        id: S.uid('app'), userId: userId, cardId: cardId, status: 'applied',
        createdAt: new Date().toISOString(), notes: []
      };
      S.insert('applications', row);
      var card = w.CC.Cards.byId(cardId);
      w.CC.Notifications.push(userId, 'application', 'Application submitted',
        'Your ' + (card ? card.name : 'card') + ' application is with the bank. Demo mode — nothing was sent to a real bank.');
      setTimeout(function () {
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
      return S.find('applications', id);
    },

    stageIndex: function (status) {
      if (status === 'rejected') return 3;
      var i = FLOW.map(function (f) { return f.id; }).indexOf(status);
      return i < 0 ? 0 : i;
    }
  };

  w.CC.Applications = Applications;
})(window);
