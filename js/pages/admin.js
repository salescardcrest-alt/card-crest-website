/* ============================================================
   Card Crest — pages/admin.js
   Operations panel. Full CRUD across every entity plus the
   status controls the cashback and application lifecycles need.
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, Auth = w.CC.Auth, S = w.CC.Store, C = w.CC.Cards, O = w.CC.Offers,
      CB = w.CC.Cashback, RW = w.CC.Rewards, RF = w.CC.Referrals,
      AP = w.CC.Applications, SP = w.CC.Support;
  w.CC.Pages = w.CC.Pages || {};

  var SECTIONS = [
    ['overview', 'Overview'], ['users', 'Users'], ['cards', 'Cards'], ['stores', 'Stores'],
    ['offers', 'Offers'], ['transactions', 'Transactions'], ['rewards', 'Rewards'],
    ['applications', 'Applications'], ['referrals', 'Referrals'], ['support', 'Support']
  ];

  function table(head, rows, emptyMsg) {
    return '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.join('') :
        '<tr><td colspan="' + head.length + '" style="padding:40px; text-align:center" class="muted">' + emptyMsg + '</td></tr>') +
      '</tbody></table></div></div>';
  }

  function statusSelect(attr, id, options, current) {
    return '<select data-' + attr + '="' + id + '" style="height:34px; width:auto; font-size:.82rem">' +
      options.map(function (o) {
        return '<option value="' + o + '"' + (o === current ? ' selected' : '') + '>' +
          o.charAt(0).toUpperCase() + o.slice(1).replace('-', ' ') + '</option>';
      }).join('') + '</select>';
  }

  /* ---------------- section renderers ---------------- */
  var views = {};

  views.overview = function () {
    var users = S.get('users').filter(function (u) { return u.role !== 'admin'; });
    var pt = CB.platformTotals();
    var apps = AP.all();
    var reds = RW.all();
    var refs = RF.all();
    var approved = apps.filter(function (a) { return a.status === 'approved' || a.status === 'completed'; }).length;
    var conv = apps.length ? Math.round((approved / apps.length) * 100) : 0;
    // Platform revenue in the demo model: what we keep after paying users back.
    var revenue = Math.round(pt.confirmed * 0.6);

    var months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    var byMonth = months.map(function (_, i) {
      return CB.all().filter(function (t) {
        return new Date(t.createdAt).getMonth() === (2 + i);
      }).reduce(function (a, t) { return a + t.amount; }, 0);
    });
    var peak = Math.max.apply(null, byMonth.concat([1]));

    return '<div class="grid g-4" style="margin-bottom:20px">' +
      stat('Total users', users.length, users.filter(function (u) { return u.active; }).length + ' active') +
      stat('Transactions', pt.count, UI.money(pt.gross) + ' gross value') +
      stat('Confirmed cashback', UI.money(pt.confirmed), UI.money(pt.pending) + ' still pending') +
      stat('Platform revenue', UI.money(revenue), 'After user payouts', true) +
      '</div>' +
      '<div class="grid g-4" style="margin-bottom:26px">' +
      stat('Applications', apps.length, approved + ' approved') +
      stat('Approval rate', conv + '%', 'Across all applications') +
      stat('Redemptions', reds.length, UI.money(reds.reduce(function (a, r) { return a + r.amount; }, 0)) + ' paid out') +
      stat('Referrals', refs.length, refs.filter(function (r) { return r.status === 'successful'; }).length + ' successful') +
      '</div>' +
      '<div class="grid g-2">' +
        '<div class="panel"><h3 class="h3" style="margin-bottom:18px">Tracked order value by month</h3>' +
        '<div class="bar-chart">' + byMonth.map(function (v, i) {
          return '<div class="bar-chart__c"><div class="bar-chart__b" style="height:' + Math.max(3, (v / peak) * 100) + '%"></div>' +
            '<div class="bar-chart__l">' + months[i] + '</div></div>';
        }).join('') + '</div>' +
        '<p class="small muted" style="margin-top:14px">Total value of orders tracked through Card Crest, by month.</p></div>' +
        '<div class="panel"><h3 class="h3" style="margin-bottom:18px">Cashback by status</h3>' +
        [['Confirmed', pt.confirmed, 'var(--leaf)'], ['Pending', pt.pending, 'var(--warn)'], ['Cancelled or rejected', pt.rejected, 'var(--danger)']]
          .map(function (r) {
            var total = pt.confirmed + pt.pending + pt.rejected || 1;
            return '<div style="margin-bottom:16px"><div class="spread small" style="margin-bottom:6px">' +
              '<span>' + r[0] + '</span><strong>' + UI.money(r[1]) + '</strong></div>' +
              '<div class="progress"><div class="progress__b" style="width:' + ((r[1] / total) * 100).toFixed(0) + '%; background:' + r[2] + '"></div></div></div>';
          }).join('') + '</div>' +
      '</div>';

    function stat(k, v, sub, accent) {
      return '<div class="stat' + (accent ? ' stat--accent' : '') + '"><span class="stat__k">' + k + '</span>' +
        '<span class="stat__v">' + v + '</span><span class="stat__sub">' + sub + '</span></div>';
    }
  };

  views.users = function () {
    var rows = S.get('users').map(function (u) {
      var t = CB.totals(u.id);
      return '<tr><td><div class="row" style="gap:10px"><span class="avatar" style="width:32px;height:32px;font-size:.72rem">' +
        UI.initials(u.name) + '</span><div><strong>' + UI.esc(u.name) + '</strong>' +
        '<div class="small muted">' + UI.esc(u.email) + '</div></div></div></td>' +
        '<td class="muted">' + UI.esc(u.city || '—') + '</td>' +
        '<td>' + (u.role === 'admin' ? '<span class="badge badge--info">Staff</span>' : UI.statusBadge(u.active ? 'active' : 'disabled')) + '</td>' +
        '<td class="num">' + UI.money(t.lifetime) + '</td>' +
        '<td class="num">' + t.count + '</td>' +
        '<td><div class="row" style="gap:6px">' +
        '<button class="btn btn--xs btn--ghost" data-user-view="' + u.id + '">View</button>' +
        (u.role === 'admin' ? '' : '<button class="btn btn--xs ' + (u.active ? 'btn--danger' : 'btn--soft') + '" data-user-toggle="' + u.id + '">' +
          (u.active ? 'Disable' : 'Enable') + '</button>') +
        '</div></td></tr>';
    });
    return '<div class="mkt__bar"><input type="search" id="admSearch" data-filter="users" placeholder="Search users by name or email" style="flex:1"></div>' +
      table(['User', 'City', 'Status', 'Lifetime rewards', 'Transactions', ''], rows, 'No users found.');
  };

  views.cards = function () {
    var rows = C.allIncludingInactive().map(function (c) {
      var bank = C.bank(c.bank);
      return '<tr><td><div class="row" style="gap:10px"><div style="width:52px">' + UI.plastic(c, true) + '</div>' +
        '<div><strong>' + UI.esc(c.name) + '</strong><div class="small muted">' + UI.esc(bank ? bank.name : '') + '</div></div></div></td>' +
        '<td class="num">' + (c.annualFee ? UI.money(c.annualFee) : 'Free') + '</td>' +
        '<td class="num">' + UI.pct(c.rewardRate) + '</td>' +
        '<td class="num">' + C.score(c).total + '</td>' +
        '<td>' + UI.statusBadge(c.active === false ? 'disabled' : 'active') + '</td>' +
        '<td><div class="row" style="gap:6px">' +
        '<button class="btn btn--xs btn--ghost" data-card-edit="' + c.id + '">Edit</button>' +
        '<button class="btn btn--xs btn--soft" data-card-toggle="' + c.id + '">' + (c.active === false ? 'Activate' : 'Deactivate') + '</button>' +
        '<button class="btn btn--xs btn--danger" data-card-del="' + c.id + '">Delete</button>' +
        '</div></td></tr>';
    });
    return '<div class="mkt__bar"><input type="search" data-filter="cards" placeholder="Search cards" style="flex:1">' +
      '<button class="btn btn--primary btn--sm" data-card-new>Add a card</button></div>' +
      table(['Card', 'Annual fee', 'Reward rate', 'Value score', 'Status', ''], rows, 'No cards yet.');
  };

  views.stores = function () {
    var rows = O.allStores().map(function (s) {
      return '<tr><td><div class="row" style="gap:10px">' +
        '<div class="logo-badge" style="width:32px;height:32px;border-radius:9px;font-size:.85rem;background:' + s.color + '">' + UI.esc(s.name[0]) + '</div>' +
        '<strong>' + UI.esc(s.name) + '</strong></div></td>' +
        '<td class="muted">' + UI.esc(s.category) + '</td>' +
        '<td class="num">' + UI.pct(s.cashback) + '</td>' +
        '<td class="num">' + O.forStore(s.id).length + '</td>' +
        '<td>' + UI.statusBadge(s.active === false ? 'disabled' : 'active') + '</td>' +
        '<td><div class="row" style="gap:6px">' +
        '<button class="btn btn--xs btn--ghost" data-store-edit="' + s.id + '">Edit</button>' +
        '<button class="btn btn--xs btn--soft" data-store-toggle="' + s.id + '">' + (s.active === false ? 'Activate' : 'Deactivate') + '</button>' +
        '<button class="btn btn--xs btn--danger" data-store-del="' + s.id + '">Delete</button>' +
        '</div></td></tr>';
    });
    return '<div class="mkt__bar"><input type="search" data-filter="stores" placeholder="Search stores" style="flex:1">' +
      '<button class="btn btn--primary btn--sm" data-store-new>Add a store</button></div>' +
      table(['Store', 'Category', 'Cashback', 'Offers', 'Status', ''], rows, 'No stores yet.');
  };

  views.offers = function () {
    var rows = O.allIncludingInactive().map(function (o) {
      var st = O.store(o.storeId);
      return '<tr><td><strong>' + UI.esc(o.title) + '</strong>' +
        (o.code ? '<div class="small mono muted">' + UI.esc(o.code) + '</div>' : '') + '</td>' +
        '<td class="muted">' + UI.esc(st ? st.name : '—') + '</td>' +
        '<td>' + (o.kind === 'coupon' ? '<span class="badge badge--info">Coupon</span>' : '<span class="badge badge--grey">Deal</span>') + '</td>' +
        '<td class="num">' + UI.pct(o.cashback) + '</td>' +
        '<td class="num">' + o.expiresInDays + 'd</td>' +
        '<td>' + UI.statusBadge(o.active === false ? 'disabled' : 'active') + '</td>' +
        '<td><div class="row" style="gap:6px">' +
        '<button class="btn btn--xs btn--ghost" data-offer-edit="' + o.id + '">Edit</button>' +
        '<button class="btn btn--xs btn--soft" data-offer-toggle="' + o.id + '">' + (o.active === false ? 'Activate' : 'Deactivate') + '</button>' +
        '<button class="btn btn--xs btn--danger" data-offer-del="' + o.id + '">Delete</button>' +
        '</div></td></tr>';
    });
    return '<div class="mkt__bar"><input type="search" data-filter="offers" placeholder="Search offers" style="flex:1">' +
      '<button class="btn btn--primary btn--sm" data-offer-new>Add an offer</button></div>' +
      table(['Offer', 'Store', 'Type', 'Cashback', 'Expires', 'Status', ''], rows, 'No offers yet.');
  };

  views.transactions = function () {
    var rows = CB.all().map(function (t) {
      var st = O.store(t.storeId), u = S.find('users', t.userId);
      return '<tr><td class="mono small">' + t.id + '</td>' +
        '<td>' + UI.esc(u ? u.name : '—') + '</td>' +
        '<td>' + UI.esc(st ? st.name : '—') + '</td>' +
        '<td class="muted">' + UI.date(t.createdAt) + '</td>' +
        '<td class="num">' + UI.money(t.amount) + '</td>' +
        '<td class="num"><strong>' + UI.money(t.cashback) + '</strong></td>' +
        '<td>' + statusSelect('txn', t.id, ['clicked', 'tracked', 'pending', 'confirmed', 'cancelled', 'rejected'], t.status) + '</td></tr>';
    });
    return '<div class="mkt__bar"><input type="search" data-filter="transactions" placeholder="Search by user, store or reference" style="flex:1"></div>' +
      '<div class="note" style="margin-bottom:16px">Changing a status sends the user a notification and moves the money in or out of their confirmed balance.</div>' +
      table(['Reference', 'User', 'Store', 'Date', 'Order value', 'Cashback', 'Status'], rows, 'No transactions yet.');
  };

  views.rewards = function () {
    var rows = RW.all().map(function (r) {
      var u = S.find('users', r.userId);
      return '<tr><td class="mono small">' + r.ref + '</td>' +
        '<td>' + UI.esc(u ? u.name : '—') + '</td>' +
        '<td class="muted">' + UI.date(r.createdAt) + '</td>' +
        '<td>' + UI.esc(r.method) + '</td>' +
        '<td class="num"><strong>' + UI.money(r.amount) + '</strong></td>' +
        '<td>' + statusSelect('rdm', r.id, ['requested', 'processing', 'completed', 'rejected'], r.status) + '</td></tr>';
    });
    return '<div class="note" style="margin-bottom:16px">Demo mode — marking a redemption completed does not transfer money. In production this is where the payout API result would be recorded.</div>' +
      table(['Reference', 'User', 'Requested', 'Method', 'Amount', 'Status'], rows, 'No redemptions yet.');
  };

  views.applications = function () {
    var rows = AP.all().map(function (a) {
      var u = S.find('users', a.userId), card = C.byId(a.cardId);
      return '<tr><td class="mono small">' + a.id + '</td>' +
        '<td>' + UI.esc(u ? u.name : '—') + '</td>' +
        '<td>' + UI.esc(card ? card.name : '—') + '</td>' +
        '<td class="muted">' + UI.date(a.createdAt) + '</td>' +
        '<td>' + statusSelect('app', a.id, ['applied', 'under-review', 'documents', 'approved', 'rejected', 'completed'], a.status) + '</td>' +
        '<td><button class="btn btn--xs btn--ghost" data-app-note="' + a.id + '">Add note</button></td></tr>';
    });
    return table(['Reference', 'User', 'Card', 'Applied', 'Status', ''], rows, 'No applications yet.');
  };

  views.referrals = function () {
    var rows = RF.all().map(function (r) {
      var u = S.find('users', r.userId);
      return '<tr><td>' + UI.esc(u ? u.name : '—') + '</td>' +
        '<td>' + UI.esc(r.name) + '</td>' +
        '<td class="muted">' + UI.date(r.createdAt) + '</td>' +
        '<td class="num">' + (r.reward ? UI.money(r.reward) : '—') + '</td>' +
        '<td>' + statusSelect('ref', r.id, ['pending', 'successful', 'rejected'], r.status) + '</td></tr>';
    });
    return table(['Referrer', 'Friend', 'Joined', 'Reward', 'Status'], rows, 'No referrals yet.');
  };

  views.support = function () {
    var rows = SP.all().map(function (t) {
      return '<tr><td class="mono small">' + t.id + '</td>' +
        '<td><strong>' + UI.esc(t.name) + '</strong><div class="small muted">' + UI.esc(t.email) + '</div></td>' +
        '<td>' + UI.esc(t.category) + '</td>' +
        '<td class="muted" style="max-width:320px">' + UI.esc(t.message) + '</td>' +
        '<td class="muted">' + UI.date(t.createdAt) + '</td>' +
        '<td>' + statusSelect('tkt', t.id, ['open', 'processing', 'resolved'], t.status) + '</td></tr>';
    });
    return table(['Reference', 'From', 'Category', 'Message', 'Received', 'Status'], rows, 'No support tickets.');
  };

  /* ---------------- editors ---------------- */
  function field(id, label, value, type) {
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" type="' + (type || 'text') + '" value="' + UI.esc(value == null ? '' : value) + '"></div>';
  }

  function cardEditor(card) {
    var isNew = !card;
    card = card || { name: '', bank: 'hdfc', annualFee: 0, joiningFee: 0, rewardRate: 1, cashback: 0, minIncome: 300000, art: 'cashback', type: ['cashback'], rating: 4, perks: [] };
    UI.modal({
      title: isNew ? 'Add a card' : 'Edit ' + card.name,
      wide: true,
      body: '<div class="form-grid">' +
        field('c-name', 'Card name', card.name) +
        '<div class="field"><label for="c-bank">Bank</label><select id="c-bank">' +
        C.banks().map(function (b) {
          return '<option value="' + b.id + '"' + (b.id === card.bank ? ' selected' : '') + '>' + b.name + '</option>';
        }).join('') + '</select></div>' +
        field('c-af', 'Annual fee (₹)', card.annualFee, 'number') +
        field('c-jf', 'Joining fee (₹)', card.joiningFee, 'number') +
        field('c-rr', 'Base reward rate (%)', card.rewardRate, 'number') +
        field('c-cb', 'Top cashback rate (%)', card.cashback, 'number') +
        field('c-inc', 'Minimum annual income (₹)', card.minIncome, 'number') +
        field('c-rating', 'Rating out of 5', card.rating, 'number') +
        '<div class="field"><label for="c-art">Card artwork</label><select id="c-art">' +
        ['cashback', 'rewards', 'travel', 'premium', 'fuel', 'shopping', 'dining'].map(function (a) {
          return '<option' + (a === card.art ? ' selected' : '') + '>' + a + '</option>';
        }).join('') + '</select></div>' +
        field('c-type', 'Categories (comma separated)', card.type.join(', ')) +
        '</div>' +
        '<div class="field" style="margin-top:16px">' + '<label for="c-perks">Headline perks (comma separated)</label>' +
        '<input id="c-perks" type="text" value="' + UI.esc(card.perks.join(', ')) + '"></div>' +
        '<div class="form-grid" style="margin-top:16px">' +
        field('c-lounge', 'Lounge access', card.lounge || 'Not included') +
        field('c-welcome', 'Welcome benefit', card.welcome || 'No welcome bonus') +
        '</div>',
      foot: '<button class="btn btn--ghost" data-x>Cancel</button>' +
            '<button class="btn btn--primary" data-save>' + (isNew ? 'Add card' : 'Save changes') + '</button>',
      onMount: function (m) {
        m.querySelector('[data-save]').onclick = function () {
          var name = m.querySelector('#c-name').value.trim();
          if (!name) return UI.toast('The card needs a name', 'error');
          var patch = {
            name: name, bank: m.querySelector('#c-bank').value,
            annualFee: Number(m.querySelector('#c-af').value) || 0,
            joiningFee: Number(m.querySelector('#c-jf').value) || 0,
            rewardRate: Number(m.querySelector('#c-rr').value) || 0,
            cashback: Number(m.querySelector('#c-cb').value) || 0,
            minIncome: Number(m.querySelector('#c-inc').value) || 300000,
            rating: Number(m.querySelector('#c-rating').value) || 4,
            art: m.querySelector('#c-art').value,
            type: m.querySelector('#c-type').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
            perks: m.querySelector('#c-perks').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
            lounge: m.querySelector('#c-lounge').value,
            welcome: m.querySelector('#c-welcome').value
          };
          if (isNew) C.create(patch); else C.update(card.id, patch);
          UI.closeModal();
          UI.toast(isNew ? 'Card added' : 'Card updated');
          w.CC.Router.refresh();
        };
      }
    });
  }

  function storeEditor(store) {
    var isNew = !store;
    store = store || { name: '', category: 'Shopping', cashback: 3, color: '#0e5c3c', popular: false };
    UI.modal({
      title: isNew ? 'Add a store' : 'Edit ' + store.name,
      body: '<div class="form-grid">' +
        field('s-name', 'Store name', store.name) +
        '<div class="field"><label for="s-cat">Category</label><select id="s-cat">' +
        w.CC.DATA.categories.map(function (c) {
          return '<option' + (c === store.category ? ' selected' : '') + '>' + c + '</option>';
        }).join('') + '</select></div>' +
        field('s-cb', 'Cashback rate (%)', store.cashback, 'number') +
        field('s-color', 'Brand colour', store.color, 'color') +
        '</div>' +
        '<label class="check" style="margin-top:16px"><input type="checkbox" id="s-pop"' + (store.popular ? ' checked' : '') + '> Show in popular stores</label>',
      foot: '<button class="btn btn--ghost" data-x>Cancel</button>' +
            '<button class="btn btn--primary" data-save>' + (isNew ? 'Add store' : 'Save changes') + '</button>',
      onMount: function (m) {
        m.querySelector('[data-save]').onclick = function () {
          var name = m.querySelector('#s-name').value.trim();
          if (!name) return UI.toast('The store needs a name', 'error');
          var patch = {
            name: name, category: m.querySelector('#s-cat').value,
            cashback: Number(m.querySelector('#s-cb').value) || 0,
            color: m.querySelector('#s-color').value,
            popular: m.querySelector('#s-pop').checked
          };
          if (isNew) O.createStore(patch); else O.updateStore(store.id, patch);
          UI.closeModal();
          UI.toast(isNew ? 'Store added' : 'Store updated');
          w.CC.Router.refresh();
        };
      }
    });
  }

  function offerEditor(offer) {
    var isNew = !offer;
    offer = offer || { title: '', storeId: O.stores()[0].id, kind: 'deal', code: '', cashback: 3, expiresInDays: 30, terms: '', url: '' };
    UI.modal({
      title: isNew ? 'Add an offer' : 'Edit offer',
      wide: true,
      body: '<div class="field" style="margin-bottom:16px"><label for="o-title">Offer title</label>' +
        '<input id="o-title" type="text" value="' + UI.esc(offer.title) + '" placeholder="What the customer gets"></div>' +
        '<div class="form-grid">' +
        '<div class="field"><label for="o-store">Store</label><select id="o-store">' +
        O.stores().map(function (s) {
          return '<option value="' + s.id + '"' + (s.id === offer.storeId ? ' selected' : '') + '>' + UI.esc(s.name) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label for="o-kind">Type</label><select id="o-kind">' +
        '<option value="deal"' + (offer.kind === 'deal' ? ' selected' : '') + '>Cashback deal</option>' +
        '<option value="coupon"' + (offer.kind === 'coupon' ? ' selected' : '') + '>Coupon code</option></select></div>' +
        field('o-code', 'Coupon code (leave blank for deals)', offer.code) +
        field('o-cb', 'Cashback rate (%)', offer.cashback, 'number') +
        field('o-exp', 'Expires in (days)', offer.expiresInDays, 'number') +
        field('o-url', 'Retailer URL', offer.url, 'url') +
        '</div>' +
        '<div class="field" style="margin-top:16px"><label for="o-terms">Terms</label>' +
        '<textarea id="o-terms">' + UI.esc(offer.terms) + '</textarea></div>' +
        '<div class="row row--wrap" style="margin-top:14px; gap:18px">' +
        '<label class="check"><input type="checkbox" id="o-feat"' + (offer.featured ? ' checked' : '') + '> Feature it</label>' +
        '<label class="check"><input type="checkbox" id="o-trend"' + (offer.trending ? ' checked' : '') + '> Mark trending</label>' +
        '<label class="check"><input type="checkbox" id="o-flash"' + (offer.flash ? ' checked' : '') + '> Flash deal</label></div>',
      foot: '<button class="btn btn--ghost" data-x>Cancel</button>' +
            '<button class="btn btn--primary" data-save>' + (isNew ? 'Add offer' : 'Save changes') + '</button>',
      onMount: function (m) {
        m.querySelector('[data-save]').onclick = function () {
          var title = m.querySelector('#o-title').value.trim();
          if (!title) return UI.toast('The offer needs a title', 'error');
          var patch = {
            title: title, storeId: m.querySelector('#o-store').value,
            kind: m.querySelector('#o-kind').value, code: m.querySelector('#o-code').value.trim(),
            cashback: Number(m.querySelector('#o-cb').value) || 0,
            expiresInDays: Number(m.querySelector('#o-exp').value) || 30,
            url: m.querySelector('#o-url').value.trim(),
            terms: m.querySelector('#o-terms').value.trim() || 'Standard cashback terms apply.',
            featured: m.querySelector('#o-feat').checked,
            trending: m.querySelector('#o-trend').checked,
            flash: m.querySelector('#o-flash').checked
          };
          if (isNew) O.create(patch); else O.update(offer.id, patch);
          UI.closeModal();
          UI.toast(isNew ? 'Offer added' : 'Offer updated');
          w.CC.Router.refresh();
        };
      }
    });
  }

  /* ---------------- page ---------------- */
  /* The admin menu: boxes of related tools, each with an icon and a count of what is waiting. */
  var GROUPS = [
    ['Daily work', ['overview', 'approvals', 'transactions', 'rewards', 'applications', 'referrals', 'support']],
    ['Members and messages', ['users', 'announce']],
    ['Catalogue', ['cards', 'stores', 'offers']],
    ['Share & Earn', ['market', 'mk-disputes', 'mk-kyc', 'mk-fees', 'mk-payouts', 'mk-reports']],
    ['Staff', ['activity']]
  ];
  var ICON = { overview: '\u25A6', approvals: '\u2713', transactions: '\u21C4', rewards: '\u2605', applications: '\u25A4', referrals: '\u2726', support: '?',
    users: '\u263A', announce: '\u2709', cards: '\u25AD', stores: '\u25A3', offers: '%', market: '\u21CC', 'mk-disputes': '!', 'mk-kyc': '\u25C9',
    'mk-fees': '\u20B9', 'mk-payouts': '\u2197', 'mk-reports': '\u2191', activity: '\u2630' };
  function adminNav(active) {
    var AX = w.CC.AdminPlus, c = AX && AX.counts ? AX.counts() : null, n = {};
    if (c) {
      n.approvals = c.cashback.length + c.redemptions.length + c.referrals.length; n.applications = c.apps.length; n.support = c.tickets.length;
      n['mk-disputes'] = c.disputes.length; n['mk-kyc'] = c.kyc.length; n['mk-payouts'] = c.payouts.length;
    }
    var label = {}; SECTIONS.forEach(function (s) { label[s[0]] = s[1]; });
    var placed = {}, boxes = GROUPS.map(function (g) {
      var items = g[1].filter(function (k) { return label[k]; });
      items.forEach(function (k) { placed[k] = 1; });
      return [g[0], items];
    });
    var rest = SECTIONS.map(function (s) { return s[0]; }).filter(function (k) { return !placed[k]; });
    if (rest.length) boxes.push(['More', rest]);
    return '<nav class="adm-nav" aria-label="Admin">' + boxes.filter(function (b) { return b[1].length; }).map(function (b) {
      return '<section class="adm-box"><h3 class="adm-box__h">' + b[0] + '</h3>' + b[1].map(function (k) {
        return '<a class="adm-tile' + (k === active ? ' is-active' : '') + '" href="#/admin/' + k + '"><span class="adm-tile__i" aria-hidden="true">' + (ICON[k] || '\u2022') + '</span>' +
          '<span class="adm-tile__t">' + label[k] + '</span>' + (n[k] ? '<span class="adm-tile__n">' + n[k] + '</span>' : '') + '</a>';
      }).join('') + '</section>';
    }).join('') + '</nav>';
  }

  var merged = false;
  w.CC.Pages.admin = function (params) {
    if (!Auth.require(true)) return false;
    /* extra staff tools plug in here: Reward approvals, announcements, activity log, then the Share & Earn sections */
    if (!merged) {
      merged = true;
      [w.CC.AdminPlus, w.CC.MarketAdmin].filter(Boolean).forEach(function (ext) {
        var at = 1;
        ext.sections.forEach(function (s) {
          if (SECTIONS.some(function (x) { return x[0] === s[0]; })) return;
          if (ext.first) SECTIONS.splice(at++, 0, s); else SECTIONS.push(s);
        });
        Object.keys(ext.views).forEach(function (k) {
          var prev = views[k], fn = ext.views[k];
          views[k] = prev && fn.length ? function () { return fn(prev); } : fn;      // a view that takes an argument wraps the one it replaces
        });
      });
    }
    var section = params.section || 'overview';
    if (!views[section]) section = 'overview';
    var label = (SECTIONS.filter(function (s) { return s[0] === section; })[0] || SECTIONS[0])[1];

    var html = '<div class="wrap section--tight">' +
      '<div class="admin-hd"><div><h1 class="h2">Card Crest operations</h1>' +
      '<p>Everything users see is managed from here. Changes take effect immediately.</p></div>' +
      '<a class="btn btn--soft btn--sm" href="#/dashboard">Back to the app</a></div>' +
      '<div class="admin">' + adminNav(section) +
      '<div><h2 class="h2" style="margin-bottom:18px">' + label + '</h2><div id="admBody">' + views[section]() + '</div></div>' +
      '</div></div>';

    return {
      title: 'Admin · ' + label + ' | Card Crest',
      html: html,
      mount: function (root) {
        /* search filters over the rendered table */
        var search = root.querySelector('[data-filter]');
        if (search) {
          search.addEventListener('input', UI.debounce(function () {
            var q = search.value.toLowerCase();
            root.querySelectorAll('tbody tr').forEach(function (tr) {
              tr.style.display = tr.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none';
            });
          }, 180));
        }

        [w.CC.AdminPlus, w.CC.MarketAdmin].forEach(function (ext) { if (ext) ext.bind(root); });

        /* status selects */
        root.querySelectorAll('[data-txn]').forEach(function (sel) {
          sel.onchange = function () {
            CB.setStatus(sel.dataset.txn, sel.value, true);
            UI.toast('Transaction marked ' + sel.value);
          };
        });
        root.querySelectorAll('[data-app]').forEach(function (sel) {
          sel.onchange = function () {
            AP.setStatus(sel.dataset.app, sel.value);
            UI.toast('Application marked ' + sel.value.replace('-', ' '));
          };
        });
        root.querySelectorAll('[data-rdm]').forEach(function (sel) {
          sel.onchange = function () {
            RW.setStatus(sel.dataset.rdm, sel.value);
            UI.toast('Redemption marked ' + sel.value);
          };
        });
        root.querySelectorAll('[data-ref]').forEach(function (sel) {
          sel.onchange = function () {
            RF.setStatus(sel.dataset.ref, sel.value);
            UI.toast('Referral marked ' + sel.value);
            w.CC.Router.refresh();
          };
        });
        root.querySelectorAll('[data-tkt]').forEach(function (sel) {
          sel.onchange = function () {
            SP.setStatus(sel.dataset.tkt, sel.value);
            UI.toast('Ticket marked ' + sel.value);
          };
        });

        /* users */
        root.querySelectorAll('[data-user-toggle]').forEach(function (b) {
          b.onclick = function () {
            var u = S.find('users', b.dataset.userToggle);
            S.update('users', u.id, { active: !u.active });
            UI.toast(u.active ? 'Account disabled' : 'Account enabled');
            w.CC.Router.refresh();
          };
        });
        root.querySelectorAll('[data-user-view]').forEach(function (b) {
          b.onclick = function () {
            var u = S.find('users', b.dataset.userView);
            var t = CB.totals(u.id);
            UI.modal({
              title: u.name,
              body: '<div class="grid g-2" style="margin-bottom:18px">' +
                '<div><span class="fact__k">Email</span><span class="fact__v" style="font-size:.85rem">' + UI.esc(u.email) + '</span></div>' +
                '<div><span class="fact__k">Mobile</span><span class="fact__v" style="font-size:.85rem">' + UI.esc(u.mobile || '—') + '</span></div>' +
                '<div><span class="fact__k">City</span><span class="fact__v" style="font-size:.85rem">' + UI.esc(u.city || '—') + '</span></div>' +
                '<div><span class="fact__k">Employment</span><span class="fact__v" style="font-size:.85rem">' + UI.esc(u.employment || '—') + '</span></div>' +
                '<div><span class="fact__k">Joined</span><span class="fact__v" style="font-size:.85rem">' + UI.date(u.joined) + '</span></div>' +
                '<div><span class="fact__k">Status</span><span class="fact__v" style="font-size:.85rem">' + (u.active ? 'Active' : 'Disabled') + '</span></div>' +
                '</div>' +
                '<div class="grid g-3">' +
                '<div class="stat"><span class="stat__k">Confirmed</span><span class="stat__v" style="font-size:1.2rem">' + UI.money(t.confirmed) + '</span></div>' +
                '<div class="stat"><span class="stat__k">Pending</span><span class="stat__v" style="font-size:1.2rem">' + UI.money(t.pending) + '</span></div>' +
                '<div class="stat"><span class="stat__k">Referrals</span><span class="stat__v" style="font-size:1.2rem">' + UI.money(t.referral) + '</span></div>' +
                '</div>' +
                '<p class="small muted" style="margin-top:16px">' + CB.forUser(u.id).length + ' transactions &middot; ' +
                AP.forUser(u.id).length + ' applications &middot; ' + RF.forUser(u.id).length + ' referrals</p>',
              foot: '<button class="btn btn--primary" data-x>Close</button>'
            });
          };
        });

        /* cards */
        var nc = root.querySelector('[data-card-new]');
        if (nc) nc.onclick = function () { cardEditor(null); };
        root.querySelectorAll('[data-card-edit]').forEach(function (b) {
          b.onclick = function () { cardEditor(C.byId(b.dataset.cardEdit)); };
        });
        root.querySelectorAll('[data-card-toggle]').forEach(function (b) {
          b.onclick = function () {
            var c = C.byId(b.dataset.cardToggle);
            C.update(c.id, { active: c.active === false });
            UI.toast('Card ' + (c.active === false ? 'activated' : 'deactivated'));
            w.CC.Router.refresh();
          };
        });
        root.querySelectorAll('[data-card-del]').forEach(function (b) {
          b.onclick = function () {
            var c = C.byId(b.dataset.cardDel);
            UI.confirm('Delete ' + c.name + '?', 'It disappears from the marketplace, comparisons and recommendations.',
              'Delete card', function () {
                C.remove(c.id); UI.toast('Card deleted'); w.CC.Router.refresh();
              }, true);
          };
        });

        /* stores */
        var ns = root.querySelector('[data-store-new]');
        if (ns) ns.onclick = function () { storeEditor(null); };
        root.querySelectorAll('[data-store-edit]').forEach(function (b) {
          b.onclick = function () { storeEditor(O.store(b.dataset.storeEdit)); };
        });
        root.querySelectorAll('[data-store-toggle]').forEach(function (b) {
          b.onclick = function () {
            var s = O.store(b.dataset.storeToggle);
            O.updateStore(s.id, { active: s.active === false });
            UI.toast('Store ' + (s.active === false ? 'activated' : 'deactivated'));
            w.CC.Router.refresh();
          };
        });
        root.querySelectorAll('[data-store-del]').forEach(function (b) {
          b.onclick = function () {
            var s = O.store(b.dataset.storeDel);
            UI.confirm('Delete ' + s.name + '?', 'Its offers stay in the database but will no longer have a store page.',
              'Delete store', function () {
                O.removeStore(s.id); UI.toast('Store deleted'); w.CC.Router.refresh();
              }, true);
          };
        });

        /* offers */
        var no = root.querySelector('[data-offer-new]');
        if (no) no.onclick = function () { offerEditor(null); };
        root.querySelectorAll('[data-offer-edit]').forEach(function (b) {
          b.onclick = function () { offerEditor(O.byId(b.dataset.offerEdit)); };
        });
        root.querySelectorAll('[data-offer-toggle]').forEach(function (b) {
          b.onclick = function () {
            var o = O.byId(b.dataset.offerToggle);
            O.update(o.id, { active: o.active === false });
            UI.toast('Offer ' + (o.active === false ? 'activated' : 'deactivated'));
            w.CC.Router.refresh();
          };
        });
        root.querySelectorAll('[data-offer-del]').forEach(function (b) {
          b.onclick = function () {
            var o = O.byId(b.dataset.offerDel);
            UI.confirm('Delete this offer?', UI.esc(o.title) + ' will be removed from the marketplace.',
              'Delete offer', function () {
                O.remove(o.id); UI.toast('Offer deleted'); w.CC.Router.refresh();
              }, true);
          };
        });

        /* application notes */
        root.querySelectorAll('[data-app-note]').forEach(function (b) {
          b.onclick = function () {
            UI.modal({
              title: 'Add a note',
              body: '<div class="field"><label for="a-note">Note for the customer</label>' +
                '<textarea id="a-note" placeholder="What the bank has asked for, or what happens next"></textarea></div>',
              foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-add>Add note</button>',
              onMount: function (m) {
                m.querySelector('[data-add]').onclick = function () {
                  var txt = m.querySelector('#a-note').value.trim();
                  if (!txt) return UI.toast('Write something first', 'error');
                  var a = AP.byId(b.dataset.appNote);
                  AP.setStatus(a.id, a.status, txt);
                  UI.closeModal();
                  UI.toast('Note added');
                };
              }
            });
          };
        });
      }
    };
  };
})(window, document);
