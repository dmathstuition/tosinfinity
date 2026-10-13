-- Billing integrity rules enforced in the database. Idempotent.

-- Invoice numbers can only be drawn by the Owner or the server.
create or replace function public.next_invoice_number() returns text
language plpgsql security definer set search_path = public as $$
declare y int := extract(year from now())::int; n int;
begin
  if not (public.is_owner() or auth.role() = 'service_role') then raise exception 'not authorised'; end if;
  insert into public.invoice_counters (year, last_value) values (y, 1)
  on conflict (year) do update set last_value = public.invoice_counters.last_value + 1
  returning last_value into n;
  return format('INV-%s-%s', y, lpad(n::text, 4, '0'));
end $$;

-- Line items may only change while the invoice is a draft; the total always equals
-- the sum of the items, so it cannot drift from what the family is shown.
create or replace function public.invoice_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_invoice uuid := coalesce(new.invoice_id, old.invoice_id); v_status text;
begin
  select status into v_status from public.invoices where id = v_invoice for update;
  if v_status is null then
    return coalesce(new, old);   -- parent invoice is being deleted (cascade)
  end if;
  if v_status <> 'draft' then
    raise exception 'line items can only be changed while the invoice is a draft';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists invoice_items_guard on public.invoice_items;
create trigger invoice_items_guard before insert or update or delete on public.invoice_items
  for each row execute function public.invoice_items_guard();

create or replace function public.invoice_items_total() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices
     set total_minor = greatest(0, coalesce((select sum(amount_minor) from public.invoice_items where invoice_id = v_invoice), 0))
   where id = v_invoice;
  return null;
end $$;
drop trigger if exists invoice_items_total on public.invoice_items;
create trigger invoice_items_total after insert or update or delete on public.invoice_items
  for each row execute function public.invoice_items_total();

-- Once issued, an invoice's money fields are frozen. Status may move only along the
-- permitted paths; paid_minor is written solely by the payments trigger.
create or replace function public.invoices_guard() returns trigger
language plpgsql as $$
begin
  if old.status <> 'draft' then
    if new.student_id <> old.student_id or new.currency <> old.currency
       or new.period_start <> old.period_start or new.period_end <> old.period_end
       or new.number <> old.number then
      raise exception 'an issued invoice cannot be altered; cancel it and create a new one';
    end if;
    if new.total_minor <> old.total_minor then
      raise exception 'the total of an issued invoice cannot change';
    end if;
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' and old.paid_minor <> 0 then
    raise exception 'an invoice with payments cannot be cancelled';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'a cancelled invoice cannot be reopened';
  end if;
  if new.status = 'draft' and old.status <> 'draft' then
    raise exception 'an issued invoice cannot return to draft';
  end if;
  return new;
end $$;
drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard before update on public.invoices
  for each row execute function public.invoices_guard();

-- Financial records are retained: an invoice can be deleted only while it is a draft.
create or replace function public.invoices_no_delete() returns trigger
language plpgsql as $$
begin
  if old.status <> 'draft' then
    raise exception 'issued invoices are kept for audit; cancel instead of deleting';
  end if;
  return old;
end $$;
drop trigger if exists invoices_no_delete on public.invoices;
create trigger invoices_no_delete before delete on public.invoices
  for each row execute function public.invoices_no_delete();

-- A person with financial history cannot be hard-deleted (profiles → invoices is RESTRICT).
-- Deactivate the account instead; this keeps the audit trail intact.

insert into public.settings (key, value, is_public) values
  ('billing', jsonb_build_object('invoice_day', 1, 'due_days', 7, 'reminder_days_before', 3, 'auto_issue', false), false)
on conflict (key) do nothing;
