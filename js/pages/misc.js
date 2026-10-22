/* ============================================================
   Card Crest — pages/misc.js
   Help centre, how it works, legal pages, 404.
   ============================================================ */
(function (w, d) {
  'use strict';
  var UI = w.CC.UI, Auth = w.CC.Auth, SP = w.CC.Support, DATA = w.CC.DATA;
  w.CC.Pages = w.CC.Pages || {};

  /* ---------------- /help ---------------- */
  w.CC.Pages.help = function () {
    var TOPICS = [
      ['Cashback', 'Tracking, timelines and missing cashback', '#/help'],
      ['Credit cards', 'Applications, eligibility and documents', '#/cards'],
      ['Rewards', 'Balances, redemption and payouts', '#/rewards'],
      ['Referrals', 'Codes, sharing and when rewards land', '#/refer'],
      ['Your account', 'Login, password and profile details', '#/profile'],
      ['The Card Value Score', 'What it measures and what it does not', '#/calculator']
    ];
    var u = Auth.current();

    return {
      title: 'Help and support | Card Crest',
      desc: 'Answers about cashback tracking, rewards, applications and your Card Crest account.',
      html: '<div class="wrap section--tight" style="max-width:900px">' +
        '<div class="section__head"><h1 class="h1">How can we <em>help</em>?</h1>' +
        '<p class="lede">Most questions are answered below. If yours is not, send us a ticket and we will come back within one working day.</p></div>' +

        '<input type="search" id="faqSearch" placeholder="Search help articles" aria-label="Search help" style="margin-bottom:26px">' +

        '<div class="grid g-3" style="margin-bottom:38px">' + TOPICS.map(function (t) {
          return '<a class="panel reveal" href="' + t[2] + '"><h3 class="h3" style="margin-bottom:6px">' + t[0] + '</h3>' +
            '<p class="muted small">' + t[1] + '</p></a>';
        }).join('') + '</div>' +

        '<h2 class="h2" style="margin-bottom:14px">Frequently asked</h2>' +
        '<div id="faqList" style="margin-bottom:40px">' + DATA.faqs.map(function (f) {
          return '<div class="accordion" data-faq="' + UI.esc((f[0] + ' ' + f[1]).toLowerCase()) + '">' +
            '<button class="accordion__q">' + f[0] + '</button>' +
            '<div class="accordion__a">' + UI.esc(f[1]) + '</div></div>';
        }).join('') + '</div>' +

        '<div class="panel" id="contact"><h2 class="h2" style="margin-bottom:8px">Raise a ticket</h2>' +
        '<p class="muted small" style="margin-bottom:22px">Tell us what happened and we will pick it up. If it is about a specific transaction, include the reference from your transactions page.</p>' +
        '<form id="ticketForm" novalidate><div class="form-grid" style="margin-bottom:16px">' +
        '<div class="field"><label for="t-name">Your name</label><input id="t-name" data-name type="text" value="' + UI.esc(u ? u.name : '') + '"><span class="err">Tell us who you are.</span></div>' +
        '<div class="field"><label for="t-email">Email address</label><input id="t-email" type="email" value="' + UI.esc(u ? u.email : '') + '"><span class="err">We need somewhere to reply.</span></div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:16px"><label for="t-cat">What is it about?</label><select id="t-cat">' +
        SP.categories.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>' +
        '<div class="field" style="margin-bottom:16px"><label for="t-msg">What happened?</label>' +
        '<textarea id="t-msg" placeholder="The more specific you are, the faster we can sort it out."></textarea><span class="err">Describe the problem so we can help.</span></div>' +
        '<div class="field" style="margin-bottom:20px"><label for="t-file">Attachment (optional)</label><input id="t-file" type="file">' +
        '<span class="hint">A screenshot of the order confirmation usually settles a cashback query fastest.</span></div>' +
        '<button class="btn btn--primary" type="submit">Send ticket</button></form></div>' +
        '</div>',
      mount: function (root) {
        root.querySelector('#faqSearch').addEventListener('input', UI.debounce(function (e) {
          var q = e.target.value.toLowerCase();
          var any = false;
          root.querySelectorAll('[data-faq]').forEach(function (el) {
            var hit = el.dataset.faq.indexOf(q) > -1;
            el.style.display = hit ? '' : 'none';
            if (hit) any = true;
          });
          var list = root.querySelector('#faqList');
          var none = list.querySelector('.js-none');
          if (!any && !none) {
            var p = d.createElement('p');
            p.className = 'muted js-none';
            p.style.padding = '20px 0';
            p.textContent = 'Nothing matches that. Try a different word, or raise a ticket below.';
            list.appendChild(p);
          } else if (any && none) none.remove();
        }, 200));

        root.querySelector('#ticketForm').addEventListener('submit', function (e) {
          e.preventDefault();
          var name = root.querySelector('#t-name'), email = root.querySelector('#t-email'), msg = root.querySelector('#t-msg');
          var checks = [
            [name, name.value.trim().length > 1],
            [email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())],
            [msg, msg.value.trim().length > 9]
          ];
          var bad = false;
          checks.forEach(function (c) {
            c[0].closest('.field').classList.toggle('is-bad', !c[1]);
            if (!c[1]) bad = true;
          });
          if (bad) return;
          var t = SP.create({
            userId: u ? u.id : null, name: UI.titleCase(name.value).trim(), email: email.value.trim(),
            category: root.querySelector('#t-cat').value, message: msg.value.trim()
          });
          UI.modal({
            title: 'Ticket received',
            body: '<p class="muted">We have logged your ticket and will reply to ' + UI.esc(email.value.trim()) + ' within one working day.</p>' +
              '<div class="copy-box" style="margin-top:18px"><code>' + t.id + '</code>' +
              '<button class="btn btn--sm btn--soft" data-c="' + t.id + '">Copy reference</button></div>' +
              '<p class="small muted" style="margin-top:14px">Demo mode — no email is actually sent.</p>',
            foot: '<button class="btn btn--primary" data-x>Done</button>',
            onMount: function (m) {
              m.querySelector('[data-c]').onclick = function () {
                navigator.clipboard && navigator.clipboard.writeText(t.id);
                UI.toast('Reference copied');
              };
            }
          });
          root.querySelector('#ticketForm').reset();
        });
      }
    };
  };

  /* ---------------- /how-it-works ---------------- */
  w.CC.Pages.howItWorks = function () {
    return {
      title: 'How Card Crest works | Card Crest',
      desc: 'How card discovery, the Card Value Score, cashback tracking and rewards redemption work on Card Crest.',
      html: '<div class="wrap section--tight">' +
        '<div class="section__head"><h1 class="h1">How Card Crest <em>works</em></h1>' +
        '<p class="lede">Two things happen here. We help you pick a card that suits how you spend, and we pay you back a share of what merchants pay us when you shop.</p></div>' +

        '<h2 class="h2" style="margin-bottom:16px">Finding the right card</h2>' +
        '<div class="flow" style="margin-bottom:40px">' +
          '<div class="flow__i"><h3 class="h3">Tell us how you spend</h3><p>Income, employment and rough monthly spend by category.</p></div>' +
          '<div class="flow__i"><h3 class="h3">We estimate eligibility</h3><p>An estimate from what you entered. No credit bureau enquiry is made.</p></div>' +
          '<div class="flow__i"><h3 class="h3">We score the value</h3><p>What each card returns on your pattern, after the annual fee.</p></div>' +
          '<div class="flow__i"><h3 class="h3">You compare and decide</h3><p>Up to four cards side by side on every line that matters.</p></div>' +
        '</div>' +

        '<div class="hiw-grid"><div><h2 class="h2" style="margin-bottom:16px">How cashback reaches you</h2>' +
        '<div class="panel" style="margin-bottom:40px"><div class="tl">' +
          [['You activate an offer', 'We open a tracked session with the retailer.'],
           ['You buy as normal', 'Complete the purchase in that same session. Ad-blockers and coupon extensions break tracking.'],
           ['The order is tracked', 'It appears in your transactions within 48 hours, marked tracked.'],
           ['Cashback goes pending', 'The merchant matches the order and confirms the amount.'],
           ['Cashback is confirmed', 'After the return window closes — usually 30 to 90 days — it lands in your rewards balance.'],
           ['You redeem', 'UPI, bank transfer or a gift card, from ₹250 upwards.']
          ].map(function (s, i) {
            return '<div class="tl__i' + (i < 3 ? ' is-done' : i === 3 ? ' is-now' : '') + '">' +
              '<div class="tl__t">' + s[0] + '</div><div class="tl__d">' + UI.esc(s[1]) + '</div></div>';
          }).join('') + '</div></div></div>' +

        '<div><h2 class="h2" style="margin-bottom:16px">What the Card Value Score measures</h2>' +
        '<div class="panel" style="margin-bottom:40px">' +
          '<p class="muted" style="margin-bottom:20px">A single number out of 100, built from six weighted parts. It is an estimate of value, not a prediction of what you will earn.</p>' +
          [['Net return on spend', 40, 'Rewards and benefits earned, minus the annual fee, as a percentage of what you spend.'],
           ['Fee efficiency', 15, 'How much value the card returns for each rupee of annual fee.'],
           ['Breadth of benefits', 20, 'How many of lounge, fuel, travel, dining, shopping, insurance and milestones the card actually offers.'],
           ['Welcome value', 10, 'What the welcome benefit is worth against the joining fee.'],
           ['Redemption quality', 10, 'Whether points convert cleanly to rupees or are locked into a voucher catalogue.'],
           ['How reachable it is', 5, 'Cards with lower income requirements score slightly higher, because a card you cannot get is worth nothing.']
          ].map(function (p) {
            return '<div style="margin-bottom:18px"><div class="spread" style="margin-bottom:6px">' +
              '<strong>' + p[0] + '</strong><span class="mono small muted">' + p[1] + ' points</span></div>' +
              '<div class="progress" style="margin-bottom:8px"><div class="progress__b" style="width:' + (p[1] / 40 * 100) + '%"></div></div>' +
              '<p class="muted small">' + UI.esc(p[2]) + '</p></div>';
          }).join('') +
          '<div class="note">Scores are calculated against a reference profile of ₹40,000 a month. Change the profile in the <a href="#/calculator">calculator</a> and every number moves with it.</div>' +
        '</div></div></div>' +

        '<h2 class="h2" style="margin-bottom:16px">How we make money</h2>' +
        '<p class="muted" style="margin-bottom:32px">Banks pay us a commission when an application we referred is approved. Merchants pay us a commission on tracked orders. We keep part of it and pass the rest back to you as rewards. Card Crest is free to use, and the commission does not change how cards are ranked — the score is calculated from published fees and benefits, not from what a bank pays.</p>' +

        '<div style="text-align:center"><a class="btn btn--primary btn--lg" href="#/eligibility">Find my card</a></div>' +
        '</div>'
    };
  };

  /* ---------------- /legal/:doc ---------------- */
  var LEGAL = {
    privacy: ['Privacy policy', [
      ['What we collect', 'The details you enter yourself — name, email, mobile number, city, employment type, income band and credit score range — plus a record of the cards you save, offers you activate and transactions we track for you.'],
      ['Why we collect it', 'To estimate your eligibility, rank cards against the way you spend, track cashback back to your account and pay out rewards. We do not sell personal data.'],
      ['Who we share it with', 'When you apply for a card, the details you have entered go to the issuing bank so they can process the application. Merchants receive an anonymous tracking identifier, never your name or contact details.'],
      ['Credit information', 'Card Crest does not pull your credit report. Eligibility results are estimates calculated from what you tell us. A bank makes a hard enquiry only when you submit a real application to them.'],
      ['How we protect it', 'Connections use HTTPS. Sign-in and passwords are handled by a secure authentication service, and database rules let each person read only their own records. We never ask for or store card numbers, CVV, PINs or OTPs, and we do not sell personal data.'],
      ['Your choices', 'You can edit or delete your profile details at any time from your settings. In this demo build all data sits in your own browser and never leaves your device.']
    ]],
    terms: ['Terms of use', [
      ['What Card Crest is', 'A discovery, comparison and rewards platform. Card Crest is not a bank, a lender, a broker or a financial adviser, and does not issue any credit card or hold your money.'],
      ['Eligibility results', 'All eligibility results are estimates derived from information you provide. They are not offers of credit and do not bind any bank. Approval, credit limit, interest rate and fees are decided solely by the issuing bank.'],
      ['Cashback', 'Cashback is earned only on purchases we successfully track, and only when the merchant confirms them. Returns, cancellations, part refunds, use of other coupon sites and blocked tracking can all reduce or remove it.'],
      ['Rewards and redemption', 'Confirmed rewards can be redeemed above the stated minimum. We may reverse rewards credited in error or arising from fraudulent or abusive activity.'],
      ['Your account', 'Keep your login details to yourself. You are responsible for activity on your account. We may suspend an account we reasonably believe is being used fraudulently.']
    ]],
    disclaimer: ['Disclaimer', [
      ['Your data is safe with us', 'We protect your information with encrypted connections (HTTPS), password protection handled by a secure sign-in service, and database rules that let each person see only their own records. Card Crest never asks for, or stores, your card number, CVV, PIN or OTP, and we do not sell your personal data. We work hard to keep your data safe, but no website or online service can promise absolute security, so please keep your password private and never share card or contact details with anyone, including in chat.'],
      ['Estimates, not guarantees', 'Card Value Scores, reward projections, eligibility percentages and net value figures are produced by our own model. They are estimates. Nothing on Card Crest is a guarantee of approval, of cashback, of a credit limit or of any financial outcome.'],
      ['Card details change', 'Banks revise fees, reward rates and benefits regularly, sometimes at short notice. Always confirm the current terms on the bank\'s own website before applying.'],
      ['Not financial advice', 'Card Crest provides information and comparison tools. It does not provide financial, tax or legal advice, and does not take your full circumstances into account. Consider getting independent advice before taking on credit.'],
      ['Borrowing responsibly', 'A credit card is borrowing. Interest on revolved balances in India commonly runs from 36% to 48% a year. Rewards never outweigh interest charges. Pay the full statement balance every month.'],
      ['Demo build', 'This deployment runs in demo mode. Cashback tracking, applications, redemptions and payouts are simulated locally in your browser. No real bank, merchant or payment network is involved.']
    ]],
    cookies: ['Cookie policy', [
      ['What we store', 'This build stores everything in your browser\'s local storage rather than in cookies: your session, saved cards, comparison selection, transactions and rewards.'],
      ['Why', 'So that refreshing the page does not lose your place, and so the demo behaves like a real signed-in product.'],
      ['Tracking', 'A production cashback platform uses affiliate tracking cookies set by the merchant network when you activate an offer. This demo does not set any such cookies, because no merchant network is connected.'],
      ['Clearing it', 'Clear your browser storage for this site, or use the reset control in profile settings, and everything returns to the original demo state.']
    ]]
  };

  w.CC.Pages.legal = function (params) {
    var doc = LEGAL[params.doc];
    if (!doc) return w.CC.Pages.notFound();
    return {
      title: doc[0] + ' | Card Crest',
      desc: 'Card Crest ' + doc[0].toLowerCase() + ' — how we handle your information, what our estimates mean, and the limits of what this platform does.',
      html: '<div class="wrap section--tight"><div class="prose">' +
        '<h1 class="h1">' + doc[0] + '</h1>' +
        '<p class="muted small" style="margin:10px 0 30px">Last updated ' + UI.date(new Date().toISOString()) + '</p>' +
        doc[1].map(function (s) {
          return '<h2>' + s[0] + '</h2><p>' + UI.esc(s[1]) + '</p>';
        }).join('') +
        '<div class="note" style="margin-top:30px">Questions about any of this? Write to admin@cardcrest.in or <a href="#/help">raise a ticket</a>.</div>' +
        '</div></div>'
    };
  };

  /* ---------------- 404 ---------------- */
  w.CC.Pages.notFound = function () {
    return {
      title: 'Page not found | Card Crest',
      html: '<div class="wrap section" style="text-align:center; max-width:560px">' +
        '<div class="h-display" style="color:var(--crest)">404</div>' +
        '<h1 class="h1" style="margin:10px 0 14px">That page does not exist</h1>' +
        '<p class="lede" style="margin:0 auto 26px">The link may be out of date, or the card or offer may have been withdrawn. Everything else is still where you left it.</p>' +
        '<div class="row" style="justify-content:center; flex-wrap:wrap">' +
        '<a class="btn btn--primary" href="#/">Back to home</a>' +
        '<a class="btn btn--ghost" href="#/cards">Browse cards</a>' +
        '<a class="btn btn--ghost" href="#/help">Get help</a></div></div>'
    };
  };
})(window, document);
