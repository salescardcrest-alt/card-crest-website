/* ============================================================
   Card Crest — pages/trackerAdmin.js
   Admin → Tracker links: one place to set the back link (tracker / affiliate / partner link) for every product and
   service. When a user clicks the product, store or card, they are sent to that link. Plugged into /admin by admin.js.
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, T = w.CC.Trackers, O = w.CC.Offers, C = w.CC.Cards, AP = w.CC.Applications;
  var esc = UI.esc;

  var TABS = [
    ['service', 'Products & services', 'The four products on the home page. With a link set, clicking the product opens it in a new tab instead of the built-in request page.'],
    ['store', 'Cashback stores', 'Where a shopper is sent when they activate cashback or tap “Go to the store”. Put {click} where the network wants the tracking reference, so each order can be matched to the shopper.'],
    ['card', 'Credit cards', 'Where “Apply for this card” sends the applicant. Use the bank’s own partner link. {ref} is Card Crest’s partner code and {click} the application reference.'],
    ['bank', 'Banks (default)', 'One link for all of a bank’s cards that have no link of their own. A card’s own link always wins.']
  ];
  var tab = 'service';

  var TA = { sections: [['trackers', 'Tracker links']], views: {} };

  function items(kind) {
    if (kind === 'service') return T.SERVICES.map(function (s) { return { id: s[0], name: s[1], sub: s[2] }; });
    if (kind === 'store') return O.allStores().map(function (s) { return { id: s.id, name: s.name, sub: s.category || '', logo: UI.logo(s, 'logo-badge--sm') }; });
    if (kind === 'bank') return C.banks().map(function (b) { return { id: b.id, name: b.name, sub: 'All ' + b.name + ' cards', logo: UI.bankLogo ? UI.bankLogo(b, 'bank-logo--sm') : '' }; });
    var seen = {}, out = [];
    C.allIncludingInactive().concat(C.partners()).forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = 1;
      var b = C.bank(c.bank);
      out.push({ id: c.id, name: c.name, sub: b ? b.name : '' });
    });
    return out;
  }
  function find(kind, id) { return items(kind).filter(function (x) { return x.id === id; })[0]; }

  function status(kind, id) {
    var r = T.row(kind, id);
    if (!r) return '<span class="badge badge--grey">Not set</span>';
    return r.active === false ? '<span class="badge badge--warn">Switched off</span>' : '<span class="badge badge--ok">Live</span>';
  }
  function row(kind, it) {
    var r = T.row(kind, it.id), set = !!r;
    return '<tr data-tk-row="' + kind + '|' + esc(it.id) + '">' +
      '<td><div class="row" style="gap:10px">' + (it.logo || '') + '<div><strong>' + esc(it.name) + '</strong>' + (it.sub ? '<div class="small muted">' + esc(it.sub) + '</div>' : '') + '</div></div></td>' +
      '<td style="min-width:300px"><input type="url" data-tk-url inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://…" value="' + esc(r ? r.url : '') + '" style="width:100%; height:38px; font-size:.86rem" aria-label="Tracker link for ' + esc(it.name) + '"></td>' +
      '<td data-tk-status>' + status(kind, it.id) + '</td>' +
      '<td><div class="row row--wrap" style="gap:6px">' +
        '<button class="btn btn--xs btn--primary" data-tk-save>Save</button>' +
        '<button class="btn btn--xs btn--ghost" data-tk-test>Test</button>' +
        (set ? '<button class="btn btn--xs btn--soft" data-tk-toggle>' + (r.active === false ? 'Switch on' : 'Switch off') + '</button>' +
               '<button class="btn btn--xs btn--danger" data-tk-clear>Remove</button>' : '') +
      '</div></td></tr>';
  }
  function panel(kind, note) {
    var list = items(kind);
    return '<div data-tk-panel="' + kind + '"' + (kind === tab ? '' : ' hidden') + '>' +
      '<div class="note" style="margin-bottom:14px">' + note + '</div>' +
      '<div class="mkt__bar"><input type="search" data-tk-filter placeholder="Search ' + esc(TABS.filter(function (t) { return t[0] === kind; })[0][1].toLowerCase()) + '" style="flex:1"></div>' +
      '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Tracker link</th><th>Status</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (it) { return row(kind, it); }).join('') : '<tr><td colspan="4" class="muted" style="padding:34px; text-align:center">Nothing here yet.</td></tr>') +
      '</tbody></table></div></div></div>';
  }
  function tabLabel(t) { return t[1] + ' <span class="small muted">' + T.count(t[0]) + '/' + items(t[0]).length + '</span>'; }

  TA.views.trackers = function () {
    return '<div data-tk-root>' +
      '<div class="note" style="margin-bottom:16px"><strong>How it works.</strong> Paste the tracker link you were given for a product, store or card, then press <b>Save</b>. ' +
      'From then on, when a user clicks it on the website they are sent to that link. Where nothing is set, Card Crest keeps using its built-in behaviour. ' +
      'You can use <code>{click}</code> (a unique tracking reference for that click), <code>{ref}</code> (Card Crest’s partner code) and <code>{user}</code> (the member’s id) inside a link. ' +
      'Press <b>Test</b> to open a link before you save it.</div>' +
      '<div class="tabs" role="tablist" style="margin-bottom:18px">' + TABS.map(function (t) {
        return '<button type="button" role="tab" data-tk-tab="' + t[0] + '" class="' + (t[0] === tab ? 'is-on' : '') + '">' + tabLabel(t) + '</button>';
      }).join('') + '</div>' +
      TABS.map(function (t) { return panel(t[0], t[2]); }).join('') + '</div>';
  };

  TA.bind = function (root) {
    var box = root.querySelector('[data-tk-root]');
    if (!box) return;

    function counts() { box.querySelectorAll('[data-tk-tab]').forEach(function (b) { b.innerHTML = tabLabel(TABS.filter(function (t) { return t[0] === b.dataset.tkTab; })[0]); }); }
    function redraw(tr) {
      var p = tr.dataset.tkRow.split('|'), it = find(p[0], p.slice(1).join('|'));
      if (!it) return;
      var tmp = d.createElement('tbody'); tmp.innerHTML = row(p[0], it);
      tr.replaceWith(tmp.firstChild); counts();
    }
    function parts(tr) { var p = tr.dataset.tkRow.split('|'); return { kind: p[0], id: p.slice(1).join('|') }; }

    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tkTab) {
        tab = b.dataset.tkTab;
        box.querySelectorAll('[data-tk-tab]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        box.querySelectorAll('[data-tk-panel]').forEach(function (x) { x.hidden = x.dataset.tkPanel !== tab; });
        return;
      }
      var tr = b.closest('[data-tk-row]'); if (!tr) return;
      var k = parts(tr), input = tr.querySelector('[data-tk-url]');
      if (b.hasAttribute('data-tk-save')) {
        b.disabled = true;
        T.save(k.kind, k.id, input.value, '').then(function (res) {
          if (!res.ok) { b.disabled = false; return UI.toast(res.error, 'error'); }
          UI.toast(res.cleared ? 'Link removed' : 'Tracker link saved');
          redraw(tr);
        });
      } else if (b.hasAttribute('data-tk-test')) {
        var url = input.value.trim();
        if (!/^https?:\/\/[^\s]+$/i.test(url)) return UI.toast('Type a link that starts with https:// first', 'error');
        var opened = w.open(T.fill(url, { click: 'TEST-' + Date.now().toString(36), ref: k.kind === 'card' || k.kind === 'bank' ? AP.partnerRef(k.kind === 'bank' ? k.id : (C.byId(k.id) || {}).bank) : '', user: 'test' }), '_blank', 'noopener');
        if (!opened) UI.toast('Allow pop-ups for this site to test the link', 'error');
      } else if (b.hasAttribute('data-tk-toggle')) {
        var r = T.row(k.kind, k.id);
        T.setActive(k.kind, k.id, r && r.active === false).then(function (res) { if (!res.ok) return UI.toast(res.error, 'error'); redraw(tr); });
      } else if (b.hasAttribute('data-tk-clear')) {
        UI.confirm('Remove this link?', 'Users will go back to the built-in behaviour for “' + (find(k.kind, k.id) || {}).name + '”.', 'Remove', function () {
          T.save(k.kind, k.id, '', '').then(function (res) { if (!res.ok) return UI.toast(res.error, 'error'); UI.toast('Link removed'); redraw(tr); });
        });
      }
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('[data-tk-url]')) { e.preventDefault(); e.target.closest('[data-tk-row]').querySelector('[data-tk-save]').click(); }
    });
    box.addEventListener('input', UI.debounce(function (e) {
      if (!e.target.matches('[data-tk-filter]')) return;
      var q = e.target.value.toLowerCase(), pan = e.target.closest('[data-tk-panel]');
      pan.querySelectorAll('tbody tr').forEach(function (tr) { tr.style.display = tr.textContent.toLowerCase().indexOf(q) > -1 || (tr.querySelector('input') && tr.querySelector('input').value.toLowerCase().indexOf(q) > -1) ? '' : 'none'; });
    }, 150));
  };

  w.CC.TrackerAdmin = TA;
})(window, document);
