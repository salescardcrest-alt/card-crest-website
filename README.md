# Card Crest

A credit-card discovery, comparison and cashback rewards platform.

Card Crest scores every credit card on what it returns against what it costs, then
layers a cashback marketplace on top — so the same purchase earns card rewards *and*
platform cashback.

Built as a no-build static application. No npm install, no bundler, no framework.
Open `index.html` and it runs.

---

## 1. Running it

**Locally — the simple way**

Open `index.html` in any browser. Everything works: there are no ES modules and no
`fetch()` calls, so there is no CORS problem from `file://`.

**Locally — with a server** (closer to production)

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

**There is no build step.** `npm run build` does not exist and is not needed. Nothing
is transpiled, minified or compiled. What you edit is what ships.

---

## 2. Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | `demo@cardcrest.in` | `demo1234` |
| Operations / admin | `admin@cardcrest.in` | `admin1234` |

Eight further demo users exist (`neha@example.com`, `subham@example.com`, and so on),
all with the password `demo1234`. They exist so the admin panel has real data to manage.

The customer account starts populated: three saved cards, ten transactions across every
cashback state, three applications, five referrals, fifteen notifications and one past
redemption.

**Resetting.** Profile → settings → *Reset demo data* restores the original dataset and
signs you out. Clearing site data in your browser does the same thing.

---

## 3. Project structure

```
card-crest/
├── index.html              app shell: header, mobile nav, footer, script tags
├── vercel.json             SPA fallback for Vercel
├── netlify.toml            SPA fallback for Netlify
├── .nojekyll               lets GitHub Pages serve files starting with _
│
├── css/
│   ├── global.css          design tokens, type scale, header, footer, tab bar
│   ├── components.css      buttons, cards, gauge, badges, forms, tables, modal, toast
│   ├── pages.css           hero, marketplace, dashboard, admin, calculator layouts
│   └── responsive.css      1280 / 1120 / 1024 / 900 / 768 / 560 / 380
│
├── js/
│   ├── data.js             the demo dataset — banks, cards, stores, offers, users, seeds
│   ├── store.js            persistence layer (localStorage) + seeding
│   ├── ui.js               formatting, toasts, modals, gauges, shared markup
│   ├── hero.js             hero card-stack parallax
│   ├── router.js           hash router + route table
│   ├── app.js              boot: header state, global search, mobile menu, bell
│   │
│   ├── services/           the API boundary — see section 7
│   │   ├── authService.js
│   │   ├── cardService.js          ← the Card Value Score lives here
│   │   ├── offerService.js
│   │   ├── cashbackService.js
│   │   ├── rewardService.js        ← the demo payout service lives here
│   │   ├── referralService.js
│   │   ├── applicationService.js
│   │   ├── notificationService.js
│   │   ├── supportService.js
│   │   └── searchService.js
│   │
│   └── pages/
│       ├── home.js         landing page
│       ├── cards.js        marketplace, card detail, compare, eligibility, calculator
│       ├── offers.js       offers, offer detail, stores, store detail, activation
│       ├── account.js      auth, dashboard, my cards, applications, transactions,
│       │                   rewards, referrals, profile, notifications
│       ├── admin.js        ops panel — CRUD across every entity
│       └── misc.js         help centre, how it works, legal, 404
│
└── assets/
    └── favicon.svg
```

**Architecture.** Every page module returns `{ html, title, desc, mount(root) }`. The
router injects the HTML, sets the metadata, then calls `mount()` to wire up events. Pages
never touch `localStorage` directly — they go through a service.

```
UI  →  Service  →  Store  →  localStorage
```

---

## 4. Routes

| Route | What it is |
|-------|-----------|
| `#/` | Home |
| `#/cards` | Card marketplace — search, 4 filter groups, 5 sorts, pagination |
| `#/cards/:id` | Card detail, score breakdown, pros and cons, FAQs |
| `#/compare` | Side-by-side comparison, up to 4 cards, best value highlighted |
| `#/eligibility` | Six-step wizard → ranked recommendations |
| `#/calculator` | Card value calculator, live recalculation |
| `#/offers` | Cashback marketplace — sections, categories, deals vs coupons |
| `#/offers/:id` | Offer detail and terms |
| `#/stores` | Store directory |
| `#/stores/:id` | Store page, coupons, cashback rules |
| `#/rewards` | Rewards wallet and redemption |
| `#/refer` | Referral code, link, sharing, history |
| `#/dashboard` | Customer overview |
| `#/dashboard/cards` | Saved cards, primary card, renewal dates, yearly value |
| `#/dashboard/applications` | Application tracker with stage timeline |
| `#/dashboard/transactions` | Transactions, filtered by state |
| `#/dashboard/notifications` | Notification centre |
| `#/profile` | Personal, financial, security, demo reset |
| `#/login`, `#/signup` | Auth with full validation |
| `#/help` | FAQ search and support tickets |
| `#/how-it-works` | Product explanation and score methodology |
| `#/legal/:doc` | privacy · terms · disclaimer · cookies |
| `#/admin/:section` | overview · users · cards · stores · offers · transactions · rewards · applications · referrals · support |

