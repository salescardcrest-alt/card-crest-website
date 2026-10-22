# Share & Earn: the card-benefit marketplace

Buyers pay into escrow for a benefit they don't have. Cardholders fulfil the request with their own card, upload proof, and are paid after the buyer confirms. Four modules share one engine:

Order & Earn and Pay & Earn share the **discount 40% buyer / 30% cardholder / 30% Card Crest**: the buyer pays the full price minus their own 40%. Lounges are a fixed price split 50/50 between the cardholder and Card Crest, with the usual entry price shown as the buyer's saving. Movie offers keep fixed fees.

| Module | Buyer pays | Cardholder gets | Platform gets |
|---|---|---|---|
| Lounge, domestic (usual price ₹1,500) | ₹500 | ₹250 | ₹250 |
| Lounge, international (usual price ₹2,500) | ₹1,000 | ₹500 | ₹500 |
| Order & Earn, e.g. listed ₹1,000, offer price ₹900 (discount ₹100) | ₹960 | ₹900 reimbursed + ₹30 | ₹30 |
| Pay & Earn (same split) | offer price + 60% of the discount | reimbursement + 30% | 30% |
| Movie, ₹500 off on 2 seats | (tickets − ₹500) + ₹300 fee | reimbursement + ₹200 | ₹100 |
| Movie, buy one get one | (half the tickets) + ₹300 fee | reimbursement + ₹200 | ₹100 |

Domestic lounges are at 37 Indian airports (terminal picked from a list). International lounges are at the 275 airports outside India, grouped by country, with the terminal typed in. The lounge usual prices, the buyer prices, and the Order and Pay percentages are all editable in **Admin → Fees**.

Every number is editable in **Admin → Fees**. A request keeps the price and split it was booked at, so fee changes never touch existing bookings.

The site never collects, sees or stores card numbers, CVVs, OTPs or bank passwords. Cardholders enter bank + variant only.

## Where things are

| Path | What it is |
|---|---|
| `js/services/marketCore.js` | Pure rules: fee maths, state machine, validation, quotas, privacy masking |
| `js/services/marketService.js` | The `CC.Market` API. Supabase RPCs when configured, a local engine otherwise |
| `js/pages/market.js` | Buyer and cardholder pages (`#/market…`) |
| `js/pages/marketAdmin.js` | Admin sections: Marketplace, Disputes, KYC, Fees, Payouts, Revenue |
| `supabase/05_marketplace.sql` | Tables, row-level security, private proof bucket, and every `mk_*` function |
| `supabase/functions/gateway-webhook/` | Signature-verified webhook for live payments |
| `tests/` | `market.test.html` (48 logic tests) and `ui-smoke.html` (44 screen tests) |

## Set up (test mode)

1. In Supabase → SQL Editor, run `supabase/05_marketplace.sql`. It needs `schema.sql` and `02_data_tables.sql` to have been run already. It is safe to re-run.
2. Deploy the site as usual. The marketplace appears as **Share & Earn** in the header.
3. Try it end to end with two accounts (a buyer and a cardholder): the cardholder adds a card under *My benefit cards*, the buyer creates and "pays" a request with the test checkout, the cardholder accepts and uploads proof, the buyer confirms.
4. As admin, open **Admin → Revenue** to see the ledger and escrow checks.

Try it alone, with no Supabase: open `http://localhost:3000/?demo=1`. A built-in test cardholder plays the other side, and a *Test helper* box on each request lets you accept, upload proof, and move the clock forward to see expiry and auto-confirm.

## Request lifecycle

`CREATED → PAID → ACCEPTED → FULFILLED → CONFIRMED → SETTLED`, plus `EXPIRED`, `CANCELLED`, `DISPUTED`, `REFUNDED`.

* **Expiry:** if no cardholder accepts in time (admin-set hours, never later than 1 hour before the visit or show), it expires and the buyer is refunded in full.
* **First accept wins:** the database locks the request row, so two cardholders cannot take the same one.
* **Eligibility:** a card must carry the benefit, be valid at the airport, and have quota left. Domestic and international lounge quotas are counted separately per calendar quarter of the visit date, and the quota is returned if the cardholder steps back.
* **Proof:** lounge pass, booking ID, order ID or invoice, stored in a private bucket and shown through signed links.
* **Price difference (movie, order, pay):** a lower final price is refunded to the buyer at settlement. A higher one needs the buyer's top-up before they can confirm.
* **Release:** the buyer confirms, or it auto-confirms after the config window with no dispute. Movie money is released after the show even if the buyer confirms early.
* **Lounge entry denied:** the buyer reports it, is refunded in full, and the cardholder gets the penalty and a trust drop.
* **No-show:** if proof isn't uploaded in time, the buyer is refunded and the cardholder penalised.
* **Disputes:** the buyer raises one with evidence. Staff choose refund, release, or a partial split.

## Money and ledger

Every movement is a balanced double-entry ledger transaction (`mk_ledger`): escrow in, reimbursement, platform fee, cardholder earning, refund, penalty, payout. **Admin → Revenue** checks that debits equal credits and that escrow equals the open requests' totals.

