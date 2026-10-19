-- Card Crest — step 2. Run after schema.sql, in Supabase → SQL Editor.
-- Safe to re-run.

------------------------------------------------------------
-- helpers
------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

------------------------------------------------------------
-- profiles: replace column grants with a guard trigger so that
-- admins can toggle `active` while users can never touch role/active/email
------------------------------------------------------------
grant update on public.profiles to authenticated;

create or replace function public.guard_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.role <> old.role or new.active <> old.active or new.email <> old.email or new.id <> old.id then
    raise exception 'You cannot change role, active status or email';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

drop policy if exists "profiles: admin read all" on public.profiles;
create policy "profiles: admin read all" on public.profiles
  for select using (public.is_admin());

drop policy if exists "profiles: admin update all" on public.profiles;
create policy "profiles: admin update all" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

------------------------------------------------------------
-- tables
------------------------------------------------------------
create table if not exists public.transactions (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  store_id     text,
  offer_id     text,
  amount       numeric not null default 0,
  cashback     numeric not null default 0,
  status       text not null default 'clicked',
  retailer_url text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.applications (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  card_id     text not null,
  status      text not null default 'applied',
  notes       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table if not exists public.redemptions (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       numeric not null,
  method       text not null,
  destination  text,
  status       text not null default 'processing',
  ref          text,
  created_at   timestamptz not null default now()
);

create table if not exists public.referrals (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default '',
  status      text not null default 'pending',
  reward      numeric not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.notifications (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null default 'system',
  title       text not null default '',
  body        text not null default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.tickets (
  id          text primary key,
  user_id     uuid references auth.users(id) on delete set null,
  name        text,
  email       text,
  category    text,
  message     text,
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);

create table if not exists public.saved_cards (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  card_id     text not null,
  is_primary  boolean not null default false,
  saved_at    timestamptz not null default now()
);

create table if not exists public.favourites (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  offer_id    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_user_idx  on public.transactions(user_id);
create index if not exists applications_user_idx  on public.applications(user_id);
create index if not exists redemptions_user_idx   on public.redemptions(user_id);
create index if not exists referrals_user_idx     on public.referrals(user_id);
create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists saved_cards_user_idx   on public.saved_cards(user_id);

------------------------------------------------------------
-- row-level security
------------------------------------------------------------
alter table public.transactions  enable row level security;
alter table public.applications  enable row level security;
alter table public.redemptions   enable row level security;
alter table public.referrals     enable row level security;
alter table public.notifications enable row level security;
alter table public.tickets       enable row level security;
alter table public.saved_cards   enable row level security;
alter table public.favourites    enable row level security;

-- transactions: users create 'clicked' rows only; admins confirm / reject
drop policy if exists "txn select" on public.transactions;
create policy "txn select" on public.transactions for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "txn insert" on public.transactions;
create policy "txn insert" on public.transactions for insert
  with check ((user_id = auth.uid() and status = 'clicked') or public.is_admin());
drop policy if exists "txn update" on public.transactions;
create policy "txn update" on public.transactions for update
  using (public.is_admin()) with check (public.is_admin());

-- applications: users submit 'applied' rows only; admins move them along
drop policy if exists "app select" on public.applications;
create policy "app select" on public.applications for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "app insert" on public.applications;
create policy "app insert" on public.applications for insert
  with check ((user_id = auth.uid() and status = 'applied') or public.is_admin());
drop policy if exists "app update" on public.applications;
create policy "app update" on public.applications for update
  using (public.is_admin()) with check (public.is_admin());

-- redemptions: users request 'processing' rows; amount is validated by trigger below
drop policy if exists "rdm select" on public.redemptions;
create policy "rdm select" on public.redemptions for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "rdm insert" on public.redemptions;
create policy "rdm insert" on public.redemptions for insert
  with check ((user_id = auth.uid() and status = 'processing') or public.is_admin());
drop policy if exists "rdm update" on public.redemptions;
create policy "rdm update" on public.redemptions for update
  using (public.is_admin()) with check (public.is_admin());

-- referrals: read-only for users, managed by admins
drop policy if exists "ref select" on public.referrals;
create policy "ref select" on public.referrals for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "ref write" on public.referrals;
create policy "ref write" on public.referrals for all
  using (public.is_admin()) with check (public.is_admin());

-- notifications
drop policy if exists "ntf select" on public.notifications;
create policy "ntf select" on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "ntf insert" on public.notifications;
create policy "ntf insert" on public.notifications for insert
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "ntf update" on public.notifications;
create policy "ntf update" on public.notifications for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- tickets: signed-in or guest users can file one; admins handle them
drop policy if exists "tkt select" on public.tickets;
create policy "tkt select" on public.tickets for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "tkt insert" on public.tickets;
create policy "tkt insert" on public.tickets for insert
  with check (user_id = auth.uid() or user_id is null);
drop policy if exists "tkt update" on public.tickets;
create policy "tkt update" on public.tickets for update
  using (public.is_admin()) with check (public.is_admin());

-- saved cards & favourites: full control over your own rows
drop policy if exists "saved own" on public.saved_cards;
create policy "saved own" on public.saved_cards for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "fav own" on public.favourites;
create policy "fav own" on public.favourites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

------------------------------------------------------------
-- redemption guard: minimum 250 and never more than the balance
------------------------------------------------------------
create or replace function public.check_redemption()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare available numeric;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;

  select
      coalesce((select sum(cashback) from public.transactions where user_id = new.user_id and status = 'confirmed'), 0)
    + coalesce((select sum(reward)   from public.referrals    where user_id = new.user_id and status = 'successful'), 0)
    - coalesce((select sum(amount)   from public.redemptions  where user_id = new.user_id and status <> 'rejected'), 0)
  into available;

  if new.amount < 250 then raise exception 'The minimum redemption is 250'; end if;
  if new.amount > available then raise exception 'Amount is more than your available balance'; end if;
  return new;
end;
$$;

drop trigger if exists check_redemption on public.redemptions;
create trigger check_redemption before insert on public.redemptions
  for each row execute function public.check_redemption();

------------------------------------------------------------
-- welcome notification now comes from the server
------------------------------------------------------------
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
  insert into public.notifications (id, user_id, type, title, body)
  values (
    'ntf-' || replace(gen_random_uuid()::text, '-', ''),
    new.id, 'system', 'Welcome to Card Crest',
    'Start by checking which cards you are eligible for.'
  );
  return new;
end;
$$;
