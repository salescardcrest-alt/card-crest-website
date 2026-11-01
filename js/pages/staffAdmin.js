/* ============================================================
   Card Crest — pages/staffAdmin.js
   Admin → Staff access: the main admin picks a member by email and ticks the admin sections that member may use.
   That member then sees the Admin panel with only those sections (and can edit them); nobody else does.
   Main admin only. Plugged into /admin by admin.js.
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, S = w.CC.Store, St = w.CC.Staff, esc = UI.esc;
  var SA = { sections: [['staff', 'Staff access']], views: {} };

  function member(id) { return S.find('users', id); }
  function byEmail(e) { e = String(e || '').trim().toLowerCase(); return S.get('users').filter(function (u) { return String(u.email || '').toLowerCase() === e; })[0]; }
  function label(k) { return (St.SECTIONS.filter(function (s) { return s[0] === k; })[0] || [k, k])[1]; }

  SA.views.staff = function () {
    return '<div data-sa>' +
      '<div class="note" style="margin-bottom:16px"><strong>Who can use the admin panel.</strong> Give a member only the sections they need. They sign in as usual and see the Admin panel with just those sections, with the option to edit them. ' +
      'Anything you do not tick stays hidden from them, and the database blocks it too. Main admins always see everything.</div>' +
      '<div class="panel" style="margin-bottom:22px"><h3 class="h3" style="margin-bottom:12px" data-sa-title>Give access</h3>' +
      '<div class="field"><label for="sa-email">Member’s email</label><div class="row" style="gap:8px; flex-wrap:nowrap"><input id="sa-email" type="email" autocomplete="off" spellcheck="false" placeholder="name@example.com" style="flex:1">' +
      '<button class="btn btn--ghost btn--sm" data-sa-find type="button">Find</button></div><span class="hint" data-sa-who></span></div>' +
      '<div class="stack" style="margin:8px 0 14px">' + St.SECTIONS.map(function (s) {
        return '<label class="check"><input type="checkbox" data-sa-sec="' + s[0] + '"> <strong>' + s[1] + '</strong> <span class="muted small">' + s[2] + '</span></label>';
      }).join('') + '</div>' +
      '<div class="row" style="gap:8px"><button class="btn btn--primary btn--sm" data-sa-save type="button">Save access</button><button class="btn btn--ghost btn--sm" data-sa-clear type="button">Clear</button></div></div>' +
      '<h3 class="h3" style="margin-bottom:10px">Members with access</h3><div data-sa-list><p class="muted">Loading…</p></div></div>';
  };

  SA.bind = function (root) {
    var box = root.querySelector('[data-sa]');
    if (!box) return;
    var target = null;
    function $(s) { return box.querySelector(s); }
    function ticks() { return Array.prototype.map.call(box.querySelectorAll('[data-sa-sec]:checked'), function (c) { return c.dataset.saSec; }); }
    function fill(u, sections) {
      target = u; $('#sa-email').value = u ? u.email : '';
      $('[data-sa-who]').textContent = u ? u.name + (u.role === 'admin' ? ' · main admin (already has everything)' : '') : '';
      box.querySelectorAll('[data-sa-sec]').forEach(function (c) { c.checked = !!sections && sections.indexOf(c.dataset.saSec) > -1; });
      $('[data-sa-title]').textContent = u ? 'Access for ' + u.name : 'Give access';
    }
    function draw() {
      St.list().then(function (rows) {
        var host = $('[data-sa-list]');
        if (!rows.length) { host.innerHTML = '<p class="muted">No one yet. Only main admins can use the admin panel.</p>'; return; }
        host.innerHTML = '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Member</th><th>Can use</th><th></th></tr></thead><tbody>' + rows.map(function (r) {
          var u = member(r.userId);
          return '<tr data-sa-row="' + esc(r.userId) + '"><td><strong>' + esc(u ? u.name : r.userId.slice(0, 8)) + '</strong><div class="small muted" style="text-transform:none">' + esc(u ? u.email : '') + '</div></td>' +
            '<td>' + r.sections.map(function (k) { return '<span class="badge badge--info" style="margin:2px 4px 2px 0">' + esc(label(k)) + '</span>'; }).join('') + '</td>' +
            '<td><div class="row" style="gap:6px; flex-wrap:nowrap"><button class="btn btn--xs btn--ghost" data-sa-edit>Edit</button><button class="btn btn--xs btn--danger" data-sa-remove>Remove all</button></div></td></tr>';
        }).join('') + '</tbody></table></div></div>';
        host.querySelectorAll('[data-sa-row]').forEach(function (tr) {
          var id = tr.dataset.saRow, row = rows.filter(function (x) { return x.userId === id; })[0];
          tr.querySelector('[data-sa-edit]').onclick = function () { fill(member(id) || { id: id, name: id.slice(0, 8), email: '' }, row.sections); w.scrollTo(0, 0); };
          tr.querySelector('[data-sa-remove]').onclick = function () {
            UI.confirm('Take back all access?', (member(id) ? member(id).name : 'This member') + ' will no longer see the admin panel.', 'Remove', function () {
              St.remove(id).then(function (r) { if (!r.ok) return UI.toast(r.error, 'error'); UI.toast('Access removed'); fill(null, []); draw(); });
            }, true);
          };
        });
      });
    }
    $('[data-sa-find]').onclick = function () {
      var u = byEmail($('#sa-email').value);
      if (!u) { fill(null, []); $('[data-sa-who]').textContent = 'No member with that email. They need to sign up first.'; return; }
      St.list().then(function (rows) { var r = rows.filter(function (x) { return x.userId === u.id; })[0]; fill(u, r ? r.sections : []); });
    };
    $('#sa-email').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('[data-sa-find]').click(); } });
    $('[data-sa-clear]').onclick = function () { fill(null, []); $('#sa-email').value = ''; };
    $('[data-sa-save]').onclick = function () {
      var u = target || byEmail($('#sa-email').value);
      if (!u) return UI.toast('Find the member by email first', 'error');
      if (u.role === 'admin') return UI.toast('A main admin already has access to everything', 'error');
      var picked = ticks();
      if (!picked.length) return UI.toast('Tick at least one section, or use Remove all in the list', 'error');
      var b = this; b.disabled = true;
      St.save(u.id, picked).then(function (r) {
        b.disabled = false;
        if (!r.ok) return UI.toast(r.error, 'error');
        UI.toast(u.name + ' can now use ' + picked.map(label).join(', ')); fill(null, []); draw();
      });
    };
    draw();
  };

  w.CC.StaffAdmin = SA;
})(window, document);
