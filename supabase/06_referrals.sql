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
