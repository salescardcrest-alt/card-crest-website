/* ============================================================
   Card Crest — services/staffService.js
   Staff permissions: which admin sections a member may use. Main admins (role "admin") can use everything and are the
   only ones who give or take back permissions. Stored in Supabase (staff_permissions, supabase/11_staff_permissions.sql);
   in demo mode they live in the local store. The database enforces the same rules, so hiding a section here is not the only guard.
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store, sb = null, mine = [];

  /* the sections that can be given, with what each one lets a member do */
  var SECTIONS = [
    ['cards', 'Cards', 'Add, edit and switch off credit cards, and set each card’s offer percentage and backlink.'],
    ['stores', 'Stores', 'Add and edit cashback stores and their rates.'],
    ['offers', 'Offers', 'Add and edit deals and coupons.'],
    ['banners', 'Banners', 'Manage the picture slideshow on the app Home.'],
    ['trackers', 'Tracker links', 'Set the tracker links for products, stores, cards and banks.'],
    ['claims', 'Cashback claims', 'Review missing-cashback claims and reply to members.'],
    ['reports', 'User reports', 'Review reports about members.']
  ];
  function local() { var a = S.get('staffPerms'); if (!a) { a = []; S.set('staffPerms', a); } return a; }
  function isAdmin() { var u = w.CC.Auth && w.CC.Auth.current(); return !!u && u.role === 'admin'; }

  var Staff = {
    SECTIONS: SECTIONS,
    init: function (client) { sb = client; },

    /* called after sign-in: learn what the signed-in member may do */
    load: function (u) {
      mine = [];
      if (!u) return Promise.resolve();
      if (!sb) {
        var r = local().filter(function (x) { return x.userId === u.id; })[0];
        mine = r ? r.sections.slice() : [];
        return Promise.resolve();
      }
      return sb.from('staff_permissions').select('sections').eq('user_id', u.id).then(function (res) {
        mine = !res.error && res.data && res.data[0] ? (res.data[0].sections || []) : [];
        /* a member with sections may read names (the database allows it), so claims and reports can show who */
        if (mine.length && u.role !== 'admin') return sb.from('profiles').select('*').then(function (p) {
          if (!p.error && p.data) S.set('users', p.data.map(function (x) { return Object.assign({}, x, { avatar: x.avatar_url || '', lastSeen: x.last_seen || null }); }));
        });
      }, function () { mine = []; }).then(function () { if (mine.length) w.dispatchEvent(new CustomEvent('cc:notify')); });   // repaint the account menu so it shows the Admin panel link
    },
    clear: function () { mine = []; },

    /* may the signed-in member use (and edit) this admin section? */
    can: function (section) { return isAdmin() || mine.indexOf(section) > -1; },
    isStaff: function () { return isAdmin() || mine.length > 0; },
    sections: function () { return isAdmin() ? SECTIONS.map(function (s) { return s[0]; }) : mine.slice(); },

    /* main admin only: everyone who has been given sections */
    list: function () {
      if (!isAdmin()) return Promise.resolve([]);
      if (!sb) return Promise.resolve(local().map(function (x) { return { userId: x.userId, sections: x.sections.slice() }; }));
      return sb.from('staff_permissions').select('*').then(function (r) {
        return (r.data || []).map(function (x) { return { userId: x.user_id, sections: x.sections || [] }; });
      }, function () { return []; });
    },
    save: function (userId, sections) {
      if (!isAdmin()) return Promise.resolve({ ok: false, error: 'Only the main admin can give permissions.' });
      sections = sections.filter(function (s) { return SECTIONS.some(function (x) { return x[0] === s; }); });
      if (!sections.length) return Staff.remove(userId);
      if (!sb) {
        var rows = local(), r = rows.filter(function (x) { return x.userId === userId; })[0];
        if (r) r.sections = sections; else rows.push({ id: userId, userId: userId, sections: sections });
        S.commit(); return Promise.resolve({ ok: true });
      }
      return sb.from('staff_permissions').upsert({ user_id: userId, sections: sections, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).then(function (r) {
        return r.error ? { ok: false, error: /staff_permissions/.test(r.error.message) ? 'Not set up yet. Run supabase/11_staff_permissions.sql in Supabase.' : r.error.message } : { ok: true };
      });
    },
    remove: function (userId) {
      if (!isAdmin()) return Promise.resolve({ ok: false, error: 'Only the main admin can take permissions back.' });
      if (!sb) { var rows = local(), i = -1; rows.forEach(function (x, n) { if (x.userId === userId) i = n; }); if (i > -1) rows.splice(i, 1); S.commit(); return Promise.resolve({ ok: true }); }
      return sb.from('staff_permissions').delete().eq('user_id', userId).then(function (r) { return r.error ? { ok: false, error: r.error.message } : { ok: true }; });
    }
  };

  w.CC.Staff = Staff;
})(window);
