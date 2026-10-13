-- Web Push subscriptions (own rows only) and an immutable audit log. Idempotent.

drop policy if exists own_insert on public.push_subscriptions;
create policy own_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists own_delete on public.push_subscriptions;
create policy own_delete on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- The audit log is append-only for everyone, including the service role.
create or replace function public.audit_immutable() returns trigger
language plpgsql as $$ begin raise exception 'the audit log cannot be changed'; end $$;
drop trigger if exists audit_no_change on public.audit_log;
create trigger audit_no_change before update or delete on public.audit_log
  for each row execute function public.audit_immutable();