Anything else renders the 404 page.

---

## 5. The Card Value Score

The one number the whole product hangs on. Defined in
`js/services/cardService.js` → `score(card, profile)`. It returns 0–100 **and** its own
breakdown, which the card detail page renders as bars so the working is visible.

| Component | Points | What it measures |
|-----------|--------|------------------|
| Net return on spend | 40 | Rewards + benefits − annual fee, as a % of spend. 0–6% maps to 0–40. |
| Fee efficiency | 15 | Value returned per rupee of annual fee. Zero-fee cards score full marks. |
| Breadth of benefits | 20 | How many of lounge / fuel / travel / dining / shopping / insurance / milestone are genuinely offered. |
| Welcome value | 10 | Welcome benefit against the joining fee. |
| Redemption quality | 10 | Whether points convert cleanly to rupees or are trapped in a voucher catalogue. |
| How reachable it is | 5 | Lower income requirement scores higher — a card you cannot get is worth nothing. |

Two deliberate choices worth knowing about:

**Points are discounted by how spendable they are.** A card paying 3% in points redeemable
at ₹0.25 each is not a 3% card. `redemptionQuality()` reads each card's own redemption
text and scales gross rewards by `0.55 + 0.45 × quality`. Statement credit scores 1.0;
a ₹0.25 voucher point scores 0.35.

**Category accelerators are modelled, not averaged.** Each card carries an `accel` map
(`online`, `offline`, `dining`, `fuel`, `travel`). The Swiggy HDFC card earns 10% on dining
and 1% offline — averaging those would misrepresent both.

**Tuning it.** The weights are the six numbers in `score()`. The reference spending profile
is `REF` at the top of the same file (₹40,000/month, split across five categories). Change
either and every score, ranking and recommendation across the app moves with it.

---

## 6. What is simulated

This runs in **demo mode**, and says so — a dismissible strip at the top of every page,
plus explicit notices at each point where real money would move.

- **Cashback tracking.** No affiliate network is connected. Activating an offer creates a
  transaction and advances it `clicked → tracked` on a 12-second timer so the lifecycle is
  visible without waiting 90 days. Admin can drive it the rest of the way.
- **Redemption.** `rewardService.payout()` records the request, validates the balance and
  the minimum, and marks it completed after 9 seconds. **No transfer is made** to any UPI
  handle, bank account or card network.
- **Applications.** Nothing reaches a bank. No credit enquiry is made. Status advances to
  `under-review` on a timer; admin controls the rest.
- **Eligibility.** An estimate from what the user typed. No credit bureau is queried, and
  the UI never claims otherwise.
- **Email.** Password resets and ticket confirmations do not send.

Financial-safety language is enforced by a test (`qa2.js`, section 21): the strings
"guaranteed approval", "guaranteed cashback", "guaranteed credit score" and "guaranteed
income" do not appear anywhere in the app.

---

## 7. Connecting a real backend

The service layer is the seam. Every page calls services; only services call `Store`.
To go live you replace the inside of each service function and change nothing else.

Currently:

```js
// js/services/cardService.js
all: function () {
  return S.where('cards', function (c) { return c.active !== false; });
}
```

With an API:

```js
all: async function () {
  const r = await fetch(`${API}/cards`, { headers: authHeaders() });
  return r.json();
}
```

Page modules become `async` where they consume that data. Nothing else changes — no
markup, no CSS, no routing.

**Suggested order:**

1. **Auth first.** `authService.js` is five functions: `login`, `signup`, `logout`,
   `updateProfile`, `changePassword`. Swap the localStorage session for a JWT and store it
   under the same key. `Auth.require()` already gates every protected route.
2. **Read paths.** `cardService.all()`, `offerService.all()`, `offerService.stores()`.
   These are pure reads and the easiest to move.
