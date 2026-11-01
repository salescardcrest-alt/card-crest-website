/* ============================================================
   Card Crest — services/catalogLive.js
   One shared catalogue. Cards, stores and offers edited in Admin are written to Supabase (table catalog_items,
   supabase/10_catalog_live.sql) instead of staying in the admin's browser, so every visitor and the Android app see the
   same thing. Each row is laid over the built-in catalogue: same id replaces, new id adds, "deleted" hides.
   Changes arrive live through Supabase Realtime. Inactive without Supabase (demo mode keeps using the local store only).
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store, D = w.CC.DATA;
  var sb = null, loaded = Promise.resolve(), mine = {};
  var COL = { card: 'cards', store: 'stores', offer: 'offers' };
  var KIND = { cards: 'card', stores: 'store', offers: 'offer' };

  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function isAdmin() { var u = w.CC.Auth && w.CC.Auth.current && w.CC.Auth.current(); return !!u && u.role === 'admin'; }

  function applyRows(rows) {
    var changed = false;
    (rows || []).forEach(function (r) {
      var col = COL[r.kind]; if (!col) return;
      var list = S.get(col), i = -1;
      list.forEach(function (x, n) { if (x.id === r.id) i = n; });
      if (r.deleted) { if (i > -1) { list.splice(i, 1); changed = true; } return; }
      var item = Object.assign({ active: true }, r.data || {}, { id: r.id });
      if (i > -1) list[i] = item; else list.push(item);
      changed = true;
    });
    if (changed) S.commit();
    return changed;
  }

  function typing() {
    var a = w.document.activeElement;
    return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || !!w.document.querySelector('.modal, [data-modal]');
  }

  var CatalogLive = {
    owns: function (col) { return !!KIND[col]; },
    ready: function () { return loaded; },

    init: function (client) {
      sb = client;
      if (!sb) return;
      loaded = CatalogLive.reload();
      sb.channel('cc-catalog').on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_items' }, function (p) {
        var row = p.new && p.new.kind ? p.new : (p.old && p.old.kind ? Object.assign({}, p.old, { deleted: true }) : null);
        if (!row) return;
        var own = mine[row.kind + ':' + row.id] && Date.now() - mine[row.kind + ':' + row.id] < 15000;
        if (applyRows([row]) && !own && !typing() && w.CC.Router) w.CC.Router.refresh();
      }).subscribe();
    },

    reload: function () {
      return sb.from('catalog_items').select('*').then(function (r) {
        if (r.error) { console.warn('[Card Crest] catalogue:', r.error.message); return; }
        CatalogLive.rows = r.data || [];
        applyRows(CatalogLive.rows);
      }, function () {});
    },

    /* an admin's earlier edits (made before this existed) live only in this browser: send whatever differs from the built-in catalogue once */
    publishLocal: function () {
      if (!sb || !isAdmin()) return Promise.resolve();
      return loaded.then(function () {
        var have = {}, out = [];
        (CatalogLive.rows || []).forEach(function (r) { have[r.kind + ':' + r.id] = 1; });
        Object.keys(KIND).forEach(function (col) {
          var kind = KIND[col], base = D[col] || [], local = S.get(col), baseById = {}, localById = {};
          base.forEach(function (b) { baseById[b.id] = b; });
          local.forEach(function (l) {
            localById[l.id] = 1;
            if (have[kind + ':' + l.id]) return;
            var b = baseById[l.id];
            if (!b || stable(l) !== stable(Object.assign({ active: true }, b))) out.push({ kind: kind, id: l.id, data: l, deleted: false });
          });
          base.forEach(function (b) { if (!localById[b.id] && !have[kind + ':' + b.id]) out.push({ kind: kind, id: b.id, data: {}, deleted: true }); });
        });
        if (!out.length) return;
        out.forEach(function (r) { mine[r.kind + ':' + r.id] = Date.now(); });
        return sb.from('catalog_items').upsert(out, { onConflict: 'kind,id' }).then(function (r) {
          if (r.error) console.warn('[Card Crest] catalogue publish:', r.error.message);
        });
      });
    },

    /* called by sync.js for every admin edit of cards, stores and offers */
    push: function (op, col, row) {
      if (!sb || !isAdmin()) return;
      var kind = KIND[col], rec = op === 'remove' ? { kind: kind, id: row.id, data: {}, deleted: true } : { kind: kind, id: row.id, data: row, deleted: false };
      mine[kind + ':' + row.id] = Date.now();
      sb.from('catalog_items').upsert(rec, { onConflict: 'kind,id' }).then(function (r) {
        if (r.error) w.CC.UI.toast(/catalog_items/.test(r.error.message) ? 'The shared catalogue is not set up yet. Run supabase/10_catalog_live.sql in Supabase.' : r.error.message, 'error');
      });
    }
  };

  w.CC.CatalogLive = CatalogLive;
})(window);
