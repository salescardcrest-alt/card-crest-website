/* ============================================================
   Card Crest — pages/account.js
   Auth, dashboard, saved cards, applications, transactions,
   rewards wallet, referrals, profile, notifications.
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, Auth = w.CC.Auth, C = w.CC.Cards, O = w.CC.Offers,
      CB = w.CC.Cashback, RW = w.CC.Rewards, RF = w.CC.Referrals,
      AP = w.CC.Applications, NT = w.CC.Notifications;
  w.CC.Pages = w.CC.Pages || {};

  /* ---------------- account shell ---------------- */
  function shell(active, title, inner) {
    var items = [
      ['/dashboard', 'Overview'],
      ['/dashboard/cards', 'My cards'],
      ['/dashboard/transactions', 'Transactions'],
      ['/dashboard/applications', 'Applications'],
      ['/rewards', 'Rewards wallet'],
      ['/refer', 'Refer and earn'],
      ['/dashboard/notifications', 'Notifications'],
      ['/profile', 'Profile and settings']
    ];
    return '<div class="wrap section--tight"><div class="dash">' +
      '<nav class="side-nav" aria-label="Account">' +
      items.map(function (i) {
        return '<a href="#' + i[0] + '" class="' + (i[0] === active ? 'is-active' : '') + '">' + i[1] + '</a>';
      }).join('') + '</nav><div>' + inner + '</div></div></div>';
  }

  /* Sign-in / sign-up motion: shake on a failed attempt, fade the card out on success. */
  function shake(root) {
    var card = root.querySelector('.auth-card');
    if (!card) return;
    card.classList.remove('is-shaking');
    void card.offsetWidth; // restart the animation
    card.classList.add('is-shaking');
  }
  function leave(root, next) {
    var card = root.querySelector('.auth-card');
    if (card) card.classList.add('is-leaving');
    setTimeout(next, 260);
  }

  /* ---------------- /login ---------------- */
  w.CC.Pages.login = function (params, query) {
    if (Auth.current()) { w.CC.Router.go('#/dashboard'); return false; }
    return {
      title: 'Sign in | Card Crest',
      desc: 'Sign in to your Card Crest account.',
      html: '<div class="auth-wrap"><div class="auth-card">' +
        '<h1 class="h1">Welcome back</h1><p class="muted" style="margin-bottom:24px">Sign in to see your cashback, rewards and applications. Card Crest staff sign in here too and go straight to the admin panel.</p>' +
        '<form id="loginForm" novalidate>' +
        '<div class="field" style="margin-bottom:16px"><label for="l-email">Email address</label>' +
        '<input id="l-email" type="email" autocomplete="email" placeholder="you@example.com"><span class="err">Enter the email you signed up with.</span></div>' +
        '<div class="field" style="margin-bottom:14px"><label for="l-pw">Password</label>' +
        '<div class="pw-wrap"><input id="l-pw" type="password" autocomplete="current-password" placeholder="Your password">' +
        '<button type="button" class="pw-toggle" data-pw="l-pw">Show</button></div><span class="err">Enter your password.</span></div>' +
        '<div class="spread" style="margin-bottom:22px">' +
        '<label class="check"><input type="checkbox" id="l-remember" checked> Keep me signed in</label>' +
        '<button type="button" class="btn btn--link small" data-forgot>Forgot password?</button></div>' +
        '<button class="btn btn--primary btn--block" type="submit">Sign in</button>' +
        '</form>' +
        (Auth.remote ? '' : '<div class="note" style="margin-top:22px"><strong>Demo accounts</strong><br>' +
        'User: demo@cardcrest.in / demo1234<br>Admin: admin@cardcrest.in / admin1234</div>') +
        '<p class="auth-alt">New to Card Crest? <a href="#/signup" style="color:var(--crest); font-weight:600">Create an account</a></p>' +
        '</div></div>',
      mount: function (root) {
        root.querySelector('[data-pw]').onclick = function () {
          var i = root.querySelector('#l-pw');
          i.type = i.type === 'password' ? 'text' : 'password';
          this.textContent = i.type === 'password' ? 'Show' : 'Hide';
        };
        root.querySelector('[data-forgot]').onclick = function () {
          UI.modal({
            title: 'Reset your password',
            body: '<p class="muted">Enter your email and we will send a reset link.</p>' +
              '<div class="field" style="margin-top:16px"><label for="f-email">Email address</label><input id="f-email" type="email"></div>' +
              (Auth.remote ? '' : '<p class="small muted" style="margin-top:14px">Demo mode — no email is actually sent.</p>'),
            foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-send>Send reset link</button>',
            onMount: function (m) {
              m.querySelector('[data-send]').onclick = function () {
                var v = m.querySelector('#f-email').value.trim();
                if (!v) return UI.toast('Enter your email address', 'error');
                UI.closeModal();
                Auth.resetPassword(v).then(function (res) {
                  if (!res.ok) return UI.toast(res.error, 'error');
                  UI.toast('If that email is registered, a reset link is on its way');
                });
              };
            }
          });
        };
        root.querySelector('#loginForm').addEventListener('submit', function (e) {
          e.preventDefault();
          var email = root.querySelector('#l-email'), pw = root.querySelector('#l-pw');
          var bad = false;
          [email, pw].forEach(function (i) {
            var ok = i.value.trim().length > 0;
            i.closest('.field').classList.toggle('is-bad', !ok);
            if (!ok) bad = true;
          });
          if (bad) return shake(root);
          var btn = root.querySelector('#loginForm button[type=submit]');
          btn.disabled = true; btn.textContent = 'Signing in…';
          Auth.login(email.value, pw.value).then(function (res) {
            if (!res.ok) {
              btn.disabled = false; btn.textContent = 'Sign in';
              UI.toast(res.error, 'error'); return shake(root);
            }
            btn.textContent = 'Welcome back';
            UI.toast('Signed in as ' + res.user.name);
            w.CC.App.paintAuth();
            leave(root, function () {
              w.CC.Router.go(query.next ? '#' + query.next : (res.user.role === 'admin' ? '#/admin' : '#/dashboard'));
            });
          });
        });
      }
    };
  };

  /* ---------------- /signup ---------------- */
  w.CC.Pages.signup = function () {
    if (Auth.current()) { w.CC.Router.go('#/dashboard'); return false; }
    return {
      title: 'Create your account | Card Crest',
      desc: 'Create a free Card Crest account to track cashback and rewards.',
      html: '<div class="auth-wrap"><div class="auth-card">' +
        '<h1 class="h1">Create your account</h1><p class="muted" style="margin-bottom:24px">Free, and it takes about a minute.</p>' +
        '<form id="signupForm" novalidate>' +
        '<div class="field" style="margin-bottom:14px"><label for="s-name">Full name</label><input id="s-name" type="text" autocomplete="name"><span class="err">Tell us what to call you.</span></div>' +
        '<div class="field" style="margin-bottom:14px"><label for="s-email">Email address</label><input id="s-email" type="email" autocomplete="email"><span class="err">Enter a valid email address.</span></div>' +
        '<div class="field" style="margin-bottom:14px"><label for="s-mobile">Mobile number</label><input id="s-mobile" type="tel" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="10 digits"><span class="err">Enter a 10-digit mobile number.</span></div>' +
        '<div class="field" style="margin-bottom:14px"><label for="s-pw">Password</label>' +
        '<div class="pw-wrap"><input id="s-pw" type="password" autocomplete="new-password"><button type="button" class="pw-toggle" data-pw="s-pw">Show</button></div>' +
        '' + UI.pwMeterHtml() + '<span class="err">Use 8+ characters with upper and lower case letters, a number and a symbol.</span></div>' +
        '<div class="field" style="margin-bottom:18px"><label for="s-pw2">Confirm password</label><input id="s-pw2" type="password" autocomplete="new-password"><span class="err">Both passwords need to match.</span></div>' +
        '<label class="check" style="margin-bottom:20px"><input type="checkbox" id="s-terms"> I agree to the <a href="#/legal/terms" style="color:var(--crest)">terms</a> and <a href="#/legal/privacy" style="color:var(--crest)">privacy policy</a>.</label>' +
        '<button class="btn btn--primary btn--block" type="submit">Create account</button>' +
        '</form>' +
        '<p class="auth-alt">Already have an account? <a href="#/login" style="color:var(--crest); font-weight:600">Sign in</a></p>' +
        '</div></div>',
      mount: function (root) {
        root.querySelector('[data-pw]').onclick = function () {
          var i = root.querySelector('#s-pw');
          i.type = i.type === 'password' ? 'text' : 'password';
          this.textContent = i.type === 'password' ? 'Show' : 'Hide';
        };
        UI.pwBind(root.querySelector('#s-pw'), root);
        root.querySelector('#s-mobile').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 10); });
        root.querySelector('#signupForm').addEventListener('submit', function (e) {
          e.preventDefault();
          var f = {
            name: root.querySelector('#s-name'), email: root.querySelector('#s-email'),
            mobile: root.querySelector('#s-mobile'), pw: root.querySelector('#s-pw'), pw2: root.querySelector('#s-pw2')
          };
          var checks = [
            [f.name, f.name.value.trim().length > 1],
            [f.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())],
            [f.mobile, /^\d{10}$/.test(f.mobile.value.replace(/\D/g, ''))],
            [f.pw, UI.pwOk(f.pw.value)],
            [f.pw2, f.pw2.value === f.pw.value && UI.pwOk(f.pw2.value)]
          ];
          var bad = false;
          checks.forEach(function (c) {
            c[0].closest('.field').classList.toggle('is-bad', !c[1]);
            if (!c[1]) bad = true;
          });
          if (!root.querySelector('#s-terms').checked) {
            UI.toast('Accept the terms to continue', 'error'); bad = true;
          }
          if (bad) return shake(root);
          var btn = root.querySelector('#signupForm button[type=submit]');
          btn.disabled = true; btn.textContent = 'Creating account…';
          Auth.signup({
            name: f.name.value, email: f.email.value,
            mobile: f.mobile.value.replace(/\D/g, ''), password: f.pw.value
          }).then(function (res) {
            if (!res.ok) {
              btn.disabled = false; btn.textContent = 'Create account';
              UI.toast(res.error, 'error'); return shake(root);
            }
            btn.textContent = 'Account created';
            if (res.confirmEmail) {
              UI.toast('Check your inbox to confirm your email, then sign in');
              return leave(root, function () { w.CC.Router.go('#/login'); });
            }
            UI.toast('Welcome to Card Crest');
            w.CC.App.paintAuth();
            leave(root, function () { w.CC.Router.go('#/eligibility'); });
          });
        });
      }
    };
  };

  /* ---------------- /dashboard ---------------- */
  w.CC.Pages.dashboard = function () {
    if (!Auth.require()) return false;
    var u = Auth.current();
    var t = CB.totals(u.id);
    var txns = CB.forUser(u.id).slice(0, 5);
    var apps = AP.forUser(u.id).slice(0, 3);
    var saved = C.saved(u.id);
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    var recCards = C.recommend(C.profileFor(u), {}).slice(0, 2);
    var recOffers = O.query({ section: 'top' }).slice(0, 3);

    var inner =
      '<div class="dash__hi"><h1 class="h1">' + greet + ', <em>' + UI.esc(u.name.split(' ')[0]) + '</em></h1>' +
      '<p class="lede">' + (t.pending > 0
        ? UI.money(t.pending) + ' of cashback is on its way. Here is where everything stands.'
        : 'Here is where everything stands.') + '</p></div>' +

      '<div class="grid g-4" style="margin-bottom:26px">' +
        '<div class="stat stat--accent"><span class="stat__k">Available to redeem</span><span class="stat__v" data-count="' + t.available + '">' + UI.money(t.available) + '</span><span class="stat__sub">Minimum ' + UI.money(RW.MIN) + '</span></div>' +
        '<div class="stat"><span class="stat__k">Pending cashback</span><span class="stat__v">' + UI.money(t.pending) + '</span><span class="stat__sub">Awaiting merchant confirmation</span></div>' +
        '<div class="stat"><span class="stat__k">Confirmed to date</span><span class="stat__v">' + UI.money(t.confirmed) + '</span><span class="stat__sub">Across ' + t.count + ' transactions</span></div>' +
        '<div class="stat"><span class="stat__k">Referral earnings</span><span class="stat__v">' + UI.money(t.referral) + '</span><span class="stat__sub">' + RF.stats(u.id).successful + ' successful referrals</span></div>' +
      '</div>' +

      '<h2 class="h3" style="margin-bottom:12px">Quick actions</h2>' +
      '<div class="quick" style="margin-bottom:32px">' +
        [['#/cards', 'Find a card', 'F'], ['#/compare', 'Compare cards', 'C'], ['#/eligibility', 'Check eligibility', 'E'],
         ['#/offers', 'Explore offers', 'O'], ['#/rewards', 'Redeem rewards', 'R'], ['#/refer', 'Refer a friend', 'S']
        ].map(function (q) {
          return '<a href="' + q[0] + '"><span class="qi">' + q[2] + '</span>' + q[1] + '</a>';
        }).join('') + '</div>' +

      '<div class="grid g-2" style="margin-bottom:28px">' +
        '<div class="panel panel--flush"><div class="panel__head"><h2 class="h3">Recent transactions</h2>' +
        '<a class="btn btn--xs btn--link" href="#/dashboard/transactions">See all</a></div><div class="panel__body">' +
        (txns.length ? txns.map(function (x) {
          var dsc = CB.describe(x);
          return '<div class="spread" style="padding:11px 0; border-bottom:1px solid var(--line-soft)">' +
            '<div><strong style="font-size:.92rem">' + UI.esc(dsc.name) + '</strong>' +
            '<div class="small muted">' + UI.date(x.createdAt) + (dsc.reward ? '' : ' &middot; ' + UI.money(x.amount)) + '</div></div>' +
            '<div style="text-align:right"><strong>' + UI.money(x.cashback) + '</strong><br>' + UI.statusBadge(x.status) + '</div></div>';
        }).join('') : '<p class="muted small">No transactions yet. Activate an offer and the first one shows up here.</p>') +
        '</div></div>' +

        '<div class="panel panel--flush"><div class="panel__head"><h2 class="h3">Your applications</h2>' +
        '<a class="btn btn--xs btn--link" href="#/dashboard/applications">See all</a></div><div class="panel__body">' +
        (apps.length ? apps.map(function (a) {
          var card = C.byId(a.cardId);
          return '<div class="spread" style="padding:11px 0; border-bottom:1px solid var(--line-soft)">' +
            '<div><strong style="font-size:.92rem">' + UI.esc(card ? card.name : 'Card') + '</strong>' +
            '<div class="small muted">Applied ' + UI.date(a.createdAt) + '</div></div>' +
            UI.statusBadge(a.status) + '</div>';
        }).join('') : '<p class="muted small">No applications yet.</p>') +
        '</div></div>' +
      '</div>' +

      '<div class="spread" style="margin-bottom:16px"><h2 class="h2">Cards worth a look</h2>' +
      '<a class="btn btn--ghost btn--sm" href="#/cards">All cards</a></div>' +
      '<div class="mkt__grid" style="margin-bottom:32px" id="dashCards">' +
        (recCards.length ? recCards.map(function (r) { return w.CC.Render.cardTile(r.card); }).join('')
          : UI.empty('Add your income to get matches', 'We need a couple of details before we can rank cards for you.', 'Check eligibility', '#/eligibility')) +
      '</div>' +

      '<div class="spread" style="margin-bottom:16px"><h2 class="h2">Offers picked for you</h2>' +
      '<a class="btn btn--ghost btn--sm" href="#/offers">All offers</a></div>' +
      '<div class="grid g-3" id="dashOffers">' + recOffers.map(w.CC.Render.offerTile).join('') + '</div>';

    return {
      title: 'Your dashboard | Card Crest',
      desc: 'Your cashback, rewards, applications and card recommendations in one place.',
      html: shell('/dashboard', 'Dashboard', inner),
      mount: function (root) {
        w.CC.Render.bindCompare(root);
        w.CC.Render.bindOfferActions(root);
        var c = root.querySelector('[data-count]');
        if (c) UI.countUp(c, Number(c.dataset.count), function (n) { return UI.money(n); });
      }
    };
  };

  /* ---------------- /dashboard/cards ---------------- */
  w.CC.Pages.myCards = function () {
    if (!Auth.require()) return false;
    var u = Auth.current();
    var saved = C.saved(u.id);

    var inner = '<div class="spread section__head"><div><h1 class="h1">My cards</h1>' +
      '<p class="lede">Cards you have saved, with what each is worth over a year at an average spending pattern.</p></div>' +
      '<button class="btn btn--primary btn--sm" data-add-card>Add a card</button></div>' +
      (saved.length ? '<div class="stack">' + saved.map(function (s) {
        var card = C.byId(s.cardId);
        if (!card) return '';
        var sc = card.partner ? null : C.score(card);
        var renew = new Date(s.savedAt); renew.setFullYear(renew.getFullYear() + 1);
        return '<div class="panel"><div class="row row--wrap" style="gap:20px; align-items:flex-start">' +
          '<div style="width:130px; flex-shrink:0">' + UI.plastic(card) + '</div>' +
          '<div style="flex:1; min-width:200px">' +
          '<div class="row" style="gap:10px; margin-bottom:6px">' +
          '<h3 class="h3" style="font-size:1.1rem">' + UI.esc(card.name) + '</h3>' +
          (s.primary ? '<span class="badge">Primary</span>' : '') + '</div>' +
          '<div class="small muted" style="margin-bottom:12px">' + UI.esc(C.bank(card.bank).name) + ' &middot; saved ' + UI.date(s.savedAt) + '</div>' +
          (card.partner ?
            '<div class="grid g-3" style="gap:14px"><div><span class="fact__k">Reward when approved</span><span class="fact__v" style="color:var(--crest)">' + UI.money(C.rewardFor(card)) + '</span></div>' +
            '<div><span class="fact__k">Fees and benefits</span><span class="fact__v">Set by the bank</span></div>' +
            '<div><span class="fact__k">Renews</span><span class="fact__v">' + UI.date(renew.toISOString()) + '</span></div></div></div>'
          :
            '<div class="grid g-3" style="gap:14px">' +
          '<div><span class="fact__k">Annual fee</span><span class="fact__v">' + (card.annualFee ? UI.money(card.annualFee) : 'None') + '</span></div>' +
          '<div><span class="fact__k">Est. yearly value</span><span class="fact__v" style="color:var(--crest)">' + UI.money(sc.value.net) + '</span></div>' +
          '<div><span class="fact__k">Renews</span><span class="fact__v">' + UI.date(renew.toISOString()) + '</span></div>' +
            '</div></div>' +
            '<div style="text-align:center">' + UI.gauge(sc.total, false) + '</div>') +
          '</div>' +
          '<div class="row row--wrap" style="margin-top:18px; gap:8px">' +
          '<a class="btn btn--ghost btn--sm" href="#/cards/' + card.id + '">Benefits</a>' +
          (card.partner ? '' : '<a class="btn btn--ghost btn--sm" href="#/calculator?card=' + card.id + '">Model my spend</a>') +
          (s.primary ? '' : '<button class="btn btn--soft btn--sm" data-primary="' + s.id + '">Make primary</button>') +
          '<button class="btn btn--danger btn--sm" data-remove="' + card.id + '" style="margin-left:auto">Remove</button>' +
          '</div></div>';
      }).join('') + '</div>'
        : UI.empty('No saved cards yet',
          'Save a card and it lands here with its renewal date and what it is worth to you over a year.',
          'Browse credit cards', '#/cards') + '<div style="text-align:center; margin-top:14px"><button class="btn btn--ghost" data-add-card>Add a card I already have</button></div>');

    return {
      title: 'My cards | Card Crest',
      html: shell('/dashboard/cards', 'My cards', inner),
      mount: function (root) {
        /* Add a card: pick the company, the card type, then the card itself. */
        function openAddCard() {
          var typeNames = { cashback: 'Cashback', travel: 'Travel', rewards: 'Rewards', premium: 'Premium', shopping: 'Shopping', fuel: 'Fuel', dining: 'Dining', lifetime: 'Lifetime free', entry: 'Entry level', business: 'Business', partner: 'Other' };
          function cardsOf(bank) {
            var seen = {}, out = [];
            C.all().concat(C.partners()).forEach(function (c) { if (c.bank === bank && !seen[c.id]) { seen[c.id] = 1; out.push(c); } });
            return out;
          }
          function typesOf(list) {
            var t = [];
            list.forEach(function (c) { (c.type || []).forEach(function (x) { if (x !== 'partner' && t.indexOf(x) < 0) t.push(x); }); });
            return t;
          }
          var banks = C.banks().filter(function (b) { return cardsOf(b.id).length; });
          UI.modal({
            title: 'Add a card',
            body: '<p class="muted" style="margin-bottom:14px">Choose the company, the type of card and the card you hold. You can add up to ' + C.MAX_SAVED + ' cards, so keep adding and press Done when finished.</p>' +
              '<div class="field"><label for="ac-bank">Card company</label><select id="ac-bank"><option value="">Select company</option>' +
              banks.map(function (b) { return '<option value="' + b.id + '">' + UI.esc(b.name) + '</option>'; }).join('') + '</select></div>' +
              '<div class="field" style="margin-top:12px"><label for="ac-type">Card type</label><select id="ac-type" disabled><option value="">Select company first</option></select></div>' +
              '<div class="field" style="margin-top:12px"><label for="ac-card">Card</label><select id="ac-card" disabled><option value="">Select company first</option></select></div>' +
              '<div class="small muted" id="ac-note" style="margin-top:10px"></div>' +
              '<div class="small" id="ac-count" style="margin-top:6px; font-weight:600"></div>',
            foot: '<button class="btn btn--ghost" data-x>Done</button><button class="btn btn--primary" data-ac-save disabled>Add card</button>',
            onMount: function (m) {
              var bankEl = m.querySelector('#ac-bank'), typeEl = m.querySelector('#ac-type'), cardEl = m.querySelector('#ac-card'),
                  note = m.querySelector('#ac-note'), save = m.querySelector('[data-ac-save]');
              function fillCards() {
                var list = cardsOf(bankEl.value), t = typeEl.value;
                if (t) list = list.filter(function (c) { return (c.type || []).indexOf(t) > -1; });
                cardEl.innerHTML = '<option value="">' + (list.length ? 'Select card' : 'No card of this type') + '</option>' +
                  list.map(function (c) { return '<option value="' + c.id + '">' + UI.esc(c.name) + '</option>'; }).join('');
                cardEl.disabled = !list.length; save.disabled = true;
              }
              bankEl.onchange = function () {
                var list = cardsOf(bankEl.value), ts = typesOf(list);
                typeEl.disabled = !bankEl.value;
                typeEl.innerHTML = '<option value="">All types</option>' + ts.map(function (x) { return '<option value="' + x + '">' + (typeNames[x] || x) + '</option>'; }).join('');
                note.textContent = ''; fillCards();
              };
              typeEl.onchange = fillCards;
              cardEl.onchange = function () {
                save.disabled = !cardEl.value;
                note.textContent = cardEl.value && C.isSaved(u.id, cardEl.value) ? 'You have already added this card.' : '';
              };
              function count() {
                var n = C.saved(u.id).length;
                m.querySelector('#ac-count').textContent = n + ' of ' + C.MAX_SAVED + ' cards added';
                save.textContent = n >= C.MAX_SAVED ? 'Limit reached' : 'Add card';
                return n;
              }
              count();
              save.onclick = function () {
                var id = cardEl.value; if (!id) return;
                if (count() >= C.MAX_SAVED) { note.textContent = 'You can add up to ' + C.MAX_SAVED + ' cards. Remove one to add another.'; save.disabled = true; return; }
                if (!C.save(u.id, id)) { note.textContent = 'You have already added this card.'; return; }
                UI.toast('Card added to My cards');
                w.CC.Router.refresh();
                var left = count();
                cardEl.value = ''; save.disabled = true;
                note.textContent = left >= C.MAX_SAVED ? 'You have reached the limit of ' + C.MAX_SAVED + ' cards.' : 'Added. Pick another card, or press Done.';
              };
            }
          });
        }
        root.querySelectorAll('[data-add-card]').forEach(function (b) { b.onclick = openAddCard; });
        root.querySelectorAll('[data-primary]').forEach(function (b) {
          b.onclick = function () {
            C.setPrimary(u.id, b.dataset.primary);
            UI.toast('Primary card updated');
            w.CC.Router.refresh();
          };
        });
        root.querySelectorAll('[data-remove]').forEach(function (b) {
          b.onclick = function () {
            var card = C.byId(b.dataset.remove);
            UI.confirm('Remove ' + card.name + '?', 'It disappears from this list. You can save it again at any time.',
              'Remove card', function () {
                C.unsave(u.id, b.dataset.remove);
                UI.toast('Card removed');
                w.CC.Router.refresh();
              }, true);
          };
        });
      }
    };
  };

  /* ---------------- /dashboard/applications ---------------- */
  w.CC.Pages.applications = function () {
    if (!Auth.require()) return false;
    var u = Auth.current();
    var apps = AP.forUser(u.id);

    var inner = '<div class="section__head"><h1 class="h1">Applications</h1>' +
      '<p class="lede">Every card application you have started, and where the bank has got to.</p></div>' +
      (apps.length ? '<div class="stack">' + apps.map(function (a) {
        var card = C.byId(a.cardId);
        var stage = AP.stageIndex(a.status);
        return '<div class="panel">' +
          '<div class="spread" style="margin-bottom:20px; align-items:flex-start">' +
          '<div class="row" style="gap:14px">' +
          '<div style="width:78px">' + UI.plastic(card, true) + '</div>' +
          '<div><h3 class="h3">' + UI.esc(card ? card.name : 'Card') + '</h3>' +
          '<div class="small muted">Reference ' + a.id + ' &middot; ' + UI.date(a.createdAt) + '</div></div></div>' +
          UI.statusBadge(a.status) + '</div>' +
          '<div class="tl">' + AP.FLOW.map(function (f, i) {
            var cls = a.status === 'rejected' && i === 3 ? 'is-now'
              : i < stage ? 'is-done' : i === stage ? 'is-now' : '';
            var desc = (a.status === 'rejected' && i === 3)
              ? 'The bank did not approve this application.' : f.desc;
            return '<div class="tl__i ' + cls + '"><div class="tl__t">' + f.label + '</div>' +
              '<div class="tl__d">' + UI.esc(desc) + '</div></div>';
          }).join('') + '</div>' +
          (a.notes && a.notes.length ? '<div class="note" style="margin-top:16px"><strong>Note from the bank</strong><br>' +
            UI.esc(a.notes[a.notes.length - 1].text) + '</div>' : '') +
          (a.status === 'documents' ? '<button class="btn btn--primary btn--sm" style="margin-top:16px" data-docs="' + a.id + '">Upload documents</button>' : '') +
          '</div>';
      }).join('') + '</div>'
        : UI.empty('No applications yet',
          'When you apply for a card through Card Crest, you can follow the bank\'s progress here step by step.',
          'Find a card to apply for', '#/cards')) +
      '<p class="small muted" style="margin-top:18px">Demo mode — these applications are simulated. Nothing has been sent to a bank and no credit enquiry has been made.</p>';

    return {
      title: 'Applications | Card Crest',
      html: shell('/dashboard/applications', 'Applications', inner),
      mount: function (root) {
        root.querySelectorAll('[data-docs]').forEach(function (b) {
          b.onclick = function () {
            UI.modal({
              title: 'Upload documents',
              body: '<p class="muted">The bank has asked for an updated address proof.</p>' +
                '<div class="field" style="margin-top:16px"><label for="doc-f">Choose a file</label><input id="doc-f" type="file"></div>' +
                '<p class="small muted" style="margin-top:14px">Demo mode — nothing is uploaded anywhere.</p>',
              foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-up>Submit document</button>',
              onMount: function (m) {
                m.querySelector('[data-up]').onclick = function () {
                  AP.setStatus(b.dataset.docs, 'under-review', 'Address proof received and sent for verification.');
                  UI.closeModal();
                  UI.toast('Document submitted');
                  w.CC.Router.refresh();
                };
              }
            });
          };
        });
      }
    };
  };

  /* ---------------- /dashboard/transactions ---------------- */
  w.CC.Pages.transactions = function () {
    if (!Auth.require()) return false;
    var u = Auth.current();
    var f = { status: 'all', q: '' };

    var inner = '<div class="section__head"><h1 class="h1">Transactions</h1>' +
      '<p class="lede">Every tracked purchase and where its cashback has got to.</p></div>' +
      '<div class="mkt__bar">' +
      '<div class="chip-row chip-row--scroll">' +
      [['all', 'All'], ['tracked', 'Tracked'], ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['cancelled', 'Cancelled'], ['rejected', 'Rejected']]
        .map(function (s) {
          return '<button class="chip' + (s[0] === 'all' ? ' is-on' : '') + '" data-status="' + s[0] + '">' + s[1] + '</button>';
        }).join('') + '</div>' +
      '<input type="search" id="txnSearch" placeholder="Search by store" aria-label="Search transactions" style="width:220px"></div>' +
      '<div class="panel panel--flush" style="margin-top:18px"><div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr><th>Store</th><th>Date</th><th class="num">Order value</th><th class="num">Cashback</th><th>Status</th></tr></thead>' +
      '<tbody id="txnBody"></tbody></table></div></div>' +
      '<div class="note" style="margin-top:18px">Cashback moves from tracked to pending once the merchant matches the order, and to confirmed after their return window closes — usually 30 to 90 days.</div>';

    return {
      title: 'Transactions | Card Crest',
      html: shell('/dashboard/transactions', 'Transactions', inner),
      mount: function (root) {
        var body = root.querySelector('#txnBody');
        function draw() {
          var list = CB.forUser(u.id, f);
          if (!list.length) {
            body.innerHTML = '<tr><td colspan="5" style="padding:40px; text-align:center" class="muted">' +
              'Nothing here yet. Activate an offer and the transaction appears within 48 hours.</td></tr>';
            return;
          }
          body.innerHTML = list.map(function (x) {
            var dsc = CB.describe(x);
            return '<tr><td><div class="row" style="gap:10px">' +
              dsc.logo +
              '<strong>' + UI.esc(dsc.name) + '</strong></div></td>' +
              '<td class="muted">' + UI.date(x.createdAt) + '</td>' +
              '<td class="num">' + (dsc.reward ? '&mdash;' : UI.money(x.amount)) + '</td>' +
              '<td class="num"><strong>' + UI.money(x.cashback) + '</strong></td>' +
              '<td>' + UI.statusBadge(x.status) + '</td></tr>';
          }).join('');
        }
        root.querySelectorAll('[data-status]').forEach(function (b) {
          b.onclick = function () {
            f.status = b.dataset.status;
            root.querySelectorAll('[data-status]').forEach(function (x) { x.classList.remove('is-on'); });
            b.classList.add('is-on'); draw();
          };
        });
        root.querySelector('#txnSearch').addEventListener('input', UI.debounce(function (e) {
          f.q = e.target.value; draw();
        }, 220));
        draw();
      }
    };
  };

  /* ---------------- /rewards ---------------- */
  w.CC.Pages.rewards = function () {
    if (!Auth.require()) return false;
    var u = Auth.current();
    var t = CB.totals(u.id);
    var history = RW.redemptions(u.id);

    var inner = '<div class="section__head"><h1 class="h1">Rewards wallet</h1>' +
      '<p class="lede">Confirmed cashback and referral rewards, ready to take out.</p></div>' +
      '<div class="grid g-4" style="margin-bottom:26px">' +
        '<div class="stat stat--accent"><span class="stat__k">Available</span><span class="stat__v" data-count="' + t.available + '">' + UI.money(t.available) + '</span><span class="stat__sub">Ready to redeem</span></div>' +
        '<div class="stat"><span class="stat__k">Pending</span><span class="stat__v">' + UI.money(t.pending) + '</span><span class="stat__sub">Not yet confirmed</span></div>' +
        '<div class="stat"><span class="stat__k">Lifetime earned</span><span class="stat__v">' + UI.money(t.lifetime) + '</span><span class="stat__sub">Cashback and referrals</span></div>' +
        '<div class="stat"><span class="stat__k">Already redeemed</span><span class="stat__v">' + UI.money(t.redeemed) + '</span><span class="stat__sub">' + history.length + ' redemptions</span></div>' +
      '</div>' +
      '<div class="panel" style="margin-bottom:26px"><div class="spread row--wrap" style="gap:14px">' +
      '<div><h2 class="h3">Take your rewards out</h2>' +
      '<p class="muted small" style="margin-top:4px">Minimum ' + UI.money(RW.MIN) + '. UPI and bank transfers land within two working days; gift cards are instant.</p></div>' +
      '<button class="btn btn--primary" data-redeem' + (t.available < RW.MIN ? ' disabled' : '') + '>Redeem ' + UI.money(t.available) + '</button>' +
      '</div>' + (t.available < RW.MIN ? '<div class="note note--warn" style="margin-top:16px">You need ' + UI.money(RW.MIN - t.available) + ' more in confirmed rewards before you can redeem.</div>' : '') + '</div>' +

      '<h2 class="h2" style="margin-bottom:16px">Redemption history</h2>' +
      '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr><th>Reference</th><th>Date</th><th>Method</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>' +
      (history.length ? history.map(function (r) {
        return '<tr><td class="mono small">' + r.ref + '</td><td class="muted">' + UI.date(r.createdAt) + '</td>' +
          '<td>' + UI.esc(r.method) + '</td><td class="num"><strong>' + UI.money(r.amount) + '</strong></td>' +
          '<td>' + UI.statusBadge(r.status) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" style="padding:40px; text-align:center" class="muted">No redemptions yet.</td></tr>') +
      '</tbody></table></div></div>' +
      '<p class="small muted" style="margin-top:16px">Demo mode — redemptions are recorded and marked processed locally. No real transfer is made to any UPI handle or bank account.</p>';

    return {
      title: 'Rewards wallet | Card Crest',
      desc: 'Your confirmed cashback and referral rewards, and how to redeem them.',
      html: shell('/rewards', 'Rewards', inner),
      mount: function (root) {
        var c = root.querySelector('[data-count]');
        if (c) UI.countUp(c, Number(c.dataset.count), function (n) { return UI.money(n); });

        var btn = root.querySelector('[data-redeem]');
        if (btn) btn.onclick = function () {
          UI.modal({
            title: 'Redeem your rewards',
            body: '<div class="field" style="margin-bottom:16px"><label for="r-amt">Amount</label>' +
              '<input id="r-amt" type="number" min="' + RW.MIN + '" max="' + t.available + '" value="' + t.available + '">' +
              '<span class="hint">Between ' + UI.money(RW.MIN) + ' and ' + UI.money(t.available) + '.</span></div>' +
              '<div class="field" style="margin-bottom:16px"><label for="r-method">Send it to</label>' +
              '<select id="r-method">' + RW.methods.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></div>' +
              '<div class="field"><label for="r-dest" id="r-dest-l">UPI ID</label><input id="r-dest" type="text" placeholder="name@bank"></div>' +
              '<div class="note" style="margin-top:16px">Demo mode — this records a redemption and marks it processed. No money moves.</div>',
            foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-go>Confirm redemption</button>',
            onMount: function (m) {
              var method = m.querySelector('#r-method'), dest = m.querySelector('#r-dest'), lbl = m.querySelector('#r-dest-l');
              method.onchange = function () {
                var v = method.value;
                lbl.textContent = v === 'UPI' ? 'UPI ID' : v === 'Bank transfer' ? 'Account number' : 'Email for the gift card';
                dest.placeholder = v === 'UPI' ? 'name@bank' : v === 'Bank transfer' ? 'Account number' : 'you@example.com';
                dest.value = '';
              };
              m.querySelector('[data-go]').onclick = function () {
                var res = RW.payout(u.id, Number(m.querySelector('#r-amt').value), method.value, dest.value.trim());
                if (!res.ok) return UI.toast(res.error, 'error');
                UI.closeModal();
                UI.modal({
                  title: 'Redemption requested',
                  body: '<div class="note" style="margin-bottom:16px">Demo redemption processed successfully.</div>' +
                    '<div class="spread" style="padding:12px 0"><span class="muted small">Reference</span><code class="mono">' + res.redemption.ref + '</code></div>' +
                    '<div class="spread" style="padding:12px 0; border-top:1px solid var(--line-soft)"><span class="muted small">Amount</span><strong>' + UI.money(res.redemption.amount) + '</strong></div>' +
                    '<div class="spread" style="padding:12px 0; border-top:1px solid var(--line-soft)"><span class="muted small">Method</span><strong>' + UI.esc(res.redemption.method) + '</strong></div>' +
                    '<p class="small muted" style="margin-top:14px">No real transfer has been made. In production this is where a payout API would be called.</p>',
                  foot: '<button class="btn btn--primary" data-x>Done</button>'
                });
                setTimeout(function () { w.CC.Router.refresh(); }, 400);
              };
            }
          });
        };
      }
    };
  };

  /* ---------------- /refer ---------------- */
  w.CC.Pages.refer = function () {
    if (!Auth.require()) return false;
    var u = Auth.current();
    var code = Auth.referralCode(u);
    var link = RF.link(u);
    var s = RF.stats(u.id);
    var list = RF.forUser(u.id);

    var inner = '<div class="section__head"><h1 class="h1">Refer and <em>earn</em></h1>' +
      '<p class="lede">When someone signs up with your code and gets their first card approved through Card Crest, you both get ' + UI.money(RF.REWARD) + '.</p></div>' +
      '<div class="panel" style="margin-bottom:24px">' +
      '<h2 class="h3" style="margin-bottom:12px">Your referral code</h2>' +
      '<div class="copy-box" style="margin-bottom:14px"><code>' + code + '</code>' +
      '<button class="btn btn--sm btn--soft" data-copy="' + code + '">Copy code</button></div>' +
      '<div class="copy-box" style="margin-bottom:18px"><code style="font-size:.82rem">' + link + '</code>' +
      '<button class="btn btn--sm btn--soft" data-copy="' + link + '">Copy link</button></div>' +
      '<div class="row row--wrap">' +
      '<button class="btn btn--primary btn--sm" data-share>Share</button>' +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://wa.me/?text=' +
        encodeURIComponent('I use Card Crest to find credit cards that actually pay back. Sign up with my code ' + code + ' and we both earn a reward: ' + link) + '">WhatsApp</a>' +
      '</div></div>' +
      '<div class="grid g-4" style="margin-bottom:26px">' +
        '<div class="stat"><span class="stat__k">Total referrals</span><span class="stat__v">' + s.total + '</span></div>' +
        '<div class="stat"><span class="stat__k">Successful</span><span class="stat__v">' + s.successful + '</span></div>' +
        '<div class="stat"><span class="stat__k">Pending</span><span class="stat__v">' + s.pending + '</span></div>' +
        '<div class="stat stat--accent"><span class="stat__k">Earned</span><span class="stat__v">' + UI.money(s.earned) + '</span></div>' +
      '</div>' +
      '<h2 class="h2" style="margin-bottom:16px">Referral history</h2>' +
      '<div class="panel panel--flush"><div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr><th>Friend</th><th>Joined</th><th>Status</th><th class="num">Reward</th></tr></thead><tbody>' +
      (list.length ? list.map(function (r) {
        return '<tr><td><strong>' + UI.esc(r.name) + '</strong></td><td class="muted">' + UI.date(r.createdAt) + '</td>' +
          '<td>' + UI.statusBadge(r.status) + '</td><td class="num">' + (r.reward ? UI.money(r.reward) : '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="4" style="padding:40px; text-align:center" class="muted">No referrals yet. Share your code to get started.</td></tr>') +
      '</tbody></table></div></div>' +
      '<p class="small muted" style="margin-top:16px">Rewards stay pending until the bank confirms the approval, and are reversed if an application is cancelled. Demo mode — referral rewards are simulated.</p>';

    return {
      title: 'Refer and earn | Card Crest',
      desc: 'Share your Card Crest code and earn when a friend gets their first card approved.',
      html: shell('/refer', 'Refer', inner),
      mount: function (root) {
        root.querySelectorAll('[data-copy]').forEach(function (b) {
          b.onclick = function () {
            navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy);
            UI.toast(b.dataset.copy.indexOf('http') === 0 ? 'Referral link copied' : 'Referral code copied');
          };
        });
        root.querySelector('[data-share]').onclick = function () {
          var payload = { title: 'Card Crest', text: 'Find a credit card that actually pays back. Use my code ' + code + '.', url: link };
          if (navigator.share) navigator.share(payload).catch(function () {});
          else {
            navigator.clipboard && navigator.clipboard.writeText(link);
            UI.toast('Referral link copied');
          }
        };
      }
    };
  };

  /* ---------------- /dashboard/notifications ---------------- */
  w.CC.Pages.notifications = function () {
    if (!Auth.require()) return false;
    var u = Auth.current();
    var list = NT.forUser(u.id);

    var inner = '<div class="spread section__head"><div><h1 class="h1">Notifications</h1>' +
      '<p class="lede">Cashback, applications, rewards and offers.</p></div>' +
      (list.length ? '<button class="btn btn--ghost btn--sm" data-all>Mark all as read</button>' : '') + '</div>' +
      '<div class="panel">' + (list.length ? list.map(function (n) {
        return '<div class="notif' + (n.read ? ' is-read' : '') + '" data-n="' + n.id + '">' +
          '<span class="notif__dot"></span>' +
          '<div style="flex:1"><div class="notif__t">' + UI.esc(n.title) + '</div>' +
          '<div class="notif__d">' + UI.esc(n.body) + '</div></div>' +
          '<span class="notif__ts">' + UI.ago(n.createdAt) + '</span></div>';
      }).join('') : '<p class="muted" style="text-align:center; padding:30px">Nothing to catch up on.</p>') + '</div>';

    return {
      title: 'Notifications | Card Crest',
      html: shell('/dashboard/notifications', 'Notifications', inner),
      mount: function (root) {
        root.querySelectorAll('[data-n]').forEach(function (el) {
          el.onclick = function () {
            NT.markRead(el.dataset.n);
            el.classList.add('is-read');
            w.CC.App.paintAuth();
          };
        });
        var all = root.querySelector('[data-all]');
        if (all) all.onclick = function () {
          NT.markAllRead(u.id);
          UI.toast('All notifications marked as read');
          w.CC.App.paintAuth();
          w.CC.Router.refresh();
        };
      }
    };
  };

  /* ---------------- /profile ---------------- */
  w.CC.Pages.profile = function () {
    if (!Auth.require()) return false;
    var u = Auth.current();

    var inner = '<div class="section__head"><h1 class="h1">Profile and settings</h1>' +
      '<p class="lede">Keeping your income and credit details current makes our eligibility estimates far more useful.</p></div>' +

      '<div class="panel" style="margin-bottom:20px"><h2 class="h3" style="margin-bottom:18px">Profile photo</h2>' +
      '<div class="photo-row"><div class="photo" id="photoPrev">' + UI.avatarHtml(u) + '</div>' +
      '<div><div class="row" style="gap:10px; flex-wrap:wrap">' +
      '<button class="btn btn--primary btn--sm" type="button" data-photo-pick>' + (u.avatar ? 'Change photo' : 'Upload photo') + '</button>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-photo-remove' + (u.avatar ? '' : ' hidden') + '>Remove</button></div>' +
      '<p class="hint small muted" style="margin-top:10px">JPG, PNG or WebP, up to 8 MB. You can crop and zoom it before saving.</p></div>' +
      '<input type="file" id="photoFile" accept="image/jpeg,image/png,image/webp" hidden></div></div>' +

      '<div class="panel" style="margin-bottom:20px"><h2 class="h3" style="margin-bottom:18px">Personal information</h2>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="p-name">Full name</label><input id="p-name" type="text" value="' + UI.esc(u.name) + '"></div>' +
      '<div class="field"><label for="p-city">City</label><input id="p-city" type="text" value="' + UI.esc(u.city || '') + '"></div>' +
      '<div class="field"><label for="p-email">Email address</label><input id="p-email" type="email" value="' + UI.esc(u.email) + '"></div>' +
      '<div class="field"><label for="p-mobile">Mobile number</label><input id="p-mobile" type="tel" inputmode="numeric" maxlength="10" placeholder="10 digits" autocomplete="tel-national" value="' + UI.esc(u.mobile || '') + '"></div>' +
      '</div><button class="btn btn--primary btn--sm" style="margin-top:18px" data-save-personal>Save changes</button></div>' +

      '<div class="panel" style="margin-bottom:20px"><h2 class="h3" style="margin-bottom:18px">Financial profile</h2>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="p-emp">Employment</label><select id="p-emp">' +
      ['Salaried', 'Self-employed', 'Business owner', 'Student', 'Retired'].map(function (x) {
        return '<option' + (u.employment === x ? ' selected' : '') + '>' + x + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label for="p-inc">Gross annual income</label><input id="p-inc" type="number" step="10000" value="' + (u.income || 0) + '"></div>' +
      '<div class="field"><label for="p-cr">Credit score</label><input id="p-cr" type="number" min="0" max="900" value="' + (u.credit || 0) + '">' +
      '<span class="hint">Leave at 0 if you have no credit history yet.</span></div>' +
      '</div><button class="btn btn--primary btn--sm" style="margin-top:18px" data-save-fin>Save changes</button></div>' +

      '<div class="panel" style="margin-bottom:20px"><h2 class="h3" style="margin-bottom:8px">Referral</h2>' +
      '<p class="muted small" style="margin-bottom:14px">Your permanent code. It never changes.</p>' +
      '<div class="copy-box"><code>' + Auth.referralCode(u) + '</code>' +
      '<a class="btn btn--sm btn--soft" href="#/refer">Open refer and earn</a></div></div>' +

      '<div class="panel" style="margin-bottom:20px"><h2 class="h3" style="margin-bottom:18px">Security</h2>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="p-old">Current password</label><input id="p-old" type="password"></div>' +
      '<div class="field"><label for="p-new">New password</label><input id="p-new" type="password" autocomplete="new-password">' + UI.pwMeterHtml() + '</div>' +
      '</div><button class="btn btn--primary btn--sm" style="margin-top:18px" data-save-pw>Update password</button></div>' +

      '<div class="panel"><h2 class="h3" style="margin-bottom:8px">Demo data</h2>' +
      '<p class="muted small" style="margin-bottom:14px">Everything you do here is stored in your browser. Resetting restores the original demo dataset and signs you out.</p>' +
      '<button class="btn btn--danger btn--sm" data-reset>Reset demo data</button></div>';

    return {
      title: 'Profile | Card Crest',
      html: shell('/profile', 'Profile', inner),
      mount: function (root) {
        /* ---- profile photo ---- */
        var file = root.querySelector('#photoFile'), prev = root.querySelector('#photoPrev');
        var pickBtn = root.querySelector('[data-photo-pick]'), rmBtn = root.querySelector('[data-photo-remove]');
        var OUT = 384; // the saved photo is OUT x OUT px
        function refreshPhoto() {
          var me = Auth.current();
          prev.innerHTML = UI.avatarHtml(me);
          pickBtn.textContent = me.avatar ? 'Change photo' : 'Upload photo';
          rmBtn.hidden = !me.avatar;
          w.CC.App.paintAuth();
        }
        /* Crop dialog: drag to reposition, slider / mouse wheel to zoom, round guide shows the final dp. */
        function openCropper(f) {
          var S = 280, url = URL.createObjectURL(f), img = new Image();
          img.onerror = function () { URL.revokeObjectURL(url); UI.toast('Could not read that image', 'error'); };
          img.onload = function () {
            var nw = img.naturalWidth, nh = img.naturalHeight, base = Math.max(S / nw, S / nh);
            var z = 1, ox = 0, oy = 0;
            UI.modal({
              title: 'Crop your photo',
              body: '<div class="crop"><div class="crop__stage"><img class="crop__img" alt="" draggable="false"><div class="crop__ring"></div></div>' +
                '<label class="crop__zoom"><span aria-hidden="true">−</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><span aria-hidden="true">+</span></label>' +
                '<p class="hint small muted" style="text-align:center">Drag to move the photo. Use the slider or scroll to zoom. The circle is what people will see.</p></div>',
              foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-save>Save photo</button>',
              onMount: function (m) {
                var stageEl = m.querySelector('.crop__stage'), im = m.querySelector('.crop__img'), zoom = m.querySelector('.crop__zoom input');
                im.src = url;
                function paint() {
                  var sc = base * z, mx = Math.max(0, (nw * sc - S) / 2), my = Math.max(0, (nh * sc - S) / 2);
                  ox = Math.max(-mx, Math.min(mx, ox)); oy = Math.max(-my, Math.min(my, oy)); // image must always cover the frame
                  im.style.width = nw * sc + 'px'; im.style.height = nh * sc + 'px';
                  im.style.left = (S / 2 + ox - nw * sc / 2) + 'px'; im.style.top = (S / 2 + oy - nh * sc / 2) + 'px';
                }
                paint();
                zoom.oninput = function () { z = +zoom.value; paint(); };
                var drag = null;
                stageEl.addEventListener('pointerdown', function (e) {
                  drag = { x: e.clientX, y: e.clientY, ox: ox, oy: oy };
                  try { stageEl.setPointerCapture(e.pointerId); } catch (err) {}
                  stageEl.classList.add('is-drag');
                });
                stageEl.addEventListener('pointermove', function (e) {
                  if (!drag) return;
                  ox = drag.ox + (e.clientX - drag.x); oy = drag.oy + (e.clientY - drag.y); paint();
                });
                ['pointerup', 'pointercancel'].forEach(function (ev) {
                  stageEl.addEventListener(ev, function () { drag = null; stageEl.classList.remove('is-drag'); });
                });
                stageEl.addEventListener('wheel', function (e) {
                  e.preventDefault();
                  z = Math.max(1, Math.min(4, z + (e.deltaY < 0 ? 0.08 : -0.08)));
                  zoom.value = z; paint();
                }, { passive: false });
                m.addEventListener('click', function (e) {
                  if (e.target === m || e.target.closest('[data-x]')) URL.revokeObjectURL(url);
                });
                m.querySelector('[data-save]').onclick = function () {
                  var btn = this, sc = base * z, c = d.createElement('canvas');
                  c.width = c.height = OUT;
                  var sx = (nw * sc / 2 - S / 2 - ox) / sc, sy = (nh * sc / 2 - S / 2 - oy) / sc, sw = S / sc;
                  var ctx = c.getContext('2d');
                  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, OUT, OUT);
                  ctx.drawImage(img, sx, sy, sw, sw, 0, 0, OUT, OUT);
                  btn.disabled = true; btn.textContent = 'Saving…';
                  c.toBlob(function (blob) {
                    if (!blob) { btn.disabled = false; btn.textContent = 'Save photo'; return UI.toast('Could not save that crop', 'error'); }
                    Auth.setAvatar(blob).then(function (res) {
                      URL.revokeObjectURL(url);
                      UI.closeModal();
                      refreshPhoto();
                      UI.toast(res.ok ? 'Profile photo updated' : res.error, res.ok ? undefined : 'error');
                    });
                  }, 'image/jpeg', 0.9);
                };
              }
            });
          };
          img.src = url;
        }
        pickBtn.onclick = function () { file.click(); };
        file.onchange = function () {
          var f = file.files[0]; file.value = '';
          if (!f) return;
          if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return UI.toast('Choose a JPG, PNG or WebP image', 'error');
          if (f.size > 8 * 1024 * 1024) return UI.toast('That image is over 8 MB', 'error');
          openCropper(f);
        };
        rmBtn.onclick = function () {
          Auth.removeAvatar().then(function (res) {
            if (!res.ok) return UI.toast(res.error, 'error');
            refreshPhoto(); UI.toast('Profile photo removed');
          });
        };
        /* ---- personal info: 10-digit mobile, and a code sent to the current email before email/mobile can change ---- */
        var mobEl = root.querySelector('#p-mobile');
        mobEl.addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 10); });

        function askCode(onOk) {
          UI.modal({
            title: 'Verify it\u2019s you',
            body: '<p class="muted" id="otpMsg">Sending a verification code to your email\u2026</p>' +
              '<div class="field" style="margin-top:16px"><label for="otp">Verification code</label>' +
              '<input id="otp" type="text" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="8-digit code"></div>' +
              '<p class="small muted" style="margin-top:12px"><button type="button" class="btn btn--link small" data-resend disabled>Resend code</button></p>',
            foot: '<button class="btn btn--ghost" data-x>Cancel</button><button class="btn btn--primary" data-verify>Verify and save</button>',
            onMount: function (m) {
              var msg = m.querySelector('#otpMsg'), otp = m.querySelector('#otp'),
                  resend = m.querySelector('[data-resend]'), go = m.querySelector('[data-verify]'), timer = null;
              otp.addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 8); });
              function cooldown(sec) {
                clearInterval(timer);
                resend.disabled = true;
                timer = setInterval(function () {
                  sec--;
                  if (sec <= 0 || !m.isConnected) { clearInterval(timer); resend.disabled = false; resend.textContent = 'Resend code'; }
                  else resend.textContent = 'Resend code in ' + sec + 's';
                }, 1000);
                resend.textContent = 'Resend code in ' + sec + 's';
              }
              function send() {
                msg.textContent = 'Sending a verification code to your email\u2026';
                Auth.sendCode().then(function (res) {
                  if (!res.ok) { msg.textContent = res.error; resend.disabled = false; resend.textContent = 'Try again'; return; }
                  msg.innerHTML = 'We sent a verification code to <strong>' + UI.esc(res.to) + '</strong>. Enter it below to confirm this change.' +
                    (res.demoCode ? '<br><span class="small">Demo mode \u2014 your code is <strong>' + res.demoCode + '</strong>.</span>' : '');
                  cooldown(45);
                  otp.focus();
                });
              }
              resend.onclick = send;
              go.onclick = function () {
                if (otp.value.length < 6) return UI.toast("Enter the code from your email", 'error');
                go.disabled = true; go.textContent = 'Checking\u2026';
                Auth.checkCode(otp.value).then(function (res) {
                  go.disabled = false; go.textContent = 'Verify and save';
                  if (!res.ok) return UI.toast(res.error, 'error');
                  clearInterval(timer); UI.closeModal(); onOk();
                });
              };
              send();
            }
          });
        }

        root.querySelector('[data-save-personal]').onclick = function () {
          var me = Auth.current();
          var name = root.querySelector('#p-name').value.trim();
          var email = root.querySelector('#p-email').value.trim();
          var mobile = mobEl.value.replace(/\D/g, '');
          var city = root.querySelector('#p-city').value.trim();
          if (!name) return UI.toast('Your name cannot be empty', 'error');
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return UI.toast('That email address does not look right', 'error');
          if (!/^\d{10}$/.test(mobile)) { mobEl.focus(); return UI.toast('Enter a 10-digit mobile number', 'error'); }

          var emailChanged = email.toLowerCase() !== String(me.email).toLowerCase();
          var mobileChanged = mobile !== String(me.mobile || '').replace(/\D/g, '');

          function apply() {
            Auth.updateProfile({ name: name, city: city, mobile: mobile });
            if (!emailChanged) { UI.toast('Profile updated'); w.CC.App.paintAuth(); return; }
            Auth.changeEmail(email).then(function (res) {
              if (!res.ok) UI.toast(res.error, 'error');
              else UI.toast(res.pending ? 'Details saved. Open the link we sent to ' + email + ' to confirm your new email address.' : 'Profile updated');
              w.CC.App.paintAuth();
            });
          }
          if (!emailChanged && !mobileChanged) return apply(); // name / city only: no code needed
          askCode(apply);
        };
        root.querySelector('[data-save-fin]').onclick = function () {
          Auth.updateProfile({
            employment: root.querySelector('#p-emp').value,
            income: Number(root.querySelector('#p-inc').value) || 0,
            credit: Number(root.querySelector('#p-cr').value) || 0
          });
          UI.toast('Financial profile updated');
        };
        UI.pwBind(root.querySelector('#p-new'), root);
        root.querySelector('[data-save-pw]').onclick = function () {
          var oldPw = root.querySelector('#p-old').value, newPw = root.querySelector('#p-new').value;
          if (!UI.pwOk(newPw)) return UI.toast('Password needs: ' + UI.pwIssues(newPw).join(', ').toLowerCase(), 'error');
          Auth.changePassword(oldPw, newPw).then(function (res) {
            if (!res.ok) return UI.toast(res.error, 'error');
            root.querySelector('#p-old').value = ''; root.querySelector('#p-new').value = '';
            UI.toast('Password updated');
          });
        };
        root.querySelector('[data-reset]').onclick = function () {
          UI.confirm('Reset the demo data?',
            'Your saved cards, transactions, rewards and applications go back to the original demo set. This cannot be undone.',
            'Reset everything', function () {
              w.CC.Store.reset();
              UI.toast('Demo data reset');
              w.CC.App.paintAuth();
              w.CC.Router.go('#/');
            }, true);
        };
      }
    };
  };
})(window, document);
