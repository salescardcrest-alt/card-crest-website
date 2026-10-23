/* ============================================================
   Card Crest — pages/applyEarn.js
   Apply & Earn: partner credit cards. The applicant applies on the
   bank's own site with Card Crest's partner code attached, and earns
   a rupee reward in their wallet once the bank approves.
   Route: #/apply-earn
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, Auth = w.CC.Auth, C = w.CC.Cards;
  w.CC.Pages = w.CC.Pages || {};

  w.CC.Pages.applyEarn = function (params, query) {
    var cards = C.partners().sort(function (a, b) { return b.reward - a.reward; });
    var bankIds = cards.map(function (c) { return c.bank; }).filter(function (b, i, a) { return a.indexOf(b) === i; });
    var top = cards[0], total = cards.reduce(function (a, c) { return a + c.reward; }, 0);

    var html = '<div class="wrap section--tight">' +
      '<div class="section__head"><span class="eyebrow">Apply &amp; Earn</span>' +
      '<h1 class="h1">Get a credit card. <em>Get paid for it.</em></h1>' +
      '<p class="lede">Apply for any card below through Card Crest. When the bank approves it, a cash reward lands in your Card Crest wallet. You can redeem it from ' + UI.money(w.CC.Rewards.MIN) + '.</p></div>' +

      '<div class="flow" style="margin-bottom:30px">' +
      [['Pick a card', 'Each card shows the reward you earn if it is approved.'],
       ['Apply on the bank’s site', 'Card Crest sends you to the bank with our partner code attached.'],
       ['The bank approves', 'Approval, limit and pricing are decided by the bank.'],
       ['Your reward is added', 'It shows in Rewards and Transactions the moment we confirm the approval.']
      ].map(function (s) { return '<div class="flow__i"><h3 class="h3">' + s[0] + '</h3><p>' + s[1] + '</p></div>'; }).join('') + '</div>' +

      '<div class="stack" style="gap:12px; margin-bottom:20px"><input type="search" id="aeSearch" placeholder="Search by card or bank" aria-label="Search cards" style="max-width:460px">' +
      '<div class="chip-row" id="aeChips"><button class="chip is-on" data-b="all">All banks</button>' + bankIds.map(function (b) {
        var bank = C.bank(b); return '<button class="chip" data-b="' + b + '">' + UI.esc(bank ? bank.short : b) + '</button>';
      }).join('') + '</div></div>' +

      '<div class="ae-grid" id="aeGrid">' + cards.map(function (c) {
        var bank = C.bank(c.bank);
        return '<div class="panel ae-tile" data-b="' + c.bank + '" data-q="' + UI.esc((c.name + ' ' + (bank ? bank.name : '')).toLowerCase()) + '">' +
          '<div class="row" style="gap:12px">' + UI.bankLogo(bank, 'bank-logo--md') + '<div><strong>' + UI.esc(c.name) + '</strong><div class="small muted">' + UI.esc(bank ? bank.name : '') + '</div></div></div>' +
          '<div class="ae-tile__r"><span class="small muted">You earn when approved</span><b>' + UI.money(c.reward) + '</b></div>' +
          '<button class="btn btn--primary btn--block" data-card="' + c.id + '">Apply &amp; Earn ' + UI.money(c.reward) + '</button></div>';
      }).join('') + '</div>' +
      '<div id="aeNone" class="empty" hidden style="margin-top:20px"><div class="empty__t">No card matches</div><p class="empty__d">Try another bank or clear the search.</p></div>' +

      '<div class="note" style="margin-top:26px"><strong>Good to know.</strong> Rewards are paid once per approved application and only when the bank confirms the approval. ' +
      'Card Crest is not a lender: fees, benefits, limit and eligibility are set by each bank, so check them on the bank’s page before you apply. ' +
      'Up to ' + UI.money(top.reward) + ' on the ' + UI.esc(top.name) + ', and ' + UI.money(total) + ' across all ' + cards.length + ' cards.</div></div>';

    return {
      title: 'Apply & Earn | Card Crest', desc: 'Apply for a credit card through Card Crest and earn a cash reward in your wallet when the bank approves it.', html: html,
      mount: function (root) {
        var q = '', b = 'all';
        function filter() {
          var shown = 0;
          root.querySelectorAll('.ae-tile').forEach(function (t) {
            var ok = (b === 'all' || t.dataset.b === b) && (!q || t.dataset.q.indexOf(q) > -1);
            t.hidden = !ok; if (ok) shown++;
          });
          root.querySelector('#aeNone').hidden = shown > 0;
        }
        root.querySelector('#aeSearch').addEventListener('input', UI.debounce(function () { q = this.value.trim().toLowerCase(); filter(); }, 120));
        root.querySelectorAll('#aeChips .chip').forEach(function (chip) {
          chip.onclick = function () {
            b = chip.dataset.b;
            root.querySelectorAll('#aeChips .chip').forEach(function (c) { c.classList.toggle('is-on', c === chip); });
            filter();
          };
        });
        root.querySelectorAll('[data-card]').forEach(function (btn) {
          btn.onclick = function () { w.CC.Render.applyForCard(C.byId(btn.dataset.card)); };
        });
      }
    };
  };
})(window, document);
