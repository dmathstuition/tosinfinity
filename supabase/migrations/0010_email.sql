-- Email: a delivery log for the Owner, and per-address preferences with a secret
-- token so people can manage optional emails from a link, without signing in.
-- Idempotent.

-- What was sent, to whom, and whether it worked. Bodies are never stored (some
-- contain one-time sign-in links). Kept for 90 days by the daily job.
create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  template text not null,
  category text not null check (category in ('essential','reminders','updates','reports')),
  recipient text not null,
  status text not null check (status in ('sent','failed','skipped','logged')),
  provider text not null,
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_status_idx on public.email_log (status, created_at desc);
alter table public.email_log enable row level security;
drop policy if exists owner_read on public.email_log;
create policy owner_read on public.email_log for select to authenticated using (public.is_owner());

-- Optional emails, by address (lower case). Essential emails (sign-in links,
-- invoices, receipts) are always sent and have no switch.
create table if not exists public.email_preferences (
  email text primary key check (email = lower(email)),
  token uuid not null unique default gen_random_uuid(),
  reminders boolean not null default true,  -- lessons tomorrow, work due
  updates boolean not null default true,    -- marks, messages, announcements
  reports boolean not null default true,    -- the weekly progress email
  updated_at timestamptz not null default now()
);
alter table public.email_preferences enable row level security;
drop policy if exists owner_read on public.email_preferences;
create policy owner_read on public.email_preferences for select to authenticated using (public.is_owner());

-- From an email link: read and change preferences with the secret token.
create or replace function public.get_email_preferences(p_token uuid)
returns table (email text, reminders boolean, updates boolean, reports boolean)
language sql stable security definer set search_path = public as $$
  select regexp_replace(p.email, '^(.).*(@.*)$', '\1•••\2'), p.reminders, p.updates, p.reports
    from public.email_preferences p where p.token = p_token;
$$;

create or replace function public.set_email_preferences(p_token uuid, p_reminders boolean, p_updates boolean, p_reports boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.email_preferences
     set reminders = p_reminders, updates = p_updates, reports = p_reports, updated_at = now()
   where token = p_token;
  return found;
end $$;

-- Signed in: the caller's own address.
create or replace function public.my_email_preferences()
returns table (reminders boolean, updates boolean, reports boolean)
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  select lower(email) into v_email from public.profiles where id = auth.uid();
  if v_email is null then raise exception 'not authorised'; end if;
  insert into public.email_preferences (email) values (v_email) on conflict (email) do nothing;
  return query select p.reminders, p.updates, p.reports from public.email_preferences p where p.email = v_email;
end $$;

create or replace function public.set_my_email_preferences(p_reminders boolean, p_updates boolean, p_reports boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  select lower(email) into v_email from public.profiles where id = auth.uid();
  if v_email is null then raise exception 'not authorised'; end if;
  insert into public.email_preferences (email, reminders, updates, reports) values (v_email, p_reminders, p_updates, p_reports)
  on conflict (email) do update set reminders = excluded.reminders, updates = excluded.updates, reports = excluded.reports, updated_at = now();
end $$;

revoke execute on function public.get_email_preferences(uuid), public.set_email_preferences(uuid, boolean, boolean, boolean),
  public.my_email_preferences(), public.set_my_email_preferences(boolean, boolean, boolean) from public;
grant execute on function public.get_email_preferences(uuid), public.set_email_preferences(uuid, boolean, boolean, boolean) to anon, authenticated, service_role;
grant execute on function public.my_email_preferences(), public.set_my_email_preferences(boolean, boolean, boolean) to authenticated;

-- Account deletion (erase_account in 0009) also removes the address's row here.
