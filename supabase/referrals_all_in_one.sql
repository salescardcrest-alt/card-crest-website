-- ============================================================
-- Card Crest — Refer & earn, ONE script for the website AND the app.
-- Paste this whole file into Supabase → SQL Editor → Run. It is safe to run again.
--
-- What it does (the website and the Card Crest app share this one database):
--   1. When someone signs up with a friend's code (on the website OR in the app), the friend gets a
--      "successful" referral with the reward, and a notification.
--   2. It remembers who referred each member, so a code can only be used once.
--   3. It lets a member add a friend's code later (the "Have a friend's code?" box, on the website and in the app).
--   4. It turns on live updates so a new referral shows in both at once.
-- ============================================================

-- Card Crest — step 6: friend (referral) tracking.
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- A new member can type a friend's code at sign up (for example CC-RAVI-1A2B). The code travels in the sign-up data
-- as `referral_code`. This script finds the friend it belongs to, adds a row to the friend's Refer & earn
-- list, marks it successful with the reward (so it is in their balance at once), and sends the friend a notification.

-- The code is CC-<first name, letters only, up to 6>-<last 4 characters of the member's id>, as built by the website.
create or replace function public.cc_referrer_for(code text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare c text := upper(trim(coalesce(code, ''))); suf text; found uuid;
begin
  if c !~ '^CC-[A-Z]{0,6}-[A-Z0-9]{4}$' then return null; end if;
  suf := right(c, 4);
  select p.id into found from public.profiles p
  where upper(right(p.id::text, 4)) = suf
    and 'CC-' || left(regexp_replace(upper(split_part(trim(coalesce(nullif(p.name, ''), 'user')), ' ', 1)), '[^A-Z]', '', 'g'), 6) || '-' || suf = c
  limit 1;
  return found;
end $$;
revoke all on function public.cc_referrer_for(text) from public, anon, authenticated;

-- "Ravi Kumar" -> "Ravi K." so a friend's full name is not shown to the person who referred them
create or replace function public.cc_short_name(full_name text)
returns text language sql immutable as $$
  select case when position(' ' in trim(coalesce(full_name, ''))) > 0
              then split_part(trim(full_name), ' ', 1) || ' ' || upper(left(trim(substr(trim(full_name), position(' ' in trim(full_name)))), 1)) || '.'
              else coalesce(nullif(trim(coalesce(full_name, '')), ''), 'A friend') end;
$$;

-- New member: profile, welcome note, and the referral (if they used a code)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare ref uuid; fname text;
begin
  insert into public.profiles (id, name, email, mobile)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'mobile', '')
  );
  insert into public.notifications (id, user_id, type, title, body)
  values (
    'ntf-' || replace(gen_random_uuid()::text, '-', ''),
    new.id, 'system', 'Welcome to Card Crest',
    'Start by checking which cards you are eligible for.'
  );

  begin   -- a problem with a referral must never stop someone signing up
  ref := public.cc_referrer_for(new.raw_user_meta_data->>'referral_code');
  if ref is not null and ref <> new.id then
    -- first name and the first letter of the last name, so a friend's full name is not shown
    fname := public.cc_short_name(new.raw_user_meta_data->>'name');
    insert into public.referrals (id, user_id, name, status, reward)
    values ('ref-' || replace(gen_random_uuid()::text, '-', ''), ref, fname, 'successful', 100);
    insert into public.notifications (id, user_id, type, title, body)
    values (
      'ntf-' || replace(gen_random_uuid()::text, '-', ''),
      ref, 'referral', 'Referral reward credited',
      fname || ' joined with your code. ₹100 has been added to your balance.'
    );
  end if;
  exception when others then null;
  end;
  return new;
end;
$$;

-- Live updates: the Refer & earn page redraws when a referral is added or changes
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'referrals') then
    alter publication supabase_realtime add table public.referrals;
  end if;
end $$;

-- Catch up: friends who already signed up with a code before this script existed
insert into public.referrals (id, user_id, name, status, reward)
select 'ref-' || replace(gen_random_uuid()::text, '-', ''), r.ref, r.fname, 'successful', 100
from (
  select u.id as uid, public.cc_referrer_for(u.raw_user_meta_data->>'referral_code') as ref,
         public.cc_short_name(u.raw_user_meta_data->>'name') as fname
  from auth.users u
  where coalesce(u.raw_user_meta_data->>'referral_code', '') <> ''
) r
where r.ref is not null and r.ref <> r.uid
  and not exists (select 1 from public.referrals x where x.user_id = r.ref and x.name = r.fname);

