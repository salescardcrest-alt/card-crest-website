-- Card Crest: ONE shared catalogue (cards, stores, offers) for the website AND the app.
-- Run this once in the Supabase SQL Editor (after 02_data_tables.sql, which creates public.is_admin()). Safe to run again.
--
-- Until now an edit made in Admin > Cards / Stores / Offers was saved only in the admin's own browser, so nobody else (and not the
-- app) ever saw it. Now every edit is written here. The website and the app read this table, listen for changes, and put each row on
-- top of the built-in catalogue: a row with the same id replaces the built-in item, a new id adds one, "deleted" hides one.

create table if not exists public.catalog_items (
  kind        text not null check (kind in ('card', 'store', 'offer')),
  id          text not null,
  data        jsonb not null default '{}'::jsonb,   -- the whole item, in the same shape as the built-in catalogue
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (kind, id)
);

create or replace function public.catalog_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists catalog_items_touch on public.catalog_items;
create trigger catalog_items_touch before insert or update on public.catalog_items for each row execute function public.catalog_touch();

alter table public.catalog_items enable row level security;

drop policy if exists "catalog: everyone reads" on public.catalog_items;
create policy "catalog: everyone reads" on public.catalog_items for select using (true);

drop policy if exists "catalog: staff write" on public.catalog_items;
create policy "catalog: staff write" on public.catalog_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.catalog_items to anon, authenticated;
grant insert, update, delete on public.catalog_items to authenticated;

-- live: the website and the app hear about every change the moment it is saved
do $$ begin
  alter publication supabase_realtime add table public.catalog_items;
exception when duplicate_object then null; when undefined_object then null; end $$;
