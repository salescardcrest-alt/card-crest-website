/* QA harness: load index.html in jsdom, walk every route, report errors. */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/claude/cc';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('JSDOM: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: undefined,
  url: 'http://localhost/#/',
  virtualConsole: vc,
  pretendToBeVisual: true
});
const { window } = dom;

// stubs jsdom lacks
window.matchMedia = window.matchMedia || (q => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
window.scrollTo = () => {};
window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
window.HTMLElement.prototype.focus = function () {};
window.HTMLElement.prototype.scrollIntoView = function () {};

// load scripts in document order, manually
const scripts = [...dom.window.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));

function run() {
  for (const src of scripts) {
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    try {
      window.eval(code);
    } catch (e) {
      errors.push(`LOAD ${src}: ${e.message}`);
    }
  }
}

const ROUTES = [
  '/', '/cards', '/cards/hdfc-millennia', '/cards/sbi-cashback', '/cards/hdfc-infinia',
  '/compare', '/eligibility', '/calculator',
  '/offers', '/offers/off-001', '/offers/off-002',
  '/stores', '/stores/amazon', '/stores/myntra',
  '/rewards', '/refer',
  '/dashboard', '/dashboard/cards', '/dashboard/applications',
  '/dashboard/transactions', '/dashboard/notifications',
  '/profile', '/login', '/signup', '/help', '/how-it-works',
  '/legal/privacy', '/legal/terms', '/legal/disclaimer', '/legal/cookies',
  '/admin', '/admin/users', '/admin/cards', '/admin/stores', '/admin/offers',
  '/admin/transactions', '/admin/rewards', '/admin/applications',
  '/admin/referrals', '/admin/support',
  '/this-route-does-not-exist'
];

async function walk() {
  const CC = window.CC;
  if (!CC) { errors.push('CC namespace never initialised'); return; }

  // sign in as the demo user so gated routes render
  const res = CC.Auth.login('demo@cardcrest.in', 'demo1234');
  if (!res.ok) errors.push('demo login failed: ' + res.error);
  CC.App.paintAuth();

  for (const r of ROUTES) {
    window.location.hash = '#' + r;
    await new Promise(res => setTimeout(res, 30));
    const view = window.document.getElementById('view');
    const txt = view.textContent.trim();
    if (!txt) errors.push(`EMPTY VIEW: ${r}`);
    if (/undefined|NaN|\[object Object\]/.test(txt)) {
      const m = txt.match(/.{0,60}(undefined|NaN|\[object Object\]).{0,40}/);
      errors.push(`BAD TOKEN in ${r}: …${m[0]}…`);
    }
    if (/Lorem ipsum|Coming Soon|TODO|Placeholder|Click Here/i.test(txt)) {
      errors.push(`PLACEHOLDER TEXT in ${r}`);
    }
  }

  // admin routes as admin
  CC.Auth.logout();
  const a = CC.Auth.login('admin@cardcrest.in', 'admin1234');
  if (!a.ok) errors.push('admin login failed: ' + a.error);
  CC.App.paintAuth();
  for (const r of ['/admin', '/admin/users', '/admin/cards', '/admin/offers', '/admin/transactions', '/admin/rewards', '/admin/applications', '/admin/referrals', '/admin/support']) {
    window.location.hash = '#' + r;
    await new Promise(res => setTimeout(res, 30));
    const txt = window.document.getElementById('view').textContent.trim();
    if (!txt) errors.push(`EMPTY ADMIN VIEW: ${r}`);
    if (/undefined|NaN|\[object Object\]/.test(txt)) errors.push(`BAD TOKEN in ${r}`);
  }

  // signed out: gated route should redirect to login
  CC.Auth.logout();
  CC.App.paintAuth();
  window.location.hash = '#/dashboard';
  await new Promise(res => setTimeout(res, 60));
  if (!window.location.hash.startsWith('#/login')) {
    errors.push('gated route did not redirect when signed out: ' + window.location.hash);
  }

  // duplicate ids
  window.location.hash = '#/';
  await new Promise(res => setTimeout(res, 40));
  const ids = {};
  window.document.querySelectorAll('[id]').forEach(el => {
    ids[el.id] = (ids[el.id] || 0) + 1;
  });
  Object.entries(ids).filter(([, n]) => n > 1).forEach(([id, n]) => errors.push(`DUPLICATE ID "${id}" x${n}`));

  // service smoke tests
  const cards = CC.Cards.all();
  if (cards.length < 20) errors.push(`only ${cards.length} cards (need 20+)`);
  if (CC.Offers.stores().length < 20) errors.push(`only ${CC.Offers.stores().length} stores (need 20+)`);
  if (CC.Offers.all().length < 40) errors.push(`only ${CC.Offers.all().length} offers (need 40+)`);
  cards.forEach(c => {
    const s = CC.Cards.score(c);
    if (!isFinite(s.total) || s.total < 1 || s.total > 100) errors.push(`bad score for ${c.id}: ${s.total}`);
    if (!isFinite(s.value.net)) errors.push(`bad net value for ${c.id}`);
  });
  // images alt / a11y basics
  const noAlt = [...window.document.querySelectorAll('img:not([alt])')].length;
  if (noAlt) errors.push(`${noAlt} <img> without alt`);

  console.log(`\nRoutes walked: ${ROUTES.length + 9}`);
  console.log(`Cards: ${cards.length} | Stores: ${CC.Offers.stores().length} | Offers: ${CC.Offers.all().length}`);
  const scores = cards.map(c => CC.Cards.score(c).total);
  console.log(`Score range: ${Math.min(...scores)}–${Math.max(...scores)}`);
}

run();
setTimeout(() => {
  walk().then(() => {
    console.log('\n=== ERRORS (' + errors.length + ') ===');
    errors.slice(0, 40).forEach(e => console.log(' • ' + e));
    if (!errors.length) console.log(' none');
    process.exit(0);
  }).catch(e => { console.log('HARNESS CRASH', e); process.exit(1); });
}, 200);
