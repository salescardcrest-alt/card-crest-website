-- Card Crest — step 9: tracker (back) links set by staff in Admin → Tracker links.
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- One row per product or service:
--   kind = 'service'  ref_id = lounge | movie | pay | order      (the four home page products)
--   kind = 'store'    ref_id = the store id                       (cashback stores: "Go to the store")
--   kind = 'card'     ref_id = the card id                        (credit cards: "Apply for this card")
--   kind = 'bank'     ref_id = the bank id                        (default for that bank's cards with no link of their own)
-- Everyone can read the links (the browser needs them to redirect). Only staff can add, change or delete them.

create table if not exists public.tracker_links (
  id          text primary key,                 -- 'store:flipkart', 'card:hdfc-millennia', ...
  kind        text not null check (kind in ('service', 'store', 'card', 'bank')),
  ref_id      text not null,
  url         text not null default '',
  active      boolean not null default true,
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.tracker_links enable row level security;

drop policy if exists "tracker read" on public.tracker_links;
create policy "tracker read" on public.tracker_links for select to anon, authenticated using (true);

drop policy if exists "tracker write" on public.tracker_links;
create policy "tracker write" on public.tracker_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.tracker_links to anon, authenticated;
grant insert, update, delete on public.tracker_links to authenticated;
