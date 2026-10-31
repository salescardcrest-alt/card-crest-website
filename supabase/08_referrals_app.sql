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
