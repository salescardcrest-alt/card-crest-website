/* ============================================================
   Card Crest — pages/cards.js
   Marketplace, card detail, comparison, eligibility, calculator.
   Also owns the shared card-tile renderer (CC.Render).
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, C = w.CC.Cards, Auth = w.CC.Auth, DATA = w.CC.DATA;
  w.CC.Pages = w.CC.Pages || {};

  /* ---------------- shared renderers ---------------- */
  var Render = {
    cardTile: function (card, opts) {
      opts = opts || {};
      var bank = C.bank(card.bank);
      var sc = C.score(card);
      var inCompare = C.compare().indexOf(card.id) > -1;
      var user = Auth.current();
      var elig = user ? C.eligibility(card, C.profileFor(user)) : null;

      return '<article class="ctile reveal" data-card="' + card.id + '">' +
        '<div class="ctile__top">' +
          UI.plastic(card) +
          '<div><div class="ctile__bank">' + UI.esc(bank ? bank.name : '') + '</div>' +
          '<h3 class="ctile__name">' + UI.esc(card.name) + '</h3>' +
          '<div class="row" style="gap:10px">' + UI.stars(card.rating) +
          (card.lifetimeFree ? '<span class="badge">Lifetime free</span>' : '') + '</div>' +
          '<div style="margin-top:12px">' + UI.gauge(sc.total) + '</div></div>' +
        '</div>' +
        '<div class="ctile__body">' +
          '<div class="ctile__facts">' +
            '<div><span class="fact__k">Annual fee</span><span class="fact__v">' +
              (card.annualFee === 0 ? 'None' : UI.money(card.annualFee)) + '</span></div>' +
            '<div><span class="fact__k">Joining fee</span><span class="fact__v">' +
              (card.joiningFee === 0 ? 'None' : UI.money(card.joiningFee)) + '</span></div>' +
            '<div><span class="fact__k">Base reward rate</span><span class="fact__v">' + UI.pct(card.rewardRate) + '</span></div>' +
            '<div><span class="fact__k">Top cashback</span><span class="fact__v">' +
              (card.cashback ? UI.pct(card.cashback) : '—') + '</span></div>' +
          '</div>' +
          '<ul class="ctile__perks">' + card.perks.map(function (p) {
            return '<li class="badge badge--grey">' + UI.esc(p) + '</li>';
          }).join('') + '</ul>' +
          (elig ? '<div class="small muted">Your fit: <strong style="color:var(--' +
            (elig.level === 'strong' ? 'crest' : elig.level === 'fair' ? 'warn' : 'muted') + ')">' +
            elig.label + '</strong> &middot; estimated</div>' : '') +
          (C.rewardFor(card) ? '<div class="ctile__reward"><span>Apply through Card Crest</span><b>Earn ' + UI.money(C.rewardFor(card)) + ' when approved</b></div>' : '') +
          '<div class="ctile__foot">' +
            '<a class="btn btn--primary btn--sm" href="#/cards/' + card.id + '">View details</a>' +
            '<a class="btn btn--ghost btn--sm" href="#/eligibility?card=' + card.id + '">Check eligibility</a>' +
          '</div>' +
          (opts.noCompare ? '' :
          '<label class="cmp-check"><input type="checkbox" data-cmp="' + card.id + '"' +
          (inCompare ? ' checked' : '') + '> Add to comparison</label>') +
        '</div></article>';
    },

    compareTray: function () {
      var list = C.compare();
      var el = d.getElementById('cmpTray');
      if (!el) {
        el = d.createElement('div');
        el.id = 'cmpTray'; el.className = 'tray';
        d.body.appendChild(el);
      }
      if (!list.length) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = '<span class="tray__t"><span>' + list.length + '</span> of 4 cards selected</span>' +
        '<a class="btn btn--primary btn--sm" href="#/compare">Compare now</a>' +
        '<button class="btn btn--sm" style="color:#8fd3b4" data-clear>Clear</button>';
      el.querySelector('[data-clear]').onclick = function () {
        C.clearCompare();
        Render.compareTray();
        d.querySelectorAll('[data-cmp]').forEach(function (c) { c.checked = false; });
        UI.toast('Comparison cleared');
      };
    },

    bindCompare: function (root) {
      root.querySelectorAll('[data-cmp]').forEach(function (box) {
        box.addEventListener('change', function () {
          var res = C.toggleCompare(box.dataset.cmp);
          if (res.full) {
            box.checked = false;
            UI.toast('You can compare up to 4 cards at once', 'error');
            return;
          }
          UI.toast(res.added ? 'Added to comparison' : 'Removed from comparison');
          Render.compareTray();
        });
      });
    }
  };
  w.CC.Render = Render;

  /* ---------------- /cards ---------------- */
  var filterState = { q: '', banks: [], types: [], fee: [], benefits: [], sort: 'score', page: 1 };
  var PER = 8;

  w.CC.Pages.cards = function (params, query) {
    if (query.type) filterState.types = [query.type];
    if (query.benefit) filterState.benefits = [query.benefit];
    if (query.q) filterState.q = query.q;

    var html = '<div class="wrap section--tight">' +
      '<div class="section__head"><h1 class="h1">Credit cards, ranked by <em>what they return</em></h1>' +
      '<p class="lede">Every card is scored on the value it gives back against what it costs you. Filter by bank, fee or the benefit you actually want.</p></div>' +
      '<a class="apply-banner" href="#/apply-earn"><div><strong>Apply & Earn: get paid when your card is approved</strong><span>' + C.partners().length + ' partner cards, with rewards up to ' + UI.money(Math.max.apply(null, C.partners().map(function (p) { return p.reward; }))) + ' in your wallet.</span></div><span class="btn btn--sm" style="background:#fff; color:var(--crest)">See the cards</span></a>' +
      '<div class="mkt">' +
        '<aside class="filters" id="filters">' +
          '<div class="spread" style="margin-bottom:16px">' +
            '<h3 class="h3">Filters</h3>' +
            '<button class="btn btn--xs btn--link" data-reset>Reset</button>' +
          '</div>' +
          grp('Bank', DATA.banks.map(function (b) { return { id: b.id, label: b.name }; }), 'banks') +
          grp('Card type', DATA.cardTypes, 'types') +
          grp('Annual fee', [
            { id: 'free', label: 'No annual fee' }, { id: 'u500', label: 'Under ₹500' },
            { id: '500-2000', label: '₹500 to ₹2,000' }, { id: '2000+', label: 'Above ₹2,000' }
          ], 'fee') +
          grp('Benefits', DATA.benefitFilters, 'benefits') +
          '<button class="btn btn--primary btn--block" data-apply style="margin-top:18px">Show results</button>' +
        '</aside>' +
        '<div>' +
          '<div class="mkt__bar">' +
            '<div class="row" style="flex:1; min-width:220px">' +
              '<input type="search" id="cardSearch" placeholder="Search by card, bank or benefit" value="' + UI.esc(filterState.q) + '" aria-label="Search cards">' +
            '</div>' +
            '<div class="row">' +
              '<button class="btn btn--ghost btn--sm filters-toggle" data-open-filters>Filters</button>' +
              '<select id="cardSort" aria-label="Sort cards" style="width:auto; height:38px">' +
                opt('score', 'Highest value score', filterState.sort) +
                opt('rating', 'Highest rated', filterState.sort) +
                opt('reward', 'Best reward rate', filterState.sort) +
                opt('fee-low', 'Lowest annual fee', filterState.sort) +
                opt('fee-high', 'Highest annual fee', filterState.sort) +
              '</select>' +
            '</div>' +
          '</div>' +
          '<p class="mkt__count" id="cardCount"></p>' +
          '<div class="mkt__grid" id="cardGrid" style="margin-top:14px">' + UI.skeletonGrid(4) + '</div>' +
          '<div class="pagination" id="cardPager"></div>' +
        '</div>' +
      '</div></div>';

    function grp(title, items, key) {
      return '<div class="filters__grp"><h4>' + title + '</h4>' + items.map(function (it) {
        return '<label><input type="checkbox" data-f="' + key + '" value="' + it.id + '"' +
          (filterState[key].indexOf(it.id) > -1 ? ' checked' : '') + '> ' + UI.esc(it.label) + '</label>';
      }).join('') + '</div>';
    }
    function opt(v, label, cur) {
      return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + label + '</option>';
    }

    return {
      title: 'Credit cards | Card Crest',
      desc: 'Compare Indian credit cards by annual fee, reward rate, lounge access and Card Value Score.',
      html: html,
      mount: function (root) {
        var grid = root.querySelector('#cardGrid');
        var count = root.querySelector('#cardCount');
        var pager = root.querySelector('#cardPager');
        var panel = root.querySelector('#filters');

        function draw() {
          var list = C.query(filterState);
          var pages = Math.max(1, Math.ceil(list.length / PER));
          if (filterState.page > pages) filterState.page = 1;
          var slice = list.slice((filterState.page - 1) * PER, filterState.page * PER);

          count.textContent = list.length + (list.length === 1 ? ' card matches' : ' cards match') + ' your filters';

          if (!list.length) {
            grid.style.gridTemplateColumns = '1fr';
            grid.innerHTML = UI.empty('No cards match those filters',
              'Try removing a filter or two — the benefit filters are strict, and asking for every benefit at once rules out most cards.',
              'Reset filters', '#/cards');
            pager.innerHTML = '';
            return;
          }
          grid.style.gridTemplateColumns = '';
          grid.innerHTML = slice.map(function (c) { return Render.cardTile(c); }).join('');
          Render.bindCompare(grid);
          UI.reveal(grid);

          pager.innerHTML = pages > 1 ? (
            '<button ' + (filterState.page === 1 ? 'disabled' : '') + ' data-p="' + (filterState.page - 1) + '">Prev</button>' +
            Array.from({ length: pages }, function (_, i) {
              return '<button class="' + (i + 1 === filterState.page ? 'is-on' : '') + '" data-p="' + (i + 1) + '">' + (i + 1) + '</button>';
            }).join('') +
            '<button ' + (filterState.page === pages ? 'disabled' : '') + ' data-p="' + (filterState.page + 1) + '">Next</button>'
          ) : '';
          pager.querySelectorAll('[data-p]').forEach(function (b) {
            b.onclick = function () {
              filterState.page = Number(b.dataset.p);
              draw();
              grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
          });
        }

        root.querySelectorAll('[data-f]').forEach(function (box) {
          box.addEventListener('change', function () {
            var key = box.dataset.f, val = box.value;
            var i = filterState[key].indexOf(val);
            if (box.checked && i < 0) filterState[key].push(val);
            if (!box.checked && i > -1) filterState[key].splice(i, 1);
            filterState.page = 1;
            draw();
          });
        });
        root.querySelector('#cardSearch').addEventListener('input', UI.debounce(function (e) {
          filterState.q = e.target.value; filterState.page = 1; draw();
        }, 240));
        root.querySelector('#cardSort').addEventListener('change', function (e) {
          filterState.sort = e.target.value; draw();
        });
        root.querySelector('[data-reset]').addEventListener('click', function () {
          filterState = { q: '', banks: [], types: [], fee: [], benefits: [], sort: 'score', page: 1 };
          root.querySelectorAll('[data-f]').forEach(function (b) { b.checked = false; });
          root.querySelector('#cardSearch').value = '';
          panel.classList.remove('is-open');
          draw();
        });
        root.querySelector('[data-open-filters]').addEventListener('click', function () {
          panel.classList.add('is-open'); d.body.classList.add('no-scroll');
        });
        root.querySelector('[data-apply]').addEventListener('click', function () {
          panel.classList.remove('is-open'); d.body.classList.remove('no-scroll');
        });

        setTimeout(draw, 120);
        Render.compareTray();
      }
    };
  };

  /* ---------------- /cards/:id ---------------- */
  w.CC.Pages.cardDetail = function (params) {
    var card = C.byId(params.id);
    if (!card) return w.CC.Pages.notFound();
    /* Apply & Earn partner cards carry only a reward, not fees or a score: show a simple page for them. */
    if (card.partner) {
      var pb = C.bank(card.bank), pr = C.rewardFor(card);
      return {
        title: card.name + ' | Card Crest', desc: 'Apply for the ' + card.name + ' through Card Crest and earn a reward when it is approved.',
        html: '<div class="wrap section--tight"><nav class="small muted" style="margin-bottom:18px"><a href="#/apply-earn">Apply &amp; Earn</a> / ' + UI.esc(card.name) + '</nav>' +
          '<div class="detail"><div><div class="ctile__bank">' + UI.esc(pb ? pb.name : '') + '</div>' +
          '<h1 class="h1" style="margin:6px 0 12px">' + UI.esc(card.name) + '</h1>' +
          '<p class="lede" style="margin-bottom:20px">Apply on the bank&rsquo;s own site through Card Crest and earn a cash reward in your wallet when the bank approves the card.</p>' +
          (pr ? '<div class="reward-box"><span>Apply through Card Crest</span><b>Earn ' + UI.money(pr) + ' when approved</b></div>' : '') +
          '<div class="note" style="margin-top:18px"><strong>Fees and benefits.</strong> They are set by ' + UI.esc(pb ? pb.name : 'the bank') + ' and can change, so check the bank&rsquo;s page before you apply.</div></div>' +
          '<aside class="panel" style="align-self:start"><div style="margin-bottom:16px">' + UI.plastic(card) + '</div>' +
          '<button class="btn btn--primary btn--block" data-apply>Apply &amp; earn ' + UI.money(pr) + '</button>' +
          '<a class="btn btn--ghost btn--block" href="#/apply-earn" style="margin-top:10px">All Apply &amp; Earn cards</a></aside></div></div>',
        mount: function (root) {
          root.querySelector('[data-apply]').addEventListener('click', function () { w.CC.Render.applyForCard(card); });
        }
      };
    }
    var bank = C.bank(card.bank);
    var sc = C.score(card);
    var user = Auth.current();
    var elig = user ? C.eligibility(card, C.profileFor(user)) : null;
    var saved = user ? C.isSaved(user.id, card.id) : false;

    function row(k, v) {
      return '<li><span class="tick">&check;</span><div><strong>' + k + '</strong><br><span class="muted">' + UI.esc(v) + '</span></div></li>';
    }

    var html = '<div class="wrap section--tight">' +
      '<nav class="small muted" style="margin-bottom:18px"><a href="#/cards">Credit cards</a> / ' + UI.esc(card.name) + '</nav>' +
      '<div class="detail">' +
        '<div>' +
          '<div class="ctile__bank">' + UI.esc(bank ? bank.name : '') + '</div>' +
          '<h1 class="h1" style="margin:6px 0 12px">' + UI.esc(card.name) + '</h1>' +
          '<div class="row row--wrap" style="gap:14px; margin-bottom:24px">' + UI.stars(card.rating) +
            card.type.map(function (t) { return '<span class="badge">' + UI.esc(t.replace('-', ' ')) + '</span>'; }).join('') +
          '</div>' +

          '<div class="spec" style="margin-bottom:28px">' +
            '<div><span class="fact__k">Annual fee</span><span class="fact__v">' + (card.annualFee === 0 ? 'None' : UI.money(card.annualFee)) + '</span></div>' +
            '<div><span class="fact__k">Joining fee</span><span class="fact__v">' + (card.joiningFee === 0 ? 'None' : UI.money(card.joiningFee)) + '</span></div>' +
            '<div><span class="fact__k">Base reward rate</span><span class="fact__v">' + UI.pct(card.rewardRate) + '</span></div>' +
            '<div><span class="fact__k">Top cashback</span><span class="fact__v">' + (card.cashback ? UI.pct(card.cashback) : 'Not a cashback card') + '</span></div>' +
            '<div><span class="fact__k">Fee waiver</span><span class="fact__v" style="font-size:.82rem">' + UI.esc(card.feeWaiver) + '</span></div>' +
            '<div><span class="fact__k">Min. income</span><span class="fact__v">' + UI.money(card.minIncome) + '</span></div>' +
          '</div>' +

          '<h2 class="h2" style="margin-bottom:14px">What you get</h2>' +
          '<ul class="benefit-list" style="margin-bottom:32px">' +
            row('Welcome benefit', card.welcome) +
            row('Airport lounge', card.lounge) +
            row('Fuel', card.fuel) +
            row('Travel', card.travel) +
            row('Dining', card.dining) +
            row('Shopping', card.shopping) +
            row('Insurance', card.insurance) +
            row('Milestones', card.milestone) +
            row('Redemption', card.redemption) +
          '</ul>' +

          '<h2 class="h2" style="margin-bottom:16px">The honest read</h2>' +
          '<div class="proscons" style="margin-bottom:32px">' +
            '<div class="panel"><h3 class="h3" style="margin-bottom:8px; color:var(--crest)">What works</h3><ul class="pros">' +
              card.pros.map(function (p) { return '<li>' + UI.esc(p) + '</li>'; }).join('') + '</ul></div>' +
            '<div class="panel"><h3 class="h3" style="margin-bottom:8px; color:var(--danger)">What to watch</h3><ul class="cons">' +
              card.cons.map(function (p) { return '<li>' + UI.esc(p) + '</li>'; }).join('') + '</ul></div>' +
          '</div>' +

          '<h2 class="h2" style="margin-bottom:14px">Eligibility and documents</h2>' +
          '<div class="panel" style="margin-bottom:32px">' +
            '<div class="grid g-2" style="margin-bottom:18px">' +
              '<div><span class="fact__k">Age</span><span class="fact__v">' + card.minAge + ' to ' + card.maxAge + ' years</span></div>' +
              '<div><span class="fact__k">Indicative credit score</span><span class="fact__v">' + card.minCibil + ' and above</span></div>' +
            '</div>' +
            '<h3 class="h3" style="margin-bottom:10px">Documents the bank will ask for</h3>' +
            '<ul class="benefit-list">' + card.documents.map(function (x) {
              return '<li><span class="tick">&check;</span>' + UI.esc(x) + '</li>';
            }).join('') + '</ul>' +
          '</div>' +

          '<h2 class="h2" style="margin-bottom:8px">How this score is built</h2>' +
          '<p class="muted small" style="margin-bottom:16px">Scored against a reference profile of ₹40,000 a month across online, offline, dining, fuel and travel spend. Change the profile in the <a href="#/calculator">card value calculator</a> to see your own numbers.</p>' +
          '<div class="panel" style="margin-bottom:32px">' + sc.parts.map(function (p) {
            return '<div style="margin-bottom:14px"><div class="spread small" style="margin-bottom:6px">' +
              '<span>' + p.k + '</span><span class="mono">' + p.v.toFixed(1) + ' / ' + p.max + '</span></div>' +
              '<div class="progress"><div class="progress__b" style="width:' + ((p.v / p.max) * 100).toFixed(0) + '%"></div></div></div>';
          }).join('') + '</div>' +

          '<h2 class="h2" style="margin-bottom:8px">Questions about this card</h2>' +
          [['Is the annual fee worth paying?',
            card.annualFee === 0 ? 'There is no annual fee on this card, so every rupee of reward is upside.'
              : 'At our reference spend of ₹4.8 lakh a year this card returns about ' + UI.money(sc.value.rewards + sc.value.perks) + ' in rewards and benefits against a ' + UI.money(card.annualFee) + ' fee. ' + (sc.value.net > 0 ? 'That is net positive.' : 'That is net negative at this spend level — you would need to spend more, or in the card\'s bonus categories, for it to pay for itself.')],
           ['How do I get the fee waived?', card.feeWaiver],
           ['What are the points actually worth?', card.redemption],
           ['Who is this card for?', 'It suits someone whose spending leans towards ' + card.type.join(', ').replace('-', ' ') + ', with an annual income of at least ' + UI.money(card.minIncome) + '.']
          ].map(function (f) {
            return '<div class="accordion"><button class="accordion__q">' + f[0] + '</button><div class="accordion__a">' + UI.esc(f[1]) + '</div></div>';
          }).join('') +
        '</div>' +

        '<aside class="detail__side">' +
          '<div class="panel">' +
            UI.plastic(card) +
            '<div style="margin:20px 0 18px">' + UI.gauge(sc.total, true, true) + '</div>' +
            '<p class="small muted" style="margin-bottom:16px">Estimated card value. This is our own model, not a guarantee of returns.</p>' +
            '<div class="calc__line" style="border-color:var(--line-soft)"><span class="small muted">Est. annual rewards</span><strong>' + UI.money(sc.value.rewards) + '</strong></div>' +
            '<div class="calc__line" style="border-color:var(--line-soft)"><span class="small muted">Est. benefit value</span><strong>' + UI.money(sc.value.perks) + '</strong></div>' +
            '<div class="calc__line" style="border-color:var(--line-soft)"><span class="small muted">Annual fee</span><strong>' + (card.annualFee ? '−' + UI.money(card.annualFee) : 'None') + '</strong></div>' +
            '<div class="calc__line"><span class="small muted">Net annual value</span><strong style="color:' + (sc.value.net >= 0 ? 'var(--crest)' : 'var(--danger)') + '">' + UI.money(sc.value.net) + '</strong></div>' +
            (elig ? '<div class="note" style="margin:16px 0">Your estimated eligibility: <strong>' + elig.label + '</strong> (' + elig.pct + '%). Based on the details in your profile.</div>' : '') +
            (C.rewardFor(card) ? '<div class="reward-box"><span>Apply through Card Crest and earn</span><b>' + UI.money(C.rewardFor(card)) + '</b><small>paid into your rewards wallet when the bank approves your application</small></div>' : '') +
            '<div class="stack" style="margin-top:18px">' +
              '<a class="btn ' + (C.rewardFor(card) ? 'btn--ghost' : 'btn--primary') + ' btn--block" href="#/eligibility?card=' + card.id + '">Check my eligibility</a>' +
              '<button class="btn ' + (C.rewardFor(card) ? 'btn--primary' : 'btn--ghost') + ' btn--block" data-apply>' + (C.rewardFor(card) ? 'Apply &amp; earn ' + UI.money(C.rewardFor(card)) : 'Apply for this card') + '</button>' +
              '<div class="row"><button class="btn btn--soft btn--sm" data-cmp-btn style="flex:1">Compare</button>' +
              '<button class="btn btn--soft btn--sm" data-save style="flex:1">' + (saved ? 'Saved' : 'Save card') + '</button></div>' +
            '</div>' +
            '<p class="small muted" style="margin-top:16px">Issued by ' + UI.esc(bank ? bank.name : '') + '. Approval, credit limit and pricing are decided by the bank. Card Crest does not lend.</p>' +
          '</div>' +
        '</aside>' +
      '</div></div>';

    return {
      title: card.name + ' | Card Crest',
      desc: card.name + ' from ' + (bank ? bank.name : '') + ' — fees, rewards, lounge access and an estimated card value score.',
      html: html,
      mount: function (root) {
        root.querySelector('[data-apply]').addEventListener('click', function () {
          w.CC.Render.applyForCard(card);
        });
        root.querySelector('[data-cmp-btn]').addEventListener('click', function () {
          var res = C.toggleCompare(card.id);
          if (res.full) return UI.toast('You can compare up to 4 cards at once', 'error');
          UI.toast(res.added ? 'Added to comparison' : 'Removed from comparison');
          Render.compareTray();
        });
        var saveBtn = root.querySelector('[data-save]');
        saveBtn.addEventListener('click', function () {
          if (!Auth.require()) return;
          var u = Auth.current();
          if (C.isSaved(u.id, card.id)) {
            C.unsave(u.id, card.id); saveBtn.textContent = 'Save card'; UI.toast('Removed from your cards');
          } else {
            if (!C.save(u.id, card.id)) return UI.toast('You can save up to ' + C.MAX_SAVED + ' cards. Remove one first.', 'error'); saveBtn.textContent = 'Saved'; UI.toast('Saved to your cards');
          }
        });
        Render.compareTray();
      }
    };
  };

  /* ---------------- /compare ---------------- */
  w.CC.Pages.compare = function () {
    var ids = C.compare();
    var cards = ids.map(C.byId).filter(Boolean);

    if (!cards.length) {
      return {
        title: 'Compare cards | Card Crest',
        html: '<div class="wrap section--tight">' +
          '<div class="section__head"><h1 class="h1">Compare cards</h1></div>' +
          UI.empty('Nothing to compare yet',
            'Pick up to four cards from the marketplace and they will line up here, side by side, on fees, rewards and benefits.',
            'Browse credit cards', '#/cards') + '</div>'
      };
    }

    var ROWS = [
      ['Card value score', function (c) { return C.score(c).total + ' / 100'; }, 'high'],
      ['Reward for applying via Card Crest', function (c) { var r = C.rewardFor(c); return r ? UI.money(r) : '2014'; }, 'high'],
      ['Annual fee', function (c) { return c.annualFee === 0 ? 'None' : UI.money(c.annualFee); }, 'low'],
      ['Joining fee', function (c) { return c.joiningFee === 0 ? 'None' : UI.money(c.joiningFee); }, 'low'],
      ['Fee waiver', function (c) { return c.feeWaiver; }],
      ['Base reward rate', function (c) { return UI.pct(c.rewardRate); }, 'high'],
      ['Top cashback rate', function (c) { return c.cashback ? UI.pct(c.cashback) : '—'; }, 'high'],
      ['Est. net annual value', function (c) { return UI.money(C.score(c).value.net); }, 'high'],
      ['Welcome benefit', function (c) { return c.welcome; }],
      ['Lounge access', function (c) { return c.lounge; }],
      ['Fuel', function (c) { return c.fuel; }],
      ['Travel', function (c) { return c.travel; }],
      ['Dining', function (c) { return c.dining; }],
      ['Shopping', function (c) { return c.shopping; }],
      ['Insurance', function (c) { return c.insurance; }],
      ['Milestones', function (c) { return c.milestone; }],
      ['Redemption', function (c) { return c.redemption; }],
      ['Minimum income', function (c) { return UI.money(c.minIncome); }, 'low']
    ];

    function numOf(s) { var m = String(s).replace(/[₹,]/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; }

    var head = '<tr><th style="width:180px"></th>' + cards.map(function (c) {
      return '<th><div style="width:100px; margin-bottom:10px">' + UI.plastic(c, true) + '</div>' +
        '<a href="#/cards/' + c.id + '" style="font-weight:600">' + UI.esc(c.name) + '</a><br>' +
        '<button class="btn btn--xs btn--link" data-rm="' + c.id + '">Remove</button></th>';
    }).join('') + '</tr>';

    var body = ROWS.map(function (r) {
      var vals = cards.map(function (c) { return r[1](c); });
      var best = null;
      if (r[2]) {
        var nums = vals.map(numOf);
        if (nums.every(function (n) { return n !== null; })) {
          best = r[2] === 'high' ? Math.max.apply(null, nums) : Math.min.apply(null, nums);
        }
      }
      return '<tr><th>' + r[0] + '</th>' + vals.map(function (v, i) {
        var isBest = best !== null && numOf(v) === best && cards.length > 1;
        return '<td' + (isBest ? ' class="cmp-best"' : '') + '>' + UI.esc(v) + '</td>';
      }).join('') + '</tr>';
    }).join('');

    return {
      title: 'Compare credit cards | Card Crest',
      desc: 'Line up to four credit cards side by side on fees, rewards, lounge access and estimated value.',
      html: '<div class="wrap section--tight">' +
        '<div class="spread section__head"><div><h1 class="h1">Comparing <em>' + cards.length + ' cards</em></h1>' +
        '<p class="lede">The strongest value in each row is highlighted. Fees and rewards are what the bank publishes; the value figures are our estimates.</p></div>' +
        '<div class="row"><a class="btn btn--ghost btn--sm" href="#/cards">Add another</a>' +
        '<button class="btn btn--danger btn--sm" data-clear>Clear all</button></div></div>' +
        '<div class="panel panel--flush"><div class="tbl-wrap"><table class="cmp-tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>' +
        '<p class="small muted" style="margin-top:16px">Net annual value assumes ₹40,000 of monthly spend spread across categories. Your own numbers will differ — the <a href="#/calculator">calculator</a> lets you set them.</p>' +
        '</div>',
      mount: function (root) {
        root.querySelectorAll('[data-rm]').forEach(function (b) {
          b.onclick = function () { C.toggleCompare(b.dataset.rm); Render.compareTray(); w.CC.Router.refresh(); };
        });
        root.querySelector('[data-clear]').onclick = function () {
          C.clearCompare(); Render.compareTray(); UI.toast('Comparison cleared'); w.CC.Router.refresh();
        };
        Render.compareTray();
      }
    };
  };

  /* ---------------- /eligibility ---------------- */
  w.CC.Pages.eligibility = function (params, query) {
    var step = 1;
    var form = {
      name: '', age: 30, city: '', employment: 'Salaried', employer: '',
      income: 900000, credit: 750, existingCards: '1',
      priorities: [], spend: Object.assign({}, C.REF)
    };
    var u = Auth.current();
    if (u) { form.name = u.name; form.city = u.city || ''; form.income = u.income || form.income; form.credit = u.credit || form.credit; form.employment = u.employment || form.employment; }

    return {
      title: 'Check your eligibility | Card Crest',
      desc: 'Answer six short steps and get an estimated eligibility and card match. No credit enquiry, no impact on your score.',
      html: '<div class="wrap section--tight" style="max-width:760px">' +
        '<div class="section__head"><h1 class="h1">Which cards are <em>within reach</em>?</h1>' +
        '<p class="lede">Six short steps. We estimate your eligibility from what you tell us — no credit bureau enquiry is made and your score is not affected.</p></div>' +
        '<div class="panel"><div class="stepper" id="stepper"></div><div id="stepBody"></div></div>' +
        '<p class="small muted" style="margin-top:16px">Estimated eligibility based on the information provided. Approval is always the bank\'s decision.</p></div>',
      mount: function (root) {
        var body = root.querySelector('#stepBody');
        var stepper = root.querySelector('#stepper');

        function nav(backLabel, nextLabel, nextFn, backFn) {
          return '<div class="row" style="margin-top:24px; gap:10px">' +
            (backFn !== false ? '<button class="btn btn--ghost" data-back>' + (backLabel || 'Back') + '</button>' : '') +
            '<button class="btn btn--primary" data-next style="flex:1">' + nextLabel + '</button></div>';
        }

        function draw() {
          stepper.innerHTML = [1, 2, 3, 4, 5, 6].map(function (i) {
            return '<div class="stepper__s' + (i <= step ? ' is-on' : '') + '"></div>';
          }).join('');

          if (step === 1) {
            body.innerHTML = '<p class="step-count">Step 1 of 6</p><h2 class="h2" style="margin-bottom:18px">About you</h2>' +
              '<div class="form-grid">' +
              '<div class="field"><label for="e-name">Full name</label><input id="e-name" data-name type="text" value="' + UI.esc(form.name) + '" placeholder="As it appears on your PAN"></div>' +
              '<div class="field"><label for="e-age">Age</label><input id="e-age" type="number" min="18" max="75" value="' + form.age + '"></div>' +
              '<div class="field" style="grid-column:1/-1"><label for="e-city">City</label><input id="e-city" type="text" value="' + UI.esc(form.city) + '" placeholder="Where you live"></div>' +
              '</div>' + nav(null, 'Continue', null, false);
          } else if (step === 2) {
            body.innerHTML = '<p class="step-count">Step 2 of 6</p><h2 class="h2" style="margin-bottom:18px">What you do</h2>' +
              '<div class="stack">' +
              '<div class="field"><label for="e-emp">Employment type</label><select id="e-emp">' +
              ['Salaried', 'Self-employed', 'Business owner', 'Student', 'Retired'].map(function (x) {
                return '<option' + (form.employment === x ? ' selected' : '') + '>' + x + '</option>';
              }).join('') + '</select></div>' +
              '<div class="field"><label for="e-org">Employer or business name</label><input id="e-org" type="text" value="' + UI.esc(form.employer) + '" placeholder="Optional, but it helps the estimate"></div>' +
              '</div>' + nav(null, 'Continue');
          } else if (step === 3) {
            body.innerHTML = '<p class="step-count">Step 3 of 6</p><h2 class="h2" style="margin-bottom:18px">Your annual income</h2>' +
              '<div class="calc__row"><div class="spread"><label for="e-inc">Gross annual income</label><output id="e-inc-o">' + UI.money(form.income) + '</output></div>' +
              '<input id="e-inc" type="range" min="120000" max="6000000" step="60000" value="' + form.income + '"></div>' +
              '<p class="small muted">Banks use gross income before tax. Include fixed bonuses if they are part of your CTC.</p>' + nav(null, 'Continue');
          } else if (step === 4) {
            body.innerHTML = '<p class="step-count">Step 4 of 6</p><h2 class="h2" style="margin-bottom:18px">Your credit profile</h2>' +
              '<div class="calc__row"><div class="spread"><label for="e-cr">Credit score</label><output id="e-cr-o">' + form.credit + '</output></div>' +
              '<input id="e-cr" type="range" min="0" max="900" step="10" value="' + form.credit + '"></div>' +
              '<p class="small muted" style="margin-bottom:20px">Set this to 0 if you have never held a card or loan. A thin file is not a rejection — some cards are built for it.</p>' +
              '<div class="field"><label for="e-cards">Credit cards you already hold</label><select id="e-cards">' +
              ['0', '1', '2', '3', '4 or more'].map(function (x) {
                return '<option' + (form.existingCards === x ? ' selected' : '') + '>' + x + '</option>';
              }).join('') + '</select></div>' + nav(null, 'Continue');
          } else if (step === 5) {
            var opts = DATA.cardTypes.filter(function (t) { return t.id !== 'lifetime-free'; });
            body.innerHTML = '<p class="step-count">Step 5 of 6</p><h2 class="h2" style="margin-bottom:8px">What should the card be good at?</h2>' +
              '<p class="muted small" style="margin-bottom:18px">Pick as many as apply. This shapes the ranking, not your eligibility.</p>' +
              '<div class="chip-row" style="margin-bottom:26px">' + opts.map(function (t) {
                return '<button class="chip' + (form.priorities.indexOf(t.id) > -1 ? ' is-on' : '') + '" data-pri="' + t.id + '">' + t.label + '</button>';
              }).join('') + '</div>' +
              '<h3 class="h3" style="margin-bottom:14px">Roughly what do you spend each month?</h3>' +
              ['online:Online shopping', 'offline:In-store and everything else', 'dining:Dining and food delivery', 'fuel:Fuel', 'travel:Travel'].map(function (pair) {
                var k = pair.split(':')[0], label = pair.split(':')[1];
                return '<div class="calc__row"><div class="spread"><label for="sp-' + k + '">' + label + '</label>' +
                  '<output id="sp-' + k + '-o">' + UI.money(form.spend[k]) + '</output></div>' +
                  '<input id="sp-' + k + '" data-spend="' + k + '" type="range" min="0" max="60000" step="1000" value="' + form.spend[k] + '"></div>';
              }).join('') + nav(null, 'See my matches');
          } else {
            var results = C.recommend(
              { income: form.income, credit: form.credit, employment: form.employment, age: Number(form.age) },
              { priorities: form.priorities, spend: form.spend }
            );
            body.innerHTML = '<p class="step-count">Step 6 of 6</p><h2 class="h2" style="margin-bottom:8px">Recommended for you</h2>' +
              '<p class="muted small" style="margin-bottom:22px">Estimated eligibility based on the information provided. Ranked on value returned at your spending pattern.</p>' +
              (results.length ? results.map(function (r) {
                var bank = C.bank(r.card.bank);
                return '<div class="panel" style="margin-bottom:14px"><div class="spread" style="align-items:flex-start">' +
                  '<div style="flex:1"><div class="ctile__bank">' + UI.esc(bank.name) + '</div>' +
                  '<h3 class="h3" style="font-size:1.15rem; margin:4px 0 10px">' + UI.esc(r.card.name) + '</h3>' +
                  '<div class="row row--wrap" style="gap:8px; margin-bottom:12px">' +
                  '<span class="badge badge--' + (r.eligibility.level === 'strong' ? 'ok' : r.eligibility.level === 'fair' ? 'warn' : 'grey') + '">' + r.eligibility.label + ' &middot; ' + r.eligibility.pct + '%</span>' +
                  '<span class="badge badge--grey">' + (r.card.annualFee ? UI.money(r.card.annualFee) + ' a year' : 'No annual fee') + '</span>' +
                  '<span class="badge badge--gold">Est. ' + UI.money(r.score.value.net) + ' net value</span></div>' +
                  '<ul class="ctile__perks">' + r.card.perks.map(function (p) {
                    return '<li class="badge badge--grey">' + UI.esc(p) + '</li>';
                  }).join('') + '</ul></div>' +
                  '<div style="text-align:center">' + UI.gauge(r.score.total, false) + '</div></div>' +
                  '<div class="row" style="margin-top:16px"><a class="btn btn--primary btn--sm" href="#/cards/' + r.card.id + '">View card</a>' +
                  '<button class="btn btn--ghost btn--sm" data-cmp-add="' + r.card.id + '">Compare</button></div></div>';
              }).join('') : UI.empty('No confident matches yet',
                'With the details given, none of the cards in our catalogue is a comfortable fit. Building a few months of credit history, or raising the income figure if it was understated, opens most of them up.',
                'Browse all cards', '#/cards')) +
              '<div class="row" style="margin-top:20px"><button class="btn btn--ghost" data-back>Change my answers</button>' +
              '<a class="btn btn--soft" href="#/calculator">Open the calculator</a></div>';
          }

          // wiring
          var back = body.querySelector('[data-back]');
          if (back) back.onclick = function () { step = Math.max(1, step - 1); draw(); };
          var next = body.querySelector('[data-next]');
          if (next) next.onclick = function () {
            if (step === 1) {
              var n = body.querySelector('#e-name').value.trim();
              if (!n) return UI.toast('Add your name to continue', 'error');
              form.name = UI.titleCase(n);
              form.age = Number(body.querySelector('#e-age').value) || 30;
              form.city = body.querySelector('#e-city').value.trim();
            }
            if (step === 2) {
              form.employment = body.querySelector('#e-emp').value;
              form.employer = body.querySelector('#e-org').value.trim();
            }
            if (step === 3) form.income = Number(body.querySelector('#e-inc').value);
            if (step === 4) {
              form.credit = Number(body.querySelector('#e-cr').value);
              form.existingCards = body.querySelector('#e-cards').value;
            }
            step = Math.min(6, step + 1);
            draw();
          };
          var inc = body.querySelector('#e-inc');
          if (inc) inc.oninput = function () { body.querySelector('#e-inc-o').textContent = UI.money(inc.value); };
          var cr = body.querySelector('#e-cr');
          if (cr) cr.oninput = function () { body.querySelector('#e-cr-o').textContent = cr.value === '0' ? 'No history' : cr.value; };
          body.querySelectorAll('[data-pri]').forEach(function (b) {
            b.onclick = function () {
              var id = b.dataset.pri, i = form.priorities.indexOf(id);
              if (i > -1) form.priorities.splice(i, 1); else form.priorities.push(id);
              b.classList.toggle('is-on');
            };
          });
          body.querySelectorAll('[data-spend]').forEach(function (r) {
            r.oninput = function () {
              form.spend[r.dataset.spend] = Number(r.value);
              body.querySelector('#sp-' + r.dataset.spend + '-o').textContent = UI.money(r.value);
            };
          });
          body.querySelectorAll('[data-cmp-add]').forEach(function (b) {
            b.onclick = function () {
              var res = C.toggleCompare(b.dataset.cmpAdd);
              if (res.full) return UI.toast('You can compare up to 4 cards at once', 'error');
              UI.toast(res.added ? 'Added to comparison' : 'Removed from comparison');
              Render.compareTray();
            };
          });
        }

        if (query.card) {
          var pre = C.byId(query.card);
          if (pre) UI.toast('Checking your fit for ' + pre.name);
        }
        draw();
      }
    };
  };

  /* ---------------- /calculator ---------------- */
  w.CC.Pages.calculator = function (params, query) {
    var spend = Object.assign({}, C.REF);
    var cardId = query.card || C.topByScore(1)[0].id;

    return {
      title: 'Card value calculator | Card Crest',
      desc: 'Work out what a credit card actually returns on your spending, after the annual fee.',
      html: '<div class="wrap section--tight">' +
        '<div class="section__head"><h1 class="h1">What is this card <em>actually worth</em> to you?</h1>' +
        '<p class="lede">Set your real monthly spending. We work out the rewards you would earn, discount points you cannot easily spend, add the benefits, subtract the fee and show you what is left.</p></div>' +
        '<div class="calc">' +
          '<div class="panel">' +
            '<div class="field" style="margin-bottom:24px"><label for="calcCard">Card to model</label>' +
            '<select id="calcCard">' + C.all().slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) {
              return '<option value="' + c.id + '"' + (c.id === cardId ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>';
            }).join('') + '</select></div>' +
            ['online:Online shopping', 'offline:In-store and everything else', 'dining:Dining and food delivery', 'fuel:Fuel', 'travel:Travel and hotels'].map(function (pair) {
              var k = pair.split(':')[0], label = pair.split(':')[1];
              return '<div class="calc__row"><div class="spread"><label for="c-' + k + '">' + label + ' <span class="muted small">per month</span></label>' +
                '<output id="c-' + k + '-o">' + UI.money(spend[k]) + '</output></div>' +
                '<input id="c-' + k + '" data-k="' + k + '" type="range" min="0" max="80000" step="1000" value="' + spend[k] + '"></div>';
            }).join('') +
            '<div class="divider"></div>' +
            '<div class="spread"><span class="muted small">Total monthly spend</span><strong class="mono" id="calcTotal"></strong></div>' +
          '</div>' +
          '<div class="calc__out" id="calcOut"></div>' +
        '</div>' +
        '<p class="small muted" style="margin-top:18px">These are estimates, not guaranteed returns. Reward caps, category exclusions and merchant category codes all move real-world numbers around. Always read the card\'s own terms.</p>' +
        '</div>',
      mount: function (root) {
        var out = root.querySelector('#calcOut');
        var sel = root.querySelector('#calcCard');

        function draw() {
          var card = C.byId(sel.value);
          var sc = C.score(card, spend);
          var v = sc.value;
          root.querySelector('#calcTotal').textContent = UI.money(spend.online + spend.offline + spend.dining + spend.fuel + spend.travel);

          out.innerHTML =
            '<div style="text-align:center; margin-bottom:20px">' + UI.gauge(sc.total, false, true) +
            '<div class="k" style="margin-top:8px">Estimated card value</div></div>' +
            '<div class="calc__line"><span class="k">Gross rewards earned</span><span class="v">' + UI.money(v.grossRewards) + '</span></div>' +
            '<div class="calc__line"><span class="k">After redemption value</span><span class="v">' + UI.money(v.rewards) + '</span></div>' +
            '<div class="calc__line"><span class="k">Benefits and perks</span><span class="v">' + UI.money(v.perks) + '</span></div>' +
            '<div class="calc__line"><span class="k">First-year welcome</span><span class="v">' + UI.money(v.welcome) + '</span></div>' +
            '<div class="calc__line"><span class="k">Annual fee</span><span class="v">' + (v.fee ? '−' + UI.money(v.fee) : 'None') + '</span></div>' +
            '<div class="calc__net"><span class="k">Net annual value</span><span class="v" id="netV">' + UI.money(v.net) + '</span>' +
            '<span class="k">on ' + UI.money(v.spend) + ' of annual spend</span></div>' +
            '<a class="btn btn--ghost btn--block" href="#/cards/' + card.id + '" style="margin-top:18px; background:#fff">Open ' + UI.esc(card.name) + '</a>';

          var netEl = out.querySelector('#netV');
          UI.countUp(netEl, v.net, function (n) { return UI.money(n); });
        }

        root.querySelectorAll('[data-k]').forEach(function (r) {
          r.addEventListener('input', function () {
            spend[r.dataset.k] = Number(r.value);
            root.querySelector('#c-' + r.dataset.k + '-o').textContent = UI.money(r.value);
            draw();
          });
        });
        sel.addEventListener('change', draw);
        draw();
      }
    };
  };
})(window, document);
