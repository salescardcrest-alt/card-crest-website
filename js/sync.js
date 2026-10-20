/* ============================================================
   Card Crest — sync.js
   Write-through bridge between the local Store and Supabase.
   - Every insert / update / remove on a synced collection is also
     sent to its Supabase table (see supabase/02_data_tables.sql).
   - hydrate() loads the signed-in user's rows (all rows for admins)
     into the Store after sign-in, so services keep reading synchronously.
   Inactive when Supabase is not configured.
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var sb = null;

  /* field spec: 'jsName' or 'jsName:db_name' (default db name is snake_case) */
  var SPEC = {
    transactions:  { table: 'transactions',  user: true,  fields: ['userId', 'storeId', 'offerId', 'amount', 'cashback', 'status', 'retailerUrl', 'createdAt', 'updatedAt'] },
    applications:  { table: 'applications',  user: true,  fields: ['userId', 'cardId', 'status', 'notes', 'createdAt', 'updatedAt'] },
    redemptions:   { table: 'redemptions',   user: true,  fields: ['userId', 'amount', 'method', 'destination', 'status', 'ref', 'createdAt'] },
    referrals:     { table: 'referrals',     user: true,  fields: ['userId', 'name', 'status', 'reward', 'createdAt'] },
    notifications: { table: 'notifications', user: true,  fields: ['userId', 'type', 'title', 'body', 'read', 'createdAt'] },
    tickets:       { table: 'tickets',       user: false, fields: ['userId', 'name', 'email', 'category', 'message', 'status', 'createdAt'] },
    savedCards:    { table: 'saved_cards',   user: true,  fields: ['userId', 'cardId', 'primary:is_primary', 'savedAt:saved_at'] },
    favourites:    { table: 'favourites',    user: true,  fields: ['userId', 'offerId', 'at:created_at'] }
  };

  function snake(k) { return k.replace(/[A-Z]/g, function (m) { return '_' + m.toLowerCase(); }); }
  function pairs(spec) {
    return spec.fields.map(function (f) {
      var p = f.split(':');
      return { js: p[0], db: p[1] || snake(p[0]) };
    });
  }
  function toDb(spec, obj) {
    var out = {};
    pairs(spec).forEach(function (p) { if (p.js in obj) out[p.db] = obj[p.js]; });
    if ('id' in obj) out.id = obj.id;
    return out;
  }
  function fromDb(spec, row) {
    var out = { id: row.id };
    pairs(spec).forEach(function (p) {
      if (row[p.db] !== null && row[p.db] !== undefined) out[p.js] = row[p.db];
    });
    return out;
  }

  function run(q) {
    q.then(function (r) {
      if (r.error) {
        console.warn('[Card Crest] Supabase write failed:', r.error.message);
        w.CC.UI.toast(r.error.message || 'Could not save that to the server', 'error');
      }
    });
  }

  function onWrite(op, col, row, patch) {
    if (!sb) return;

    if (col === 'users') { // admin enabling / disabling an account
      if (op === 'update' && UUID.test(row.id) && patch && Object.keys(patch).join() === 'active') {
        run(sb.from('profiles').update({ active: patch.active }).eq('id', row.id));
      }
      return;
    }

    var spec = SPEC[col];
    if (!spec) return;
    if (spec.user && !UUID.test(row.userId || '')) return; // demo / seed rows stay local

    if (op === 'insert') run(sb.from(spec.table).insert(toDb(spec, row)));
    else if (op === 'update') run(sb.from(spec.table).update(toDb(spec, patch)).eq('id', row.id));
    else run(sb.from(spec.table).delete().eq('id', row.id));
  }

  var Sync = {
    init: function (client) {
      sb = client;
      if (sb) S.hook(onWrite);
    },

    hydrate: function (user) {
      if (!sb) return Promise.resolve();
      var jobs = Object.keys(SPEC).map(function (col) {
        var spec = SPEC[col];
        return sb.from(spec.table).select('*').then(function (r) {
          if (r.error) { console.warn('[Card Crest] load ' + spec.table + ':', r.error.message); return; }
          S.set(col, r.data.map(function (row) { return fromDb(spec, row); }));
        });
      });
      if (user && user.role === 'admin') {
        jobs.push(sb.from('profiles').select('*').then(function (r) {
          if (r.error) return;
          S.set('users', r.data.map(function (p) { return Object.assign({}, p, { avatar: p.avatar_url || '' }); }));
        }));
      }
      return Promise.all(jobs).catch(function () {});
    },

    /* On sign-out: drop the previous user's rows from this browser. */
    clear: function () {
      if (!sb) return;
      Object.keys(SPEC).forEach(function (col) { S.set(col, []); });
    }
  };

  w.CC.Sync = Sync;
})(window);