-- If an earlier version of this script already added "pending" rows, pay them now
update public.referrals set status = 'successful', reward = 100 where status = 'pending' and id like 'ref-%' and reward = 0;


-- ---------------- part 2: remember who referred whom, and add a code later ----------------

-- Card Crest app: what the app adds on top of the website's referral setup (supabase/06_referrals.sql in the website repo).
-- Run 06_referrals.sql FIRST (it pays the referrer when a friend signs up with their code), then run this once in the
-- Supabase SQL editor. It is safe to run again.
--
--   1. Remembers who referred each member (profiles.referred_by), so a code can only be used once.
--   2. apply_referral_code({"code": "CC-RAVI-1A2B"}): lets a member who skipped the code at sign up add a friend's code
--      later in the app. It works exactly like the sign-up path: the friend gets a "successful" referral with the reward.
--   3. Turns on live updates for referrals and notifications, so the app and the website show a new referral at once.
--
-- Needs cc_referrer_for() and cc_short_name() from 06_referrals.sql.

alter table public.profiles add column if not exists referred_by uuid;

-- New member signed up with a code: remember the friend it belongs to.
create or replace function public.cc_set_referred_by()
returns trigger language plpgsql security definer set search_path = public as $$
declare code text; ref uuid;
begin
  begin
    select raw_user_meta_data->>'referral_code' into code from auth.users where id = new.id;
    ref := public.cc_referrer_for(code);
    if ref is not null and ref <> new.id then
      update public.profiles set referred_by = ref where id = new.id;
    end if;
  exception when others then null;   -- never stop someone signing up
  end;
  return new;
end $$;

drop trigger if exists cc_profile_referred_by on public.profiles;
create trigger cc_profile_referred_by after insert on public.profiles
  for each row execute function public.cc_set_referred_by();

-- Catch up members who signed up with a code before this script existed.
update public.profiles p set referred_by = public.cc_referrer_for(u.raw_user_meta_data->>'referral_code')
from auth.users u
where u.id = p.id and p.referred_by is null and coalesce(u.raw_user_meta_data->>'referral_code', '') <> ''
  and public.cc_referrer_for(u.raw_user_meta_data->>'referral_code') is not null
  and public.cc_referrer_for(u.raw_user_meta_data->>'referral_code') <> p.id;

-- Add a friend's code after sign up.
create or replace function public.apply_referral_code(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u       uuid := auth.uid();
  entered text := upper(trim(coalesce(p->>'code', '')));
  me      public.profiles%rowtype;
  ref     uuid;
  fname   text;
begin
  if u is null then raise exception 'Sign in first.'; end if;
  if entered !~ '^CC-[A-Z]{0,6}-[A-Z0-9]{4}$' then raise exception 'That does not look like a Card Crest code.'; end if;

  select * into me from public.profiles where id = u;
  if not found then raise exception 'Your profile was not found.'; end if;
  if me.referred_by is not null then raise exception 'You have already used a referral code.'; end if;

  ref := public.cc_referrer_for(entered);
  if ref is null then raise exception 'We could not find that code. Check it and try again.'; end if;
  if ref = u then raise exception 'You cannot use your own code.'; end if;

  fname := public.cc_short_name(me.name);
  update public.profiles set referred_by = ref where id = u;
  insert into public.referrals (id, user_id, name, status, reward)
  values ('ref-' || replace(gen_random_uuid()::text, '-', ''), ref, fname, 'successful', 100);
  insert into public.notifications (id, user_id, type, title, body)
  values ('ntf-' || replace(gen_random_uuid()::text, '-', ''), ref, 'referral', 'Referral reward credited',
          fname || ' joined with your code. ₹100 has been added to your balance.');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.apply_referral_code(jsonb) from public, anon;
grant execute on function public.apply_referral_code(jsonb) to authenticated;

-- Live updates (06 already publishes referrals; this adds notifications and sends whole rows so filtered updates work).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'referrals') then
      alter publication supabase_realtime add table public.referrals;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;
alter table public.referrals     replica identity full;
alter table public.notifications replica identity full;
