/* ============================================================
   Card Crest — pages/adminApp.js
   Admin sections shared with the Android app's admin: Banners (home slideshow), Missing cashback claims, User reports.
   Both admins read and write the same Supabase tables, so a change in one shows in the other.
   Tables: home_banners (+ storage bucket "banners"), cashback_claims, user_reports. Needs Supabase (not available in demo mode).
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, S = w.CC.Store, esc = UI.esc;
  var AA = { sections: [['banners', 'Banners'], ['claims', 'Cashback claims'], ['reports', 'User reports']], views: {} };

  var PAGES = [['coupons', 'All coupons'], ['offers', 'All stores'], ['apply-earn', 'Apply & Earn'], ['cards', 'Cards'], ['referrals', 'Refer & Earn'], ['earn', 'Share & Earn'],
    ['lounge', 'Lounge Access'], ['movies', 'Movie Offers'], ['compare', 'Compare cards'], ['leaderboard', 'Top savers'], ['rewards', 'Rewards']];
  var TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  function sb() { return w.CC.Auth && w.CC.Auth.client; }
  function who(id) { var u = S.find('users', id); return u ? u.name : String(id || '').slice(0, 8); }
  function shell(id, note) {
    return '<div data-aa="' + id + '"><div class="note" style="margin-bottom:16px">' + note + '</div>' +
      (sb() ? '<p class="muted" data-aa-body>Loading…</p>' : '<div class="note note--warn">This section needs the live Supabase connection, so it is not available in demo mode.</div>') + '</div>';
  }
  function missing(err, file) {
    return /does not exist|schema cache|relation|Bucket not found/i.test(err.message || '') ? 'Not set up yet. Run ' + file + ' in the Supabase SQL Editor.' : err.message;
  }
  function table(head, rows, empty) {
    return '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl"><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.join('') : '<tr><td colspan="' + head.length + '" class="muted" style="padding:40px; text-align:center">' + empty + '</td></tr>') + '</tbody></table></div></div>';
  }
  function opts(list, cur) { return list.map(function (o) { return '<option value="' + o + '"' + (o === cur ? ' selected' : '') + '>' + o.charAt(0).toUpperCase() + o.slice(1) + '</option>'; }).join(''); }
  function intro(box) { return box.querySelector('.note').outerHTML; }

  /* ---------------- banners ---------------- */
  AA.views.banners = function () {
    return shell('banners', 'The slideshow at the top of Home in the app. Each banner is a picture and where tapping it goes: a store, a page of the app or a web address. Pictures up to 3 MB (JPG, PNG or WebP). The app shows them in this order.');
  };
  function bannerUrl(b) { return w.CC_CONFIG.SUPABASE_URL + '/storage/v1/object/public/banners/' + b.image_path; }
  function linkValue(kind, val) {
    if (kind === 'store') return '<select data-bn-v style="height:36px">' + w.CC.Offers.allStores().slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === val ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select>';
    if (kind === 'page') return '<select data-bn-v style="height:36px">' + PAGES.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === val ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select>';
    if (kind === 'web') return '<input data-bn-v type="url" placeholder="https://…" value="' + esc(val) + '" style="height:36px; min-width:200px">';
    return '';
  }
  function linkField(link) {
    var kind = /^store:/.test(link) ? 'store' : /^page:/.test(link) ? 'page' : /^https?:/.test(link) ? 'web' : 'none';
    var val = kind === 'store' || kind === 'page' ? link.split(':').slice(1).join(':') : link;
    return '<div class="row" data-bn-link style="gap:6px; flex-wrap:nowrap"><select data-bn-kind style="width:auto; height:36px">' +
      [['none', 'No link'], ['store', 'Store'], ['page', 'App page'], ['web', 'Web address']].map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === kind ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select>' +
      '<span data-bn-val>' + linkValue(kind, val) + '</span></div>';
  }
  function readLink(holder) {
    var k = holder.querySelector('[data-bn-kind]').value, v = holder.querySelector('[data-bn-v]');
    v = v ? v.value.trim() : '';
    if (k === 'none') return { ok: true, link: '' };
    if (k === 'web' && !/^https?:\/\/[^\s]+$/i.test(v)) return { ok: false, error: 'The web address must start with https://' };
    return { ok: true, link: k === 'web' ? v : k + ':' + v };
  }
  function drawBanners(box) {
    sb().from('home_banners').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false }).then(function (r) {
      var body = box.querySelector('[data-aa-body]');
      if (r.error) { body.outerHTML = '<div class="note note--warn">' + esc(missing(r.error, 'supabase/14_home_banners.sql')) + '</div>'; return; }
      var next = r.data.length ? Math.max.apply(null, r.data.map(function (b) { return b.sort || 0; })) + 1 : 1;
      var add = '<div class="panel" style="margin-bottom:18px"><h3 class="h3" style="margin-bottom:12px">Add a banner</h3><div class="form-grid">' +
        '<div class="field"><label for="bn-file">Picture</label><input id="bn-file" type="file" accept="image/jpeg,image/png,image/webp"></div>' +
        '<div class="field"><label for="bn-title">Title (optional)</label><input id="bn-title" maxlength="80"></div>' +
        '<div class="field"><label>Where it goes</label><div data-bn-new>' + linkField('') + '</div></div>' +
        '<div class="field"><label for="bn-sort">Order (lower shows first)</label><input id="bn-sort" type="number" value="' + next + '"></div></div>' +
        '<p class="err" id="bn-err" style="color:var(--danger); font-size:.88rem; display:none"></p><button class="btn btn--primary btn--sm" id="bn-add" style="margin-top:8px">Add banner</button></div>';
      var rows = r.data.map(function (b) {
        return '<tr data-bn="' + esc(b.id) + '"><td><img src="' + esc(bannerUrl(b)) + '" alt="" style="width:120px; height:56px; object-fit:cover; border-radius:8px"></td>' +
          '<td><input data-bn-title value="' + esc(b.title) + '" maxlength="80" style="height:36px; min-width:130px"></td><td>' + linkField(b.link) + '</td>' +
          '<td><input data-bn-sort type="number" value="' + (b.sort || 0) + '" style="width:70px; height:36px"></td>' +
          '<td>' + (b.active ? '<span class="badge badge--ok">Showing</span>' : '<span class="badge badge--grey">Hidden</span>') + '</td>' +
          '<td><div class="row" style="gap:6px; flex-wrap:nowrap"><button class="btn btn--xs btn--primary" data-bn-save>Save</button><button class="btn btn--xs btn--soft" data-bn-toggle>' + (b.active ? 'Hide' : 'Show') + '</button><button class="btn btn--xs btn--danger" data-bn-del>Delete</button></div></td></tr>';
      });
      body.outerHTML = add + table(['Picture', 'Title', 'Goes to', 'Order', 'Status', ''], rows, 'No banners yet.');
      bindBanners(box, r.data);
    });
  }
  function bindBanners(box, data) {
    function again() { box.innerHTML = intro(box) + '<p class="muted" data-aa-body>Loading…</p>'; drawBanners(box); }
    box.onchange = function (e) {
      if (!e.target.matches('[data-bn-kind]')) return;
      e.target.closest('[data-bn-link]').querySelector('[data-bn-val]').innerHTML = linkValue(e.target.value, '');
    };
    box.querySelector('#bn-add').onclick = function () {
      var b = this, err = box.querySelector('#bn-err'), f = box.querySelector('#bn-file').files[0], lk = readLink(box.querySelector('[data-bn-new]'));
      function bad(m) { err.textContent = m; err.style.display = 'block'; }
      err.style.display = 'none';
      if (!f) return bad('Choose a picture.');
      if (!TYPES[f.type]) return bad('The picture must be a JPG, PNG or WebP.');
      if (f.size > 3145728) return bad('The picture must be 3 MB or smaller.');
      if (!lk.ok) return bad(lk.error);
      var id = 'bnr-' + Math.random().toString(16).slice(2, 10) + Date.now().toString(16), path = id + '.' + TYPES[f.type];
      b.disabled = true;
      sb().storage.from('banners').upload(path, f, { contentType: f.type, upsert: false }).then(function (u) {
        if (u.error) throw u.error;
        return sb().from('home_banners').insert({ id: id, image_path: path, title: box.querySelector('#bn-title').value.trim(), link: lk.link, sort: Number(box.querySelector('#bn-sort').value) || 0, active: true });
      }).then(function (r) {
        if (r.error) throw r.error;
        UI.toast('Banner added'); again();
      }).catch(function (e2) { b.disabled = false; bad(missing(e2, 'supabase/14_home_banners.sql')); });
    };
    box.querySelectorAll('[data-bn]').forEach(function (tr) {
      var id = tr.dataset.bn, row = data.filter(function (x) { return x.id === id; })[0];
      function done(r, msg) { if (r.error) return UI.toast(r.error.message, 'error'); UI.toast(msg); again(); }
      tr.querySelector('[data-bn-save]').onclick = function () {
        var lk = readLink(tr.querySelector('[data-bn-link]'));
        if (!lk.ok) return UI.toast(lk.error, 'error');
        sb().from('home_banners').update({ title: tr.querySelector('[data-bn-title]').value.trim(), link: lk.link, sort: Number(tr.querySelector('[data-bn-sort]').value) || 0 }).eq('id', id).then(function (r) { done(r, 'Banner saved'); });
      };
      tr.querySelector('[data-bn-toggle]').onclick = function () { sb().from('home_banners').update({ active: !row.active }).eq('id', id).then(function (r) { done(r, row.active ? 'Banner hidden' : 'Banner showing'); }); };
      tr.querySelector('[data-bn-del]').onclick = function () {
        UI.confirm('Delete this banner?', 'It disappears from the app and the picture is removed.', 'Delete', function () {
          sb().from('home_banners').delete().eq('id', id).then(function (r) {
            if (!r.error) sb().storage.from('banners').remove([row.image_path]);
            done(r, 'Banner deleted');
          });
        }, true);
      };
    });
  }

  /* ---------------- missing cashback claims ---------------- */
  AA.views.claims = function () {
    return shell('claims', 'Purchases a member says did not track. Move a claim to reviewing, approved or rejected and add a reply: the member is notified automatically (in the app and on the website).');
  };
  var CLAIM_STATUS = ['submitted', 'reviewing', 'approved', 'rejected'];
  function drawClaims(box) {
    sb().from('cashback_claims').select('*').order('created_at', { ascending: false }).limit(300).then(function (r) {
      var body = box.querySelector('[data-aa-body]');
      if (r.error) { body.outerHTML = '<div class="note note--warn">' + esc(missing(r.error, 'supabase/11_cashback_claims.sql')) + '</div>'; return; }
      var rows = r.data.map(function (c) {
        var st = w.CC.Offers.store(c.store_id);
        return '<tr data-cl="' + esc(c.id) + '"><td><strong>' + esc(who(c.user_id)) + '</strong><div class="small muted">' + UI.date(c.created_at) + '</div></td>' +
          '<td>' + esc(st ? st.name : c.store_id) + '<div class="small mono muted">' + esc(c.order_id) + '</div></td><td class="muted" style="white-space:nowrap">' + esc(c.order_date) + '</td>' +
          '<td class="num">' + UI.money(c.amount) + '</td><td style="max-width:220px">' + esc(c.note || '') + (c.invoice_path ? '<div><a href="#" data-cl-inv="' + esc(c.invoice_path) + '">View invoice</a></div>' : '') + '</td>' +
          '<td><select data-cl-status style="height:36px; width:auto">' + opts(CLAIM_STATUS, c.status) + '</select></td>' +
          '<td><input data-cl-reply value="' + esc(c.reply || '') + '" maxlength="300" placeholder="Reply to the member" style="height:36px; min-width:180px"></td>' +
          '<td><button class="btn btn--xs btn--primary" data-cl-save>Save</button></td></tr>';
      });
      body.outerHTML = '<div class="mkt__bar"><input type="search" data-aa-filter placeholder="Search claims" style="flex:1"></div>' + table(['Member', 'Store and order', 'Order date', 'Amount', 'Note', 'Status', 'Reply', ''], rows, 'No claims yet.');
      box.querySelectorAll('[data-cl]').forEach(function (tr) {
        tr.querySelector('[data-cl-save]').onclick = function () {
          var b = this; b.disabled = true;
          sb().from('cashback_claims').update({ status: tr.querySelector('[data-cl-status]').value, reply: tr.querySelector('[data-cl-reply]').value.trim() || null }).eq('id', tr.dataset.cl).then(function (r2) {
            b.disabled = false; UI.toast(r2.error ? r2.error.message : 'Claim saved', r2.error ? 'error' : undefined);
          });
        };
        var inv = tr.querySelector('[data-cl-inv]');
        if (inv) inv.onclick = function (e) {
          e.preventDefault();
          sb().storage.from('mk-proofs').createSignedUrl(inv.dataset.clInv, 3600).then(function (r3) { if (r3.data) w.open(r3.data.signedUrl, '_blank', 'noopener'); else UI.toast('Could not open the invoice', 'error'); });
        };
      });
    });
  }

  /* ---------------- user reports ---------------- */
  AA.views.reports = function () {
    return shell('reports', 'Members who reported another member (for example after a Share & Earn request). Set the status and leave a private staff note.');
  };
  var REPORT_STATUS = ['open', 'reviewing', 'closed'];
  function drawReports(box) {
    sb().from('user_reports').select('*').order('created_at', { ascending: false }).limit(300).then(function (r) {
      var body = box.querySelector('[data-aa-body]');
      if (r.error) { body.outerHTML = '<div class="note note--warn">' + esc(missing(r.error, 'supabase/13_payouts_trust_leaderboard.sql')) + '</div>'; return; }
      var rows = r.data.map(function (x) {
        return '<tr data-rp="' + esc(x.id) + '"><td><strong>' + esc(who(x.reported)) + '</strong><div class="small muted">reported by ' + esc(who(x.reporter)) + '</div><div class="small muted">' + UI.date(x.created_at) + '</div></td>' +
          '<td>' + esc(x.reason) + (x.request_id ? '<div class="small mono muted">' + esc(String(x.request_id).slice(-8)) + '</div>' : '') + '</td><td style="max-width:260px">' + esc(x.details) + '</td>' +
          '<td><select data-rp-status style="height:36px; width:auto">' + opts(REPORT_STATUS, x.status) + '</select></td>' +
          '<td><input data-rp-note value="' + esc(x.staff_note || '') + '" placeholder="Staff note" style="height:36px; min-width:180px"></td>' +
          '<td><button class="btn btn--xs btn--primary" data-rp-save>Save</button></td></tr>';
      });
      body.outerHTML = '<div class="mkt__bar"><input type="search" data-aa-filter placeholder="Search reports" style="flex:1"></div>' + table(['Member', 'Reason', 'Details', 'Status', 'Staff note', ''], rows, 'No reports.');
      box.querySelectorAll('[data-rp]').forEach(function (tr) {
        tr.querySelector('[data-rp-save]').onclick = function () {
          var b = this; b.disabled = true;
          sb().from('user_reports').update({ status: tr.querySelector('[data-rp-status]').value, staff_note: tr.querySelector('[data-rp-note]').value.trim() || null }).eq('id', tr.dataset.rp).then(function (r2) {
            b.disabled = false; UI.toast(r2.error ? r2.error.message : 'Report saved', r2.error ? 'error' : undefined);
          });
        };
      });
    });
  }

  AA.bind = function (root) {
    var box;
    if ((box = root.querySelector('[data-aa="banners"]')) && sb()) drawBanners(box);
    if ((box = root.querySelector('[data-aa="claims"]')) && sb()) drawClaims(box);
    if ((box = root.querySelector('[data-aa="reports"]')) && sb()) drawReports(box);
    root.querySelectorAll('[data-aa]').forEach(function (b) {
      b.addEventListener('input', UI.debounce(function (e) {
        if (!e.target.matches('[data-aa-filter]')) return;
        var q = e.target.value.toLowerCase();
        b.querySelectorAll('tbody tr').forEach(function (tr) { tr.style.display = tr.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none'; });
      }, 150));
    });
  };

  w.CC.AdminApp = AA;
})(window, document);