Payments go through `mk_apply_payment()`, which records the gateway event id first. A replayed event is acknowledged and ignored, a wrong amount is refused, and a second payment for an already-paid request is refused.

## Tests

```
py -m http.server 3000                      # from the repo root
powershell -File tests\run-tests.ps1        # logic: fee splits, state machine, ledger, webhooks, quotas
powershell -File tests\run-tests.ps1 http://localhost:3000/tests/ui-smoke.html   # real screens, offline
```

You can also open either page in a browser. The logic tests cover both lounge types, both movie offers, price-difference adjustment, expiry, no-show, denial, disputes, payouts, signature checking and webhook replays.

**What is not covered:** `05_marketplace.sql` mirrors the same rules, but the tests run against the in-browser engine. Run through the flow once with real accounts after applying the SQL, and use *Admin → Revenue* to confirm the ledger balances.

## Going live (not done yet)

1. **Gateway approval.** Holding customer money and paying it out later needs a gateway marketplace product (Razorpay Route or Cashfree Easy Split) and its approval. Until then, stay in test mode.
2. **Create orders with the gateway.** `mk_start_payment` makes a test order id. Replace it with a call to the gateway's orders API (an Edge Function) and store the gateway's order id.
3. **Webhook.** Deploy `supabase/functions/gateway-webhook`, set `GATEWAY_WEBHOOK_SECRET`, and point the gateway at it.
4. **Payouts.** `mk_process_payout` only writes the ledger entry in test mode. Call the gateway's payout API before marking a payout paid.
5. **Switch the mode:** `update mk_settings set value = 'live' where key = 'gateway_mode';` (this turns off `mk_test_payment`).
6. **Timers.** The site runs the timers whenever someone opens a page. For reliability enable `pg_cron` and schedule `select public.mk_sweep();` every 5 minutes (the SQL file ends with the lines).
7. **Notifications.** In-app notifications work now. Email and WhatsApp messages are queued in `mk_outbox`. A sender (Edge Function, Resend, WhatsApp Business API) needs to read the `QUEUED` rows.
8. **KYC data.** PAN and bank details sit in `mk_kyc`, readable only by the owner and staff. Move them to Supabase Vault or pgsodium for encryption at rest before real users.
9. **Rotate the keys** that were pasted into chat earlier (secret and service-role keys).

## Things to check before launch

* **Bank terms.** Many card issuers restrict sharing benefits such as lounge guest access or offer pricing, and a cardholder could be penalised. Get legal advice and show clear terms.
* **Lounge access.** Priority Pass and DreamFolks tie entry to the member's own card and ID, so guest access depends on each program's rules. Treat the lounge module as the highest-risk one.
* **Tax.** Cardholder earnings may involve TDS and GST. Collect what your accountant needs.

## Live alerts for cardholders

When a buyer's payment lands in escrow (or a cardholder steps back), the database alerts every cardholder whose card fits the request: the right benefit, a valid airport, lounge quota left, and the bank the buyer asked for. The buyer and the cardholder who stepped back are not alerted.

* **In the browser:** the alert is a row in `notifications`, pushed over Supabase Realtime the moment it is created. The signed-in cardholder sees a toast, hears a soft chime (switchable on the Earn page), gets a desktop alert if they allowed it, and the open requests list updates without a refresh. The bell opens the Earn page.
* **Email and WhatsApp:** the same alert is queued in `mk_outbox` for the sender described under "Going live".
* **Setup:** `05_marketplace.sql` adds the `notifications` table to the `supabase_realtime` publication. Realtime must be enabled for the project (it is by default).
* **Offline demo:** with `?demo=1`, two browser windows signed in as different users also get each other's alerts live.

## Email alerts for new requests (opt-in)

On the Earn page a person can press **Email me alerts**. From then on, every new request their card can fulfil, and the buyer's "Payment held safely" confirmation, is
also emailed to the address on their account (for example their Gmail). It is off until they switch it on, and they can
switch it off the same way.

How it works: the database (`mk_notify_open`) queues an email row in `mk_outbox` only for people who opted in
(`mk_member.email_alerts`). The Edge Function `supabase/functions/send-alert-email` sends each queued row through Gmail.

One-time setup (the website part works without it; without it the emails stay queued):
1. Run `supabase/05_marketplace.sql` again in the SQL Editor (adds the opt-in column and `mk_set_email_alerts`).
2. Use the mailbox you send from. A Hostinger mailbox such as admin@cardcrest.in needs no app password: it uses the mailbox password (Hostinger hPanel, Emails). A Gmail mailbox needs an App password instead.
3. In Supabase, Edge Functions, create `send-alert-email` and paste `supabase/functions/send-alert-email/index.ts`, then add these secrets:
   `SMTP_HOST` (smtp.hostinger.com), `SMTP_PORT` (465), `SMTP_USER` (admin@cardcrest.in), `SMTP_PASSWORD`, `WEBHOOK_SECRET` (any long random text), `SITE_URL`.
4. In Supabase, Database, Webhooks: create a webhook on table `mk_outbox`, event **Insert**, type **Supabase Edge Function**,
   function `send-alert-email`, with the HTTP header `x-webhook-secret` set to the same `WEBHOOK_SECRET`.
Never put the service-role key or the app password in the website or the app.
