/* ============================================================
   Card Crest — trackerService.js
   Tracker (back) links set by staff in Admin → Tracker links.
   Every product and service can have one link:
     service  the four home page products (Lounge, Movies, Pay & Earn, Order & Earn)
     store    each cashback store: where "Activate" / "Go to the store" sends the shopper
     card     each credit card: where "Apply for this card" sends the applicant
     bank     a default for every card of that bank that has no link of its own
   A link may hold {click} (the tracking reference), {ref} (Card Crest's partner code) and {user} (the member's id).
   On the live site the links live in the tracker_links table (supabase/09_tracker_links.sql) so every visitor gets them;
   in demo mode they are kept in this browser.
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store, sb = null, loaded = null;

  var SERVICES = [
    ['lounge', 'Lounge Access', 'Airport lounge requests'],
    ['movie', 'Movie Tickets', 'Movie offer requests'],
    ['pay', 'Pay & Earn', 'Pay with someone else’s card offer'],
    ['order', 'Order & Earn', 'Order with someone else’s card offer']
  ];

  function col() {
    var all = S.all();
    if (!all.trackers) all.trackers = [];
    return all.trackers;
  }
  function idOf(kind, refId) { return kind + ':' + refId; }
  function safe(url) { return /^https?:\/\/[^\s]+$/i.test(String(url || '').trim()); }
  function fromDb(r) { return { id: r.id, kind: r.kind, refId: r.ref_id, url: r.url || '', active: r.active !== false, note: r.note || '', updatedAt: r.updated_at || '' }; }

  var Trackers = {
    SERVICES: SERVICES,
    KINDS: ['service', 'store', 'card', 'bank'],

    /* the connection to Supabase, started with the rest of the app, and a first load that every visitor gets */
    init: function (client) {
      sb = client;
      if (!sb) { loaded = Promise.resolve(); return; }
      Trackers.reload();
    },
    reload: function () {
      if (!sb) return Promise.resolve();
      loaded = sb.from('tracker_links').select('*').then(function (r) {
        if (r.error) { console.warn('[Card Crest] tracker links:', r.error.message); return; }
        var all = S.all(); all.trackers = (r.data || []).map(fromDb); S.commit();
        w.dispatchEvent(new CustomEvent('cc:trackers'));
      }, function () {});
      return loaded;
    },
    ready: function () { return loaded || Promise.resolve(); },

    row: function (kind, refId) {
      var id = idOf(kind, refId);
      return col().filter(function (r) { return r.id === id; })[0] || null;
    },
    /* the link to use, or '' when none is set (or it is switched off, or is not a web address) */
    get: function (kind, refId) {
      var r = Trackers.row(kind, refId);
      return r && r.active !== false && safe(r.url) ? String(r.url).trim() : '';
    },
    count: function (kind) {
      return col().filter(function (r) { return r.kind === kind && r.active !== false && safe(r.url); }).length;
    },
    fill: function (url, vars) {
      vars = vars || {};
      return String(url).replace(/\{(click|ref|user)\}/g, function (m, k) { return encodeURIComponent(vars[k] == null ? '' : vars[k]); });
    },
    serviceUrl: function (key) {
      var u = Trackers.get('service', key);
      return u ? Trackers.fill(u, { click: 'svc-' + key + '-' + Date.now().toString(36), user: (w.CC.Auth && w.CC.Auth.current() || {}).id || '' }) : '';
    },

    /* set, change or clear (empty address) one link; resolves { ok } or { ok: false, error } */
    save: function (kind, refId, url, note) {
      url = String(url || '').trim(); note = String(note || '').trim();
      var id = idOf(kind, refId), had = Trackers.row(kind, refId);
      if (url && !safe(url)) return Promise.resolve({ ok: false, error: 'The link must start with https:// (or http://) and have no spaces.' });
      var who = w.CC.Auth && w.CC.Auth.current();
      if (!who || (who.role !== 'admin' && !(w.CC.Staff && w.CC.Staff.can('trackers')))) return Promise.resolve({ ok: false, error: 'Only staff can change tracker links.' });
      function local() {
        var rows = col(), now = new Date().toISOString();
        if (!url) { var i = rows.indexOf(had); if (i > -1) rows.splice(i, 1); }
        else if (had) { had.url = url; had.note = note; had.active = true; had.updatedAt = now; }
        else rows.unshift({ id: id, kind: kind, refId: refId, url: url, active: true, note: note, updatedAt: now });
        S.commit();
        w.dispatchEvent(new CustomEvent('cc:trackers'));
        return { ok: true, cleared: !url };
      }
      if (!sb) return Promise.resolve(local());
      var q = url
        ? sb.from('tracker_links').upsert({ id: id, kind: kind, ref_id: refId, url: url, note: note, active: true, updated_at: new Date().toISOString(), updated_by: who.id })
        : sb.from('tracker_links').delete().eq('id', id);
      return q.then(function (r) {
        if (r.error) {
          var m = r.error.message || '';
          return { ok: false, error: /tracker_links|schema cache|does not exist/i.test(m) ? 'Tracker links are not switched on for this project yet. Run supabase/09_tracker_links.sql in Supabase.' : m };
        }
        return local();
      }, function () { return { ok: false, error: 'Could not reach the server. Try again.' }; });
    },
    setActive: function (kind, refId, on) {
      var r = Trackers.row(kind, refId);
      if (!r) return Promise.resolve({ ok: false, error: 'Set a link first.' });
      var who = w.CC.Auth && w.CC.Auth.current();
      if (!who || (who.role !== 'admin' && !(w.CC.Staff && w.CC.Staff.can('trackers')))) return Promise.resolve({ ok: false, error: 'Only staff can change tracker links.' });
      function local() { r.active = !!on; S.commit(); w.dispatchEvent(new CustomEvent('cc:trackers')); return { ok: true }; }
      if (!sb) return Promise.resolve(local());
      return sb.from('tracker_links').update({ active: !!on, updated_at: new Date().toISOString() }).eq('id', r.id).then(function (x) { return x.error ? { ok: false, error: x.error.message } : local(); });
    }
  };

  w.CC.Trackers = Trackers;
})(window);
