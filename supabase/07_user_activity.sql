-- Card Crest: remember when each person was last seen, so the admin panel can show how many users are active.
-- Run in Supabase -> SQL Editor. Safe to re-run.
alter table public.profiles add column if not exists last_seen timestamptz;
grant update (last_seen) on public.profiles to authenticated;
