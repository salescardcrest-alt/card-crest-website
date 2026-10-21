/* ============================================================
   Card Crest — config.js
   Paste your Supabase project values here (Project Settings → API).
   The anon key is safe to ship in the browser; row-level security
   (see supabase/schema.sql) is what protects the data.
   Leave both empty to run in local demo mode.
   ============================================================ */
// Add ?demo=1 to the address (for example http://localhost:3000/?demo=1) to run fully offline in local demo mode.
window.CC_CONFIG = /[?&]demo=1/.test(location.search) ? {} : {
  SUPABASE_URL: 'https://bkedgkarjwihipegloia.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZWRna2FyandpaGlwZWdsb2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMTU2NTEsImV4cCI6MjEwNzg5MTY1MX0.4gVOuOTSe5cv-NrvYzVICYDV7KA-pKaUbOINQl4I2O4'
};

/* Affiliate links (cashback tracking). When you join an affiliate network (Cuelinks, EarnKaro, vCommission, the
   store's own programme...), put each store's deep link here. {click} is replaced with Card Crest's tracking
   reference, which the network reports back with every order. Example:
   window.CC_CONFIG.AFFILIATE_LINKS = {
     flipkart: 'https://dl.flipkart.com/dl/?affid=YOUR_ID&affExtParam1={click}',
     amazon:   'https://www.amazon.in/?tag=YOUR_TAG&ascsubtag={click}'
   };
   Stores without an entry open their own site with the reference attached (cc_click=...). */

/* Card applications ("Apply for this card"). The applicant is sent to the bank's own site with Card Crest's partner
   (employee / DSA / referral) code attached.
   PARTNER_REF: your code per bank, with `default` for banks not listed:
     window.CC_CONFIG.PARTNER_REF = { default: 'CARDCREST', hdfc: 'CC-EMP-1042', axis: 'CC-AX-77' };
   APPLY_LINKS: the exact partner link each bank gave you, per bank id or per card id. {ref} becomes the partner
   code and {click} the application reference:
     window.CC_CONFIG.APPLY_LINKS = { hdfc: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards?partnerid={ref}&sub={click}' };
   Without an APPLY_LINKS entry the bank's homepage opens with ref=<code> and cc_click=<reference> added, which
   only helps if the bank has agreed to read them. Real credit is always set up in the bank's own partner programme. */

/* Default partner code, used for every bank that has no code of its own. CARDCREST is a placeholder: replace it
   with the code your bank partner programme gives you, and add per-bank codes beside it, for example
   { default: 'CARDCREST', hdfc: 'CC-EMP-1042' }. */
window.CC_CONFIG.PARTNER_REF = { default: 'CARDCREST' };
