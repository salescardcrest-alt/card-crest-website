-- Card Crest — keep profiles.email in step with the login email after a confirmed email change.
-- Run in Supabase → SQL Editor. Safe to re-run.

create or replace function public.guard_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() or current_setting('app.sync_email', true) = '1' then return new; end if;
  if new.role <> old.role or new.active <> old.active or new.email <> old.email or new.id <> old.id then
    raise exception 'You cannot change role, active status or email';
  end if;
  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    perform set_config('app.sync_email', '1', true);
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
