-- Card Crest: staff permissions. The main admin chooses which admin sections a member may use.
-- Run this once in the Supabase SQL Editor (after 02_data_tables.sql, 09_tracker_links.sql, 10_catalog_live.sql, and the app's
-- 11_cashback_claims.sql, 13_payouts_trust_leaderboard.sql and 14_home_banners.sql). It is safe to run again.
--
-- A member with a row in staff_permissions sees the Admin panel with ONLY the sections listed for them, and the database lets them
-- change only the data of those sections. Main admins (profiles.role = 'admin') keep full access and are the only ones who can
-- hand out or take back permissions.
--
-- Sections that can be given: cards, stores, offers (catalogue), banners, trackers (tracker links), claims (missing cashback), reports (user reports).

create table if not exists public.staff_permissions (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  sections    text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);

alter table public.staff_permissions enable row level security;

drop policy if exists "staff perms: own or admin read" on public.staff_permissions;
create policy "staff perms: own or admin read" on public.staff_permissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "staff perms: admin write" on public.staff_permissions;
create policy "staff perms: admin write" on public.staff_permissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.staff_permissions to authenticated;

-- true for a main admin, or a member who was given this section
create or replace function public.has_perm(sec text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.staff_permissions where user_id = auth.uid() and sec = any(sections));
$$;

-- true for a main admin, or a member with at least one section
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.staff_permissions where user_id = auth.uid() and cardinality(sections) > 0);
$$;

grant execute on function public.has_perm(text), public.is_staff() to authenticated;

-- ---------- what each section may change (these policies add to the existing ones) ----------

-- catalogue: cards / stores / offers
drop policy if exists "catalog: staff by section" on public.catalog_items;
create policy "catalog: staff by section" on public.catalog_items for all to authenticated
  using (public.has_perm(kind || 's')) with check (public.has_perm(kind || 's'));

-- tracker links
drop policy if exists "tracker links: staff by section" on public.tracker_links;
create policy "tracker links: staff by section" on public.tracker_links for all to authenticated
  using (public.has_perm('trackers')) with check (public.has_perm('trackers'));

-- missing cashback claims
drop policy if exists "claims: staff read by section" on public.cashback_claims;
create policy "claims: staff read by section" on public.cashback_claims for select to authenticated
  using (public.has_perm('claims'));
drop policy if exists "claims: staff update by section" on public.cashback_claims;
create policy "claims: staff update by section" on public.cashback_claims for update to authenticated
  using (public.has_perm('claims')) with check (public.has_perm('claims'));

-- user reports
drop policy if exists "reports: staff read by section" on public.user_reports;
create policy "reports: staff read by section" on public.user_reports for select to authenticated
  using (public.has_perm('reports'));
drop policy if exists "reports: staff update by section" on public.user_reports;
create policy "reports: staff update by section" on public.user_reports for update to authenticated
  using (public.has_perm('reports')) with check (public.has_perm('reports'));

-- banners: the rows and the pictures
drop policy if exists "banners: staff by section" on public.home_banners;
create policy "banners: staff by section" on public.home_banners for all to authenticated
  using (public.has_perm('banners')) with check (public.has_perm('banners'));
drop policy if exists "banners: staff upload by section" on storage.objects;
create policy "banners: staff upload by section" on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and public.has_perm('banners'));
drop policy if exists "banners: staff change by section" on storage.objects;
create policy "banners: staff change by section" on storage.objects for update to authenticated
  using (bucket_id = 'banners' and public.has_perm('banners'));
drop policy if exists "banners: staff delete by section" on storage.objects;
create policy "banners: staff delete by section" on storage.objects for delete to authenticated
  using (bucket_id = 'banners' and public.has_perm('banners'));

-- staff need to read member names (claims and reports show who) but nothing is changed
drop policy if exists "profiles: staff read" on public.profiles;
create policy "profiles: staff read" on public.profiles for select to authenticated using (public.is_staff());
