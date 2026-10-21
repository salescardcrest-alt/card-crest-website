/* ============================================================
   Card Crest — pages/home.js
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, C = w.CC.Cards, O = w.CC.Offers, DATA = w.CC.DATA;
  w.CC.Pages = w.CC.Pages || {};

  var INTENTS = [
    ['cashback', 'Cashback', 'Money straight back on what you spend'],
    ['travel', 'Travel', 'Lounges, low forex, airline points'],
    ['rewards', 'Rewards', 'Points that convert to real value'],
    ['fuel', 'Fuel', 'Surcharge waivers and pump cashback'],
    ['shopping', 'Shopping', 'Accelerated rates at big retailers'],
    ['dining', 'Dining', 'Restaurants and food delivery'],
    ['premium', 'Premium', 'Concierge, golf, unlimited lounge'],
    ['lifetime-free', 'Lifetime free', 'No annual fee, ever']
  ];

  w.CC.Pages.home = function () {
    /* Amex Platinum Travel is listed under See all cards, not on the home page */
    var top = C.topByScore(8).filter(function (c) { return c.id !== 'amex-plat-travel'; }).slice(0, 3);
    var popular = C.popular(3);
    var offers = O.query({ section: 'top' }).slice(0, 6);
    var bestCard = top[0];
    var bestScore = C.score(bestCard);
    var ringCards = C.topByScore(9);

    var html =
      /* ---- hero ---- */
      '<section class="hero"><div class="wrap hero__in">' +
        '<div>' +
          '<span class="hero__tag"><span class="dot"></span>' + C.all().length + ' cards scored on what they return</span>' +
          '<h1 class="h-display">Get more value from <em>every card</em></h1>' +
          '<p class="lede">Most people carry the wrong card for the way they actually spend. Card Crest scores every card on what it gives back against what it costs, then stacks cashback on top.</p>' +
          '<div class="hero__cta">' +
            '<a class="btn btn--primary btn--lg" href="#/eligibility">Find my card</a>' +
            '<a class="btn btn--ghost btn--lg" href="#/cards">Browse all cards</a>' +
          '</div>' +
          '<div class="hero__proof">' +
            '<div><strong data-count="' + C.all().length + '">' + C.all().length + '</strong><span>Cards scored</span></div>' +
            '<div><strong data-count="' + O.stores().length + '">' + O.stores().length + '</strong><span>Cashback stores</span></div>' +
            '<div><strong data-count="' + O.all().length + '">' + O.all().length + '</strong><span>Live offers</span></div>' +
            '<div><strong data-count="' + Math.round(bestScore.value.net) + '" data-money="1">' + UI.money(bestScore.value.net) + '</strong><span>Top card\'s net annual value</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="stage" id="heroStage" style="--step:' + (360 / ringCards.length) + 'deg">' +
          '<div class="stage__floor" aria-hidden="true"><i></i><i></i><i></i></div>' +
          '<div class="ring">' + ringCards.map(function (c, i) {
            var b = C.bank(c.bank);
            return '<div class="rc" style="--i:' + i + '" data-id="' + c.id + '" data-name="' + UI.esc(c.name) + '" data-bank="' +
              UI.esc(b ? b.name : '') + '" data-score="' + Math.round(C.score(c).total) + '">' + UI.plastic(c) + '</div>';
          }).join('') + '</div>' +
          '<div class="stage__info" aria-live="polite">' +
            '<div class="stage__bank"></div><div class="stage__name"></div>' +
            '<div class="stage__meta"><span class="stage__score"><b></b>/100 value score</span>' +
            '<a class="stage__go" href="#/cards">View card →</a></div>' +
          '</div>' +
          '<div class="stage__hint" aria-hidden="true">Drag to spin</div>' +
        '</div>' +
      '</div></section>' +

      /* ---- intent ---- */
      '<section class="section section--mist"><div class="wrap">' +
        '<div class="section__head"><div class="eyebrow">Start here</div>' +
        '<h2 class="h1">What do you want the card to <em>be good at</em>?</h2></div>' +
        '<div class="intent">' + INTENTS.map(function (i) {
          return '<a class="reveal" href="#/cards?type=' + i[0] + '"><b>' + i[1] + '</b><span>' + i[2] + '</span></a>';
        }).join('') + '</div>' +
      '</div></section>' +

      /* ---- highest value ---- */
      '<section class="section"><div class="wrap">' +
        '<div class="spread section__head"><div><div class="eyebrow">Card value score</div>' +
        '<h2 class="h1">The cards that <em>return the most</em></h2>' +
        '<p class="lede">Scored out of 100 on net return, fee efficiency, benefits, welcome value and how easily the points convert to rupees.</p></div>' +
        '<a class="btn btn--ghost" href="#/cards">See all cards</a></div>' +
        '<div class="mkt__grid" id="homeTop">' + top.map(function (c) { return w.CC.Render.cardTile(c); }).join('') + '</div>' +
      '</div></section>' +

      /* ---- popular ---- */
      '<section class="section section--mist"><div class="wrap">' +
        '<div class="spread section__head"><div><div class="eyebrow">Most looked at</div>' +
        '<h2 class="h1">Popular right now</h2></div>' +
        '<a class="btn btn--ghost" href="#/compare">Compare cards</a></div>' +
        '<div class="mkt__grid" id="homePop">' + popular.map(function (c) { return w.CC.Render.cardTile(c); }).join('') + '</div>' +
      '</div></section>' +

      /* ---- offers ---- */
      '<section class="section"><div class="wrap">' +
        '<div class="spread section__head"><div><div class="eyebrow">Cashback marketplace</div>' +
        '<h2 class="h1">Cashback <em>on top of</em> your card rewards</h2>' +
        '<p class="lede">Start your session from Card Crest and we track the purchase. What your card earns, you keep as well.</p></div>' +
        '<a class="btn btn--ghost" href="#/offers">All offers</a></div>' +
        '<div class="grid g-3" id="homeOffers">' + offers.map(w.CC.Render.offerTile).join('') + '</div>' +
        '<div class="grid g-4" style="margin-top:24px">' +
          O.stores().filter(function (s) { return s.popular; }).slice(0, 4).map(w.CC.Render.storeTile).join('') + '</div>' +
      '</div></section>' +

      /* ---- calculator teaser ---- */
      '<section class="section section--mist"><div class="wrap">' +
        '<div class="grid g-2" style="gap:44px; align-items:center">' +
          '<div><div class="eyebrow">Card value calculator</div>' +
          '<h2 class="h1">Is the annual fee <em>actually worth it</em>?</h2>' +
          '<p class="lede" style="margin:16px 0 24px">Put in what you really spend each month. We work out the rewards, discount the points you cannot easily spend, add the benefits, subtract the fee, and show you what is left over.</p>' +
          '<a class="btn btn--primary" href="#/calculator">Open the calculator</a></div>' +
          '<div class="panel">' +
            '<div class="spread" style="margin-bottom:18px"><div><div class="ctile__bank">' + UI.esc(C.bank(bestCard.bank).name) + '</div>' +
            '<h3 class="h3" style="font-size:1.15rem">' + UI.esc(bestCard.name) + '</h3></div>' +
            UI.gauge(bestScore.total, false) + '</div>' +
            '<div class="calc__line" style="border-color:var(--line-soft)"><span class="muted small">Rewards at ₹40,000 a month</span><strong>' + UI.money(bestScore.value.rewards) + '</strong></div>' +
            '<div class="calc__line" style="border-color:var(--line-soft)"><span class="muted small">Benefits and perks</span><strong>' + UI.money(bestScore.value.perks) + '</strong></div>' +
            '<div class="calc__line" style="border-color:var(--line-soft)"><span class="muted small">Annual fee</span><strong>' + (bestCard.annualFee ? '−' + UI.money(bestCard.annualFee) : 'None') + '</strong></div>' +
            '<div class="calc__line"><span class="muted small">Net annual value</span><strong style="color:var(--crest); font-size:1.15rem">' + UI.money(bestScore.value.net) + '</strong></div>' +
            '<p class="small muted" style="margin-top:14px">Estimated, not guaranteed. Caps and exclusions move real numbers around.</p>' +
          '</div>' +
        '</div>' +
      '</div></section>' +

      /* ---- how it works ---- */
      '<section class="section"><div class="wrap">' +
        '<div class="section__head"><div class="eyebrow">How Card Crest works</div>' +
        '<h2 class="h1">Find it, use it, <em>get paid back</em></h2></div>' +
        '<div class="flow">' +
          '<div class="flow__i reveal"><h3 class="h3">Tell us how you spend</h3><p>Six short questions. No credit enquiry, no impact on your score.</p></div>' +
          '<div class="flow__i reveal"><h3 class="h3">Compare on real value</h3><p>Every card scored on what it returns after the fee, not on marketing copy.</p></div>' +
          '<div class="flow__i reveal"><h3 class="h3">Shop through Card Crest</h3><p>Activate an offer, buy as usual, and we track the order back to you.</p></div>' +
          '<div class="flow__i reveal"><h3 class="h3">Take the money out</h3><p>Confirmed cashback goes to UPI, your bank or a gift card.</p></div>' +
        '</div>' +
      '</div></section>' +

      /* ---- refer ---- */
      '<section class="section section--tight"><div class="wrap">' +
        '<div class="panel" style="background:linear-gradient(135deg,var(--crest),var(--crest-d)); border:0; color:#fff; padding:44px">' +
        '<div class="spread row--wrap" style="gap:24px">' +
        '<div style="max-width:52ch"><h2 class="h1" style="color:#fff; margin-bottom:12px">Refer a friend, <em style="color:#8fd3b4">both earn ₹100</em></h2>' +
        '<p style="color:rgba(255,255,255,.78)">When someone signs up with your code and gets their first card approved through Card Crest, the reward lands for both of you.</p></div>' +
        '<a class="btn btn--soft btn--lg" href="#/refer">Get my referral code</a></div></div>' +
      '</div></section>' +

      /* ---- trust ---- */
      '<section class="section section--mist"><div class="wrap">' +
        '<div class="section__head"><div class="eyebrow">Where we stand</div>' +
        '<h2 class="h1">What Card Crest is, and <em>what it is not</em></h2></div>' +
        '<div class="grid g-3">' +
          '<div class="panel reveal"><h3 class="h3" style="margin-bottom:8px">We are not a bank</h3>' +
          '<p class="muted small">Every card is issued by the bank named on it. Approval, credit limit and pricing are entirely the bank\'s decision. We do not lend and we never see your money.</p></div>' +
          '<div class="panel reveal"><h3 class="h3" style="margin-bottom:8px">Nothing here is guaranteed</h3>' +
          '<p class="muted small">Card Value Scores, reward estimates and eligibility results are our own modelling. They are labelled as estimates because that is what they are.</p></div>' +
          '<div class="panel reveal"><h3 class="h3" style="margin-bottom:8px">How we get paid</h3>' +
          '<p class="muted small">Banks and merchants pay us a commission. We pass part of it back to you as cashback and rewards. It costs you nothing, and it does not change how we rank cards.</p></div>' +
        '</div>' +
      '</div></section>' +

      /* ---- FAQs ---- */
      '<section class="section"><div class="wrap" style="max-width:800px">' +
        '<div class="section__head"><div class="eyebrow">Questions</div>' +
        '<h2 class="h1">Before you start</h2></div>' +
        DATA.faqs.slice(0, 6).map(function (f) {
          return '<div class="accordion"><button class="accordion__q">' + f[0] + '</button>' +
            '<div class="accordion__a">' + UI.esc(f[1]) + '</div></div>';
        }).join('') +
        '<div style="text-align:center; margin-top:26px"><a class="btn btn--ghost" href="#/help">Visit the help centre</a></div>' +
      '</div></section>' +

      /* ---- final CTA ---- */
      '<section class="section section--tight"><div class="wrap" style="text-align:center; max-width:640px">' +
        '<h2 class="h1">Find out what your <em>next card</em> is worth</h2>' +
        '<p class="lede" style="margin:14px auto 26px">Six questions, an estimated eligibility for every card, and a ranked shortlist built around how you actually spend.</p>' +
        '<div class="row" style="justify-content:center; flex-wrap:wrap">' +
        '<a class="btn btn--primary btn--lg" href="#/eligibility">Check my eligibility</a>' +
        '<a class="btn btn--ghost btn--lg" href="#/calculator">Try the calculator</a></div>' +
      '</div></section>';

    return {
      title: 'Card Crest | Get more value from every card',
      desc: 'Discover, compare and maximise the value of your credit cards. Card Value Scores, cashback offers and a rewards wallet.',
      html: html,
      mount: function (root) {
        w.CC.Hero.mount(root);
        w.CC.Render.bindCompare(root);
        w.CC.Render.bindOfferActions(root);
      }
    };
  };
})(window, document);
