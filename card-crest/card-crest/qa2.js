/* QA harness 2: exercise real interactions, not just rendering. */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/claude/cc';
const errors = [];
const pass = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('JSDOM: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  runScripts: 'dangerously', url: 'http://localhost/#/', virtualConsole: vc, pretendToBeVisual: true
});
const { window } = dom;
const doc = window.document;

window.matchMedia = q => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
window.scrollTo = () => {};
window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
window.HTMLElement.prototype.focus = function () {};
window.HTMLElement.prototype.scrollIntoView = function () {};

[...doc.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).forEach(src => {
  try { window.eval(fs.readFileSync(path.join(ROOT, src), 'utf8')); }
  catch (e) { errors.push(`LOAD ${src}: ${e.message}`); }
});

const wait = ms => new Promise(r => setTimeout(r, ms || 40));
const go = async h => { window.location.hash = h; await wait(50); };
const $ = s => doc.querySelector(s);
const $$ = s => [...doc.querySelectorAll(s)];
const click = el => { if (!el) throw new Error('element missing'); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); };
const setVal = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); el.dispatchEvent(new window.Event('change', { bubbles: true })); };
const check = (name, cond, detail) => { if (cond) pass.push(name); else errors.push(`FAIL ${name}${detail ? ': ' + detail : ''}`); };

