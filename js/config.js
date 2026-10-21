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