3. **Write paths.** `cashbackService.activate()`, `applicationService.create()`,
   `rewardService.payout()`. These need real endpoints and idempotency keys.
4. **Tracking.** `activate()` is where a real affiliate deeplink goes. The transaction
   record already carries `retailerUrl`, `offerId`, `userId`, `amount` and a timestamp —
   which is exactly the payload a network postback needs to reconcile against.
5. **Payouts.** `rewardService.payout()` is deliberately the only function that would touch
   money. Replace its body with a Razorpay/Cashfree payout call; keep the balance and
   minimum validation, which already runs before any external call.

**Secrets.** There are none in this repo and none should be added. No API key belongs in
client-side JavaScript — put payout and bank credentials behind your own backend and have
the browser call that.

The Card Value Score should move server-side when you have real data, so scores stay
consistent across web, app and any partner surface.

---

## 8. Deployment

**Vercel**
```bash
vercel --prod
```
`vercel.json` is already configured with the SPA fallback.

**Netlify**
```bash
netlify deploy --prod
```
`netlify.toml` sets `publish = "."` and the redirect.

**GitHub Pages**

Push to the repo and enable Pages on the branch root. `.nojekyll` is included.
Routing uses hash fragments, so Pages needs no rewrite rules and deep links work
without a 404 shim.

**Any static host.** Upload the folder. There is nothing to build.

---

## 9. Test suites

Three headless suites run the app in jsdom. From the parent directory:

```bash
npm install jsdom
node qa.js    # walks all 50 routes: render errors, empty views, undefined/NaN
              # leakage, placeholder text, duplicate IDs, data volume, score sanity
node qa2.js   # 101 interaction checks: signup and login validation, filters,
              # sorting, pagination, comparison cap, six-step wizard, calculator,
              # activation, cashback lifecycle, redemption limits, saved cards,
              # applications, referrals, profile edits, tickets, admin CRUD,
              # admin gating, persistence, global search, safety language
node qa3.js   # SEO and accessibility: unique titles, single H1 per route,
              # meta descriptions, labelled inputs, named buttons
```

Current status: **0 failures across all three.**

---

## 10. Known limitations

- **No real backend.** Everything is in the browser's localStorage. Two browsers means two
  separate worlds; clearing site data wipes it.
- **Card data is a snapshot.** Fees, reward rates and benefits are accurate to the best of
  our knowledge but banks revise them frequently. Production needs a maintained data source.
- **The score is a model, not a fact.** It embeds judgements — how much a lounge visit is
  worth, how much to discount a ₹0.25 point. Reasonable people would weight them differently.
- **`valuePerks` is hand-estimated per card.** It is the softest input in the score. Real
  usage data should replace it.
- **No password hashing.** Demo passwords sit in plain text in localStorage. Obviously
  never do this with a real backend.
- **No image assets for cards or store logos.** Card art is CSS gradients keyed to card
  type; store logos are coloured initials. Both are deliberate — they scale to any number
  of cards and stores without an asset pipeline, and they are trivially replaceable with
  real images in `UI.plastic()` and `UI.logo()`.
- **The hero is CSS 3D, not Three.js.** `js/hero.js` is a drop-in point: replace `mount()`
  with an existing Three.js initialiser and keep the `#heroStage` element id.
- **Cashback timers are for demonstration.** Real confirmation windows are 30–90 days.

---

## 11. Where to change what

| I want to… | Go to |
|---|---|
| Add or edit a card | `js/data.js` → `CARDS`, or the admin panel at `#/admin/cards` |
| Change the scoring weights | `js/services/cardService.js` → `score()` |
| Change the reference spend profile | `js/services/cardService.js` → `REF` |
| Change the redemption minimum | `js/services/rewardService.js` → `MIN` |
| Change the referral reward | `js/services/referralService.js` → `REWARD` |
| Change colours or type | `css/global.css` → `:root` |
| Add a route | `js/router.js` → `Router.start()`, plus a page module |
| Swap in the Three.js hero | `js/hero.js` → `mount()` |
| Replace card art with images | `js/ui.js` → `UI.plastic()` |
| Replace store logos with images | `js/ui.js` → `UI.logo()` |

---

Card Crest is a discovery and comparison platform. It is not a bank, a lender or a
financial adviser. All value figures are estimates. Approval, credit limits, cashback and
benefits are decided by the issuing bank or merchant.