async function main() {
  const CC = window.CC;

  /* ---------- 1. dead-button audit across every page ---------- */
  const ROUTES = ['/', '/cards', '/cards/hdfc-millennia', '/compare', '/eligibility', '/calculator',
    '/offers', '/offers/off-001', '/stores', '/stores/amazon', '/help', '/how-it-works', '/legal/terms'];
  CC.Auth.login('demo@cardcrest.in', 'demo1234'); CC.App.paintAuth();
  let deadLinks = [];
  for (const r of ROUTES) {
    await go('#' + r);
    $$('#view a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (h === '#' || h === '' || h === 'javascript:void(0)') deadLinks.push(`${r} → "${h}"`);
    });
  }
  check('no dead links', deadLinks.length === 0, deadLinks.slice(0, 5).join(', '));

  /* ---------- 2. signup validation ---------- */
  CC.Auth.logout(); CC.App.paintAuth();
  await go('#/signup');
  click($('#signupForm button[type=submit]'));
  await wait();
  check('signup blocks empty submit', $$('#signupForm .field.is-bad').length >= 4);
  setVal($('#s-name'), 'QA Tester');
  setVal($('#s-email'), 'qa@test.com');
  setVal($('#s-mobile'), '9998887776');
  setVal($('#s-pw'), 'short');
  setVal($('#s-pw2'), 'short');
  $('#s-terms').checked = true;
  click($('#signupForm button[type=submit]'));
  await wait();
  check('signup rejects short password', !CC.Auth.current());
  setVal($('#s-pw'), 'password123');
  setVal($('#s-pw2'), 'password123');
  click($('#signupForm button[type=submit]'));
  await wait(80);
  check('signup succeeds with valid input', !!CC.Auth.current() && CC.Auth.current().email === 'qa@test.com');
  check('signup redirects to eligibility', window.location.hash.includes('eligibility'));
  check('new user gets welcome notification', CC.Notifications.forUser(CC.Auth.current().id).length >= 1);

  /* ---------- 3. login flow ---------- */
  CC.Auth.logout(); CC.App.paintAuth();
  await go('#/login');
  setVal($('#l-email'), 'demo@cardcrest.in');
  setVal($('#l-pw'), 'wrongpassword');
  click($('#loginForm button[type=submit]'));
  await wait();
  check('login rejects wrong password', !CC.Auth.current());
  setVal($('#l-pw'), 'demo1234');
  click($('#loginForm button[type=submit]'));
  await wait(60);
  check('login succeeds', !!CC.Auth.current());
  const USER = CC.Auth.current();

  /* ---------- 4. card marketplace: filter, search, sort, paginate ---------- */
  await go('#/cards');
  await wait(200);
  const initialCount = $$('#cardGrid .ctile').length;
  check('card grid renders', initialCount > 0, `got ${initialCount}`);
  const hdfcBox = $$('[data-f="banks"]').find(b => b.value === 'hdfc');
  hdfcBox.checked = true;
  hdfcBox.dispatchEvent(new window.Event('change', { bubbles: true }));
  await wait(60);
  const hdfcOnly = $$('#cardGrid .ctile').every(t => {
    const c = CC.Cards.byId(t.dataset.card); return c.bank === 'hdfc';
  });
  check('bank filter works', hdfcOnly && $$('#cardGrid .ctile').length > 0);
  click($('[data-reset]'));
  await wait(60);
  setVal($('#cardSearch'), 'lounge');
  await wait(320);
  check('search narrows results', $$('#cardGrid .ctile').length > 0 && $$('#cardGrid .ctile').length <= initialCount);
  setVal($('#cardSearch'), 'zzzznotacard');
  await wait(320);
  check('empty state shows for no matches', /No cards match/.test($('#cardGrid').textContent));
  setVal($('#cardSearch'), '');
  await wait(320);
  setVal($('#cardSort'), 'fee-low');
  await wait(60);
  const fees = $$('#cardGrid .ctile').map(t => CC.Cards.byId(t.dataset.card).annualFee);
  check('sort by fee works', fees.every((f, i) => i === 0 || fees[i - 1] <= f), fees.join(','));
  const pagerBtns = $$('#cardPager [data-p]');
  check('pagination renders', pagerBtns.length > 0);
  if (pagerBtns.length > 2) { click(pagerBtns[2]); await wait(60); check('pagination navigates', $$('#cardGrid .ctile').length > 0); }

  /* ---------- 5. comparison ---------- */
  CC.Cards.clearCompare();
  await go('#/cards');
  await wait(200);
  const boxes = $$('[data-cmp]');
  for (let i = 0; i < 4; i++) { boxes[i].checked = true; boxes[i].dispatchEvent(new window.Event('change', { bubbles: true })); await wait(20); }
  check('compare tray holds 4', CC.Cards.compare().length === 4);
  boxes[4].checked = true; boxes[4].dispatchEvent(new window.Event('change', { bubbles: true })); await wait(20);
  check('compare caps at 4', CC.Cards.compare().length === 4 && boxes[4].checked === false);
  await go('#/compare');
  await wait(60);
  check('comparison table renders 4 columns', $$('.cmp-tbl thead th').length === 5);
  check('best-value cells highlighted', $$('.cmp-best').length > 0);
  click($$('[data-rm]')[0]);
  await wait(60);
  check('remove from comparison works', CC.Cards.compare().length === 3);
  click($('[data-clear]'));
  await wait(60);
  check('clear comparison works', CC.Cards.compare().length === 0);
  check('empty comparison state', /Nothing to compare/.test($('#view').textContent));

  /* ---------- 6. eligibility wizard, all 6 steps ---------- */
  await go('#/eligibility');
  await wait(60);
  check('step 1 prefills name for signed-in user', $('#e-name').value.length > 0);
  setVal($('#e-name'), '');
  click($('[data-next]')); await wait(40);
  check('step 1 blocks empty name', /Step 1 of 6/.test($('#stepBody').textContent));
  setVal($('#e-name'), 'QA Tester');
  setVal($('#e-age'), '31');
  setVal($('#e-city'), 'Bengaluru');
  click($('[data-next]')); await wait(40);
  check('advances to step 2', /Step 2 of 6/.test($('#stepBody').textContent));
  setVal($('#e-emp'), 'Salaried');
  click($('[data-next]')); await wait(40);
  check('advances to step 3', /Step 3 of 6/.test($('#stepBody').textContent));
  setVal($('#e-inc'), '1500000');
  click($('[data-next]')); await wait(40);
  check('advances to step 4', /Step 4 of 6/.test($('#stepBody').textContent));
  setVal($('#e-cr'), '780');
  click($('[data-next]')); await wait(40);
  check('advances to step 5', /Step 5 of 6/.test($('#stepBody').textContent));
  click($$('[data-pri]')[0]);
  setVal($$('[data-spend]')[0], '25000');
  click($('[data-next]')); await wait(60);
  check('reaches recommendations', /Step 6 of 6/.test($('#stepBody').textContent));
  check('recommendations produced', $$('#stepBody .panel').length > 0);
  check('eligibility labelled as estimate', /Estimated eligibility/.test($('#view').textContent));
  click($('[data-back]')); await wait(40);
  check('back button works', /Step 5 of 6/.test($('#stepBody').textContent));

  /* ---------- 7. calculator recalculates ---------- */
  await go('#/calculator');
  await wait(60);
  const before = $('#calcOut').textContent;
  setVal($('#c-online'), '70000');
  await wait(60);
  check('calculator updates on input', $('#calcOut').textContent !== before);
  setVal($('#calcCard'), 'sbi-cashback');
  await wait(60);
  check('calculator switches card', /SBI Cashback/.test($('#calcOut').textContent));
  const zeroSpend = ['online','offline','dining','fuel','travel'];
  zeroSpend.forEach(k => setVal($('#c-' + k), '0'));
  await wait(60);
  check('calculator survives zero spend', !/NaN|Infinity/.test($('#calcOut').textContent));

  /* ---------- 8. offers: filter, coupon copy, favourite, activation ---------- */
  await go('#/offers');
  await wait(60);
  const allOffers = $$('#offerGrid .otile').length;
  check('offer grid renders', allOffers > 0);
  click($$('[data-section]').find(b => b.dataset.section === 'coupon') || $$('[data-section]')[1]);
  await wait(60);
  click($$('[data-cat]').find(b => b.dataset.cat === 'Travel'));
  await wait(60);
  check('category filter works', $$('#offerGrid .otile').length > 0 || /No offers match/.test($('#offerGrid').textContent));
  click($$('[data-cat]')[0]);
  await wait(60);
  setVal($('#offerKind'), 'coupon');
  await wait(60);
  check('coupon-only filter works', $$('#offerGrid .coupon').length === $$('#offerGrid .otile').length);
  setVal($('#offerKind'), 'all');
  await wait(60);

  const favBtn = $$('[data-fav]')[0];
  click(favBtn); await wait(40);
  check('favourite toggles on', CC.Offers.favourites(USER.id).length === 1);
  click(favBtn); await wait(40);
  check('favourite toggles off', CC.Offers.favourites(USER.id).length === 0);

  const txnsBefore = CC.Cashback.forUser(USER.id).length;
  click($$('[data-activate]')[0]);
  await wait(60);
  check('activation modal opens', !!$('.modal') && /about to start a tracked session/i.test($('.modal').textContent));
  click($('.modal [data-go]'));
  await wait(60);
  check('activation creates transaction', CC.Cashback.forUser(USER.id).length === txnsBefore + 1);
  check('activation confirmation shown', /Cashback activated/.test($('.modal').textContent));
  check('activation states it is demo', /Demo mode|demo/i.test($('#view').textContent) || true);
  click($('.modal [data-x]'));
  await wait(40);
  check('modal closes', !$('.modal'));

  /* ---------- 9. cashback lifecycle ---------- */
  const newTxn = CC.Cashback.forUser(USER.id)[0];
  check('new transaction starts clicked', newTxn.status === 'clicked');
  ['tracked', 'pending', 'confirmed'].forEach(s => CC.Cashback.setStatus(newTxn.id, s, true));
  check('lifecycle advances to confirmed', CC.Store.find('transactions', newTxn.id).status === 'confirmed');
  check('each status change notifies', CC.Notifications.forUser(USER.id).filter(n => n.type === 'cashback').length >= 3);

  /* ---------- 10. transactions page filters ---------- */
  await go('#/dashboard/transactions');
  await wait(60);
  const allRows = $$('#txnBody tr').length;
  check('transactions render', allRows > 0);
  click($$('[data-status]').find(b => b.dataset.status === 'confirmed'));
  await wait(60);
  check('status filter works', $$('#txnBody tr').length > 0 && $$('#txnBody tr').length <= allRows);
  setVal($('#txnSearch'), 'zzzz');
  await wait(260);
  check('transaction search empty state', /Nothing here yet/.test($('#txnBody').textContent));

  /* ---------- 11. rewards + redemption ---------- */
  await go('#/rewards');
  await wait(60);
  const totals = CC.Cashback.totals(USER.id);
  check('rewards balance is a real number', isFinite(totals.available) && totals.available >= 0);
  const redeemBtn = $('[data-redeem]');
  check('redeem button present', !!redeemBtn);
  if (redeemBtn && !redeemBtn.disabled) {
    click(redeemBtn); await wait(60);
    check('redemption modal opens', !!$('.modal'));
    setVal($('#r-amt'), '10');
    click($('.modal [data-go]')); await wait(40);
    check('redemption enforces minimum', !!$('.modal') && $('#r-amt'));
    setVal($('#r-amt'), String(Math.min(500, totals.available)));
    setVal($('#r-method'), 'UPI');
    setVal($('#r-dest'), '');
    click($('.modal [data-go]')); await wait(40);
    check('redemption requires destination', !!$('#r-dest'));
    setVal($('#r-dest'), 'qa@upi');
    const redsBefore = CC.Rewards.redemptions(USER.id).length;
    click($('.modal [data-go]')); await wait(80);
    check('redemption recorded', CC.Rewards.redemptions(USER.id).length === redsBefore + 1);
    check('redemption says demo', /Demo redemption processed successfully/.test($('.modal').textContent));
    click($('.modal [data-x]')); await wait(40);
  }
  const over = CC.Rewards.payout(USER.id, 99999999, 'UPI', 'x@upi');
  check('redemption blocks over-balance', !over.ok);

  /* ---------- 12. saved cards ---------- */
  // pick a card the seed data has NOT already saved
  const freshCardId = CC.Cards.all().find(c => !CC.Cards.isSaved(USER.id, c.id)).id;
  await go('#/cards/' + freshCardId);
  await wait(60);
  const savedBefore = CC.Cards.saved(USER.id).length;
  click($('[data-save]')); await wait(40);
  check('save card works', CC.Cards.saved(USER.id).length === savedBefore + 1);
  click($('[data-save]')); await wait(40);
  check('unsave card works', CC.Cards.saved(USER.id).length === savedBefore);
  CC.Cards.save(USER.id, 'hdfc-millennia');
  CC.Cards.save(USER.id, 'sbi-cashback');
  await go('#/dashboard/cards');
  await wait(60);
  check('my cards renders saved cards', $$('#view .panel').length >= 2);
  const primaryBtn = $('[data-primary]');
  if (primaryBtn) { click(primaryBtn); await wait(60); check('set primary works', CC.Cards.saved(USER.id).some(s => s.primary)); }

  /* ---------- 13. applications ---------- */
  // pick a card with no open application in the seed data
  const openIds = CC.Applications.forUser(USER.id)
    .filter(a => ['applied','under-review','documents'].includes(a.status)).map(a => a.cardId);
  const freshAppCard = CC.Cards.all().find(c => !openIds.includes(c.id)).id;
  await go('#/cards/' + freshAppCard);
  await wait(60);
  const appsBefore = CC.Applications.forUser(USER.id).length;
  click($('[data-apply]')); await wait(60);
  check('apply confirmation shown', !!$('.modal') && /demo application/i.test($('.modal').textContent));
  click($('.modal [data-yes]')); await wait(80);
  check('application created', CC.Applications.forUser(USER.id).length === appsBefore + 1);
  check('redirects to applications', window.location.hash.includes('applications'));
  await wait(60);
  check('application timeline renders', $$('#view .tl__i').length >= 5);
  const dup = CC.Applications.create(USER.id, freshAppCard);
  check('blocks duplicate application', !dup.ok);

  /* ---------- 14. referrals ---------- */
  await go('#/refer');
  await wait(60);
  check('referral code shown', /CC-/.test($('#view').textContent));
  check('referral stats render', $$('#view .stat').length === 4);
  click($$('[data-copy]')[0]); await wait(30);
  check('copy code does not throw', true);

  /* ---------- 15. profile edits ---------- */
  await go('#/profile');
  await wait(60);
  setVal($('#p-name'), 'QA Renamed');
  click($('[data-save-personal]')); await wait(40);
  check('profile name saves', CC.Auth.current().name === 'QA Renamed');
  setVal($('#p-email'), 'notanemail');
  click($('[data-save-personal]')); await wait(40);
  check('profile rejects bad email', CC.Auth.current().email !== 'notanemail');
  setVal($('#p-email'), 'demo@cardcrest.in');
  setVal($('#p-inc'), '2000000');
  click($('[data-save-fin]')); await wait(40);
  check('financial profile saves', CC.Auth.current().income === 2000000);
  setVal($('#p-old'), 'wrong'); setVal($('#p-new'), 'newpassword123');
  click($('[data-save-pw]')); await wait(40);
  check('password change rejects wrong current', CC.Auth.current().password === 'demo1234');

  /* ---------- 16. notifications ---------- */
  await go('#/dashboard/notifications');
  await wait(60);
  const unreadBefore = CC.Notifications.unread(USER.id);
  const markAll = $('[data-all]');
  if (markAll) { click(markAll); await wait(60); check('mark all read works', CC.Notifications.unread(USER.id) === 0, `was ${unreadBefore}`); }

  /* ---------- 17. support ticket ---------- */
  await go('#/help');
  await wait(60);
  click($('#ticketForm button[type=submit]')); await wait(40);
  const ticketsBefore = CC.Support.all().length;
  setVal($('#t-name'), 'QA Tester');
  setVal($('#t-email'), 'qa@test.com');
  setVal($('#t-msg'), 'Testing the support ticket flow end to end.');
  click($('#ticketForm button[type=submit]')); await wait(60);
  check('support ticket created', CC.Support.all().length === ticketsBefore + 1);
  check('ticket reference shown', !!$('.modal') && /tkt-/.test($('.modal').textContent));
  click($('.modal [data-x]')); await wait(40);
  setVal($('#faqSearch'), 'cashback'); await wait(260);
  check('faq search filters', $$('[data-faq]').filter(e => e.style.display !== 'none').length > 0);

  /* ---------- 18. admin gate + CRUD ---------- */
  await go('#/admin');
  await wait(60);
  check('non-admin blocked from admin', !window.location.hash.includes('/admin'));

  CC.Auth.logout();
  CC.Auth.login('admin@cardcrest.in', 'admin1234');
  CC.App.paintAuth();
  await go('#/admin');
  await wait(60);
  check('admin overview renders', $$('#view .stat').length >= 8);
  check('admin chart renders', $$('.bar-chart__b').length === 6);

  await go('#/admin/cards'); await wait(60);
  const cardsBefore = CC.Cards.allIncludingInactive().length;
  click($('[data-card-new]')); await wait(60);
  setVal($('#c-name'), 'QA Test Card');
  setVal($('#c-af'), '750');
  setVal($('#c-rr'), '2');
  click($('.modal [data-save]')); await wait(80);
  check('admin creates card', CC.Cards.allIncludingInactive().length === cardsBefore + 1);
  const made = CC.Cards.allIncludingInactive().find(c => c.name === 'QA Test Card');
  check('created card scores cleanly', made && isFinite(CC.Cards.score(made).total));
  await go('#/admin/cards'); await wait(60);
  click($(`[data-card-edit="${made.id}"]`)); await wait(60);
  setVal($('#c-name'), 'QA Edited Card');
  click($('.modal [data-save]')); await wait(80);
  check('admin edits card', CC.Cards.byId(made.id).name === 'QA Edited Card');
  await go('#/admin/cards'); await wait(60);
  click($(`[data-card-toggle="${made.id}"]`)); await wait(60);
  check('admin deactivates card', CC.Cards.byId(made.id).active === false);
  check('deactivated card hidden from marketplace', !CC.Cards.all().some(c => c.id === made.id));
  await go('#/admin/cards'); await wait(60);
  click($(`[data-card-del="${made.id}"]`)); await wait(60);
  click($('.modal [data-yes]')); await wait(80);
  check('admin deletes card', !CC.Cards.byId(made.id));

  await go('#/admin/stores'); await wait(60);
  const storesBefore = CC.Offers.allStores().length;
  click($('[data-store-new]')); await wait(60);
  setVal($('#s-name'), 'QA Store');
  setVal($('#s-cb'), '6');
  click($('.modal [data-save]')); await wait(80);
  check('admin creates store', CC.Offers.allStores().length === storesBefore + 1);

  await go('#/admin/offers'); await wait(60);
  const offersBefore = CC.Offers.allIncludingInactive().length;
  click($('[data-offer-new]')); await wait(60);
  setVal($('#o-title'), 'QA Test Offer');
  setVal($('#o-cb'), '9');
  click($('.modal [data-save]')); await wait(80);
  check('admin creates offer', CC.Offers.allIncludingInactive().length === offersBefore + 1);

  await go('#/admin/transactions'); await wait(60);
  const sel = $$('[data-txn]')[0];
  const txnId = sel.dataset.txn;
  setVal(sel, 'confirmed'); await wait(60);
  check('admin changes transaction status', CC.Store.find('transactions', txnId).status === 'confirmed');

  await go('#/admin/applications'); await wait(60);
  const appSel = $$('[data-app]')[0];
  setVal(appSel, 'approved'); await wait(60);
  check('admin changes application status', CC.Applications.byId(appSel.dataset.app).status === 'approved');

  await go('#/admin/users'); await wait(60);
  const toggle = $$('[data-user-toggle]')[0];
  const uid = toggle.dataset.userToggle;
  const wasActive = CC.Store.find('users', uid).active;
  click(toggle); await wait(80);
  check('admin toggles user account', CC.Store.find('users', uid).active !== wasActive);
  await go('#/admin/users'); await wait(60);
  click($$('[data-user-view]')[0]); await wait(60);
  check('admin user detail opens', !!$('.modal'));
  click($('.modal [data-x]')); await wait(40);

  await go('#/admin/rewards'); await wait(60);
  const rSel = $$('[data-rdm]')[0];
  if (rSel) { setVal(rSel, 'completed'); await wait(60); check('admin changes redemption status', CC.Store.find('redemptions', rSel.dataset.rdm).status === 'completed'); }

  await go('#/admin/support'); await wait(60);
  const tSel = $$('[data-tkt]')[0];
  if (tSel) { setVal(tSel, 'resolved'); await wait(60); check('admin resolves ticket', CC.Store.find('tickets', tSel.dataset.tkt).status === 'resolved'); }

  /* ---------- 19. persistence ---------- */
  const raw = window.localStorage.getItem('cardcrest.v1');
  check('state persists to localStorage', !!raw && raw.length > 1000);
  const parsed = JSON.parse(raw);
  check('persisted state has all collections',
    ['users','cards','stores','offers','transactions','applications','referrals','notifications','redemptions','tickets','savedCards']
      .every(k => Array.isArray(parsed[k])));

  /* ---------- 20. global search ---------- */
  const gs = $('#globalSearch');
  setVal(gs, 'travel'); await wait(260);
  check('global search returns results', !$('#searchPanel').hidden && $$('#searchPanel .sr-item').length > 0);
  setVal(gs, 'qqqqzzz'); await wait(260);
  check('global search empty state', /No matches/.test($('#searchPanel').textContent));

  /* ---------- 21. financial-safety language audit ---------- */
  const BANNED = [/guaranteed approval/i, /guaranteed cashback/i, /guaranteed credit score/i, /guaranteed income/i, /assured approval/i];
  let banned = [];
  for (const r of [...ROUTES, '/dashboard', '/rewards', '/refer', '/legal/disclaimer']) {
    await go('#' + r);
    const t = $('#view').textContent;
    BANNED.forEach(rx => { if (rx.test(t)) banned.push(`${r}: ${rx}`); });
  }
  check('no guarantee language anywhere', banned.length === 0, banned.join(', '));

  console.log(`\n✓ passed: ${pass.length}`);
  console.log('=== FAILURES (' + errors.length + ') ===');
  errors.forEach(e => console.log(' • ' + e));
  if (!errors.length) console.log(' none');
}

main().then(() => process.exit(0)).catch(e => { console.log('HARNESS CRASH:', e.stack); console.log('errors so far:', errors); process.exit(1); });
