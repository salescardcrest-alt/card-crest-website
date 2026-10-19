-- Card Crest — run this once in Supabase → SQL Editor.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  mobile      text not null default '',
  city        text not null default '',
  employment  text not null default '',
  income      numeric not null default 0,
  credit      integer not null default 0,
  role        text not null default 'user' check (role in ('user','admin')),
  active      boolean not null default true,
  joined      date not null default current_date
);

alter table public.profiles enable row level security;

-- Users can read their own profile.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

-- Users can edit their own profile, but never role/active/email.
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (name, mobile, city, employment, income, credit) on public.profiles to authenticated;

-- Create a profile automatically whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, mobile)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'mobile', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- To make yourself an admin (run manually, never from the browser):
-- update public.profiles set role = 'admin' where email = 'you@example.com';
