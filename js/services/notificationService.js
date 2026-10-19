/* ============================================================
   Card Crest — notificationService.js
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store;

  var Notifications = {
    forUser: function (userId) {
      return S.where('notifications', function (n) { return n.userId === userId; })
        .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    },
    unread: function (userId) {
      return Notifications.forUser(userId).filter(function (n) { return !n.read; }).length;
    },
    push: function (userId, type, title, body) {
      var row = {
        id: S.uid('ntf'), userId: userId, type: type, title: title,
        body: body, createdAt: new Date().toISOString(), read: false
      };
      S.insert('notifications', row);
      w.dispatchEvent(new CustomEvent('cc:notify'));
      return row;
    },
    markRead: function (id) { S.update('notifications', id, { read: true }); },
    markAllRead: function (userId) {
      Notifications.forUser(userId).forEach(function (n) {
        if (!n.read) S.update('notifications', n.id, { read: true });
      });
      w.dispatchEvent(new CustomEvent('cc:notify'));
    }
  };

  w.CC.Notifications = Notifications;
})(window);
